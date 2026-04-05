/**
 * @fileoverview Require vi.hoisted() for mock variables referenced in vi.mock() factories.
 *
 * Vitest hoists `vi.mock()` calls above all `const`/`let` declarations. Any variable
 * referenced inside a `vi.mock()` factory must be created via `vi.hoisted()` or it
 * will throw `ReferenceError: Cannot access 'X' before initialization`.
 *
 * ## Rule Details
 *
 * This rule detects:
 * 1. `const { x, y } = vi.hoisted(() => ...)` — GOOD (allowed)
 * 2. `const x = vi.fn()` followed by `vi.mock('...', () => ({ fn: x }))` — BAD (x is not hoisted)
 * 3. `const mockX = vi.fn()` at module level in test files, where mockX is later
 *    used inside `vi.mock()` — BAD
 *
 * ## Options
 *
 * None.
 *
 * @author liminal test quality enforcement
 */

'use strict';

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require vi.hoisted() for mock variables used in vi.mock() factories',
      recommended: true,
      url: 'https://github.com/liminal/liminal/blob/main/scripts/testing/eslint-rules/require-vi-hoisted.js',
    },
    messages: {
      notHoisted:
        '`{{name}}` is used inside `vi.mock()` but was not created with `vi.hoisted()`. ' +
        'Vitest hoists `vi.mock()` above all declarations — this causes `ReferenceError: Cannot access before initialization`. ' +
        'Wrap in `const { {{name}} } = vi.hoisted(() => ({ {{name}}: vi.fn() }))`.',
      notHoistedDestructured:
        'Mock variables `{{names}}` are used inside `vi.mock()` but were not created with `vi.hoisted()`. ' +
        'Vitest hoists `vi.mock()` above all declarations — this causes `ReferenceError`. ' +
        'Wrap in `vi.hoisted(() => ({ ... }))`.',
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename();

    // Only apply to test files
    if (!filename.includes('.test.') && !filename.includes('.spec.') && !filename.includes('/test/')) {
      return {};
    }

    // Track variable declarations and their init expressions
    /** @type {Map<string, { hoisted: boolean, node: import('eslint').Rule.Node }>} */
    const declarations = new Map();

    // Track all identifiers used inside vi.mock() factories
    /** @type {Set<string>} */
    const mockReferencedVars = new Set();

    // Track vi.mock() factory node ranges so we can check references
    /** @type {Array<{ start: number, end: number }>} */
    const mockFactoryRanges = [];

    /**
     * Check if a node is inside a vi.mock() factory callback
     */
    function isInsideMockFactory(node) {
      let current = node;
      while (current) {
        if (
          current.type === 'CallExpression' &&
          current.callee.type === 'MemberExpression' &&
          current.callee.object.type === 'Identifier' &&
          current.callee.object.name === 'vi' &&
          current.callee.property.type === 'Identifier' &&
          current.callee.property.name === 'mock'
        ) {
          // The factory is the last argument (callback)
          const factoryArg = current.arguments[current.arguments.length - 1];
          if (factoryArg && node.range && factoryArg.range) {
            return node.range[0] >= factoryArg.range[0] && node.range[1] <= factoryArg.range[1];
          }
        }
        current = current.parent;
      }
      return false;
    }

    return {
      // Track variable declarations at module level
      VariableDeclarator(node) {
        // Only track module-level declarations
        if (node.parent?.parent?.type !== 'Program') return;

        if (node.id.type === 'Identifier') {
          const name = node.id.name;
          const init = node.init;

          // Check if it's vi.hoisted()
          const isHoisted =
            init?.type === 'CallExpression' &&
            init?.callee?.type === 'MemberExpression' &&
            init?.callee?.object?.type === 'Identifier' &&
            init?.callee?.object?.name === 'vi' &&
            init?.callee?.property?.type === 'Identifier' &&
            init?.callee?.property?.name === 'hoisted';

          declarations.set(name, { hoisted: isHoisted, node });
        }

        // Handle destructured vi.hoisted: const { a, b } = vi.hoisted(...)
        if (node.id.type === 'ObjectPattern' && node.init) {
          const init = node.init;
          const isHoisted =
            init.type === 'CallExpression' &&
            init.callee?.type === 'MemberExpression' &&
            init.callee.object?.type === 'Identifier' &&
            init.callee.object?.name === 'vi' &&
            init.callee.property?.type === 'Identifier' &&
            init.callee.property?.name === 'hoisted';

          for (const prop of node.id.properties) {
            if (prop.type === 'Property' && prop.value.type === 'Identifier') {
              declarations.set(prop.value.name, { hoisted: isHoisted, node });
            }
          }
        }
      },

      // Find vi.mock() calls and track factory ranges
      CallExpression(node) {
        const isViMock =
          node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'vi' &&
          node.callee.property.type === 'Identifier' &&
          node.callee.property.name === 'mock';

        if (!isViMock || node.arguments.length < 2) return;

        const factory = node.arguments[node.arguments.length - 1];
        if (factory.range) {
          mockFactoryRanges.push({ start: factory.range[0], end: factory.range[1] });
        }
      },

      // Track identifier references inside vi.mock() factories
      'CallExpression > ArrowFunctionExpression Identifier'(node) {
        if (isInsideMockFactory(node) && node.parent?.type !== 'MemberExpression') {
          const name = node.name;
          // Skip vi, expect, and other globals
          if (['vi', 'expect', 'Promise', 'console', 'Error', 'undefined', 'null', 'true', 'false'].includes(name)) return;
          // Skip property names (left side of MemberExpression)
          if (node.parent?.type === 'MemberExpression' && node.parent.property === node && !node.parent.computed) return;
          // Skip object keys
          if (node.parent?.type === 'Property' && node.parent.key === node && !node.parent.computed) return;
          // Skip function parameters
          if (node.parent?.type === 'ArrowFunctionExpression' || node.parent?.type === 'FunctionExpression') return;

          mockReferencedVars.add(name);
        }
      },

      // Report violations at end of file (after collecting all data)
      'Program:exit'() {
        for (const name of mockReferencedVars) {
          const decl = declarations.get(name);
          if (decl && !decl.hoisted) {
            context.report({
              node: decl.node,
              messageId: 'notHoisted',
              data: { name },
            });
          }
        }
      },
    };
  },
};
