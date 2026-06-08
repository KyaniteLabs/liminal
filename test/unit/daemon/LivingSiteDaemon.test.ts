import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	LivingSiteDaemon,
	DEFAULT_DAEMON_CONFIG,
} from "../../../src/daemon/LivingSiteDaemon.js";
import {
	SlotManager,
	type SiteSlot,
	type SlotVariant,
} from "../../../src/site/SlotManager.js";
import { PostHogClient } from "../../../src/analytics/PostHogClient.js";
import { Domain } from "../../../src/types/domains.js";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

function makeVariant(overrides: Partial<SlotVariant> = {}): SlotVariant {
	return {
		htmlPath: "/tmp/test-variant.html",
		experimentId: "sinter-test",
		fitness: 0.7,
		deployedAt: new Date().toISOString(),
		model: "test-model",
		domain: Domain.P5,
		...overrides,
	};
}

function makeSlot(overrides: Partial<SiteSlot> = {}): SiteSlot {
	return {
		id: "home-hero",
		page: "/",
		domains: [Domain.P5, Domain.THREE],
		active: makeVariant({ experimentId: "active-1" }),
		challenger: null,
		...overrides,
	};
}

describe("LivingSiteDaemon", () => {
	let tmpDir: string;
	let statePath: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "sinter-daemon-test-"));
		statePath = join(tmpDir, "slots.json");
		process.env.LIMINAL_POSTHOG_KEY = "phc_test_daemon";
	});

	function cleanup() {
		delete process.env.LIMINAL_POSTHOG_KEY;
		if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
	}

	describe("runCycle", () => {
		it("skips cycle when PostHog is not configured", async () => {
			delete process.env.LIMINAL_POSTHOG_KEY;
			const sm = new SlotManager(statePath);
			const ph = new PostHogClient();
			const daemon = new LivingSiteDaemon(sm, ph, {
				...DEFAULT_DAEMON_CONFIG,
				assetDir: tmpDir,
			});
			sm.setSlot(makeSlot());
			await daemon.runCycle();
			// Should not throw, should not generate challenger
			expect(sm.getSlot("home-hero")!.challenger).toBeNull();
			cleanup();
		});

		it("generates challenger for slot that needs one", async () => {
			const sm = new SlotManager(statePath);
			const ph = new PostHogClient();
			const daemon = new LivingSiteDaemon(sm, ph, {
				...DEFAULT_DAEMON_CONFIG,
				assetDir: tmpDir,
			});
			sm.setSlot(makeSlot());

			// Spy on generateAndDeployChallenger to avoid real LLM calls
			vi.spyOn(daemon, "generateAndDeployChallenger").mockImplementation(
				async (slot: SiteSlot, _dryRun: boolean) => {
					sm.setChallenger(slot.id, {
						htmlPath: "/tmp/test-challenger.html",
						experimentId: `sinter-${slot.id}-abc123`,
						fitness: 0.5,
						deployedAt: new Date().toISOString(),
						model: "mock-model",
						domain: Domain.P5,
					});
				},
			);

				await daemon.runCycle();
				expect(sm.getSlot("home-hero")!.challenger).toMatchObject({
					experimentId: "sinter-home-hero-abc123",
					fitness: 0.5,
					model: "mock-model",
					domain: Domain.P5,
				});
				cleanup();
			});

		it("does not deploy files in dry-run mode", async () => {
			const sm = new SlotManager(statePath);
			const ph = new PostHogClient();
			const daemon = new LivingSiteDaemon(sm, ph, {
				...DEFAULT_DAEMON_CONFIG,
				assetDir: tmpDir,
			});
			sm.setSlot(makeSlot());

			// Spy on generateAndDeployChallenger to avoid real LLM calls
			vi.spyOn(daemon, "generateAndDeployChallenger").mockImplementation(
				async (slot: SiteSlot, _dryRun: boolean) => {
					sm.setChallenger(slot.id, {
						htmlPath: "/tmp/test-challenger.html",
						experimentId: `sinter-${slot.id}-abc123`,
						fitness: 0.5,
						deployedAt: new Date().toISOString(),
						model: "mock-model",
						domain: Domain.P5,
					});
				},
			);

				await daemon.runCycle(true); // dry-run
				// Challenger should be set in memory but file not written
				expect(sm.getSlot("home-hero")!.challenger).toMatchObject({
					experimentId: "sinter-home-hero-abc123",
					fitness: 0.5,
				});
				cleanup();
			});
	});

	describe("evaluateChallenger", () => {
		it("promotes challenger when it has higher aesthetic fitness", async () => {
			const sm = new SlotManager(statePath);
			const ph = new PostHogClient();
			const active = makeVariant({ experimentId: "active-1", fitness: 0.4 });
			const challenger = makeVariant({ experimentId: "challenger-1", fitness: 0.7 });
			sm.setSlot(makeSlot({ active, challenger }));
			vi.spyOn(ph, "getVariantEngagementMetrics")
				.mockResolvedValueOnce({
					variantId: active.experimentId,
					visitors: 250,
					metrics: { dwellRate: 0.2, scrollDepth: 0.2, interactionRate: 0.2, retentionScore: 0.2 },
				})
				.mockResolvedValueOnce({
					variantId: challenger.experimentId,
					visitors: 250,
					metrics: { dwellRate: 0.9, scrollDepth: 0.9, interactionRate: 0.9, retentionScore: 0.9 },
				});
			vi.spyOn(ph, "trackEvent");
			const daemon = new LivingSiteDaemon(sm, ph, { ...DEFAULT_DAEMON_CONFIG, assetDir: tmpDir });

			await daemon.evaluateChallenger(sm.getSlot("home-hero")!, false);

			expect(sm.getSlot("home-hero")!.active.experimentId).toBe("challenger-1");
			expect(sm.getSlot("home-hero")!.challenger).toBeNull();
			expect(ph.trackEvent).toHaveBeenCalledWith(
				"liminal_challenger_promoted",
				expect.objectContaining({
					activeScore: expect.closeTo(0.2),
					challengerScore: expect.closeTo(0.9),
				}),
			);
			cleanup();
		});

		it("keeps active variant when challenger has lower aesthetic fitness", async () => {
			const sm = new SlotManager(statePath);
			const ph = new PostHogClient();
			const active = makeVariant({ experimentId: "active-1", fitness: 0.8 });
			const challenger = makeVariant({ experimentId: "challenger-1", fitness: 0.7 });
			sm.setSlot(makeSlot({ active, challenger }));
			vi.spyOn(ph, "getVariantEngagementMetrics")
				.mockResolvedValueOnce({
					variantId: active.experimentId,
					visitors: 250,
					metrics: { dwellRate: 0.8, scrollDepth: 0.8, interactionRate: 0.8, retentionScore: 0.8 },
				})
				.mockResolvedValueOnce({
					variantId: challenger.experimentId,
					visitors: 250,
					metrics: { dwellRate: 0.3, scrollDepth: 0.3, interactionRate: 0.3, retentionScore: 0.3 },
				});
			const daemon = new LivingSiteDaemon(sm, ph, { ...DEFAULT_DAEMON_CONFIG, assetDir: tmpDir });

			await daemon.evaluateChallenger(sm.getSlot("home-hero")!, false);

			expect(sm.getSlot("home-hero")!.active.experimentId).toBe("active-1");
			expect(sm.getSlot("home-hero")!.challenger).toBeNull();
			cleanup();
		});

		it("waits when either variant lacks enough engagement samples", async () => {
			const sm = new SlotManager(statePath);
			const ph = new PostHogClient();
			sm.setSlot(makeSlot({ challenger: makeVariant({ experimentId: "challenger-1" }) }));
			vi.spyOn(ph, "getVariantEngagementMetrics").mockResolvedValue(null);
			const daemon = new LivingSiteDaemon(sm, ph, { ...DEFAULT_DAEMON_CONFIG, assetDir: tmpDir });

				await daemon.evaluateChallenger(sm.getSlot("home-hero")!, false);

				expect(sm.getSlot("home-hero")!.challenger).toMatchObject({
					experimentId: "challenger-1",
				});
				cleanup();
			});

		it("does not promote on engagement alone when aesthetic fitness is lower (ADR 0002: PostHog is a sensorium, not the objective)", async () => {
			const sm = new SlotManager(statePath);
			const ph = new PostHogClient();
			const active = makeVariant({ experimentId: "active-1", fitness: 0.8 });
			const challenger = makeVariant({ experimentId: "challenger-1", fitness: 0.5 });
			sm.setSlot(makeSlot({ active, challenger }));
			// Engagement strongly favors the challenger; aesthetic fitness favors the active.
			vi.spyOn(ph, "getVariantEngagementMetrics")
				.mockResolvedValueOnce({
					variantId: active.experimentId,
					visitors: 250,
					metrics: { dwellRate: 0.2, scrollDepth: 0.2, interactionRate: 0.2, retentionScore: 0.2 },
				})
				.mockResolvedValueOnce({
					variantId: challenger.experimentId,
					visitors: 250,
					metrics: { dwellRate: 0.9, scrollDepth: 0.9, interactionRate: 0.9, retentionScore: 0.9 },
				});
			const daemon = new LivingSiteDaemon(sm, ph, { ...DEFAULT_DAEMON_CONFIG, assetDir: tmpDir });

			await daemon.evaluateChallenger(sm.getSlot("home-hero")!, false);

			// Aesthetic fitness is the objective → higher engagement must NOT win.
			expect(sm.getSlot("home-hero")!.active.experimentId).toBe("active-1");
			expect(sm.getSlot("home-hero")!.challenger).toBeNull();
			cleanup();
		});

		it("uses engagement as a tiebreaker when aesthetic fitness is ~equal", async () => {
			const sm = new SlotManager(statePath);
			const ph = new PostHogClient();
			const active = makeVariant({ experimentId: "active-1", fitness: 0.7 });
			const challenger = makeVariant({ experimentId: "challenger-1", fitness: 0.71 });
			sm.setSlot(makeSlot({ active, challenger }));
			// Aesthetic delta (0.01) is within the tie epsilon → engagement decides.
			vi.spyOn(ph, "getVariantEngagementMetrics")
				.mockResolvedValueOnce({
					variantId: active.experimentId,
					visitors: 250,
					metrics: { dwellRate: 0.2, scrollDepth: 0.2, interactionRate: 0.2, retentionScore: 0.2 },
				})
				.mockResolvedValueOnce({
					variantId: challenger.experimentId,
					visitors: 250,
					metrics: { dwellRate: 0.9, scrollDepth: 0.9, interactionRate: 0.9, retentionScore: 0.9 },
				});
			const daemon = new LivingSiteDaemon(sm, ph, { ...DEFAULT_DAEMON_CONFIG, assetDir: tmpDir });

			await daemon.evaluateChallenger(sm.getSlot("home-hero")!, false);

			expect(sm.getSlot("home-hero")!.active.experimentId).toBe("challenger-1");
			expect(sm.getSlot("home-hero")!.challenger).toBeNull();
			cleanup();
		});
	});

	describe("injectVariantEngagementTracking", () => {
		it("adds variant-specific PostHog events used by engagement readback", () => {
			const sm = new SlotManager(statePath);
			const ph = new PostHogClient();
			const daemon = new LivingSiteDaemon(sm, ph);
			const html = daemon.injectVariantEngagementTracking(
				"<html><head></head><body><main>visual</main></body></html>",
				makeSlot(),
				"sinter-home-hero-abc123",
			);

			expect(html).toContain("liminal_slot_view");
			expect(html).toContain("liminal_slot_interaction");
			expect(html).toContain("liminal_slot_bounce");
			expect(html).toContain("liminal_variant_id");
			expect(html).toContain("sinter-home-hero-abc123");
			cleanup();
		});
	});

	describe("buildCreativePrompt", () => {
		it("includes KyaniteLabs brand context and anti-generic taste constraints", () => {
			const sm = new SlotManager(statePath);
			const ph = new PostHogClient();
			const daemon = new LivingSiteDaemon(sm, ph);
			const prompt = daemon.buildCreativePrompt(makeSlot(), false);

			expect(prompt).toContain("KyaniteLabs");
				expect(prompt).toContain("kyanite blue");
				expect(prompt).toContain("avoid generic AI art");
				expect(prompt).toContain("home-hero");
				expect(prompt).toContain("Page: /");
				expect(prompt).toContain(Domain.P5);
				cleanup();
			});

		it("adds a controlled novelty brief on wildcard days", () => {
			const sm = new SlotManager(statePath);
			const ph = new PostHogClient();
			const daemon = new LivingSiteDaemon(sm, ph);
			const prompt = daemon.buildCreativePrompt(makeSlot(), true);

			expect(prompt).toContain("controlled wildcard");
			expect(prompt).toContain("Do not abandon the KyaniteLabs brand system");
			cleanup();
		});
	});

	describe("RalphLoop quality options", () => {
		it("uses iterative render-scored generation for living-site variants", () => {
			const sm = new SlotManager(statePath);
			const ph = new PostHogClient();
			const daemon = new LivingSiteDaemon(sm, ph);
			const options = daemon.buildRalphLoopOptions(makeSlot());

			expect(options.maxIterations).toBeGreaterThanOrEqual(5);
			expect(options.minQualityScore).toBeGreaterThanOrEqual(0.75);
			expect(options.useRenderScoring).toBe(true);
			expect(options.evaluationCriteria).toEqual(
				expect.arrayContaining(["aesthetic", "technical", "novelty", "emergence", "interestingness"]),
			);
			cleanup();
		});
	});

	describe("quality gate", () => {
		it("uses a conservative default visual deploy threshold", () => {
			expect(DEFAULT_DAEMON_CONFIG.minVisualScore).toBeGreaterThanOrEqual(0.6);
		});

		it("rejects render results below the deploy threshold", () => {
			const sm = new SlotManager(statePath);
			const ph = new PostHogClient();
			const daemon = new LivingSiteDaemon(sm, ph, {
				...DEFAULT_DAEMON_CONFIG,
				minVisualScore: 0.65,
			});

			expect(daemon.passesVisualDeployGate({ success: true, score: 0.64 })).toBe(false);
			expect(daemon.passesVisualDeployGate({ success: true, score: 0.65 })).toBe(true);
			expect(daemon.passesVisualDeployGate({ success: false, score: 0.99 })).toBe(false);
			cleanup();
		});
	});

	describe("isWildcardDay", () => {
		it("returns true when no last wildcard date", () => {
			const sm = new SlotManager(statePath);
			const ph = new PostHogClient();
			const daemon = new LivingSiteDaemon(sm, ph);
			expect(daemon.isWildcardDay()).toBe(true);
			cleanup();
		});

		it("returns true when 7+ days since last wildcard", () => {
			const sm = new SlotManager(statePath);
			const ph = new PostHogClient();
			const daemon = new LivingSiteDaemon(sm, ph);
			const eightDaysAgo = new Date(
				Date.now() - 8 * 24 * 60 * 60 * 1000,
			).toISOString();
			expect(daemon.isWildcardDay(eightDaysAgo)).toBe(true);
			cleanup();
		});

		it("returns false when less than 7 days since last wildcard", () => {
			const sm = new SlotManager(statePath);
			const ph = new PostHogClient();
			const daemon = new LivingSiteDaemon(sm, ph);
			const twoDaysAgo = new Date(
				Date.now() - 2 * 24 * 60 * 60 * 1000,
			).toISOString();
			expect(daemon.isWildcardDay(twoDaysAgo)).toBe(false);
			cleanup();
		});
	});

	describe("createFitnessCombiner", () => {
		it("returns default weights when not wildcard", () => {
			const sm = new SlotManager(statePath);
			const ph = new PostHogClient();
			const daemon = new LivingSiteDaemon(sm, ph);
			const combiner = daemon.createFitnessCombiner(false);
			const weights = combiner.getWeights();
			expect(weights.novelty).toBe(0.375);
			expect(weights.engagement).toBe(0);
			cleanup();
		});

		it("returns novelty-biased weights when wildcard", () => {
			const sm = new SlotManager(statePath);
			const ph = new PostHogClient();
			const daemon = new LivingSiteDaemon(sm, ph);
			const combiner = daemon.createFitnessCombiner(true);
			const weights = combiner.getWeights();
			expect(weights.novelty).toBe(0.5);
			expect(weights.engagement).toBe(0.1);
			cleanup();
		});
	});

	describe("getGridForSlot", () => {
		it("creates a new grid for unknown slot", () => {
			const sm = new SlotManager(statePath);
				const ph = new PostHogClient();
				const daemon = new LivingSiteDaemon(sm, ph);
				const grid = daemon.getGridForSlot("test-slot");
				expect(grid.size()).toBe(0);
				cleanup();
			});

		it("returns same grid on repeated calls", () => {
			const sm = new SlotManager(statePath);
			const ph = new PostHogClient();
			const daemon = new LivingSiteDaemon(sm, ph);
			const grid1 = daemon.getGridForSlot("test-slot");
			const grid2 = daemon.getGridForSlot("test-slot");
			expect(grid1).toBe(grid2);
			cleanup();
		});
	});
});
