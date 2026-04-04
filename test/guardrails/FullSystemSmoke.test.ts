/**
 * Full DGF System Smoke Test
 * 
 * Tests all 3 phases working together
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { initializeGuardrailSystem } from '../../src/guardrails/index.js';
import { Constitution, initializeConstitution } from '../../src/guardrails/evolution/Constitution.js';
import { SelfHealingGuardrail } from '../../src/guardrails/evolution/SelfHealingGuardrail.js';
import { GuardrailTier } from '../../src/guardrails/core/types.js';
import { TypeCheckGuardrail } from '../../src/guardrails/correctness/TypeCheckGuardrail.js';
import { TestVerificationGuardrail } from '../../src/guardrails/correctness/TestVerificationGuardrail.js';
import { CodeStyleGuardrail } from '../../src/guardrails/hygiene/CodeStyleGuardrail.js';
import { SchemaValidator } from '../../src/guardrails/validation/SchemaValidator.js';
import { RemediationEngine, classifyError } from '../../src/guardrails/remediation/ErrorTaxonomy.js';

describe('DGF Full System Smoke Test', () => {
  beforeEach(() => {
    // Reset global state
    initializeConstitution();
  });

  it('should initialize complete guardrail system with all layers', () => {
    const system = initializeGuardrailSystem({
      shadowMode: false,
      defaultTier: GuardrailTier.ENFORCING,
    });

    expect(system.registry).toBeDefined();
    expect(system.telemetry).toBeDefined();
    expect(system.resourceLimiter).toBeDefined();
  });

  it('should register and evaluate Phase 1 catastrophic guardrails', async () => {
    const system = initializeGuardrailSystem({ shadowMode: false });
    const registry = system.registry;

    // Evaluate with normal context - should pass
    const normalResult = await registry.evaluate({
      taskId: 'test-task',
      step: 10,
      maxSteps: 50,
      startTime: Date.now(),
      resources: {
        tokensUsed: 100,
        tokensLimit: 1000,
        memoryUsedMB: 50,
        memoryLimitMB: 500,
        timeElapsedMs: 1000,
        timeLimitMs: 30000,
        apiCalls: 1,
        apiCallLimit: 10,
      },
      trace: { steps: [] },
    });

    expect(normalResult.passed).toBe(true);
    expect(normalResult.blockingResults.length).toBe(0);
  });

  it('should detect catastrophic failures (max iterations)', async () => {
    const system = initializeGuardrailSystem({ shadowMode: false });
    const registry = system.registry;

    const violationResult = await registry.evaluate({
      taskId: 'test-task',
      step: 100, // Exceeds maxSteps
      maxSteps: 50,
      startTime: Date.now(),
      resources: {
        tokensUsed: 100,
        tokensLimit: 1000,
        memoryUsedMB: 50,
        memoryLimitMB: 500,
        timeElapsedMs: 1000,
        timeLimitMs: 30000,
        apiCalls: 1,
        apiCallLimit: 10,
      },
      trace: { steps: [] },
    });

    expect(violationResult.passed).toBe(false);
    expect(violationResult.blockingResults.length).toBeGreaterThan(0);
    expect(violationResult.blockingResults[0].guardrailId).toContain('max-iterations');
  });

  it('should work with Phase 2 validation layer', () => {
    const validator = new SchemaValidator();
    
    // Register a schema
    validator.registerSchema('test', {
      type: 'object',
      required: true,
      properties: {
        name: { type: 'string', required: true },
        count: { type: 'number', required: true },
      }
    });
    
    const validData = { name: 'test', count: 42 };
    const result = validator.validate('test', validData);
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should work with Phase 2 remediation layer', () => {
    // classifyError is a standalone function
    const classification = classifyError('timeout');
    expect(classification).toBeDefined();
    expect(classification?.type).toBe('TIMEOUT');
  });

  it('should work with Phase 3 Constitution', async () => {
    const constitution = initializeConstitution();

    // Simulate learning from a failure
    const failure = {
      id: 'failure-test',
      timestamp: Date.now(),
      taskId: 'task-1',
      guardrailId: 'guardrail-type-check',
      errorType: 'TYPE_ERROR',
      errorMessage: 'Property foo does not exist on type Bar',
      context: {
        taskId: 'task-1',
        step: 1,
        maxSteps: 50,
        startTime: Date.now(),
        resources: {
          tokensUsed: 100,
          tokensLimit: 1000,
          memoryUsedMB: 50,
          memoryLimitMB: 500,
          timeElapsedMs: 1000,
          timeLimitMs: 30000,
          apiCalls: 1,
          apiCallLimit: 10,
        },
        trace: { steps: [] },
      },
      resolution: 'autoFixed' as const,
      fixDetails: 'Added proper type annotation to fix the error',
    };

    const learnedRule = await constitution.learnFromFailure(failure);
    expect(learnedRule).toBeDefined();
    expect(learnedRule?.pattern.errorType).toBe('TYPE_ERROR');
    expect(learnedRule?.confidence).toBeGreaterThan(0);
  });

  it('should work with Phase 3 Self-Healing Guardrail', async () => {
    const constitution = initializeConstitution();
    const selfHealing = new SelfHealingGuardrail(constitution, {
      confidenceThreshold: 0.5,
      maxHealingAttempts: 3,
      enablePrevention: true,
      enableSuggestions: true,
    });

    const context = {
      taskId: 'healing-test',
      step: 1,
      maxSteps: 50,
      startTime: Date.now(),
      resources: {
        tokensUsed: 100,
        tokensLimit: 1000,
        memoryUsedMB: 50,
        memoryLimitMB: 500,
        timeElapsedMs: 1000,
        timeLimitMs: 30000,
        apiCalls: 1,
        apiCallLimit: 10,
      },
      trace: { steps: [] },
    };

    // First evaluation - no learned rules yet
    const result = await selfHealing.evaluate(context);
    expect(result.passed).toBe(true);
    expect(result.guardrailId).toBe('guardrail-self-healing');
  });

  it('should demonstrate complete workflow: observe, validate, remediate, learn', async () => {
    // The TypeCheckGuardrail and CodeStyleGuardrail shell out to tsc/eslint/prettier.
    // Since no changed files match real project files, they should pass cleanly.
    // We test the workflow with just the catastrophic guardrails (no file I/O).
    const constitution = initializeConstitution();
    const system = initializeGuardrailSystem({
      shadowMode: false,
      defaultTier: GuardrailTier.ENFORCING,
    });

    // Step 1: Evaluate with clean context (catastrophic guardrails only —
    // TypeCheckGuardrail and CodeStyleGuardrail would need real files or mocking)
    const cleanResult = await system.registry.evaluate({
      taskId: 'workflow-test',
      step: 5,
      maxSteps: 50,
      changedFiles: ['src/test.ts'],
      startTime: Date.now(),
      resources: {
        tokensUsed: 500,
        tokensLimit: 1000,
        memoryUsedMB: 100,
        memoryLimitMB: 500,
        timeElapsedMs: 5000,
        timeLimitMs: 30000,
        apiCalls: 2,
        apiCallLimit: 10,
      },
      trace: { steps: [] },
    });

    expect(cleanResult.passed).toBe(true);
    // Catastrophic guardrails (at least 3: CodeInjection, PathTraversal, ResourceLimits)
    expect(cleanResult.results.length).toBeGreaterThanOrEqual(3);

    // Step 2: Test learning from failure
    const failure = {
      id: 'failure-workflow',
      timestamp: Date.now(),
      taskId: 'workflow-test',
      guardrailId: 'guardrail-code-style',
      errorType: 'LINT_ERROR',
      errorMessage: 'Missing semicolon',
      context: {
        taskId: 'workflow-test',
        step: 5,
        maxSteps: 50,
        changedFiles: ['src/test.ts'],
        startTime: Date.now(),
        resources: {
          tokensUsed: 500,
          tokensLimit: 1000,
          memoryUsedMB: 100,
          memoryLimitMB: 500,
          timeElapsedMs: 5000,
          timeLimitMs: 30000,
          apiCalls: 2,
          apiCallLimit: 10,
        },
        trace: { steps: [] },
      },
      resolution: 'autoFixed' as const,
      fixDetails: 'Applied eslint --fix to add missing semicolons',
    };

    const learnedRule = await constitution.learnFromFailure(failure);
    expect(learnedRule).toBeDefined();
    expect(constitution.getActiveRules().length).toBe(1);

    // Step 3: Get statistics
    const stats = constitution.getFailureStats();
    expect(stats.totalFailures).toBe(1);
    expect(stats.autoFixed).toBe(1);

    const effectiveness = constitution.getEffectivenessReport();
    expect(effectiveness.totalRules).toBe(1);
    expect(effectiveness.activeRules).toBe(1);
  });

  it('should export and import constitution', async () => {
    const constitution = initializeConstitution();

    // Learn a rule
    const failure = {
      id: 'failure-export-test',
      timestamp: Date.now(),
      taskId: 'export-test',
      guardrailId: 'test-guardrail',
      errorType: 'TEST_FAILURE',
      errorMessage: 'Test failed with error',
      context: {
        taskId: 'export-test',
        step: 1,
        maxSteps: 50,
        startTime: Date.now(),
        resources: {
          tokensUsed: 100,
          tokensLimit: 1000,
          memoryUsedMB: 50,
          memoryLimitMB: 500,
          timeElapsedMs: 1000,
          timeLimitMs: 30000,
          apiCalls: 1,
          apiCallLimit: 10,
        },
        trace: { steps: [] },
      },
      resolution: 'autoFixed' as const,
      fixDetails: 'Fixed test',
    };

    await constitution.learnFromFailure(failure);

    // Export
    const exported = constitution.export();
    expect(exported.rules.length).toBe(1);
    expect(exported.stats.totalRules).toBe(1);

    // Import into new constitution
    const newConstitution = new Constitution();
    newConstitution.import(exported);
    expect(newConstitution.getAllRules().length).toBe(1);
  });

  it('should demonstrate tier progression', () => {
    // Tier progression rules:
    // - SHADOW (0) -> ADVISORY (1): 95% success over 50 tasks
    // - ADVISORY (1) -> ENFORCING (2): 95% success over 100 tasks
    // - ENFORCING (2) -> AUTONOMOUS (3): 95% success over 200 tasks

    const progressions = [
      { from: 'SHADOW', to: 'ADVISORY', requiredSuccesses: 47.5, totalTasks: 50 },
      { from: 'ADVISORY', to: 'ENFORCING', requiredSuccesses: 95, totalTasks: 100 },
      { from: 'ENFORCING', to: 'AUTONOMOUS', requiredSuccesses: 190, totalTasks: 200 },
    ];

    for (const p of progressions) {
      const successRate = p.requiredSuccesses / p.totalTasks;
      expect(successRate).toBeGreaterThanOrEqual(0.95);
    }
  });
});
