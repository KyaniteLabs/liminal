import { describe, it, expect } from "vitest";
import {
	FitnessCombiner,
	DEFAULT_FITNESS_WEIGHTS,
} from "../../../src/evolution/FitnessCombiner.js";

describe("DEFAULT_FITNESS_WEIGHTS", () => {
	it("sums to 1.0", () => {
		const sum =
			DEFAULT_FITNESS_WEIGHTS.novelty +
			DEFAULT_FITNESS_WEIGHTS.quality +
			DEFAULT_FITNESS_WEIGHTS.technical +
			DEFAULT_FITNESS_WEIGHTS.diversity +
			DEFAULT_FITNESS_WEIGHTS.engagement;
		expect(sum).toBeCloseTo(1.0, 2);
	});

	it("has novelty and quality tied for highest weight", () => {
		expect(DEFAULT_FITNESS_WEIGHTS.novelty).toBe(
			DEFAULT_FITNESS_WEIGHTS.quality,
		);
		expect(DEFAULT_FITNESS_WEIGHTS.novelty).toBeGreaterThan(
			DEFAULT_FITNESS_WEIGHTS.technical,
		);
	});

	it("has diversity as lowest weight", () => {
		expect(DEFAULT_FITNESS_WEIGHTS.diversity).toBeLessThan(
			DEFAULT_FITNESS_WEIGHTS.technical,
		);
	});

	it("defaults engagement axis to 0 (opt-in sensorium, not a default objective)", () => {
		expect(DEFAULT_FITNESS_WEIGHTS.engagement).toBe(0);
	});
});

