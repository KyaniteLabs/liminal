import { describe, it, expect, beforeAll, afterEach, afterAll, test, vi } from 'vitest';
/**
 * Evaluator-Gallery Integration Tests
 *
 * End-to-end tests that verify the complete workflow:
 * - Generate multiple iterations
 * - Evaluate creative quality for each iteration
 * - Save only passing iterations to gallery
 * - Validate history management and quality tracking
 * - Test real-world creative coding scenarios
 */

import { CreativeEvaluator } from '../../src/core/CreativeEvaluator.js';
import { Gallery } from '../../src/gallery/Gallery.js';
import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

// Mock P5Generator to avoid LLM dependency
const MOCK_P5_CODE = `function setup() {
  createCanvas(800, 600);
  colorMode(HSB, 360, 100, 100);
}

function draw() {
  background(frameCount % 360, 20, 90);
  fill(255);
  noStroke();
  for (let i = 0; i < 20; i++) {
    let x = width / 2 + cos(frameCount * 0.02 + i * 0.5) * (100 + i * 10);
    let y = height / 2 + sin(frameCount * 0.03 + i * 0.7) * (80 + i * 8);
    ellipse(x, y, 15 + sin(frameCount * 0.05 + i) * 5);
  }
}

function mousePressed() {
  background(0);
}
`;

vi.mock('../../src/generators/p5/P5Generator.js', () => ({
  P5Generator: {
    generate: vi.fn(() => MOCK_P5_CODE),
  },
}));

// Import the mocked P5Generator for use in tests
import { P5Generator } from '../../src/generators/p5/P5Generator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Increase timeout for integration tests
const EVALUATOR_GALLERY_TIMEOUT = 60000; // 60 seconds

