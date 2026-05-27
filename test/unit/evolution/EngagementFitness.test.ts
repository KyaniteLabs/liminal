import { describe, it, expect } from "vitest";
import {
	EngagementFitness,
	ENGAGEMENT_WEIGHTS,
	NEUTRAL_ENGAGEMENT,
} from "../../../src/evolution/EngagementFitness.js";

describe("EngagementFitness", () => {
	const ef = new EngagementFitness();

	describe("score", () => {
		it("returns 0 for all-zero metrics", () => {
			expect(
				ef.score({
					dwellRate: 0,
					scrollDepth: 0,
					interactionRate: 0,
					retentionScore: 0,
				}),
			).toBe(0);
		});

		it("returns ~1 for all-one metrics", () => {
			const result = ef.score({
				dwellRate: 1,
				scrollDepth: 1,
				interactionRate: 1,
				retentionScore: 1,
			});
			expect(result).toBeCloseTo(1.0, 5);
		});

		it("computes weighted score correctly", () => {
			// Only dwellRate=1, rest=0: should be 0.3
			const result = ef.score({
				dwellRate: 1,
				scrollDepth: 0,
				interactionRate: 0,
				retentionScore: 0,
			});
			expect(result).toBeCloseTo(ENGAGEMENT_WEIGHTS.dwellRate, 5);
		});

		it("computes interaction-only score correctly", () => {
			const result = ef.score({
				dwellRate: 0,
				scrollDepth: 0,
				interactionRate: 1,
				retentionScore: 0,
			});
			expect(result).toBeCloseTo(ENGAGEMENT_WEIGHTS.interactionRate, 5);
		});

		it("computes mixed metrics correctly", () => {
			const result = ef.score({
				dwellRate: 0.5,
				scrollDepth: 0.5,
				interactionRate: 0.5,
				retentionScore: 0.5,
			});
			expect(result).toBeCloseTo(0.5, 5);
		});

		it("clamps values above 1 to 1", () => {
			const result = ef.score({
				dwellRate: 2,
				scrollDepth: 3,
				interactionRate: 1.5,
				retentionScore: 5,
			});
			expect(result).toBeCloseTo(1.0, 5);
		});

		it("clamps negative values to 0", () => {
			const result = ef.score({
				dwellRate: -0.5,
				scrollDepth: 0,
				interactionRate: 0,
				retentionScore: 0,
			});
			expect(result).toBe(0);
		});
	});

	describe("neutralScore", () => {
		it("returns 0.5", () => {
			expect(ef.neutralScore()).toBe(NEUTRAL_ENGAGEMENT);
			expect(ef.neutralScore()).toBe(0.5);
		});
	});

	describe("ENGAGEMENT_WEIGHTS", () => {
		it("sums to 1.0", () => {
			const sum =
				ENGAGEMENT_WEIGHTS.dwellRate +
				ENGAGEMENT_WEIGHTS.scrollDepth +
				ENGAGEMENT_WEIGHTS.interactionRate +
				ENGAGEMENT_WEIGHTS.retentionScore;
			expect(sum).toBeCloseTo(1.0, 5);
		});
	});
});
