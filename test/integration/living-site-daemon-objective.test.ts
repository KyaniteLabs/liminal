/**
 * Integration: living-site daemon objective-function semantics (ADR 0002).
 *
 * Proves end-to-end through the REAL daemon decision path that:
 *   - the objective function is AESTHETIC/visual fitness, and
 *   - PostHog engagement is telemetry + a tiebreaker only — never the objective.
 *
 * Real modules exercised together: LivingSiteDaemon + SlotManager + EngagementFitness
 * (engagement scores are computed for real from the metrics). Only true boundaries are
 * mocked: PostHog (network) is spied on a real client; the LLM (RalphLoop), the render
 * pipeline (RenderAndScorePipeline) and generator registration are mocked for the
 * visual-gate path so no real model or browser is invoked.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
	ralphRun: vi.fn(),
	pipelineProcess: vi.fn(),
	pipelineClose: vi.fn(),
	registerGenerators: vi.fn(async () => {}),
}));

vi.mock("../../src/core/RalphLoop.js", () => ({
	RalphLoop: { run: mocks.ralphRun },
}));
vi.mock("../../src/render/RenderAndScorePipeline.js", () => ({
	RenderAndScorePipeline: class {
		process = mocks.pipelineProcess;
		close = mocks.pipelineClose;
	},
}));
vi.mock("../../src/generators/registerGenerators.js", () => ({
	registerAllGenerators: mocks.registerGenerators,
}));

import {
	LivingSiteDaemon,
	DEFAULT_DAEMON_CONFIG,
} from "../../src/daemon/LivingSiteDaemon.js";
import {
	SlotManager,
	type SiteSlot,
	type SlotVariant,
} from "../../src/site/SlotManager.js";
import { PostHogClient } from "../../src/analytics/PostHogClient.js";
import type { EngagementMetrics } from "../../src/evolution/EngagementFitness.js";
import { Domain } from "../../src/types/domains.js";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/** Uniform metrics → EngagementFitness.score returns exactly `v` (weights sum to 1). */
function uniformMetrics(v: number): EngagementMetrics {
	return { dwellRate: v, scrollDepth: v, interactionRate: v, retentionScore: v };
}

function makeVariant(overrides: Partial<SlotVariant> = {}): SlotVariant {
	return {
		htmlPath: "/tmp/variant.html",
		experimentId: "exp",
		fitness: 0.7,
		deployedAt: new Date().toISOString(),
		model: "test-model",
		domain: Domain.P5,
		...overrides,
	};
}

function makeSlot(active: SlotVariant, challenger: SlotVariant | null): SiteSlot {
	return {
		id: "home-hero",
		page: "/",
		domains: [Domain.P5],
		active,
		challenger,
	};
}

/** Mock PostHog engagement metrics keyed by experimentId, with enough visitors to evaluate. */
function mockEngagement(
	ph: PostHogClient,
	byExperiment: Record<string, number>,
	visitors = 250,
) {
	return vi
		.spyOn(ph, "getVariantEngagementMetrics")
		.mockImplementation(async (experimentId: string) => {
			const score = byExperiment[experimentId];
			if (score === undefined) return null;
			return {
				variantId: experimentId,
				visitors,
				metrics: uniformMetrics(score),
			};
		});
}

