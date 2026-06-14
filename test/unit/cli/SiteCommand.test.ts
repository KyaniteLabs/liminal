/**
 * SiteCommand loop tests (E5) — re-entrancy guard + clear-on-stop.
 *
 * The continuous evolution loop must NOT stack overlapping ticks when a cycle
 * runs longer than the interval, and stop() must clear the interval so the
 * timer does not leak.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Suppress Logger noise.
vi.mock("../../../src/utils/Logger.js", () => ({
	Logger: {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	},
}));

import { startSiteEvolveLoop } from "../../../src/cli/SiteCommand.js";

describe("startSiteEvolveLoop (E5)", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	/** A controllable tick: each call returns a promise we resolve manually. */
	function controllableTick() {
		const resolvers: Array<() => void> = [];
		let calls = 0;
		const tick = vi.fn(() => {
			calls++;
			return new Promise<void>((resolve) => {
				resolvers.push(resolve);
			});
		});
		return {
			tick,
			get calls() {
				return calls;
			},
			/** Resolve the oldest in-flight tick. */
			resolveOne() {
				const r = resolvers.shift();
				if (r) r();
			},
		};
	}

	it("skips an overlapping tick while the previous is still in flight", async () => {
		const ctrl = controllableTick();
		const loop = startSiteEvolveLoop(ctrl.tick, 1000);

		// First interval fires → tick #1 starts (still pending, never resolved).
		await vi.advanceTimersByTimeAsync(1000);
		expect(ctrl.calls).toBe(1);

		// Second interval fires while #1 is still running → MUST be skipped.
		await vi.advanceTimersByTimeAsync(1000);
		expect(ctrl.calls).toBe(1);

		// Third interval fires, still running → still skipped.
		await vi.advanceTimersByTimeAsync(1000);
		expect(ctrl.calls).toBe(1);

		// Resolve the in-flight tick, then the next interval may start a new one.
		ctrl.resolveOne();
		await vi.advanceTimersByTimeAsync(1000);
		expect(ctrl.calls).toBe(2);

		loop.stop();
	});

	it("runs sequential ticks when each completes before the next interval", async () => {
		const ctrl = controllableTick();
		const loop = startSiteEvolveLoop(ctrl.tick, 1000);

		await vi.advanceTimersByTimeAsync(1000);
		expect(ctrl.calls).toBe(1);
		ctrl.resolveOne();

		await vi.advanceTimersByTimeAsync(1000);
		expect(ctrl.calls).toBe(2);
		ctrl.resolveOne();

		await vi.advanceTimersByTimeAsync(1000);
		expect(ctrl.calls).toBe(3);
		ctrl.resolveOne();

		loop.stop();
	});

	it("stop() clears the interval so no further ticks fire", async () => {
		const ctrl = controllableTick();
		const loop = startSiteEvolveLoop(ctrl.tick, 1000);

		await vi.advanceTimersByTimeAsync(1000);
		expect(ctrl.calls).toBe(1);
		ctrl.resolveOne();

		loop.stop();

		// Advance well past several intervals — no new ticks should fire.
		await vi.advanceTimersByTimeAsync(5000);
		expect(ctrl.calls).toBe(1);
	});

	it("stop() removes the timer from the active timer set", () => {
		const ctrl = controllableTick();
		const loop = startSiteEvolveLoop(ctrl.tick, 1000);

		// One pending interval timer is registered.
		expect(vi.getTimerCount()).toBe(1);

		loop.stop();

		// After stop() the interval is cleared — zero active timers.
		expect(vi.getTimerCount()).toBe(0);
	});
});
