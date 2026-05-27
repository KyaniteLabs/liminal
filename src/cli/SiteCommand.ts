/**
 * SiteCommand — CLI interface for the living website daemon.
 *
 * Usage:
 *   liminal site evolve            # Run daemon continuously
 *   liminal site evolve --once     # Run single cycle
 *   liminal site evolve --dry-run  # Generate but don't deploy
 *   liminal site evolve --slot home-hero  # Target specific slot
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

const DEFAULT_STATE_DIR = join(homedir(), ".liminal", "site");

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

	// Schedule subsequent cycles
	const timer = setInterval(() => {
		void run();
	}, config.cycleIntervalMs);

	// Graceful shutdown
	const shutdown = () => {
		Logger.info("SiteCommand", "Shutting down...");
		clearInterval(timer);
		void posthog.shutdown().then(() => process.exit(0));
	};

	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);
}
