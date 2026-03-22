/**
 * Unit tests for RelationshipExtractor
 *
 * Tests Tier 1 (import graph) and Tier 2 (local call graph) extraction.
 */

import { describe, it, expect } from 'vitest';
import * as ts from 'typescript';
import { RelationshipExtractor } from '../../../../src/core/parsing/RelationshipExtractor.js';

describe('RelationshipExtractor', () => {
  describe('Tier 1: Import graph extraction', () => {
    it('should extract named imports with callee and module', () => {
      const code = `import { foo, bar } from './module.js';`;
      const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);

      const imports = RelationshipExtractor.extractImports(sourceFile);

      expect(imports).toHaveLength(2);
      expect(imports).toContainEqual({ callee: 'foo', module: './module.js' });
      expect(imports).toContainEqual({ callee: 'bar', module: './module.js' });
    });

    it('should extract default imports with callee and module', () => {
      const code = `import foo from './module.js';`;
      const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);

      const imports = RelationshipExtractor.extractImports(sourceFile);

      expect(imports).toHaveLength(1);
      expect(imports[0]).toEqual({ callee: 'foo', module: './module.js' });
    });

    it('should extract namespace imports with callee and module', () => {
      const code = `import * as utils from './utils.js';`;
      const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);

      const imports = RelationshipExtractor.extractImports(sourceFile);

      expect(imports).toHaveLength(1);
      expect(imports[0]).toEqual({ callee: 'utils', module: './utils.js' });
    });

    it('should handle bare imports (side-effect modules)', () => {
      const code = `import './polyfills.js';`;
      const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);

      const imports = RelationshipExtractor.extractImports(sourceFile);

      expect(imports).toHaveLength(1);
      expect(imports[0]).toEqual({ callee: './polyfills.js', module: './polyfills.js' });
    });

    it('should extract mixed import types', () => {
      const code = `
import { Component } from 'react';
import { serve } from 'bun';
import * as fs from 'node:fs';
import defaultExport from './default.js';
`;
      const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);

      const imports = RelationshipExtractor.extractImports(sourceFile);

      expect(imports).toHaveLength(4);
      expect(imports).toContainEqual({ callee: 'Component', module: 'react' });
      expect(imports).toContainEqual({ callee: 'serve', module: 'bun' });
      expect(imports).toContainEqual({ callee: 'fs', module: 'node:fs' });
      expect(imports).toContainEqual({ callee: 'defaultExport', module: './default.js' });
    });

    it('should handle exported declarations as tier 1 relationships', () => {
      const code = `
export function baz() {
  return 'baz';
}

export const value = 42;
`;
      const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);

      const imports = RelationshipExtractor.extractImports(sourceFile);

      // No imports in this file
      expect(imports).toHaveLength(0);
    });
  });

  describe('Tier 2: Local call graph extraction', () => {
    it('should extract function calls within function body', () => {
      const code = `
function myFunc(x: number) {
  return foo(x);
}
`;
      const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);

      const symbols = [{ name: 'myFunc', kind: 'function' as const }];
      const calls = RelationshipExtractor.extractCalls(sourceFile, symbols);

      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual({
        caller: 'myFunc',
        callee: 'foo',
        argCount: 1,
      });
    });

    it('should extract multiple calls from same function', () => {
      const code = `
function caller() {
  foo();
  bar();
  baz(1, 2, 3);
}
`;
      const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);

      const symbols = [{ name: 'caller', kind: 'function' as const }];
      const calls = RelationshipExtractor.extractCalls(sourceFile, symbols);

      expect(calls).toHaveLength(3);
      expect(calls).toContainEqual({ caller: 'caller', callee: 'foo', argCount: 0 });
      expect(calls).toContainEqual({ caller: 'caller', callee: 'bar', argCount: 0 });
      expect(calls).toContainEqual({ caller: 'caller', callee: 'baz', argCount: 3 });
    });

    it('should extract method calls (property access)', () => {
      const code = `
function process() {
  array.map(x => x * 2);
  console.log('test');
}
`;
      const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);

      const symbols = [{ name: 'process', kind: 'function' as const }];
      const calls = RelationshipExtractor.extractCalls(sourceFile, symbols);

      expect(calls).toHaveLength(2);
      expect(calls).toContainEqual({ caller: 'process', callee: 'map', argCount: 1 });
      expect(calls).toContainEqual({ caller: 'process', callee: 'log', argCount: 1 });
    });

    it('should capture calls to external symbols (not in symbol table)', () => {
      const code = `
function myFunc() {
  console.log('external');
  return Math.random();
}
`;
      const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);

      const symbols = [{ name: 'myFunc', kind: 'function' as const }];
      const calls = RelationshipExtractor.extractCalls(sourceFile, symbols);

      // Should still capture calls to external symbols
      expect(calls).toHaveLength(2);
      expect(calls).toContainEqual({ caller: 'myFunc', callee: 'log', argCount: 1 });
      expect(calls).toContainEqual({ caller: 'myFunc', callee: 'random', argCount: 0 });
    });

    it('should deduplicate repeated calls to same callee', () => {
      const code = `
function caller() {
  foo();
  bar();
  foo(); // Call foo again
}
`;
      const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);

      const symbols = [{ name: 'caller', kind: 'function' as const }];
      const calls = RelationshipExtractor.extractCalls(sourceFile, symbols);

      // Should deduplicate - only one entry for foo
      const fooCalls = calls.filter(c => c.callee === 'foo');
      expect(fooCalls).toHaveLength(1);

      // But should still have both foo and bar
      expect(calls).toHaveLength(2);
    });

    it('should extract calls from class methods', () => {
      const code = `
class Calculator {
  add(x: number, y: number) {
    return this.sum(x, y);
  }

  sum(x: number, y: number) {
    return x + y;
  }
}
`;
      const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);

      const symbols = [
        { name: 'add', kind: 'method' as const },
        { name: 'sum', kind: 'method' as const },
      ];
      const calls = RelationshipExtractor.extractCalls(sourceFile, symbols);

      expect(calls).toContainEqual({ caller: 'add', callee: 'sum', argCount: 2 });
    });

    it('should extract calls from arrow functions', () => {
      const code = `
const arrow = (x: number) => {
  return helper(x);
};
`;
      const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);

      const symbols = [{ name: 'arrow', kind: 'function' as const }];
      const calls = RelationshipExtractor.extractCalls(sourceFile, symbols);

      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual({ caller: 'arrow', callee: 'helper', argCount: 1 });
    });
  });

  describe('Edge cases', () => {
    it('should handle empty file', () => {
      const code = ``;
      const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);

      const imports = RelationshipExtractor.extractImports(sourceFile);
      const calls = RelationshipExtractor.extractCalls(sourceFile, []);

      expect(imports).toHaveLength(0);
      expect(calls).toHaveLength(0);
    });

    it('should handle file with no imports', () => {
      const code = `
function local() {
  return 42;
}
`;
      const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);

      const imports = RelationshipExtractor.extractImports(sourceFile);

      expect(imports).toHaveLength(0);
    });

    it('should handle file with no function calls', () => {
      const code = `
function standalone() {
  const x = 42;
  return x;
}
`;
      const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);

      const symbols = [{ name: 'standalone', kind: 'function' as const }];
      const calls = RelationshipExtractor.extractCalls(sourceFile, symbols);

      expect(calls).toHaveLength(0);
    });

    it('should handle nested function calls', () => {
      const code = `
function outer() {
  foo(bar(baz()));
}
`;
      const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);

      const symbols = [{ name: 'outer', kind: 'function' as const }];
      const calls = RelationshipExtractor.extractCalls(sourceFile, symbols);

      // Should capture all three calls
      expect(calls).toHaveLength(3);
      expect(calls).toContainEqual({ caller: 'outer', callee: 'foo', argCount: 1 });
      expect(calls).toContainEqual({ caller: 'outer', callee: 'bar', argCount: 1 });
      expect(calls).toContainEqual({ caller: 'outer', callee: 'baz', argCount: 0 });
    });

    it('should handle complex expressions with calls', () => {
      const code = `
function complex() {
  const result = obj?.method?.();
  const value = (callback || defaultCallback)();
}
`;
      const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);

      const symbols = [{ name: 'complex', kind: 'function' as const }];
      const calls = RelationshipExtractor.extractCalls(sourceFile, symbols);

      // Should capture method and both potential callbacks
      expect(calls.length).toBeGreaterThan(0);
    });

    it('should handle new expressions (constructor calls)', () => {
      const code = `
function create() {
  return new MyClass(arg1, arg2);
}
`;
      const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);

      const symbols = [{ name: 'create', kind: 'function' as const }];
      const calls = RelationshipExtractor.extractCalls(sourceFile, symbols);

      // New expressions are also calls
      expect(calls).toContainEqual({ caller: 'create', callee: 'MyClass', argCount: 2 });
    });
  });

  describe('Deduplication', () => {
    it('should not duplicate import entries for same import', () => {
      const code = `import { foo } from './module.js';`;
      const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);

      const imports = RelationshipExtractor.extractImports(sourceFile);

      // Single import should appear once
      expect(imports).toHaveLength(1);
    });

    it('should not duplicate call entries for repeated calls', () => {
      const code = `
function repeat() {
  foo();
  foo();
  foo();
}
`;
      const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);

      const symbols = [{ name: 'repeat', kind: 'function' as const }];
      const calls = RelationshipExtractor.extractCalls(sourceFile, symbols);

      // Three calls to foo should be deduplicated to one
      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual({ caller: 'repeat', callee: 'foo', argCount: 0 });
    });
  });
});
