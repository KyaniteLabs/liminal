/**
 * LivingSiteDaemon — orchestrates the living website evolution cycle.
 *
 * For each managed slot, the daemon:
 * 1. Checks if challenger has enough PostHog data to evaluate
 * 2. Promotes winners and discards losers
 * 3. Generates new challengers for slots that need them
 * 4. Deploys variant HTML to the nginx-served directory
 * 5. Creates PostHog feature flags for A/B experiments
 *
 * Gated on LIMINAL_POSTHOG_KEY — all operations are no-ops without it.
 */

import {
	SlotManager,
	type SiteSlot,
	type SlotVariant,
} from "../site/SlotManager.js";
import { EngagementFitness } from "../evolution/EngagementFitness.js";
import { FitnessCombiner } from "../evolution/FitnessCombiner.js";
import { PostHogClient } from "../analytics/PostHogClient.js";
import { HTMLWrapper } from "../utils/htmlWrapper.js";
import { MapElites } from "../evolution/MapElites.js";
import { RenderAndScorePipeline } from "../render/RenderAndScorePipeline.js";
import { RalphLoop } from "../core/RalphLoop.js";
import type { LoopOptions } from "../core/LoopConfig.js";
import { Domain } from "../types/domains.js";
import { registerAllGenerators } from "../generators/registerGenerators.js";
import { Logger } from "../utils/Logger.js";
import { randomBytes } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export interface DaemonConfig {
	/** Directory to write variant HTML files (served by nginx) */
	assetDir: string;
	/** Minimum visitors per variant before evaluating A/B results */
	minSampleSize: number;
	/** Default cycle interval in milliseconds (6h = 21600000) */
	cycleIntervalMs: number;
	/** Number of days between wildcard (novelty-biased) generations */
	wildcardIntervalDays: number;
	/** Minimum visual score to deploy a variant (0-1) */
	minVisualScore: number;
}

export const DEFAULT_DAEMON_CONFIG: DaemonConfig = {
	assetDir: "/var/www/kyanitelabs/liminal-asset",
	minSampleSize: 200,
	cycleIntervalMs: 21_600_000, // 6 hours
	wildcardIntervalDays: 7,
	minVisualScore: 0.65,
};

export class LivingSiteDaemon {
	private readonly engagement = new EngagementFitness();
	private readonly slotGrids = new Map<string, MapElites>();
	private generatorsRegistered = false;

	constructor(
		private readonly slotManager: SlotManager,
		private readonly posthog: PostHogClient,
		private readonly config: DaemonConfig = DEFAULT_DAEMON_CONFIG,
	) {}

	/** Ensure generators are registered (idempotent) */
	private async ensureGenerators(): Promise<void> {
		if (this.generatorsRegistered) return;
		await registerAllGenerators();
		this.generatorsRegistered = true;
		Logger.info("LivingSiteDaemon", "Generators registered");
	}

	/**
	 * Run a single evolution cycle.
	 * For each slot: evaluate challengers → promote → generate new challengers.
	 */
	async runCycle(dryRun = false): Promise<void> {
		if (!this.posthog.isConfigured()) {
			Logger.info("LivingSiteDaemon", "PostHog not configured, skipping cycle");
			return;
		}

		const slots = this.slotManager.getAllSlots();

		for (const slot of slots) {
			// 1. Evaluate challenger if one exists
			if (slot.challenger) {
				await this.evaluateChallenger(slot, dryRun);
			}

			// 2. Generate new challenger if needed
			if (this.slotManager.needsChallenger(slot.id)) {
				await this.generateAndDeployChallenger(slot, dryRun);
			}
		}

		// Save state after cycle
		if (!dryRun) {
			await this.slotManager.save();
		}
	}

