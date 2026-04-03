import { describe, it, expect, beforeAll } from 'vitest';
/**
 * Model Comparison Test Suite
 * 
 * Tests 5 models across identical prompts to compare:
 * - Success rate
 * - Quality scores
 * - Generation time
 * - Output cleanliness
 * 
 * Models:
 * 1. Qwen 3.5 9B (local)
 * 2. Qwen 3 Coder 40B (local)
 * 3. MiniMax-M2.7 (cloud)
 * 4. MiniMax-M2.7-highspeed (cloud)
 * 5. MiniMax-M2.5 (cloud)
 */

import { run } from '../../src/index.js';
import { LLMClient } from '../../src/llm/LLMClient.js';
import { CodeValidator } from '../../src/core/CodeValidator.js';
import fs from 'fs/promises';
import path from 'path';

interface ModelConfig {
  name: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
  type: 'local' | 'cloud';
}

interface TestResult {
  model: string;
  prompt: string;
  domain: string;
  success: boolean;
  score: number;
  iterations: number;
  duration: number;
  codeLength: number;
  hasThinkTags: boolean;
  isValid: boolean;
  errors: string[];
}

// Model configurations
const MODELS: ModelConfig[] = [
  {
    name: 'Qwen 3.5 9B',
    baseUrl: 'http://localhost:1234/v1',
    model: 'qwen3.5-9b',
    type: 'local',
  },
  {
    name: 'Qwen 3 Coder 40B',
    baseUrl: 'http://localhost:1234/v1',
    model: 'qwen3-coder-next-reap-40b-a3b-i1',
    type: 'local',
  },
  {
    name: 'MiniMax-M2.7',
    baseUrl: 'https://api.minimax.io/v1',
    model: 'MiniMax-M2.7',
    apiKey: process.env.MINIMAX_API_KEY,
    type: 'cloud',
  },
  {
    name: 'MiniMax-M2.7-highspeed',
    baseUrl: 'https://api.minimax.io/v1',
    model: 'MiniMax-M2.7-highspeed',
    apiKey: process.env.MINIMAX_API_KEY,
    type: 'cloud',
  },
  {
    name: 'MiniMax-M2.5',
    baseUrl: 'https://api.minimax.io/v1',
    model: 'MiniMax-M2.5',
    apiKey: process.env.MINIMAX_API_KEY,
    type: 'cloud',
  },
];

// Test prompts by domain
const TEST_PROMPTS = [
  { domain: 'p5.js', prompt: 'simple blue circle with animation' },
  { domain: 'shader', prompt: 'neon plasma effect with color cycling' },
  { domain: 'strudel', prompt: 'techno beat at 130 BPM' },
  { domain: 'hydra', prompt: 'geometric shapes with feedback trails' },
];

const TEST_TIMEOUT = 300000; // 5 minutes per test

