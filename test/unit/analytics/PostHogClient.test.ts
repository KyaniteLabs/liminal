import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PostHogClient } from "../../../src/analytics/PostHogClient.js";

describe("PostHogClient", () => {
	const originalEnv = process.env;

	beforeEach(() => {
		process.env = { ...originalEnv };
		delete process.env.LIMINAL_POSTHOG_KEY;
		delete process.env.LIMINAL_POSTHOG_HOST;
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
			process.env.LIMINAL_POSTHOG_KEY = "phc_testkey123";
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
			process.env.LIMINAL_POSTHOG_KEY = "phc_testkey456";
			const client = new PostHogClient();
			expect(client.getApiKey()).toBe("phc_testkey456");
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
			process.env.LIMINAL_POSTHOG_KEY = "phc_testkey789";
			const client = new PostHogClient();
			expect(() =>
				client.trackEvent("test_event", { key: "value" }),
			).not.toThrow();
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
