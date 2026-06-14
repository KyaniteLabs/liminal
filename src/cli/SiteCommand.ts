/**
 * SiteCommand — CLI interface for the living website daemon.
 *
 * Usage:
 *   sinter site evolve            # Run daemon continuously
 *   sinter site evolve --once     # Run single cycle
 *   sinter site evolve --dry-run  # Generate but don't deploy
 *   sinter site evolve --slot home-hero  # Target specific slot
 */

import {
	LivingSiteDaemon,
	DEFAULT_DAEMON_CONFIG,
} from "../daemon/LivingSiteDaemon.js";
import { SlotManager } from "../site/SlotManager.js";
import { PostHogClient } from "../analytics/PostHogClient.js";
import { Logger } from "../utils/Logger.js";
import { join } from "node:path";
import { homedir } from "node:os";

export interface SiteEvolveOptions {
	once?: boolean;
	dryRun?: boolean;
	slot?: string;
	interval?: number;
}

const DEFAULT_STATE_DIR = join(homedir(), ".sinter", "site");

/**
 * Schedule a recurring async tick with a re-entrancy guard.
 *
 * If a tick is still running when the next interval fires, that tick is
 * SKIPPED rather than stacked — long cycles can no longer pile up overlapping
 * runs. Returns a `stop()` that clears the underlying interval (no leak).
 */
export function startSiteEvolveLoop(
	tick: () => Promise<void>,
	intervalMs: number,
): { stop: () => void } {
	let running = false;

	const timer = setInterval(() => {
		if (running) {
			Logger.info(
				"SiteCommand",
				"Previous cycle still running, skipping this tick",
			);
			return;
		}
		running = true;
		void tick().finally(() => {
			running = false;
		});
	}, intervalMs);

	return {
		stop: () => clearInterval(timer),
	};
}

export async function runSiteEvolve(
	options: SiteEvolveOptions = {},
): Promise<void> {
	const statePath = join(DEFAULT_STATE_DIR, "slots.json");
	const config = { ...DEFAULT_DAEMON_CONFIG };

	if (options.interval) {
		config.cycleIntervalMs = options.interval;
	}

	const slotManager = new SlotManager(statePath);
	const posthog = new PostHogClient();
	const daemon = new LivingSiteDaemon(slotManager, posthog, config);

	// Load existing slot state
	await slotManager.load();

	if (options.once) {
		Logger.info("SiteCommand", "Running single evolution cycle");
		await daemon.runCycle(options.dryRun);
		await posthog.shutdown();
		return;
	}

	// Continuous mode
	Logger.info(
		"SiteCommand",
		`Starting continuous evolution (interval: ${config.cycleIntervalMs}ms)`,
	);

	const run = async () => {
		try {
			await daemon.runCycle(options.dryRun);
		} catch (err) {
			Logger.error("SiteCommand", "Cycle failed:", err);
		}
	};

	// Run first cycle immediately
	await run();

	// Schedule subsequent cycles with a re-entrancy guard so a slow cycle
	// cannot stack overlapping ticks.
	const loop = startSiteEvolveLoop(run, config.cycleIntervalMs);

	// Graceful shutdown
	const shutdown = () => {
		Logger.info("SiteCommand", "Shutting down...");
		loop.stop();
		void posthog.shutdown().then(() => process.exit(0));
	};

	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);
}