	/**
	 * Evaluate a challenger variant against the active variant.
	 * Promotes the challenger if it has higher engagement.
	 */
	async evaluateChallenger(slot: SiteSlot, dryRun: boolean): Promise<void> {
		if (!slot.challenger) return;

		const [activeResult, challengerResult] = await Promise.all([
			this.posthog.getVariantEngagementMetrics(slot.active.experimentId),
			this.posthog.getVariantEngagementMetrics(slot.challenger.experimentId),
		]);

		if (
			!activeResult ||
			!challengerResult ||
			activeResult.visitors < this.config.minSampleSize ||
			challengerResult.visitors < this.config.minSampleSize
		) {
			this.posthog.trackEvent("liminal_challenger_waiting_for_samples", {
				slotId: slot.id,
				challengerExperimentId: slot.challenger.experimentId,
				activeExperimentId: slot.active.experimentId,
				activeVisitors: activeResult?.visitors ?? 0,
				challengerVisitors: challengerResult?.visitors ?? 0,
				minSampleSize: this.config.minSampleSize,
				dryRun,
			});
			return;
		}

		const activeScore = this.engagement.score(activeResult.metrics);
		const challengerScore = this.engagement.score(challengerResult.metrics);
		const challengerWins = challengerScore > activeScore;

		this.posthog.trackEvent("liminal_challenger_evaluated", {
			slotId: slot.id,
			challengerExperimentId: slot.challenger.experimentId,
			activeExperimentId: slot.active.experimentId,
			activeScore,
			challengerScore,
			dryRun,
		});

		if (challengerWins) {
			if (!dryRun) {
				this.slotManager.promoteChallenger(slot.id);
			}
			this.posthog.trackEvent("liminal_challenger_promoted", {
				slotId: slot.id,
				challengerExperimentId: challengerResult.variantId,
				activeExperimentId: activeResult.variantId,
				activeScore,
				challengerScore,
				dryRun,
			});
			Logger.info("LivingSiteDaemon", `Promoted challenger for slot ${slot.id}`);
			return;
		}

		if (!dryRun) {
			this.slotManager.clearChallenger(slot.id);
		}
		this.posthog.trackEvent("liminal_challenger_rejected", {
			slotId: slot.id,
			challengerExperimentId: challengerResult.variantId,
			activeExperimentId: activeResult.variantId,
			activeScore,
			challengerScore,
			dryRun,
		});
		Logger.info("LivingSiteDaemon", `Rejected challenger for slot ${slot.id}`);
	}

	/**
	 * Generate a new variant using real LLM inference, wrap it, and deploy as challenger.
	 * Uses GeneratorRegistry to dispatch to the right generator (p5, GLSL, Three, etc.)
	 * based on the slot's configured domains.
	 */
	async generateAndDeployChallenger(
		slot: SiteSlot,
		dryRun: boolean,
	): Promise<void> {
		await this.ensureGenerators();

		const hash = randomBytes(6).toString("hex");
		const filename = `${slot.id}-${hash}.html`;
		const htmlPath = join(this.config.assetDir, filename);

		// Build a brand-specific creative prompt for this slot.
		const isWildcard = this.isWildcardDay();
		const prompt = this.buildCreativePrompt(slot, isWildcard);

		// Use RalphLoop so living-site output gets iterative generation, evaluation,
		// repair, and render scoring instead of a single-shot prompt response.
		const loopResult = await RalphLoop.run(
			prompt,
			this.buildRalphLoopOptions(slot),
		);
		const code = loopResult.code;
		const model = loopResult.model ?? "unknown";

		if (!code || code.trim().length < 20) {
			Logger.error(
				"LivingSiteDaemon",
				`Generation produced insufficient output (${code?.length ?? 0} chars), skipping`,
			);
			return;
		}

		const detectedDomain = HTMLWrapper.detectDomain(code);
		const renderScore = await this.scoreVariantForDeploy(code, detectedDomain);
		if (!this.passesVisualDeployGate(renderScore)) {
			this.posthog.trackEvent("liminal_variant_rejected", {
				slotId: slot.id,
				variantHash: hash,
				reason: renderScore.success ? "visual_score_below_threshold" : "render_failed",
				visualScore: renderScore.score,
				minVisualScore: this.config.minVisualScore,
				error: renderScore.error,
				dryRun,
			});
			Logger.warn(
				"LivingSiteDaemon",
				`Rejected challenger for ${slot.id}: visual score ${renderScore.score.toFixed(2)} below ${this.config.minVisualScore.toFixed(2)}`,
			);
			return;
		}

		// Wrap in HTML with PostHog injection
		const html = HTMLWrapper.wrap(code);

		if (!dryRun) {
			await mkdir(this.config.assetDir, { recursive: true });
			await writeFile(htmlPath, html, "utf-8");
		}

		const variant: SlotVariant = {
			htmlPath,
			experimentId: `liminal-${slot.id}-${hash}`,
			fitness: renderScore.score,
			deployedAt: new Date().toISOString(),
			model,
			domain:
				detectedDomain === "p5"
					? Domain.P5
					: detectedDomain === "three"
						? Domain.THREE
						: detectedDomain === "shader"
							? Domain.SHADER
							: Domain.P5,
		};

		this.slotManager.setChallenger(slot.id, variant);

		this.posthog.trackEvent("liminal_variant_generated", {
			slotId: slot.id,
			variantHash: hash,
			experimentId: variant.experimentId,
			model,
			codeLength: code.length,
			visualScore: renderScore.score,
			minVisualScore: this.config.minVisualScore,
			dryRun,
		});

		Logger.info(
			"LivingSiteDaemon",
			`Generated challenger for ${slot.id}: ${filename} (${code.length} chars, model: ${model})`,
		);
	}

