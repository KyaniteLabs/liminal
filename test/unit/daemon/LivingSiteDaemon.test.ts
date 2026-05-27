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
		experimentId: "liminal-test",
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
		tmpDir = mkdtempSync(join(tmpdir(), "liminal-daemon-test-"));
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
						experimentId: `liminal-${slot.id}-abc123`,
						fitness: 0.5,
						deployedAt: new Date().toISOString(),
						model: "mock-model",
						domain: Domain.P5,
					});
				},
			);

			await daemon.runCycle();
			expect(sm.getSlot("home-hero")!.challenger).not.toBeNull();
			expect(sm.getSlot("home-hero")!.challenger!.experimentId).toContain(
				"liminal-home-hero-",
			);
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
						experimentId: `liminal-${slot.id}-abc123`,
						fitness: 0.5,
						deployedAt: new Date().toISOString(),
						model: "mock-model",
						domain: Domain.P5,
					});
				},
			);

			await daemon.runCycle(true); // dry-run
			// Challenger should be set in memory but file not written
			expect(sm.getSlot("home-hero")!.challenger).not.toBeNull();
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
			expect(weights.novelty).toBe(0.25);
			expect(weights.engagement).toBe(0.25);
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
			expect(grid).toBeDefined();
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
