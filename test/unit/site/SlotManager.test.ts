import { describe, it, expect, beforeEach } from "vitest";
import {
	SlotManager,
	type SiteSlot,
	type SlotVariant,
} from "../../../src/site/SlotManager.js";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { Domain } from "../../../src/types/domains.js";

function makeVariant(overrides: Partial<SlotVariant> = {}): SlotVariant {
	return {
		htmlPath: "/var/www/liminal-asset/test-abc.html",
		experimentId: "liminal-test-flag",
		fitness: 0.75,
		deployedAt: new Date().toISOString(),
		model: "minimax-m27",
		domain: Domain.P5,
		...overrides,
	};
}

function makeSlot(overrides: Partial<SiteSlot> = {}): SiteSlot {
	return {
		id: "home-hero",
		page: "/",
		domains: [Domain.P5, Domain.THREE, Domain.GLSL],
		active: makeVariant({ experimentId: "liminal-home-hero-active" }),
		challenger: null,
		...overrides,
	};
}

describe("SlotManager", () => {
	let tmpDir: string;
	let statePath: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "liminal-slot-test-"));
		statePath = join(tmpDir, "slots.json");
	});

	// No afterEach — cleanup is manual per test via cleanup()

	// Manual cleanup helper
	function cleanup() {
		if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
	}

	describe("load/save round-trip", () => {
		it("starts empty when file does not exist", async () => {
			const sm = new SlotManager(statePath);
			await sm.load();
			expect(sm.getAllSlots()).toEqual([]);
		});

		it("persists slots to disk and loads them back", async () => {
			const sm = new SlotManager(statePath);
			sm.setSlot(makeSlot());
			await sm.save();

			const sm2 = new SlotManager(statePath);
			await sm2.load();
			const loaded = sm2.getSlot("home-hero");
			expect(loaded).toMatchObject({
				id: "home-hero",
				active: { fitness: 0.75 },
			});

			cleanup();
		});
	});

	describe("getSlot / getAllSlots", () => {
		it("returns undefined for unknown slot", async () => {
			const sm = new SlotManager(statePath);
			await sm.load();
			expect(sm.getSlot("nonexistent")).toBeUndefined();
		});

		it("returns all slots", async () => {
			const sm = new SlotManager(statePath);
			sm.setSlot(makeSlot({ id: "slot-a" }));
			sm.setSlot(makeSlot({ id: "slot-b" }));
			expect(sm.getAllSlots()).toHaveLength(2);
		});
	});

	describe("setActive", () => {
		it("updates the active variant", async () => {
			const sm = new SlotManager(statePath);
			sm.setSlot(makeSlot());
			const newVariant = makeVariant({
				fitness: 0.9,
				experimentId: "new-active",
			});
			sm.setActive("home-hero", newVariant);
			expect(sm.getSlot("home-hero")!.active.fitness).toBe(0.9);
		});

		it("throws for unknown slot", () => {
			const sm = new SlotManager(statePath);
			expect(() => sm.setActive("unknown", makeVariant())).toThrow(
				/Slot not found/,
			);
		});
	});

	describe("setChallenger / clearChallenger", () => {
		it("sets a challenger variant", () => {
			const sm = new SlotManager(statePath);
			sm.setSlot(makeSlot());
			const challenger = makeVariant({
				fitness: 0.85,
				experimentId: "challenger-1",
			});
			sm.setChallenger("home-hero", challenger);
			expect(sm.getSlot("home-hero")!.challenger).toMatchObject({
				experimentId: "challenger-1",
				fitness: 0.85,
			});
		});

		it("clears the challenger", () => {
			const sm = new SlotManager(statePath);
			sm.setSlot(makeSlot());
			sm.setChallenger("home-hero", makeVariant());
			sm.clearChallenger("home-hero");
			expect(sm.getSlot("home-hero")!.challenger).toBeNull();
		});

		it("throws for unknown slot", () => {
			const sm = new SlotManager(statePath);
			expect(() => sm.setChallenger("unknown", makeVariant())).toThrow(
				/Slot not found/,
			);
			expect(() => sm.clearChallenger("unknown")).toThrow(/Slot not found/);
		});
	});

	describe("promoteChallenger", () => {
		it("promotes challenger to active and clears challenger", () => {
			const sm = new SlotManager(statePath);
			sm.setSlot(makeSlot());
			const challenger = makeVariant({ fitness: 0.95, experimentId: "winner" });
			sm.setChallenger("home-hero", challenger);
			sm.promoteChallenger("home-hero");

			expect(sm.getSlot("home-hero")!.active.fitness).toBe(0.95);
			expect(sm.getSlot("home-hero")!.active.experimentId).toBe("winner");
			expect(sm.getSlot("home-hero")!.challenger).toBeNull();
		});

		it("throws when no challenger exists", () => {
			const sm = new SlotManager(statePath);
			sm.setSlot(makeSlot());
			expect(() => sm.promoteChallenger("home-hero")).toThrow(/No challenger/);
		});

		it("throws for unknown slot", () => {
			const sm = new SlotManager(statePath);
			expect(() => sm.promoteChallenger("unknown")).toThrow(/Slot not found/);
		});
	});

	describe("needsChallenger", () => {
		it("returns true when no challenger", () => {
			const sm = new SlotManager(statePath);
			sm.setSlot(makeSlot());
			expect(sm.needsChallenger("home-hero")).toBe(true);
		});

		it("returns false when challenger exists", () => {
			const sm = new SlotManager(statePath);
			sm.setSlot(makeSlot());
			sm.setChallenger("home-hero", makeVariant());
			expect(sm.needsChallenger("home-hero")).toBe(false);
		});

		it("returns false for unknown slot", () => {
			const sm = new SlotManager(statePath);
			expect(sm.needsChallenger("unknown")).toBe(false);
		});
	});
});
