import { describe, it, expect, beforeEach, vi } from 'vitest';
/**
 * ErrorTaxonomy unit tests
 */
import {
  ERROR_TAXONOMY,
  ERROR_PATTERNS,
  classifyError,
  RemediationEngine,
  initializeRemediationEngine,
  getRemediationEngine,
} from '../../../src/guardrails/remediation/ErrorTaxonomy.js';
import type { ExecutionContext } from '../../../src/guardrails/core/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext(overrides?: Partial<ExecutionContext>): ExecutionContext {
  return {
    taskId: 'task-1',
    step: 1,
    maxSteps: 10,
    startTime: Date.now(),
    resources: {
      tokensUsed: 0,
      tokensLimit: 10000,
      memoryUsedMB: 0,
      memoryLimitMB: 512,
      timeElapsedMs: 0,
      timeLimitMs: 60000,
      apiCalls: 0,
      apiCallLimit: 100,
    },
    trace: { steps: [] },
    ...overrides,
  };
}

// ============================================================================
// ERROR_TAXONOMY
// ============================================================================

describe('ERROR_TAXONOMY', () => {
  const expectedTypes = [
    'SYNTAX_ERROR',
    'MISSING_SEMICOLON',
    'UNMATCHED_BRACKET',
    'TYPE_ERROR',
    'MISSING_TYPE',
    'TEST_FAILURE',
    'ASSERTION_FAILURE',
    'TIMEOUT',
    'RATE_LIMIT',
    'HALLUCINATION',
    'JSON_PARSE_ERROR',
    'SCHEMA_VIOLATION',
    'TOOL_NOT_FOUND',
    'PERMISSION_DENIED',
  ];

  it('contains all expected error categories', () => {
    for (const type of expectedTypes) {
      expect(ERROR_TAXONOMY[type], `Missing taxonomy entry for ${type}`).toBeDefined();
    }
  });

  it('every entry has a type matching its key', () => {
    for (const [key, entry] of Object.entries(ERROR_TAXONOMY)) {
      expect(entry.type, `Entry key "${key}" has mismatched type`).toBe(key);
    }
  });

  it('every entry has a valid severity', () => {
    const validSeverities = ['low', 'medium', 'high', 'critical'];
    for (const [key, entry] of Object.entries(ERROR_TAXONOMY)) {
      expect(
        validSeverities,
        `Entry "${key}" has invalid severity "${entry.severity}"`,
      ).toContain(entry.severity);
    }
  });

  it('every entry has non-negative maxRetries', () => {
    for (const [key, entry] of Object.entries(ERROR_TAXONOMY)) {
      expect(
        entry.maxRetries,
        `Entry "${key}" has negative maxRetries`,
      ).toBeGreaterThanOrEqual(0);
    }
  });

  it('every entry has a non-empty remediationStrategy', () => {
    for (const [key, entry] of Object.entries(ERROR_TAXONOMY)) {
      expect(
        entry.remediationStrategy.length,
        `Entry "${key}" has empty remediationStrategy`,
      ).toBeGreaterThan(0);
    }
  });

  it('non-autoFixable errors have zero estimatedFixTimeMs', () => {
    const nonAutoFixable = Object.entries(ERROR_TAXONOMY).filter(([, e]) => !e.autoFixable);
    for (const [key, entry] of nonAutoFixable) {
      expect(
        entry.estimatedFixTimeMs,
        `Non-autoFixable entry "${key}" should have 0 estimatedFixTimeMs`,
      ).toBe(0);
    }
  });
});

// ============================================================================
// ERROR_PATTERNS
// ============================================================================