describe("FitnessCombiner", () => {
	describe("constructor", () => {
		it("creates with default weights", () => {
			const combiner = new FitnessCombiner();
			expect(combiner.getWeights()).toEqual(DEFAULT_FITNESS_WEIGHTS);
		});

		it("creates with custom weights", () => {
			const combiner = new FitnessCombiner({
				novelty: 0.5,
				quality: 0.2,
				technical: 0.1,
				diversity: 0.05,
				engagement: 0.15,
			});
			const weights = combiner.getWeights();
			expect(weights.novelty).toBe(0.5);
			expect(weights.engagement).toBe(0.15);
		});

		it("rejects partial weight override that breaks sum", () => {
			// { novelty: 0.7 } merged with defaults: 0.7 + 0.25 + 0.15 + 0.10 + 0.25 = 1.45
			expect(() => new FitnessCombiner({ novelty: 0.7 })).toThrow(/sum to 1.0/);
		});

		it("throws when weights do not sum to 1.0", () => {
			expect(
				() =>
					new FitnessCombiner({ novelty: 0.5, quality: 0.6, engagement: 0.1 }),
			).toThrow(/sum to 1.0/);
		});

		it("accepts 5-axis weights summing to exactly 1.0", () => {
			expect(
				() =>
					new FitnessCombiner({
						novelty: 0.2,
						quality: 0.2,
						technical: 0.2,
						diversity: 0.2,
						engagement: 0.2,
					}),
			).not.toThrow();
		});

		it("tolerates weights summing to 1.005 (within 0.01)", () => {
			expect(
				() =>
					new FitnessCombiner({
						novelty: 0.4,
						quality: 0.3,
						technical: 0.2,
						diversity: 0.105,
						engagement: 0,
					}),
			).not.toThrow();
		});
	});

	describe("calculate", () => {
		it("computes weighted fitness with default 5-axis weights", () => {
			const combiner = new FitnessCombiner();
			const result = combiner.calculate({
				novelty: 1,
				quality: 1,
				technical: 1,
				diversity: 1,
				engagement: 1,
			});
			expect(result).toBeCloseTo(1.0, 5);
		});

		it("returns 0 for all-zero components", () => {
			const combiner = new FitnessCombiner();
			const result = combiner.calculate({
				novelty: 0,
				quality: 0,
				technical: 0,
				diversity: 0,
				engagement: 0,
			});
			expect(result).toBe(0);
		});

		it("computes partial fitness correctly with 5 equal axes", () => {
			const combiner = new FitnessCombiner({
				novelty: 0.2,
				quality: 0.2,
				technical: 0.2,
				diversity: 0.2,
				engagement: 0.2,
			});
			const result = combiner.calculate({
				novelty: 1,
				quality: 0,
				technical: 0,
				diversity: 0,
				engagement: 0,
			});
			expect(result).toBeCloseTo(0.2, 5);
		});

		it("clamps values above 1 to 1", () => {
			const combiner = new FitnessCombiner();
			const result = combiner.calculate({
				novelty: 2,
				quality: 3,
				technical: 1.5,
				diversity: 5,
				engagement: 2,
			});
			expect(result).toBeCloseTo(1.0, 5);
		});

		it("clamps negative values to 0", () => {
			const combiner = new FitnessCombiner();
			const result = combiner.calculate({
				novelty: -0.5,
				quality: 0,
				technical: 0,
				diversity: 0,
				engagement: 0,
			});
			expect(result).toBe(0);
		});

		it("uses custom weights", () => {
			const combiner = new FitnessCombiner({
				novelty: 1.0,
				quality: 0,
				technical: 0,
				diversity: 0,
				engagement: 0,
			});
			const result = combiner.calculate({
				novelty: 0.8,
				quality: 0.2,
				technical: 0.5,
				diversity: 0.9,
				engagement: 0.3,
			});
			expect(result).toBeCloseTo(0.8, 5);
		});

		it("weights engagement axis correctly", () => {
			const combiner = new FitnessCombiner({
				novelty: 0,
				quality: 0,
				technical: 0,
				diversity: 0,
				engagement: 1.0,
			});
			const result = combiner.calculate({
				novelty: 0,
				quality: 0,
				technical: 0,
				diversity: 0,
				engagement: 0.75,
			});
			expect(result).toBeCloseTo(0.75, 5);
		});
	});

	describe("calculateBatch", () => {
		it("calculates fitness for multiple items", () => {
			const combiner = new FitnessCombiner();
			const items = [
				{
					id: "a",
					components: {
						novelty: 1,
						quality: 1,
						technical: 1,
						diversity: 1,
						engagement: 1,
					},
				},
				{
					id: "b",
					components: {
						novelty: 0,
						quality: 0,
						technical: 0,
						diversity: 0,
						engagement: 0,
					},
				},
			];
			const results = combiner.calculateBatch(items);
			expect(results).toHaveLength(2);
			expect(results[0].fitness).toBeCloseTo(1.0, 5);
			expect(results[1].fitness).toBe(0);
		});

		it("preserves item IDs", () => {
			const combiner = new FitnessCombiner();
			const items = [
				{
					id: "x",
					components: {
						novelty: 0.5,
						quality: 0.5,
						technical: 0.5,
						diversity: 0.5,
						engagement: 0.5,
					},
				},
			];
			const results = combiner.calculateBatch(items);
			expect(results[0].id).toBe("x");
		});

		it("returns empty array for empty input", () => {
			const combiner = new FitnessCombiner();
			expect(combiner.calculateBatch([])).toEqual([]);
		});
	});

	describe("rank", () => {
		it("sorts items by fitness descending", () => {
			const combiner = new FitnessCombiner();
			const items = [
				{
					id: "low",
					components: {
						novelty: 0.1,
						quality: 0.1,
						technical: 0.1,
						diversity: 0.1,
						engagement: 0.1,
					},
				},
				{
					id: "high",
					components: {
						novelty: 0.9,
						quality: 0.9,
						technical: 0.9,
						diversity: 0.9,
						engagement: 0.9,
					},
				},
				{
					id: "mid",
					components: {
						novelty: 0.5,
						quality: 0.5,
						technical: 0.5,
						diversity: 0.5,
						engagement: 0.5,
					},
				},
			];
			const ranked = combiner.rank(items);
			expect(ranked[0].id).toBe("high");
			expect(ranked[1].id).toBe("mid");
			expect(ranked[2].id).toBe("low");
		});

		it("returns empty array for empty input", () => {
			const combiner = new FitnessCombiner();
			expect(combiner.rank([])).toEqual([]);
		});
	});

	describe("setWeights", () => {
		it("updates weights", () => {
			const combiner = new FitnessCombiner();
			combiner.setWeights({
				novelty: 0.2,
				quality: 0.2,
				technical: 0.2,
				diversity: 0.2,
				engagement: 0.2,
			});
			const weights = combiner.getWeights();
			expect(weights.novelty).toBe(0.2);
			expect(weights.engagement).toBe(0.2);
		});

		it("throws if updated weights do not sum to 1.0", () => {
			const combiner = new FitnessCombiner();
			expect(() => combiner.setWeights({ novelty: 0.9 })).toThrow(/sum to 1.0/);
		});
	});

	describe("getWeights", () => {
		it("returns a copy (not reference)", () => {
			const combiner = new FitnessCombiner();
			const weights = combiner.getWeights();
			weights.novelty = 999;
			expect(combiner.getWeights().novelty).toBe(
				DEFAULT_FITNESS_WEIGHTS.novelty,
			);
		});
	});
});
