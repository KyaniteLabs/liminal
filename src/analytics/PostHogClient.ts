/**
 * PostHogClient — server-side PostHog integration for Liminal.
 *
 * Wraps posthog-node to send custom events and query experiment results.
 * Gated on LIMINAL_POSTHOG_KEY env var — does nothing when absent.
 *
 * Uses the PostHog proxy at puenteworks.com/ph by default.
 */

import { PostHog } from "posthog-node";
import { Logger } from "../utils/Logger.js";

const ENV_KEY = "LIMINAL_POSTHOG_KEY";
const ENV_HOST = "LIMINAL_POSTHOG_HOST";
const DEFAULT_HOST = "https://puenteworks.com/ph";

export interface PostHogEventProperties {
	[key: string]: string | number | boolean | null | undefined;
}

export class PostHogClient {
	private client: PostHog | null = null;
	private readonly apiKey: string;
	private readonly host: string;

	constructor() {
		this.apiKey = process.env[ENV_KEY] ?? "";
		this.host = process.env[ENV_HOST] ?? DEFAULT_HOST;

		if (this.apiKey) {
			this.client = new PostHog(this.apiKey, {
				host: this.host,
			});
		}
	}

	/** Whether PostHog is configured (env var set) */
	isConfigured(): boolean {
		return this.client !== null;
	}

	/** Get the API key (for CSP injection) */
	getApiKey(): string {
		return this.apiKey;
	}

	/** Get the host URL (for CSP injection) */
	getHost(): string {
		return this.host;
	}

	/**
	 * Track a custom server-side event.
	 * No-op when not configured.
	 */
	trackEvent(event: string, properties?: PostHogEventProperties): void {
		if (!this.client) return;

		try {
			this.client.capture({
				distinctId: "liminal-daemon",
				event,
				properties: {
					source: "liminal-server",
					...properties,
				},
			});
		} catch (err) {
			Logger.warn("PostHogClient", "Failed to track event:", err);
		}
	}

	/**
	 * Shutdown the client, flushing any pending events.
	 */
	async shutdown(): Promise<void> {
		if (!this.client) return;
		try {
			await this.client.shutdown();
		} catch (err) {
			Logger.warn("PostHogClient", "Failed to shutdown:", err);
		}
	}
}