describe("LivingSiteDaemon objective-function semantics (ADR 0002)", () => {
	let tmpDir: string;
	let sm: SlotManager;
	let ph: PostHogClient;
	let daemon: LivingSiteDaemon;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "sinter-objective-"));
		sm = new SlotManager(join(tmpDir, "slots.json"));
		ph = new PostHogClient(); // unconfigured; engagement + trackEvent are spied per test
		daemon = new LivingSiteDaemon(sm, ph, {
			...DEFAULT_DAEMON_CONFIG,
			assetDir: tmpDir,
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		mocks.ralphRun.mockReset();
		mocks.pipelineProcess.mockReset();
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("(a) does NOT promote a higher-engagement challenger when its aesthetic fitness is lower", async () => {
		const active = makeVariant({ experimentId: "active-A", fitness: 0.85 });
		const challenger = makeVariant({ experimentId: "chal-A", fitness: 0.7 });
		sm.setSlot(makeSlot(active, challenger));
		// Challenger engagement is far higher (0.95 vs 0.10) — under the old policy it would win.
		mockEngagement(ph, { "active-A": 0.1, "chal-A": 0.95 });
		const track = vi.spyOn(ph, "trackEvent");

		await daemon.evaluateChallenger(sm.getSlot("home-hero")!, false);

		// Aesthetic is the objective → the lower-aesthetic challenger loses despite higher engagement.
		expect(sm.getSlot("home-hero")!.active.experimentId).toBe("active-A");
		expect(sm.getSlot("home-hero")!.challenger).toBeNull();
		// Telemetry recorded the (higher) challenger engagement, proving it was seen but not decisive.
		expect(track).toHaveBeenCalledWith(
			"liminal_challenger_evaluated",
			expect.objectContaining({
				activeAesthetic: 0.85,
				challengerAesthetic: 0.7,
				activeScore: expect.closeTo(0.1, 5),
				challengerScore: expect.closeTo(0.95, 5),
			}),
		);
		expect(track).toHaveBeenCalledWith(
			"liminal_challenger_rejected",
			expect.objectContaining({ dryRun: false }),
		);
		expect(track).not.toHaveBeenCalledWith(
			"liminal_challenger_promoted",
			expect.anything(),
		);
	});

	it("(b) uses engagement as the tiebreaker when aesthetic fitness is within the epsilon", async () => {
		// Aesthetic delta 0.01 < AESTHETIC_TIE_EPSILON (0.02) → a tie → engagement decides.
		const active = makeVariant({ experimentId: "active-B", fitness: 0.7 });
		const challenger = makeVariant({ experimentId: "chal-B", fitness: 0.71 });
		sm.setSlot(makeSlot(active, challenger));
		mockEngagement(ph, { "active-B": 0.2, "chal-B": 0.9 });
		const track = vi.spyOn(ph, "trackEvent");

		await daemon.evaluateChallenger(sm.getSlot("home-hero")!, false);

		// Higher-engagement challenger wins the tie and is promoted to active.
		expect(sm.getSlot("home-hero")!.active.experimentId).toBe("chal-B");
		expect(sm.getSlot("home-hero")!.challenger).toBeNull();
		expect(track).toHaveBeenCalledWith(
			"liminal_challenger_promoted",
			expect.objectContaining({
				activeScore: expect.closeTo(0.2, 5),
				challengerScore: expect.closeTo(0.9, 5),
			}),
		);
	});

	it("(c) rejects a challenger below the 0.65 visual gate, without consulting engagement", async () => {
		const active = makeVariant({ experimentId: "active-C", fitness: 0.8 });
		sm.setSlot(makeSlot(active, null));
		mocks.ralphRun.mockResolvedValue({
			code: "function setup(){createCanvas(400,400);} function draw(){background(0);ellipse(200,200,80,80);}",
			model: "mock-gate",
		});
		// Render scores below the 0.65 deploy gate.
		mocks.pipelineProcess.mockResolvedValue({ success: true, score: 0.5 });
		const engagement = mockEngagement(ph, { "active-C": 0.9 });
		const track = vi.spyOn(ph, "trackEvent");

		await daemon.generateAndDeployChallenger(sm.getSlot("home-hero")!, true);

		// Gate rejects it; no challenger is ever set.
		expect(sm.getSlot("home-hero")!.challenger).toBeNull();
		expect(track).toHaveBeenCalledWith(
			"liminal_variant_rejected",
			expect.objectContaining({
				reason: "visual_score_below_threshold",
				visualScore: 0.5,
				minVisualScore: 0.65,
			}),
		);
		// The visual gate is engagement-independent: engagement is never queried here.
		expect(engagement).toHaveBeenCalledTimes(0);
	});

	it("(d) promotes on aesthetic fitness even when engagement is LOWER, and records promotion telemetry", async () => {
		const active = makeVariant({ experimentId: "active-D", fitness: 0.6 });
		const challenger = makeVariant({ experimentId: "chal-D", fitness: 0.9 });
		sm.setSlot(makeSlot(active, challenger));
		// Challenger has the WORSE engagement (0.15 vs 0.85) but the BETTER aesthetic fitness.
		mockEngagement(ph, { "active-D": 0.85, "chal-D": 0.15 });
		const track = vi.spyOn(ph, "trackEvent");

		await daemon.evaluateChallenger(sm.getSlot("home-hero")!, false);

		// Aesthetic objective promotes it regardless of the lower engagement.
		expect(sm.getSlot("home-hero")!.active.experimentId).toBe("chal-D");
		expect(sm.getSlot("home-hero")!.challenger).toBeNull();
		// Promotion telemetry fires (engagement is recorded, not the decider).
		expect(track).toHaveBeenCalledWith(
			"liminal_challenger_promoted",
			expect.objectContaining({
				activeScore: expect.closeTo(0.85, 5),
				challengerScore: expect.closeTo(0.15, 5),
			}),
		);
	});
});