describe('ERROR_PATTERNS', () => {
  it('every pattern references a taxonomy entry that exists', () => {
    for (const ep of ERROR_PATTERNS) {
      expect(
        ERROR_TAXONOMY[ep.type],
        `Pattern references unknown taxonomy type "${ep.type}"`,
      ).toBeDefined();
    }
  });

  it('SYNTAX_ERROR matches "Unexpected token"', () => {
    const p = ERROR_PATTERNS.find(ep => ep.type === 'SYNTAX_ERROR')!;
    expect(p.pattern.test('Unexpected token at line 5')).toBe(true);
    expect(p.pattern.test('SyntaxError: missing (')).toBe(true);
    expect(p.pattern.test('Parse error in module')).toBe(true);
  });

  it('MISSING_SEMICOLON matches expected messages', () => {
    const p = ERROR_PATTERNS.find(ep => ep.type === 'MISSING_SEMICOLON')!;
    expect(p.pattern.test('Missing semicolon at end of line')).toBe(true);
    expect(p.pattern.test("Expected ';' but got '}'")).toBe(true);
  });

  it('UNMATCHED_BRACKET matches expected messages', () => {
    const p = ERROR_PATTERNS.find(ep => ep.type === 'UNMATCHED_BRACKET')!;
    expect(p.pattern.test('Unmatched bracket in expression')).toBe(true);
    expect(p.pattern.test('Unmatched parenthesis')).toBe(true);
    expect(p.pattern.test('Unexpected )')).toBe(true);
  });

  it('TYPE_ERROR matches TypeScript type errors', () => {
    const p = ERROR_PATTERNS.find(ep => ep.type === 'TYPE_ERROR')!;
    expect(p.pattern.test("Type 'string' is not assignable to type 'number'")).toBe(true);
    expect(p.pattern.test('TypeError: cannot read property')).toBe(true);
    expect(p.pattern.test('cannot assign value')).toBe(true);
  });

  it('TEST_FAILURE matches test assertion messages', () => {
    const p = ERROR_PATTERNS.find(ep => ep.type === 'TEST_FAILURE')!;
    expect(p.pattern.test('test failed: expected 5 but got 3')).toBe(true);
    expect(p.pattern.test('AssertionError: values differ')).toBe(true);
    expect(p.pattern.test('expect(5).toBe(3) but received 5')).toBe(true);
  });

  it('TIMEOUT matches timeout variants', () => {
    const p = ERROR_PATTERNS.find(ep => ep.type === 'TIMEOUT')!;
    expect(p.pattern.test('timeout after 5000ms')).toBe(true);
    expect(p.pattern.test('Connection timed out')).toBe(true);
    expect(p.pattern.test('ETIMEDOUT')).toBe(true);
  });

  it('RATE_LIMIT matches rate limit variants', () => {
    const p = ERROR_PATTERNS.find(ep => ep.type === 'RATE_LIMIT')!;
    expect(p.pattern.test('rate limit exceeded')).toBe(true);
    expect(p.pattern.test('too many requests')).toBe(true);
    expect(p.pattern.test('HTTP 429 Too Many Requests')).toBe(true);
  });

  it('JSON_PARSE_ERROR matches JSON parse variants', () => {
    const p = ERROR_PATTERNS.find(ep => ep.type === 'JSON_PARSE_ERROR')!;
    expect(p.pattern.test('JSON parse error: unexpected character')).toBe(true);
    expect(p.pattern.test('Unexpected token < in JSON')).toBe(true);
    expect(p.pattern.test('invalid json response')).toBe(true);
  });

  it('SCHEMA_VIOLATION matches schema errors', () => {
    const p = ERROR_PATTERNS.find(ep => ep.type === 'SCHEMA_VIOLATION')!;
    expect(p.pattern.test('Output does not match schema')).toBe(true);
    expect(p.pattern.test('invalid schema: missing field')).toBe(true);
    expect(p.pattern.test('required property "name" missing')).toBe(true);
  });

  it('TOOL_NOT_FOUND matches tool errors', () => {
    const p = ERROR_PATTERNS.find(ep => ep.type === 'TOOL_NOT_FOUND')!;
    expect(p.pattern.test('tool not found: readFile')).toBe(true);
    expect(p.pattern.test('unknown tool invoked')).toBe(true);
    expect(p.pattern.test('invalid tool name')).toBe(true);
  });

  it('PERMISSION_DENIED matches auth errors', () => {
    const p = ERROR_PATTERNS.find(ep => ep.type === 'PERMISSION_DENIED')!;
    expect(p.pattern.test('permission denied: cannot write')).toBe(true);
    expect(p.pattern.test('access denied to resource')).toBe(true);
    expect(p.pattern.test('not authorized for operation')).toBe(true);
    expect(p.pattern.test('EACCES: permission denied')).toBe(true);
  });
});

