/**
 * @fileoverview Detect weak test assertions that indicate PADDING/WEAK quality tests.
 *
 * This rule catches common patterns from low-quality test files:
 * - `toBeDefined()` / `toBeTruthy()` — proves existence, not correctness
 * - `typeof x === 'boolean'` without checking the expected value
 * - `toBeGreaterThan(0)` on scores without upper bound (score could be 999)
 * - `toContain('x')` on single-character strings (matches everything)
 * - `toBeDefined()` after constructor (PADDING test pattern)
 *
 * ## Rule Details
 *
 * Each pattern gets a specific message explaining why it's weak and what to use instead.
 *
 * @author sinter test quality enforcement
 */

'use strict';

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Detect weak test assertions that indicate PADDING/WEAK quality tests',
      recommended: true,
      url: 'https://github.com/sinter/sinter/blob/main/scripts/testing/eslint-rules/no-weak-test-assertions.js',
    },
    messages: {
      toBeDefined:
        '`toBeDefined()` only proves the value is not `undefined`, not that it is correct. ' +
        'Use `toBe(expectedValue)` or `toEqual(expectedShape)` instead.',
      toBeTruthy:
        '`toBeTruthy()` passes for any truthy value (1, "abc", {}, []). ' +
        'Use `toBe(true)`, `toBe(expectedValue)`, or `toEqual(expectedShape)` instead.',
      toBeFalsy:
        '`toBeFalsy()` passes for `0`, `""`, `null`, `undefined`, `false`. ' +
        'Use `toBe(false)` or `toBe(null)` to be explicit about the expected value.',
      typeofBoolean:
        '`typeof x === "boolean"` only checks the type, not the expected value. ' +
        'Use `expect(x).toBe(true)` or `expect(x).toBe(false)` to assert the actual value.',
      toContainSingleChar:
        '`toContain("{{char}}")` with a single character matches almost any string. ' +
        'Use a longer, more specific substring or `toMatch(/pattern/)` instead.',
      scoreGtZeroNoUpperBound:
        '`toBeGreaterThan(0)` on a score without an upper bound assertion. ' +
        'Add `toBeLessThanOrEqual(1)` (or the expected maximum) to constrain the range.',
      constructorDefined:
        '`toBeDefined()` after `new ClassName()` is a PADDING test. ' +
        'Test actual behavior: call a method and assert on the result.',
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename();

    // Only apply to test files
    if (!filename.includes('.test.') && !filename.includes('.spec.') && !filename.includes('/test/')) {
      return {};
    }

    /**
     * Check if a CallExpression is an expect() chain
     */
    function getExpectInfo(node) {
      if (node.type !== 'CallExpression') return null;
      const callee = node.callee;
      if (callee.type !== 'MemberExpression') return null;
      if (callee.object.type !== 'CallExpression') return null;

      // Check it's expect(...)
      const expectCall = callee.object;
      if (
        expectCall.callee.type !== 'Identifier' ||
        expectCall.callee.name !== 'expect'
      ) return null;

      return {
        matcher: callee.property.type === 'Identifier' ? callee.property.name : null,
        args: node.arguments,
        expectArg: expectCall.arguments[0],
      };
    }

    /**
     * Check if the expect argument is `typeof x === 'boolean'`
     */
    function isTypeofBooleanCheck(node) {
      if (!node) return false;
      if (node.type !== 'BinaryExpression') return false;
      if (node.operator !== '===' && node.operator !== '==') return false;

      const left = node.left;
      const right = node.right;

      // typeof x === 'boolean' or 'boolean' === typeof x
      if (
        left.type === 'UnaryExpression' &&
        left.operator === 'typeof' &&
        right.type === 'Literal' &&
        right.value === 'boolean'
      ) return true;

      if (
        right.type === 'UnaryExpression' &&
        right.operator === 'typeof' &&
        left.type === 'Literal' &&
        left.value === 'boolean'
      ) return true;

      return false;
    }

    /**
     * Detect PADDING pattern: const x = new ClassName(); expect(x).toBeDefined()
     */
    function isConstructorDefinedPattern(expectInfo) {
      if (expectInfo.matcher !== 'toBeDefined') return false;
      const arg = expectInfo.expectArg;
      if (!arg || arg.type !== 'Identifier') return false;

      // Walk up to find the variable declaration
      // This is a simplified check — we just look for `new X` in the same scope
      return false; // We'll handle this via a different approach
    }

    return {
      // Check expect(...).toBeDefined()
      CallExpression(node) {
        const info = getExpectInfo(node);
        if (!info) return;

        // toBeDefined() — weak
        if (info.matcher === 'toBeDefined') {
          context.report({
            node,
            messageId: 'toBeDefined',
          });
          return;
        }

        // toBeTruthy() — weak
        if (info.matcher === 'toBeTruthy') {
          context.report({
            node,
            messageId: 'toBeTruthy',
          });
          return;
        }

        // toBeFalsy() — weak
        if (info.matcher === 'toBeFalsy') {
          context.report({
            node,
            messageId: 'toBeFalsy',
          });
          return;
        }

        // toBe(true) or toBe(false) — these are fine, skip
        if (info.matcher === 'toBe' && info.args.length === 1) {
          const arg = info.args[0];
          if (arg.type === 'Literal' && (arg.value === true || arg.value === false || arg.value === null)) {
            return;
          }
        }

        // toContain('x') with single-char string
        if (info.matcher === 'toContain' && info.args.length === 1) {
          const arg = info.args[0];
          if (arg.type === 'Literal' && typeof arg.value === 'string' && arg.value.length === 1) {
            context.report({
              node,
              messageId: 'toContainSingleChar',
              data: { char: arg.value },
            });
            return;
          }
        }

        // toBeGreaterThan(0) on score-like variable without upper bound
        if (info.matcher === 'toBeGreaterThan' && info.args.length === 1) {
          const arg = info.args[0];
          if (arg.type === 'Literal' && arg.value === 0) {
            // Check if the expect argument looks like a score
            const expectArg = info.expectArg;
            const isScoreLike =
              expectArg?.type === 'MemberExpression' &&
              expectArg.property?.type === 'Identifier' &&
              /score|rating|value|result/i.test(expectArg.property.name || '');

            if (isScoreLike) {
              context.report({
                node,
                messageId: 'scoreGtZeroNoUpperBound',
              });
            }
          }
          return;
        }

        // typeof x === 'boolean' inside expect() — weak
        if (info.matcher === 'toBe' && info.args.length === 1) {
          const arg = info.args[0];
          if (arg.type === 'Literal' && arg.value === true) {
            // Check the expect argument is `typeof x === 'boolean'`
            if (isTypeofBooleanCheck(info.expectArg)) {
              context.report({
                node: info.expectArg,
                messageId: 'typeofBoolean',
              });
            }
          }
        }
      },

      // typeof x === 'boolean' standalone expression in assertions
      BinaryExpression(node) {
        if (!isTypeofBooleanCheck(node)) return;

        // Check if this is inside an expect() call
        if (
          node.parent?.type === 'CallExpression' &&
          node.parent.callee?.type === 'Identifier' &&
          node.parent.callee.name === 'expect'
        ) {
          context.report({
            node,
            messageId: 'typeofBoolean',
          });
        }
      },
    };
  },
};
