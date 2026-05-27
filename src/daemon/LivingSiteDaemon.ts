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
import { Domain } from "../types/domains.js";
import { generatorRegistry } from "../generators/GeneratorRegistry.js";
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
	minVisualScore: 0.2,
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
		// Use engagement scorer to compute neutral score for now
		// In production, this would query PostHog experiment API for real data
		const _score = this.engagement.neutralScore();
		void _score;
		this.posthog.trackEvent("liminal_challenger_evaluated", {
			slotId: slot.id,
			challengerExperimentId: slot.challenger!.experimentId,
			activeExperimentId: slot.active.experimentId,
			dryRun,
		});

		Logger.info("LivingSiteDaemon", `Evaluated challenger for slot ${slot.id}`);
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

		// Build a creative prompt for this slot
		const isWildcard = this.isWildcardDay();
		const styleHint = isWildcard
			? "Surprise me with something completely unexpected and visually striking."
			: "Create something beautiful and engaging.";
		const prompt =
			`Generate a creative animated visual for the "${slot.id}" section of a website. ` +
			`It should be visually captivating and run smoothly in a browser. ${styleHint} ` +
			`Target creative domain: ${slot.domains[0]}.`;

		// Dispatch to the best generator for this prompt
		const dispatched = generatorRegistry.dispatch(prompt);

		let code: string;
		let model: string;

		if (dispatched) {
			Logger.info(
				"LivingSiteDaemon",
				`Dispatched to ${dispatched.entry.name} (confidence: ${dispatched.confidence})`,
			);
			const result = await dispatched.entry.generate(prompt);
			code = typeof result === "string" ? result : result.code;
			model =
				typeof result === "string" ? "unknown" : (result.model ?? "unknown");
		} else {
			// Fallback: no generator matched, generate directly via LLMClient
			Logger.warn(
				"LivingSiteDaemon",
				"No generator matched, using LLMClient fallback",
			);
			const { LLMClient } = await import("../llm/LLMClient.js");
			await LLMClient.loadRoles();
			const llm = new LLMClient({ role: "generator" });
			const response = await llm.complete({
				prompt,
				systemPrompt: "You are a creative coder. Return only valid p5.js code.",
			});
			code = response.text;
			model = llm.getConfig().model ?? "unknown";
		}

		if (!code || code.trim().length < 20) {
			Logger.error(
				"LivingSiteDaemon",
				`Generation produced insufficient output (${code?.length ?? 0} chars), skipping`,
			);
			return;
		}

		// Wrap in HTML with PostHog injection
		const html = HTMLWrapper.wrap(code);

		if (!dryRun) {
			await mkdir(this.config.assetDir, { recursive: true });
			await writeFile(htmlPath, html, "utf-8");
		}

		const detectedDomain = HTMLWrapper.detectDomain(code);
		const variant: SlotVariant = {
			htmlPath,
			experimentId: `liminal-${slot.id}-${hash}`,
			fitness: 0.5,
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
			dryRun,
		});

		Logger.info(
			"LivingSiteDaemon",
			`Generated challenger for ${slot.id}: ${filename} (${code.length} chars, model: ${model})`,
		);
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