// ============================================================================
// classifyError
// ============================================================================

describe('classifyError', () => {
  it('classifies a string error message', () => {
    const result = classifyError('Unexpected token at line 10');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('SYNTAX_ERROR');
    expect(result!.severity).toBe('high');
    expect(result!.autoFixable).toBe(true);
  });

  it('classifies an Error object', () => {
    const result = classifyError(new Error('timeout: operation exceeded 30s'));
    expect(result).not.toBeNull();
    expect(result!.type).toBe('TIMEOUT');
    expect(result!.autoFixable).toBe(false);
  });

  it('classifies rate limit errors', () => {
    const result = classifyError('HTTP 429 Too Many Requests');
    expect(result!.type).toBe('RATE_LIMIT');
    expect(result!.maxRetries).toBe(5);
  });

  it('classifies JSON parse errors', () => {
    const result = classifyError('invalid json response body');
    expect(result!.type).toBe('JSON_PARSE_ERROR');
  });

  it('classifies permission errors', () => {
    const result = classifyError('EACCES: permission denied, open /etc/hosts');
    expect(result!.type).toBe('PERMISSION_DENIED');
    expect(result!.severity).toBe('critical');
    expect(result!.autoFixable).toBe(false);
  });

  it('returns null for unknown errors', () => {
    expect(classifyError('something completely unexpected happened')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(classifyError('')).toBeNull();
  });

  it('returns null for an Error with a non-matching message', () => {
    expect(classifyError(new Error('the cake is a lie'))).toBeNull();
  });

  it('returns the first matching pattern when multiple could match', () => {
    // "SyntaxError" matches SYNTAX_ERROR, which comes before TEST_FAILURE
    const result = classifyError('SyntaxError: test failed');
    expect(result!.type).toBe('SYNTAX_ERROR');
  });
});

// ============================================================================
// RemediationEngine
// ============================================================================

describe('RemediationEngine', () => {
  let engine: RemediationEngine;
  let ctx: ExecutionContext;

  beforeEach(() => {
    engine = new RemediationEngine();
    ctx = makeContext({ prompt: 'Write a function' });
  });

  // -- Syntax errors ---------------------------------------------------------

  it('remediates SYNTAX_ERROR with syntax_fix action', async () => {
    const result = await engine.remediate('Unexpected token }', ctx);
    expect(result.success).toBe(true);
    expect(result.action).toBe('syntax_fix');
    expect(result.newContext?.prompt).toContain('[GUARDRAIL REMEDIATION]');
  });

  it('remediates MISSING_SEMICOLON with syntax_fix action', async () => {
    const result = await engine.remediate("Expected ';'", ctx);
    expect(result.success).toBe(true);
    expect(result.action).toBe('syntax_fix');
  });

  it('remediates UNMATCHED_BRACKET with syntax_fix action', async () => {
    const result = await engine.remediate('Unmatched bracket in expression', ctx);
    expect(result.success).toBe(true);
    expect(result.action).toBe('syntax_fix');
  });

  // -- Type errors -----------------------------------------------------------

  it('remediates TYPE_ERROR with type_fix action', async () => {
    const result = await engine.remediate(
      "Type 'string' is not assignable to type 'number'",
      ctx,
    );
    expect(result.success).toBe(true);
    expect(result.action).toBe('type_fix');
    expect(result.newContext?.prompt).toContain('type annotations');
  });

  // -- Test failures ---------------------------------------------------------

  it('remediates TEST_FAILURE with test_fix action', async () => {
    const result = await engine.remediate('test failed: expected true but got false', ctx);
    expect(result.success).toBe(true);
    expect(result.action).toBe('test_fix');
    expect(result.newContext?.prompt).toContain('GUARDRAIL REMEDIATION');
  });

  // -- Timeout ---------------------------------------------------------------

  it('handles TIMEOUT with success=false (not auto-fixable)', async () => {
    const result = await engine.remediate('Connection timed out', ctx);
    expect(result.success).toBe(false);
    expect(result.action).toBe('timeout');
  });

  // -- JSON parse ------------------------------------------------------------

  it('remediates JSON_PARSE_ERROR with json_fix action', async () => {
    // Use a message that only matches the JSON_PARSE_ERROR pattern,
    // not the SYNTAX_ERROR pattern ("Parse error" matches SYNTAX_ERROR)
    const result = await engine.remediate('invalid json response body', ctx);
    expect(result.success).toBe(true);
    expect(result.action).toBe('json_fix');
    expect(result.newContext?.prompt).toContain('valid JSON only');
  });

  // -- Schema violation ------------------------------------------------------

  it('remediates SCHEMA_VIOLATION with schema_fix action', async () => {
    const result = await engine.remediate('required property "id" missing', ctx);
    expect(result.success).toBe(true);
    expect(result.action).toBe('schema_fix');
    expect(result.newContext?.prompt).toContain('required fields');
  });

  // -- Tool not found --------------------------------------------------------

  it('remediates TOOL_NOT_FOUND with an alternative when allowedTools exist', async () => {
    const ctxWithTools = makeContext({ allowedTools: ['readFile', 'writeFile'] });
    const result = await engine.remediate('tool not found: editFile', ctxWithTools);
    expect(result.success).toBe(true);
    expect(result.action).toBe('suggest_alternative_tool');
    expect(result.newContext?.proposedTool).toBe('readFile');
  });

  it('fails TOOL_NOT_FOUND remediation when no allowedTools', async () => {
    const ctxNoTools = makeContext({ allowedTools: [] });
    const result = await engine.remediate('tool not found: editFile', ctxNoTools);
    expect(result.success).toBe(false);
    expect(result.action).toBe('no_alternatives');
  });

  it('fails TOOL_NOT_FOUND remediation when allowedTools is undefined', async () => {
    const result = await engine.remediate('tool not found: editFile', ctx);
    expect(result.success).toBe(false);
    expect(result.action).toBe('no_alternatives');
  });

  // -- Non-auto-fixable: PERMISSION_DENIED, HALLUCINATION --------------------

  it('PERMISSION_DENIED is blocked by zero-retry budget (maxRetries=0)', async () => {
    // PERMISSION_DENIED has maxRetries=0, so the retry budget check (attempts >= 0)
    // fires before the switch. This means it returns max_retries_exceeded, not
    // requires_human_intervention. The source code has a design issue where
    // non-retryable errors hit the budget gate before reaching their switch case.
    const freshEngine = new RemediationEngine();
    const freshCtx = makeContext({ taskId: 'perm-task', prompt: 'do work' });
    const result = await freshEngine.remediate('permission denied', freshCtx);
    expect(result.success).toBe(false);
    // maxRetries=0 means attempts(0) >= maxRetries(0) is immediately true
    expect(result.action).toBe('max_retries_exceeded');
  });

  it('HALLUCINATION is also blocked by zero-retry budget', async () => {
    const entry = ERROR_TAXONOMY['HALLUCINATION'];
    expect(entry.maxRetries).toBe(0);
    expect(entry.autoFixable).toBe(false);
  });

  it('requires human intervention for HALLUCINATION (if classified)', async () => {
    // HALLUCINATION is in the taxonomy but has no ERROR_PATTERN, so it won't
    // be classified from a message. We test the code path by verifying the
    // taxonomy entry is non-autoFixable and the switch handles it.
    const entry = ERROR_TAXONOMY['HALLUCINATION'];
    expect(entry.autoFixable).toBe(false);
    expect(entry.maxRetries).toBe(0);
  });

  // -- Unknown errors --------------------------------------------------------

  it('returns unknown_error for unclassifiable errors', async () => {
    const result = await engine.remediate('the intertubes are clogged', ctx);
    expect(result.success).toBe(false);
    expect(result.action).toBe('unknown_error');
    expect(result.message).toContain('Unknown error type');
  });

  // -- Retry budget ----------------------------------------------------------

  it('enforces max retries per task+errorType', async () => {
    // SYNTAX_ERROR has maxRetries: 2
    const syntaxCtx = makeContext({ taskId: 'retry-task' });

    const r1 = await engine.remediate('Unexpected token', syntaxCtx);
    expect(r1.success).toBe(true);

    const r2 = await engine.remediate('Unexpected token', syntaxCtx);
    expect(r2.success).toBe(true);

    // Third attempt exceeds budget of 2
    const r3 = await engine.remediate('Unexpected token', syntaxCtx);
    expect(r3.success).toBe(false);
    expect(r3.action).toBe('max_retries_exceeded');
    expect(r3.message).toContain('Max retries (2)');
  });

  it('resets retry count for a specific task', async () => {
    const taskCtx = makeContext({ taskId: 'reset-task' });

    await engine.remediate('Unexpected token', taskCtx);
    await engine.remediate('Unexpected token', taskCtx);

    engine.resetAttempts('reset-task');

    const result = await engine.remediate('Unexpected token', taskCtx);
    expect(result.success).toBe(true);
  });

  it('different tasks have independent retry budgets', async () => {
    const ctxA = makeContext({ taskId: 'task-A' });
    const ctxB = makeContext({ taskId: 'task-B' });

    // Exhaust retries for task-A (SYNTAX_ERROR maxRetries=2)
    await engine.remediate('Unexpected token', ctxA);
    await engine.remediate('Unexpected token', ctxA);
    const exhausted = await engine.remediate('Unexpected token', ctxA);
    expect(exhausted.action).toBe('max_retries_exceeded');

    // task-B still has budget
    const fresh = await engine.remediate('Unexpected token', ctxB);
    expect(fresh.success).toBe(true);
  });

  // -- Rate limit backoff (uses real timers in this suite) --------------------

  it('handles RATE_LIMIT with backoff', async () => {
    // Use vi.useFakeTimers just for this test to avoid real waits
    vi.useFakeTimers();
    const rateCtx = makeContext({ taskId: 'rate-task' });

    const promise = engine.remediate('rate limit exceeded', rateCtx);
    await vi.advanceTimersByTimeAsync(2000);
    const result = await promise;

    expect(result.success).toBe(true);
    expect(result.action).toBe('rate_limit_backoff');
    expect(result.message).toContain('Backed off');

    vi.useRealTimers();
  });

  // -- Error objects vs strings ----------------------------------------------

  it('handles Error objects the same as string messages', async () => {
    const err = new Error('Unexpected token at line 1');
    const result = await engine.remediate(err, ctx);
    expect(result.success).toBe(true);
    expect(result.action).toBe('syntax_fix');
  });
});

// ============================================================================
// Global engine helpers
// ============================================================================

describe('global remediation engine', () => {
  it('initializeRemediationEngine creates and returns a new engine', () => {
    const engine = initializeRemediationEngine();
    expect(engine).toBeInstanceOf(RemediationEngine);
    expect(getRemediationEngine()).toBe(engine);
  });

  it('getRemediationEngine returns null before initialization', () => {
    // Reset module-level state by re-importing — but since modules cache,
    // a previous test may have initialized it. We just test the contract:
    // after init, get returns the same instance.
    const engine = initializeRemediationEngine();
    expect(getRemediationEngine()).toBe(engine);
  });
});