describe('Model Comparison Suite', () => {
  const results: TestResult[] = [];
  const outputDir = path.join(process.cwd(), 'test-results', 'model-comparison');

  beforeAll(async () => {
    await fs.mkdir(outputDir, { recursive: true });
  });

  // Test each model with each prompt
  for (const model of MODELS) {
    describe(`Model: ${model.name}`, () => {
      // Skip cloud models if no API key
      const hasApiKey = model.apiKey || process.env.MINIMAX_API_KEY;
      const testFn = model.type === 'cloud' && !hasApiKey ? it.skip : it;

      for (const { domain, prompt } of TEST_PROMPTS) {
        testFn(
          `${domain}: "${prompt}"`,
          async () => {
            const startTime = Date.now();
            const modelOutputDir = path.join(outputDir, model.name.replace(/\s+/g, '-').toLowerCase(), domain);
            await fs.mkdir(modelOutputDir, { recursive: true });

            try {
              // Configure environment for this model
              process.env.LIMINAL_LLM_BASE_URL = model.baseUrl;
              process.env.LIMINAL_LLM_MODEL = model.model;
              if (model.apiKey) {
                process.env.LIMINAL_LLM_API_KEY = model.apiKey;
              }

              // Run generation
              const result = await run(prompt, {
                maxIterations: 3,
                output: modelOutputDir,
                project: `${domain}-test`,
                tolerateErrors: true, // Don't fail on low scores, just record
              });

              const duration = Date.now() - startTime;

              // Validate output
              const validation = CodeValidator.validate(result.code);
              const hasThinkTags = result.code.includes('<think');

              const testResult: TestResult = {
                model: model.name,
                prompt,
                domain,
                success: result.finalScore >= 0.7,
                score: result.finalScore,
                iterations: result.iterations,
                duration,
                codeLength: result.code.length,
                hasThinkTags,
                isValid: validation.valid,
                errors: validation.errors,
              };

              results.push(testResult);

              // Assertions - record data, don't necessarily fail
              expect(result.code).toBeDefined();
              expect(result.code.length).toBeGreaterThan(0);
              
              // Key assertion: no contamination
              expect(hasThinkTags).toBe(false);
              
              // Log results for analysis
              console.log(`\n[${model.name}] ${domain}: score=${result.finalScore.toFixed(2)}, iters=${result.iterations}, time=${(duration/1000).toFixed(1)}s`);

            } catch (error) {
              const duration = Date.now() - startTime;
              results.push({
                model: model.name,
                prompt,
                domain,
                success: false,
                score: 0,
                iterations: 0,
                duration,
                codeLength: 0,
                hasThinkTags: false,
                isValid: false,
                errors: [formatError('ModelComparison', error)],
              });
              throw error;
            }
          },
          TEST_TIMEOUT
        );
      }
    });
  }

  // Summary report after all tests
  describe('Summary Report', () => {
    it('generates comparison report', async () => {
      if (results.length === 0) {
        console.log('No results to report');
        return;
      }

      // Calculate statistics per model
      const modelStats: Record<string, {
        attempts: number;
        successes: number;
        avgScore: number;
        avgTime: number;
        totalIterations: number;
        contaminationCount: number;
      }> = {};

      for (const result of results) {
        if (!modelStats[result.model]) {
          modelStats[result.model] = {
            attempts: 0,
            successes: 0,
            avgScore: 0,
            avgTime: 0,
            totalIterations: 0,
            contaminationCount: 0,
          };
        }

        const stats = modelStats[result.model];
        stats.attempts++;
        if (result.success) stats.successes++;
        stats.avgScore += result.score;
        stats.avgTime += result.duration;
        stats.totalIterations += result.iterations;
        if (result.hasThinkTags) stats.contaminationCount++;
      }

      // Calculate averages
      for (const model of Object.keys(modelStats)) {
        const stats = modelStats[model];
        stats.avgScore /= stats.attempts;
        stats.avgTime /= stats.attempts;
      }

      // Print report
      console.log('\n\n========== MODEL COMPARISON REPORT ==========\n');
      console.log('Model                    | Success | Avg Score | Avg Time | Avg Iters | Contamination');
      console.log('-------------------------|---------|-----------|----------|-----------|---------------');

      for (const [model, stats] of Object.entries(modelStats)) {
        const successRate = ((stats.successes / stats.attempts) * 100).toFixed(0);
        const avgScore = stats.avgScore.toFixed(2);
        const avgTime = (stats.avgTime / 1000).toFixed(1);
        const avgIters = (stats.totalIterations / stats.attempts).toFixed(1);
        const contam = stats.contaminationCount > 0 ? `⚠️ ${stats.contaminationCount}` : '✓ None';

        console.log(
          `${model.padEnd(24)} | ${successRate.padStart(3)}%   | ${avgScore.padStart(9)} | ${avgTime.padStart(8)}s | ${avgIters.padStart(9)} | ${contam}`
        );
      }

      console.log('\n=============================================\n');

      // Save detailed report
      const reportPath = path.join(outputDir, 'comparison-report.json');
      await fs.writeFile(
        reportPath,
        JSON.stringify({ results, stats: modelStats }, null, 2)
      );

      console.log(`Full report saved to: ${reportPath}`);

      // Key assertions
      for (const [model, stats] of Object.entries(modelStats)) {
        expect(stats.contaminationCount).toBe(0); // No model should have contamination
      }
    });
  });
});