	/**
	 * Build a brand-specific generation prompt for a website slot.
	 */
	buildCreativePrompt(slot: SiteSlot, wildcard: boolean): string {
		const noveltyBrief = wildcard
			? "This is a controlled wildcard: introduce one memorable visual surprise. Do not abandon the KyaniteLabs brand system."
			: "Create a refined, brand-consistent visual that feels intentional rather than decorative.";

		return [
			"Generate one production-quality creative-coded website visual for KyaniteLabs.",
			`Slot: ${slot.id}`,
			`Page: ${slot.page}`,
			`Target creative domain: ${slot.domains[0]}`,
			"Brand: KyaniteLabs is an operator lab for verifiable AI tools, implementation help, creative coding, and agent-system field notes.",
			"Taste direction: premium technical, calm but alive, more declassified instrument panel than generic SaaS confetti.",
			"Palette: deep ink background, kyanite blue highlights, cool cyan glows, restrained violet accents, warm off-white text contrast.",
			"Motion: slow, precise, legible, ambient; use generative movement that suggests signal, proof, traces, constellations, instrumentation, or evolving systems.",
			"Composition: leave breathing room for real website copy; avoid covering text; make it work as a section accent or background layer.",
			"Quality bar: avoid generic AI art, rainbow particles, noisy blobs, random bouncing balls, over-saturated gradients, cheap neon, and template-looking hero effects.",
			"Technical constraints: browser-smooth, self-contained, no external assets, no network requests, no eval/new Function, no console spam.",
			noveltyBrief,
			"Return only valid creative code for the selected domain.",
		].join("\n");
	}

	/**
	 * RalphLoop options for high-quality living-site generation.
	 */
	buildRalphLoopOptions(slot: SiteSlot): LoopOptions {
		return {
			maxIterations: 5,
			minQualityScore: 0.78,
			collabDomain: slot.domains[0],
			evaluationCriteria: [
				"aesthetic",
				"technical",
				"novelty",
				"emergence",
				"interestingness",
			],
			useRenderScoring: true,
			renderScoringOptions: {
				scoreVisual: true,
				scoreAudio: false,
				timeout: 30_000,
			},
			useAestheticGuardrails: true,
			useHumanPerceptionGuardrails: true,
			useEvolution: true,
			tolerateErrors: false,
			project: "kyanitelabs-living-site",
		};
	}

	/**
	 * Render-score a generated variant before allowing deployment.
	 */
	async scoreVariantForDeploy(
		code: string,
		detectedDomain: ReturnType<typeof HTMLWrapper.detectDomain>,
	): Promise<{ success: boolean; score: number; error?: string }> {
		const pipeline = new RenderAndScorePipeline({
			scoreVisual: true,
			scoreAudio: false,
			timeout: 30_000,
		});
		try {
			const domainHint = detectedDomain === "three" ? "three" : detectedDomain === "shader" ? "glsl" : "p5";
			return await pipeline.process(code, domainHint);
		} catch (error) {
			return {
				success: false,
				score: 0,
				error: error instanceof Error ? error.message : String(error),
			};
		} finally {
			await pipeline.close();
		}
	}

	/**
	 * Conservative deploy gate: failed renders and weak visuals do not reach nginx.
	 */
	passesVisualDeployGate(result: { success: boolean; score: number }): boolean {
		return result.success && result.score >= this.config.minVisualScore;
	}

	/**
	 * Check if today is a wildcard day (novelty-biased generation).
	 */
	isWildcardDay(lastWildcardDate?: string): boolean {
		if (!lastWildcardDate) return true;
		const last = new Date(lastWildcardDate);
		const now = new Date();
		const daysSince = (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24);
		return daysSince >= this.config.wildcardIntervalDays;
	}

	/**
	 * Get or create a MAP-Elites grid for a specific slot.
	 */
	getGridForSlot(slotId: string, dims: number[] = [10, 10]): MapElites {
		let grid = this.slotGrids.get(slotId);
		if (!grid) {
			grid = new MapElites(dims);
			this.slotGrids.set(slotId, grid);
		}
		return grid;
	}

	/**
	 * Create a FitnessCombiner with optional wildcard-biased weights.
	 */
	createFitnessCombiner(wildcard = false): FitnessCombiner {
		if (wildcard) {
			return new FitnessCombiner({
				novelty: 0.5,
				quality: 0.2,
				technical: 0.1,
				diversity: 0.1,
				engagement: 0.1,
			});
		}
		return new FitnessCombiner();
	}
}
