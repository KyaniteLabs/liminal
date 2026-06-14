import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
	PostHogClient,
	ENGAGEMENT_EVENTS,
	ENGAGEMENT_PROPS,
} from "../../../src/analytics/PostHogClient.js";

describe("PostHogClient", () => {
	const originalEnv = process.env;

	beforeEach(() => {
		process.env = { ...originalEnv };
		delete process.env.LIMINAL_POSTHOG_KEY;
		delete process.env.LIMINAL_POSTHOG_HOST;
		delete process.env.LIMINAL_POSTHOG_PERSONAL_API_KEY;
		delete process.env.LIMINAL_POSTHOG_PROJECT_ID;
		delete process.env.LIMINAL_POSTHOG_API_HOST;
		vi.restoreAllMocks();
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	describe("isConfigured", () => {
		it("returns false when LIMINAL_POSTHOG_KEY is not set", () => {
			const client = new PostHogClient();
			expect(client.isConfigured()).toBe(false);
		});

		it("returns true when LIMINAL_POSTHOG_KEY is set", () => {
			process.env.LIMINAL_POSTHOG_KEY = "phc_a";
			const client = new PostHogClient();
			expect(client.isConfigured()).toBe(true);
		});
	});

	describe("getApiKey", () => {
		it("returns empty string when not configured", () => {
			const client = new PostHogClient();
			expect(client.getApiKey()).toBe("");
		});

		it("returns the configured key", () => {
			process.env.LIMINAL_POSTHOG_KEY = "phc_b";
			const client = new PostHogClient();
			expect(client.getApiKey()).toBe("phc_b");
		});
	});

	describe("getHost", () => {
		it("returns default host when LIMINAL_POSTHOG_HOST is not set", () => {
			const client = new PostHogClient();
			expect(client.getHost()).toBe("https://puenteworks.com/ph");
		});

		it("returns custom host when LIMINAL_POSTHOG_HOST is set", () => {
			process.env.LIMINAL_POSTHOG_HOST = "https://custom.example.com/ph";
			const client = new PostHogClient();
			expect(client.getHost()).toBe("https://custom.example.com/ph");
		});
	});

	describe("trackEvent", () => {
		it("does not throw when not configured", () => {
			const client = new PostHogClient();
			expect(() => client.trackEvent("test", { foo: "bar" })).not.toThrow();
		});

		it("does not throw when configured and called", () => {
			process.env.LIMINAL_POSTHOG_KEY = "phc_c";
			const client = new PostHogClient();
			expect(() =>
				client.trackEvent("test_event", { key: "value" }),
			).not.toThrow();
		});
	});

	describe("getVariantEngagementMetrics", () => {
		it("returns null when the server-side PostHog query credentials are missing", async () => {
			process.env.LIMINAL_POSTHOG_KEY = "phc_public";
			const client = new PostHogClient();

			await expect(client.getVariantEngagementMetrics("variant-a")).resolves.toBeNull();
		});

		it("queries HogQL and maps variant engagement metrics", async () => {
			process.env.LIMINAL_POSTHOG_KEY = "phc_public";
			process.env.LIMINAL_POSTHOG_PERSONAL_API_KEY = "phx_private";
			process.env.LIMINAL_POSTHOG_PROJECT_ID = "12345";
			process.env.LIMINAL_POSTHOG_API_HOST = "https://app.posthog.com";
			const fetchMock = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					results: [[250, 0.6, 0.7, 0.2, 0.8]],
				}),
			});
			vi.stubGlobal("fetch", fetchMock);
			const client = new PostHogClient();

			const result = await client.getVariantEngagementMetrics("home-hero-abc123");

			expect(fetchMock).toHaveBeenCalledWith(
				"https://app.posthog.com/api/projects/12345/query/",
				expect.objectContaining({
					method: "POST",
						headers: expect.objectContaining({ Authorization: "Bearer phx_private" }),
				}),
			);
			expect(result).toEqual({
				variantId: "home-hero-abc123",
				visitors: 250,
				metrics: {
					dwellRate: 0.6,
					scrollDepth: 0.7,
					interactionRate: 0.2,
					retentionScore: 0.8,
				},
			});
		});

		it("returns null when PostHog query fails", async () => {
				process.env.LIMINAL_POSTHOG_KEY = "phc_public";
				process.env.LIMINAL_POSTHOG_PERSONAL_API_KEY = "phx_private";
			process.env.LIMINAL_POSTHOG_PROJECT_ID = "12345";
			vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403 }));
			const client = new PostHogClient();

			await expect(client.getVariantEngagementMetrics("variant-a")).resolves.toBeNull();
		});
	});

	describe("buildVariantEngagementQuery", () => {
		it("reads back the canonical liminal_ schema, never the legacy sinter_ keys", () => {
			const client = new PostHogClient();
			const query = client.buildVariantEngagementQuery();

			expect(query).toContain(`properties.${ENGAGEMENT_PROPS.dwellSeconds}`);
			expect(query).toContain(`properties.${ENGAGEMENT_PROPS.scrollDepth}`);
			expect(query).toContain(`properties.${ENGAGEMENT_PROPS.variantId} = {variantId}`);
			expect(query).toContain(ENGAGEMENT_EVENTS.view);
			expect(query).toContain(ENGAGEMENT_EVENTS.interaction);
			expect(query).toContain(ENGAGEMENT_EVENTS.bounce);

			// The defect this guards: emit wrote liminal_*, query read sinter_* → zero rows.
			expect(query).not.toContain("sinter_dwell_seconds");
			expect(query).not.toContain("sinter_scroll_depth");
			expect(query).not.toContain("sinter_variant_id");
		});

		it("exposes a liminal_ canonical prefix on every engagement key", () => {
			for (const key of Object.values(ENGAGEMENT_PROPS)) {
				expect(key.startsWith("liminal_")).toBe(true);
			}
			for (const event of Object.values(ENGAGEMENT_EVENTS)) {
				expect(event.startsWith("liminal_")).toBe(true);
			}
		});
	});

	describe("shutdown", () => {
		it("does not throw when not configured", async () => {
			const client = new PostHogClient();
			await expect(client.shutdown()).resolves.toBeUndefined();
		});

		it("does not throw when configured", async () => {
			process.env.LIMINAL_POSTHOG_KEY = "phc_testkey";
			const client = new PostHogClient();
			await expect(client.shutdown()).resolves.toBeUndefined();
		});
	});
});