describe('Evaluator-Gallery Integration Tests', () => {
  let testGalleryDir;
  let gallery;

  beforeAll(() => {
    testGalleryDir = path.resolve(__dirname, 'test-evaluator-gallery');
    gallery = new Gallery(testGalleryDir);
  });

  afterAll(async () => {
    // Clean up test directory
    try {
      await fs.rm(testGalleryDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  afterEach(async () => {
    // Clean up test gallery after each test
    try {
      await fs.rm(testGalleryDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore if directory doesn't exist
    }
  });

  describe('Quality Evaluation and Gallery Saving', () => {
    test('should evaluate quality and save only passing iterations', async () => {
      const projectName = 'quality-filter-test';
      const iterations = 5;
      const passingIterations = [];

      // Generate and evaluate multiple iterations
      for (let i = 1; i <= iterations; i++) {
        const prompt = `Create p5.js sketch iteration ${i}`;
        const code = P5Generator.generate(prompt, { iteration: i });

        // Evaluate quality
        const evaluation = CreativeEvaluator.assess(code);

        // Only save passing iterations to gallery
        if (evaluation.passed) {
          await gallery.saveIteration(projectName, i, code);
          passingIterations.push({ iteration: i, code, evaluation });
        }
      }

      // Verify gallery saved only passing iterations
      const history = await gallery.loadHistory(projectName);

      expect(history.length).toBeGreaterThan(0);
      expect(history.length).toBeLessThanOrEqual(iterations);
      expect(history.length).toBe(passingIterations.length);

      // Verify all saved iterations passed quality check
      history.forEach((savedIteration, index) => {
        expect(savedIteration.version).toBe(passingIterations[index].iteration);
        expect(savedIteration.code).toBe(passingIterations[index].code);

        // Re-evaluate to confirm it passes
        const reevaluation = CreativeEvaluator.assess(savedIteration.code);
        expect(reevaluation.passed).toBe(true);
        expect(reevaluation.score).toBeGreaterThanOrEqual(0.7);
      });
    }, EVALUATOR_GALLERY_TIMEOUT);

    test('should track quality scores across saved iterations', async () => {
      const projectName = 'quality-tracking-test';
      const iterations = 4;
      const qualityScores = [];

      // Generate, evaluate, and save iterations
      for (let i = 1; i <= iterations; i++) {
        const prompt = i === 1
          ? 'Create basic p5.js sketch'
          : 'Improve the sketch with more detail';

        const code = P5Generator.generate(prompt, { iteration: i });
        const evaluation = CreativeEvaluator.assess(code);

        qualityScores.push({
          iteration: i,
          score: evaluation.score,
          technicalScore: evaluation.technicalScore,
          creativeScore: evaluation.creativeScore,
          passed: evaluation.passed
        });

        // Save only if passed
        if (evaluation.passed) {
          await gallery.saveIteration(projectName, i, code);
        }
      }

      // Verify gallery has saved iterations
      const history = await gallery.loadHistory(projectName);
      expect(history.length).toBeGreaterThan(0);

      // Verify we tracked quality for all iterations
      expect(qualityScores.length).toBe(iterations);

      // Verify quality scores are in valid range
      qualityScores.forEach(qs => {
        expect(qs.score).toBeGreaterThanOrEqual(0);
        expect(qs.score).toBeLessThanOrEqual(1);
        expect(qs.technicalScore).toBeGreaterThanOrEqual(0);
        expect(qs.technicalScore).toBeLessThanOrEqual(1);
        expect(qs.creativeScore).toBeGreaterThanOrEqual(0);
        expect(qs.creativeScore).toBeLessThanOrEqual(1);
      });

      // Verify saved iterations have passing scores
      const passedCount = qualityScores.filter(qs => qs.passed).length;
      expect(history.length).toBe(passedCount);
    }, EVALUATOR_GALLERY_TIMEOUT);

    test('should maintain iteration history with quality metadata', async () => {
      const projectName = 'history-metadata-test';
      const iterations = 3;

      // Generate and save iterations
      for (let i = 1; i <= iterations; i++) {
        const prompt = `Create p5.js sketch ${i}`;
        const code = P5Generator.generate(prompt, { iteration: i });
        const evaluation = CreativeEvaluator.assess(code);

        if (evaluation.passed) {
          await gallery.saveIteration(projectName, i, code);
        }
      }

      // Verify gallery history
      const history = await gallery.loadHistory(projectName);

      expect(history.length).toBeGreaterThan(0);
      expect(history.length).toBeLessThanOrEqual(iterations);

      // Verify history is sorted by version
      for (let i = 1; i < history.length; i++) {
        expect(history[i].version).toBeGreaterThan(history[i - 1].version);
      }

      // Verify each iteration has required metadata
      history.forEach(iteration => {
        expect(iteration.version).toBeDefined();
        expect(iteration.code).toBeDefined();
        expect(iteration.timestamp).toBeDefined();
        expect(iteration.code.length).toBeGreaterThan(0);

        // Verify code is valid when re-evaluated
        const evaluation = CreativeEvaluator.assess(iteration.code);
        expect(evaluation.passed).toBe(true);
      });
    }, EVALUATOR_GALLERY_TIMEOUT);
  });

  describe('Quality Gate Enforcement', () => {
    test('should enforce minimum quality threshold', async () => {
      const projectName = 'quality-gate-test';
      const highQualityCode = `
        function setup() {
          createCanvas(800, 600);
          colorMode(HSB, 360, 100, 100);
        }

        function draw() {
          background(frameCount % 360, 20, 90);
          fill(255);
          ellipse(mouseX, mouseY, 50, 50);

          for (let i = 0; i < 10; i++) {
            rect(random(width), random(height), 20, 20);
          }
        }

        function mousePressed() {
          background(0);
        }
      `;

      const lowQualityCode = `
        function setup() {
        }
      `;

      // Evaluate both code samples
      const highQualityEval = CreativeEvaluator.assess(highQualityCode);
      const lowQualityEval = CreativeEvaluator.assess(lowQualityCode);

      // High quality should pass
      expect(highQualityEval.passed).toBe(true);
      expect(highQualityEval.score).toBeGreaterThanOrEqual(0.7);

      // Low quality should fail
      expect(lowQualityEval.passed).toBe(false);
      expect(lowQualityEval.score).toBeLessThan(0.7);

      // Only high quality should be saved
      if (highQualityEval.passed) {
        await gallery.saveIteration(projectName, 1, highQualityCode);
      }

      // Low quality should not be saved
      if (lowQualityEval.passed) {
        await gallery.saveIteration(projectName, 2, lowQualityCode);
      }

      // Verify only high quality iteration was saved
      const history = await gallery.loadHistory(projectName);
      expect(history.length).toBe(1);
      expect(history[0].code).toBe(highQualityCode);
    });

    test('should identify and report quality issues', async () => {
      const problematicCode = `
        function setup() {
          // Missing createCanvas
        }

        // Missing draw function
      `;

      const evaluation = CreativeEvaluator.assess(problematicCode);

      // Should fail quality check
      expect(evaluation.passed).toBe(false);

      // Should identify specific issues
      expect(evaluation.issues.length).toBeGreaterThan(0);
      expect(evaluation.issues.some(issue =>
        issue.toLowerCase().includes('setup') ||
        issue.toLowerCase().includes('draw')
      )).toBe(true);

      // Should not be saved to gallery
      const projectName = 'quality-issues-test';
      if (evaluation.passed) {
        await gallery.saveIteration(projectName, 1, problematicCode);
      }

      const history = await gallery.loadHistory(projectName);
      expect(history.length).toBe(0);
    });
  });

  describe('Real-World Creative Coding Scenarios', () => {
    test('should handle particle system evolution workflow', async () => {
      const projectName = 'particle-evolution-test';
      const workflow = [
        'Create basic particle system',
        'Add color to particles',
        'Add mouse interaction',
        'Optimize performance'
      ];

      let savedCount = 0;

      for (let i = 0; i < workflow.length; i++) {
        const prompt = workflow[i];
        const code = P5Generator.generate(prompt, { iteration: i + 1 });
        const evaluation = CreativeEvaluator.assess(code);

        if (evaluation.passed) {
          await gallery.saveIteration(projectName, i + 1, code);
          savedCount++;
        }
      }

      // Verify at least some iterations passed
      expect(savedCount).toBeGreaterThan(0);

      // Verify gallery history
      const history = await gallery.loadHistory(projectName);
      expect(history.length).toBe(savedCount);

      // Verify evolution in code quality
      const evaluations = history.map(iter => CreativeEvaluator.assess(iter.code));
      evaluations.forEach(evaluation => {
        expect(evaluation.passed).toBe(true);
      });
    }, EVALUATOR_GALLERY_TIMEOUT);

    test('should handle animation-focused workflow', async () => {
      const projectName = 'animation-workflow-test';
      const animationPrompts = [
        'Create animated circles',
        'Add smooth motion',
        'Add color transitions',
        'Add frame rate control'
      ];

      for (let i = 0; i < animationPrompts.length; i++) {
        const prompt = animationPrompts[i];
        const code = P5Generator.generate(prompt, { iteration: i + 1 });
        const evaluation = CreativeEvaluator.assess(code);

        if (evaluation.passed) {
          await gallery.saveIteration(projectName, i + 1, code);
        }
      }

      // Verify saved iterations
      const history = await gallery.loadHistory(projectName);
      expect(history.length).toBeGreaterThan(0);

      // Verify all saved iterations passed quality evaluation
      history.forEach(iteration => {
        const evaluation = CreativeEvaluator.assess(iteration.code);
        expect(evaluation.passed).toBe(true);
        expect(evaluation.score).toBeGreaterThanOrEqual(0.7);
      });

      // Verify we can track quality metrics across the workflow
      const scores = history.map(iteration => {
        const evaluation = CreativeEvaluator.assess(iteration.code);
        return evaluation.score;
      });

      expect(scores.length).toBeGreaterThan(0);
      scores.forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });
    }, EVALUATOR_GALLERY_TIMEOUT);

    test('should handle interactive art workflow', async () => {
      const projectName = 'interactive-art-test';
      const interactivePrompts = [
        'Create mouse-responsive art',
        'Add keyboard controls',
        'Add touch interaction support'
      ];

      for (let i = 0; i < interactivePrompts.length; i++) {
        const prompt = interactivePrompts[i];
        const code = P5Generator.generate(prompt, { iteration: i + 1 });
        const evaluation = CreativeEvaluator.assess(code);

        if (evaluation.passed) {
          await gallery.saveIteration(projectName, i + 1, code);
        }
      }

      // Verify saved interactive art
      const history = await gallery.loadHistory(projectName);
      expect(history.length).toBeGreaterThan(0);

      // Verify all saved iterations passed quality evaluation
      history.forEach(iteration => {
        const evaluation = CreativeEvaluator.assess(iteration.code);
        expect(evaluation.passed).toBe(true);
      });

      // Check that at least some have interactivity/animation features
      const interactiveCount = history.filter(iteration => {
        const evaluation = CreativeEvaluator.assess(iteration.code);
        return evaluation.metrics.hasInteractivity || evaluation.metrics.usesAnimation;
      }).length;

      expect(interactiveCount).toBeGreaterThan(0);
    }, EVALUATOR_GALLERY_TIMEOUT);
  });

  describe('Gallery Validation and Consistency', () => {
    test('should maintain data consistency across saves', async () => {
      const projectName = 'data-consistency-test';
      const iterations = 3;

      // Save iterations
      for (let i = 1; i <= iterations; i++) {
        const code = P5Generator.generate(`Test ${i}`, { iteration: i });
        const evaluation = CreativeEvaluator.assess(code);

        if (evaluation.passed) {
          await gallery.saveIteration(projectName, i, code);
        }
      }

      // Load and verify
      const history = await gallery.loadHistory(projectName);

      history.forEach(iteration => {
        // Verify data integrity
        expect(iteration.code).toBeDefined();
        expect(iteration.code.length).toBeGreaterThan(0);

        // Verify evaluation consistency
        const evaluation = CreativeEvaluator.assess(iteration.code);
        expect(evaluation.passed).toBe(true);

        // Verify code can be executed (syntax check)
        expect(() => {
          Function(iteration.code);
        }).not.toThrow();
      });
    }, EVALUATOR_GALLERY_TIMEOUT);

    test('should handle concurrent evaluation and saving', async () => {
      const projectName = 'concurrent-eval-test';
      const concurrentTasks = 5;

      // Run concurrent evaluations
      const tasks = Array.from({ length: concurrentTasks }, (_, i) =>
        (async () => {
          const code = P5Generator.generate(`Concurrent ${i}`, { iteration: i + 1 });
          const evaluation = CreativeEvaluator.assess(code);

          if (evaluation.passed) {
            await gallery.saveIteration(projectName, i + 1, code);
            return { passed: true, code };
          }
          return { passed: false, code };
        })()
      );

      const results = await Promise.all(tasks);

      // Verify some passed
      const passedCount = results.filter(r => r.passed).length;
      expect(passedCount).toBeGreaterThan(0);

      // Verify gallery consistency
      const history = await gallery.loadHistory(projectName);
      expect(history.length).toBe(passedCount);

      // Verify all saved iterations are valid
      history.forEach(iteration => {
        const evaluation = CreativeEvaluator.assess(iteration.code);
        expect(evaluation.passed).toBe(true);
      });
    }, EVALUATOR_GALLERY_TIMEOUT);

    test('should validate code quality before saving', async () => {
      const projectName = 'pre-save-validation-test';

      // Try to save various code qualities
      const codeSamples = [
        { name: 'empty', code: '', shouldPass: false },
        { name: 'incomplete', code: 'function setup() {', shouldPass: false },
        { name: 'basic', code: 'function setup() { createCanvas(400, 400); } function draw() { background(0); }', shouldPass: false },
        { name: 'moderate', code: 'function setup() { createCanvas(400, 400); }\nfunction draw() {\n  background(20);\n  fill(100, 150, 255);\n  noStroke();\n  for (let i = 0; i < 5; i++) {\n    let x = width / 2 + cos(frameCount * 0.02 + i) * 100;\n    let y = height / 2 + sin(frameCount * 0.02 + i) * 100;\n    ellipse(x, y, 30);\n  }\n}', shouldPass: true },
        { name: 'complex', code: P5Generator.generate('Create complex art', {}), shouldPass: true }
      ];

      for (let i = 0; i < codeSamples.length; i++) {
        const sample = codeSamples[i];
        const evaluation = CreativeEvaluator.assess(sample.code);

        // Only save if it passes evaluation
        if (evaluation.passed) {
          await gallery.saveIteration(projectName, i + 1, sample.code);
        }

        // Verify evaluation matches expected
        if (sample.shouldPass) {
          expect(evaluation.passed).toBe(true);
        } else {
          expect(evaluation.passed).toBe(false);
        }
      }

      // Verify gallery only has passing iterations
      const history = await gallery.loadHistory(projectName);
      history.forEach(iteration => {
        const evaluation = CreativeEvaluator.assess(iteration.code);
        expect(evaluation.passed).toBe(true);
      });
    });
  });

  describe('Quality Metrics and Analysis', () => {
    test('should provide detailed quality metrics', async () => {
      const projectName = 'quality-metrics-test';
      const code = P5Generator.generate('Create detailed art with animation', {});
      const evaluation = CreativeEvaluator.assess(code);

      if (evaluation.passed) {
        await gallery.saveIteration(projectName, 1, code);
      }

      // Verify detailed metrics
      expect(evaluation.metrics).toBeDefined();
      expect(evaluation.metrics.codeLength).toBeGreaterThan(0);
      expect(typeof evaluation.metrics.hasSetup).toBe('boolean');
      expect(typeof evaluation.metrics.hasDraw).toBe('boolean');
      expect(typeof evaluation.metrics.usesAnimation).toBe('boolean');
      expect(typeof evaluation.metrics.usesColor).toBe('boolean');
      expect(typeof evaluation.metrics.hasInteractivity).toBe('boolean');
      expect(typeof evaluation.metrics.complexity).toBe('number');

      // Verify score components
      expect(evaluation.technicalScore).toBeGreaterThanOrEqual(0);
      expect(evaluation.technicalScore).toBeLessThanOrEqual(1);
      expect(evaluation.creativeScore).toBeGreaterThanOrEqual(0);
      expect(evaluation.creativeScore).toBeLessThanOrEqual(1);
    }, EVALUATOR_GALLERY_TIMEOUT);

    test('should track quality improvements over iterations', async () => {
      const projectName = 'quality-improvement-test';
      const iterations = 4;
      const scores = [];

      for (let i = 1; i <= iterations; i++) {
        const prompt = i === 1 ? 'Create basic sketch' : 'Improve and add detail';
        const code = P5Generator.generate(prompt, { iteration: i });
        const evaluation = CreativeEvaluator.assess(code);

        scores.push({
          iteration: i,
          score: evaluation.score,
          passed: evaluation.passed
        });

        if (evaluation.passed) {
          await gallery.saveIteration(projectName, i, code);
        }
      }

      // Verify we tracked scores for all iterations
      expect(scores.length).toBe(iterations);

      // Verify at least some iterations improved
      const passedIterations = scores.filter(s => s.passed);
      expect(passedIterations.length).toBeGreaterThan(0);

      // Verify gallery has saved iterations
      const history = await gallery.loadHistory(projectName);
      expect(history.length).toBe(passedIterations.length);
    }, EVALUATOR_GALLERY_TIMEOUT);

    test('should identify creative vs technical aspects', async () => {
      const projectName = 'aspect-analysis-test';

      // Technical-focused code
      const technicalCode = `
        function setup() {
          createCanvas(800, 600);
          frameRate(60);
        }

        function draw() {
          background(0);
          for (let i = 0; i < 1000; i++) {
            point(random(width), random(height));
          }
        }
      `;

      // Creative-focused code
      const creativeCode = `
        function setup() {
          createCanvas(800, 600);
          colorMode(HSB);
        }

        function draw() {
          background(frameCount % 360, 50, 50);
          fill(255);
          ellipse(mouseX, mouseY, 50 + sin(frameCount * 0.1) * 20);

          if (mouseIsPressed) {
            fill(random(255), random(255), random(255));
            rect(random(width), random(height), 30, 30);
          }
        }

        function mousePressed() {
          background(random(255));
        }
      `;

      const techEval = CreativeEvaluator.assess(technicalCode);
      const creativeEval = CreativeEvaluator.assess(creativeCode);

      // Both should pass but with different score profiles
      expect(techEval.passed).toBe(true);
      expect(creativeEval.passed).toBe(true);

      // Save both to gallery
      await gallery.saveIteration(projectName, 1, technicalCode);
      await gallery.saveIteration(projectName, 2, creativeCode);

      // Verify both saved
      const history = await gallery.loadHistory(projectName);
      expect(history.length).toBe(2);

      // Verify we can distinguish by metrics
      expect(creativeEval.metrics.hasInteractivity).toBe(true);
      expect(creativeEval.metrics.usesColor).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle evaluation errors gracefully', async () => {
      const projectName = 'eval-error-test';

      // Test with various edge cases
      const edgeCases = [
        null,
        undefined,
        '',
        '   ',
        123,
        {},
        []
      ];

      for (let i = 0; i < edgeCases.length; i++) {
        const input = edgeCases[i];
        const evaluation = CreativeEvaluator.assess(input);

        // Should handle gracefully without throwing
        expect(evaluation).toBeDefined();
        expect(evaluation.passed).toBe(false);
        expect(evaluation.score).toBe(0);

        // Should not save to gallery
        if (evaluation.passed) {
          await gallery.saveIteration(projectName, i + 1, input);
        }
      }

      // Verify nothing was saved
      const history = await gallery.loadHistory(projectName);
      expect(history.length).toBe(0);
    });

    test('should handle very long code', async () => {
      const projectName = 'long-code-test';

      // Generate very long code
      let longCode = 'function setup() { createCanvas(800, 600); }\nfunction draw() {\n';
      for (let i = 0; i < 1000; i++) {
        longCode += `  rect(${i}, ${i}, 10, 10);\n`;
      }
      longCode += '}';

      const evaluation = CreativeEvaluator.assess(longCode);

      expect(evaluation).toBeDefined();
      expect(evaluation.metrics.codeLength).toBeGreaterThan(10000);

      if (evaluation.passed) {
        await gallery.saveIteration(projectName, 1, longCode);

        // Verify saved correctly
        const history = await gallery.loadHistory(projectName);
        expect(history.length).toBe(1);
        expect(history[0].code).toBe(longCode);
      }
    });

    test('should handle unicode and special characters', async () => {
      const projectName = 'unicode-test';

      const unicodeCode = `
        function setup() {
          createCanvas(400, 400);
          // 测试中文
          // テスト日本語
          // 테스트한국어
        }

        function draw() {
          background(255);
          text("🎨 🖼️ ✨", mouseX, mouseY);
          fill("#FF5733");
          ellipse(200, 200, 100, 100);
        }
      `;

      const evaluation = CreativeEvaluator.assess(unicodeCode);

      expect(evaluation).toBeDefined();

      if (evaluation.passed) {
        await gallery.saveIteration(projectName, 1, unicodeCode);

        // Verify saved and loaded correctly
        const history = await gallery.loadHistory(projectName);
        expect(history.length).toBe(1);
        expect(history[0].code).toContain('🎨');
      }
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle rapid evaluation cycles', async () => {
      const projectName = 'rapid-eval-test';
      const cycles = 10;
      const startTime = Date.now();

      for (let i = 1; i <= cycles; i++) {
        const code = P5Generator.generate(`Rapid ${i}`, { iteration: i });
        const evaluation = CreativeEvaluator.assess(code);

        if (evaluation.passed) {
          await gallery.saveIteration(projectName, i, code);
        }
      }

      const duration = Date.now() - startTime;

      // Should complete rapidly (less than 30 seconds for 10 iterations)
      expect(duration).toBeLessThan(30000);

      // Verify results
      const history = await gallery.loadHistory(projectName);
      expect(history.length).toBeGreaterThan(0);
    }, EVALUATOR_GALLERY_TIMEOUT);

    test('should maintain performance with large gallery', async () => {
      const projectName = 'large-gallery-test';
      const iterations = 20;

      for (let i = 1; i <= iterations; i++) {
        const code = P5Generator.generate(`Large ${i}`, { iteration: i });
        const evaluation = CreativeEvaluator.assess(code);

        if (evaluation.passed) {
          await gallery.saveIteration(projectName, i, code);
        }
      }

      // Verify gallery can handle large history
      const startTime = Date.now();
      const history = await gallery.loadHistory(projectName);
      const loadTime = Date.now() - startTime;

      expect(history.length).toBeGreaterThan(0);
      expect(loadTime).toBeLessThan(5000); // Should load quickly
    }, EVALUATOR_GALLERY_TIMEOUT);
  });
});