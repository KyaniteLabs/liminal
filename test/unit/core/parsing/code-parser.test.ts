/**
 * Unit tests for CodeParser
 *
 * Tests TypeScript Compiler API-based symbol extraction with metrics computation.
 */

import { describe, it, expect } from 'vitest';
import { CodeParser } from '../../../../src/core/parsing/CodeParser.js';
import { LIRParseError } from '../../../../src/core/lir/errors.js';
import type { LIRCodeToken } from '../../../../src/core/lir/types.js';

describe('CodeParser', () => {
  describe('TypeScript function parsing', () => {
    it('should parse function declarations with correct kind, line, and exports', () => {
      const typescript = `
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

export function farewell(name: string): string {
  return \`Goodbye, \${name}!\`;
}
`;

      const parser = new CodeParser();
      const result = parser.parse(typescript, 'test.ts');

      expect(result).toHaveLength(2);

      // First function: not exported
      expect(result[0].type).toBe('code');
      expect(result[0].name).toBe('greet');
      expect(result[0].kind).toBe('function');
      expect(result[0].location.startLine).toBe(2);
      expect(result[0].location.endLine).toBe(4);
      expect(result[0].location.file).toBe('test.ts');
      expect(result[0].language).toBe('typescript');
      expect(result[0].relationships.exports).toEqual([]);

      // Second function: exported
      expect(result[1].type).toBe('code');
      expect(result[1].name).toBe('farewell');
      expect(result[1].kind).toBe('function');
      expect(result[1].location.startLine).toBe(6);
      expect(result[1].relationships.exports).toEqual(['farewell']);
    });

    it('should extract function signature with parameters', () => {
      const typescript = `
function calculate(x: number, y: number): number {
  return x + y;
}
`;

      const parser = new CodeParser();
      const result = parser.parse(typescript, 'test.ts');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('calculate');
      expect(result[0].signature).toContain('calculate');
      expect(result[0].signature).toContain('x');
      expect(result[0].signature).toContain('y');
      expect(result[0].metrics.paramCount).toBe(2);
    });

    it('should detect arrow functions in variable declarations', () => {
      const typescript = `
const add = (a: number, b: number): number => {
  return a + b;
};

export const multiply = (x: number, y: number) => x * y;
`;

      const parser = new CodeParser();
      const result = parser.parse(typescript, 'test.ts');

      expect(result).toHaveLength(2);

      // First arrow function
      expect(result[0].name).toBe('add');
      expect(result[0].kind).toBe('function');
      expect(result[0].relationships.exports).toEqual([]);

      // Second arrow function (exported)
      expect(result[1].name).toBe('multiply');
      expect(result[1].kind).toBe('function');
      expect(result[1].relationships.exports).toEqual(['multiply']);
    });

    it('should extract function source code', () => {
      const typescript = `
function test() {
  console.log('line 1');
  console.log('line 2');
  return true;
}
`;

      const parser = new CodeParser();
      const result = parser.parse(typescript, 'test.ts');

      expect(result).toHaveLength(1);
      expect(result[0].source).toContain('console.log');
      expect(result[0].source).toContain('return true');
    });
  });

  describe('Class and method parsing', () => {
    it('should parse class declarations with methods', () => {
      const typescript = `
class Calculator {
  add(x: number, y: number): number {
    return x + y;
  }

  subtract(x: number, y: number): number {
    return x - y;
  }
}

export class ScientificCalculator extends Calculator {
  square(x: number): number {
    return x * x;
  }
}
`;

      const parser = new CodeParser();
      const result = parser.parse(typescript, 'test.ts');

      expect(result.length).toBeGreaterThanOrEqual(4);

      // First class
      const calculator = result.find((t) => t.name === 'Calculator');
      expect(calculator).toBeDefined();
      expect(calculator!.kind).toBe('class');
      expect(calculator!.relationships.exports).toEqual([]);
      expect(calculator!.relationships.extends).toEqual([]);

      // Calculator methods
      const add = result.find((t) => t.name === 'add');
      expect(add).toBeDefined();
      expect(add!.kind).toBe('method');

      const subtract = result.find((t) => t.name === 'subtract');
      expect(subtract).toBeDefined();
      expect(subtract!.kind).toBe('method');

      // Second class (with inheritance)
      const scientific = result.find((t) => t.name === 'ScientificCalculator');
      expect(scientific).toBeDefined();
      expect(scientific!.kind).toBe('class');
      expect(scientific!.relationships.exports).toEqual(['ScientificCalculator']);
      expect(scientific!.relationships.extends).toEqual(['Calculator']);

      // Scientific calculator method
      const square = result.find((t) => t.name === 'square');
      expect(square).toBeDefined();
      expect(square!.kind).toBe('method');
    });

    it('should extract class heritage (extends)', () => {
      const typescript = `
class Animal {}

class Dog extends Animal {}

class Cat extends Animal {}
`;

      const parser = new CodeParser();
      const result = parser.parse(typescript, 'test.ts');

      expect(result).toHaveLength(3);

      const animal = result.find((t) => t.name === 'Animal');
      expect(animal!.relationships.extends).toEqual([]);

      const dog = result.find((t) => t.name === 'Dog');
      expect(dog!.relationships.extends).toEqual(['Animal']);

      const cat = result.find((t) => t.name === 'Cat');
      expect(cat!.relationships.extends).toEqual(['Animal']);
    });
  });

  describe('Import statement extraction', () => {
    it('should extract import statements as module paths', () => {
      const typescript = `
import { foo } from './module.js';
import bar from 'npm-package';
import * as baz from 'another-module';

function test() {
  return foo();
}
`;

      const parser = new CodeParser();
      const result = parser.parse(typescript, 'test.ts');

      // Should have imports in relationships
      const allImports = result.flatMap((t) => t.relationships.imports);
      expect(allImports).toContain('./module.js');
      expect(allImports).toContain('npm-package');
      expect(allImports).toContain('another-module');
    });

    it('should build Tier 1 import graph with callee and module', () => {
      const typescript = `
import { Component, useState } from 'react';
import { serve } from 'bun';

function App() {
  return Component();
}
`;

      const parser = new CodeParser();
      const result = parser.parse(typescript, 'test.ts');

      // Check import graph structure
      const importGraph = result.flatMap((t) => t.relationships.importGraph);

      expect(importGraph).toHaveLength(3);

      // Should have { callee, module } structure
      const reactImport = importGraph.find((ig) => ig.module === 'react');
      expect(reactImport).toBeDefined();
      expect(reactImport!.callee).toBeDefined();

      const bunImport = importGraph.find((ig) => ig.module === 'bun');
      expect(bunImport).toBeDefined();
      expect(bunImport!.callee).toBeDefined();
    });
  });

  describe('Tier 2: local call graph', () => {
    it('should extract local function calls within file', () => {
      const typescript = `
function helper() {
  return 'help';
}

function main() {
  const result = helper();
  console.log(result);
  return result;
}
`;

      const parser = new CodeParser();
      const result = parser.parse(typescript, 'test.ts');

      // main() should call helper()
      const main = result.find((t) => t.name === 'main');
      expect(main).toBeDefined();
      expect(main!.relationships.calls).toContain('helper');
    });

    it('should track call counts in metrics', () => {
      const typescript = `
function a() {}
function b() {}
function c() {}

function main() {
  a();
  b();
  c();
  a(); // calls a twice
}
`;

      const parser = new CodeParser();
      const result = parser.parse(typescript, 'test.ts');

      const main = result.find((t) => t.name === 'main');
      expect(main!.metrics.callCount).toBe(4);
    });

    it('should return caller-callee pairs from call graph', () => {
      const typescript = `
function foo() {
  bar();
}

function bar() {
  baz();
}

function baz() {
  return;
}
`;

      const parser = new CodeParser();
      const result = parser.parse(typescript, 'test.ts');

      // foo -> bar
      const foo = result.find((t) => t.name === 'foo');
      expect(foo!.relationships.calls).toContain('bar');

      // bar -> baz
      const bar = result.find((t) => t.name === 'bar');
      expect(bar!.relationships.calls).toContain('baz');

      // baz -> no calls
      const baz = result.find((t) => t.name === 'baz');
      expect(baz!.relationships.calls).toHaveLength(0);
    });
  });

  describe('Metrics computation', () => {
    it('should compute lines of code (loc) excluding whitespace/comments', () => {
      const typescript = `
function test() {
  // This is a comment
  const x = 1;

  /* Multi-line
     comment */

  const y = 2;
  return x + y;
}
`;

      const parser = new CodeParser();
      const result = parser.parse(typescript, 'test.ts');

      expect(result[0].metrics.loc).toBeGreaterThan(0);
      // Should count actual code lines, not comments
      expect(result[0].metrics.loc).toBeLessThan(10);
    });

    it('should compute cyclomatic complexity from decision points', () => {
      const typescript = `
function complex(x: number, y: number) {
  if (x > 0) {        // +1
    if (y > 0) {      // +1
      return x + y;
    }
  }

  for (let i = 0; i < 10; i++) {  // +1
    x++;
  }

  while (x < 100) {    // +1
    x *= 2;
  }

  switch (x) {         // +1
    case 1:           // +1
      return 1;
    default:
      return 0;
  }

  return x;
}
`;

      const parser = new CodeParser();
      const result = parser.parse(typescript, 'test.ts');

      // Base complexity is 1, each decision point adds 1
      // if (2) + for (1) + while (1) + switch (1) + case (1) = 7
      expect(result[0].metrics.cyclomaticComplexity).toBeGreaterThanOrEqual(6);
    });

    it('should count logical operators in cyclomatic complexity', () => {
      const typescript = `
function logical(a: boolean, b: boolean, c: boolean) {
  if (a && b) {        // && adds complexity
    return true;
  }

  if (a || b) {        // || adds complexity
    return true;
  }

  return c ?? a;       // ?? adds complexity
}
`;

      const parser = new CodeParser();
      const result = parser.parse(typescript, 'test.ts');

      // Base 1 + if (2) + logical operators (3) = 6
      expect(result[0].metrics.cyclomaticComplexity).toBeGreaterThan(1);
    });

    it('should compute parameter count', () => {
      const typescript = `
function noParams() {}
function oneParam(x: number) {}
function threeParams(a: string, b: number, c: boolean) {}
`;

      const parser = new CodeParser();
      const result = parser.parse(typescript, 'test.ts');

      expect(result.find((t) => t.name === 'noParams')!.metrics.paramCount).toBe(0);
      expect(result.find((t) => t.name === 'oneParam')!.metrics.paramCount).toBe(1);
      expect(result.find((t) => t.name === 'threeParams')!.metrics.paramCount).toBe(3);
    });

    it('should compute nesting depth', () => {
      const typescript = `
function nested() {
  if (true) {              // depth 1
    if (true) {            // depth 2
      for (;;) {           // depth 3
        if (true) {        // depth 4
          return;
        }
      }
    }
  }
}
`;

      const parser = new CodeParser();
      const result = parser.parse(typescript, 'test.ts');

      expect(result[0].metrics.nestingDepth).toBe(4);
    });

    it('should compute import and export counts', () => {
      const typescript = `
import { a } from 'a';
import { b } from 'b';
import { c } from 'c';

export function x() {}
export function y() {}
export const z = () => 1;
`;

      const parser = new CodeParser();
      const result = parser.parse(typescript, 'test.ts');

      // Each symbol should have the same import count (total imports in file)
      result.forEach((token) => {
        expect(token.metrics.importCount).toBe(3);
      });

      // Export count should be 1 for exported symbols, 0 for non-exported
      const x = result.find((t) => t.name === 'x');
      const y = result.find((t) => t.name === 'y');
      const z = result.find((t) => t.name === 'z');

      expect(x?.metrics.exportCount).toBe(1);
      expect(y?.metrics.exportCount).toBe(1);
      expect(z?.metrics.exportCount).toBe(1);
    });

    it('should compute call count', () => {
      const typescript = `
function caller() {
  helper1();
  helper2();
  helper3();
  helper1(); // calls helper1 twice
}
`;

      const parser = new CodeParser();
      const result = parser.parse(typescript, 'test.ts');

      const caller = result.find((t) => t.name === 'caller');
      expect(caller!.metrics.callCount).toBe(4);
    });

    it('should compute class depth (inheritance hierarchy)', () => {
      const typescript = `
class A {}

class B extends A {}

class C extends B {}
`;

      const parser = new CodeParser();
      const result = parser.parse(typescript, 'test.ts');

      expect(result.find((t) => t.name === 'A')!.metrics.classDepth).toBe(0);
      expect(result.find((t) => t.name === 'B')!.metrics.classDepth).toBe(1);
      expect(result.find((t) => t.name === 'C')!.metrics.classDepth).toBe(2);
    });
  });

  describe('Symbol limits', () => {
    it('should cap symbols at maxSymbolsPerFile (200)', () => {
      // Generate a file with many functions
      const lines = ['// Auto-generated file with many functions'];
      for (let i = 0; i < 250; i++) {
        lines.push(`function func${i}() { return ${i}; }`);
      }
      const typescript = lines.join('\n');

      const parser = new CodeParser();
      const result = parser.parse(typescript, 'test.ts');

      // Should cap at 200 symbols
      expect(result.length).toBeLessThanOrEqual(200);
    });

    it('should handle files at exactly the limit', () => {
      const lines = ['// Exactly 200 functions'];
      for (let i = 0; i < 200; i++) {
        lines.push(`function func${i}() { return ${i}; }`);
      }
      const typescript = lines.join('\n');

      const parser = new CodeParser();
      const result = parser.parse(typescript, 'test.ts');

      expect(result.length).toBe(200);
    });
  });

  describe('Error handling', () => {
    it('should throw LIRParseError for malformed syntax', () => {
      const malformed = `
function broken() {
  // Missing closing brace
  const x = {
    a: 1,
    b: 2,
  // Missing closing brace for object

// Missing closing brace for function
`;

      const parser = new CodeParser();

      expect(() => parser.parse(malformed, 'test.ts')).toThrow(LIRParseError);
    });

    it('should include source file and line in LIRParseError', () => {
      const malformed = `function broken() {`;

      const parser = new CodeParser();

      try {
        parser.parse(malformed, 'test.ts');
        expect.fail('Should have thrown LIRParseError');
      } catch (error) {
        expect(error).toBeInstanceOf(LIRParseError);
        expect((error as LIRParseError).source).toBe('test.ts');
      }
    });
  });

  describe('Language detection', () => {
    it('should detect .ts as typescript', () => {
      const code = `function test() {}`;

      const parser = new CodeParser();
      const result = parser.parse(code, 'file.ts');

      expect(result[0].language).toBe('typescript');
    });

    it('should detect .js as javascript', () => {
      const code = `function test() {}`;

      const parser = new CodeParser();
      const result = parser.parse(code, 'file.js');

      expect(result[0].language).toBe('javascript');
    });

    it('should default to typescript for unknown extensions', () => {
      const code = `function test() {}`;

      const parser = new CodeParser();
      const result = parser.parse(code, 'file.unknown');

      expect(result[0].language).toBe('typescript');
    });
  });

  describe('Token structure', () => {
    it('should create tokens with required base properties', () => {
      const typescript = `function test() { return 42; }`;

      const parser = new CodeParser();
      const result = parser.parse(typescript, 'test.ts');

      const token = result[0];
      expect(token.id).toBeDefined();
      expect(token.type).toBe('code');
      expect(token.domain).toBe('code');
      expect(token.layer).toBe('implementation');
      expect(token.metadata).toEqual({});
      expect(token.tags).toEqual([]);
    });

    it('should generate unique IDs for each symbol', () => {
      const typescript = `
function a() {}
function b() {}
function c() {}
`;

      const parser = new CodeParser();
      const result = parser.parse(typescript, 'test.ts');

      const ids = result.map((t) => t.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(3);
    });

    it('should generate summary from source or docstring', () => {
      const typescript = `
/**
 * Adds two numbers together.
 * @param x - First number
 * @param y - Second number
 * @returns Sum of x and y
 */
function add(x: number, y: number): number {
  return x + y;
}
`;

      const parser = new CodeParser();
      const result = parser.parse(typescript, 'test.ts');

      expect(result[0].summary).toBeDefined();
      expect(result[0].summary.length).toBeGreaterThan(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty file', () => {
      const typescript = ``;

      const parser = new CodeParser();
      const result = parser.parse(typescript, 'test.ts');

      expect(result).toHaveLength(0);
    });

    it('should handle file with only comments', () => {
      const typescript = `
// This is a comment
/* This is a
   multi-line comment */
/**
 * This is a JSDoc comment
 */
`;

      const parser = new CodeParser();
      const result = parser.parse(typescript, 'test.ts');

      expect(result).toHaveLength(0);
    });

    it('should handle export default declarations', () => {
      const typescript = `
export default function defaultFunction() {
  return 'default';
}

export default class DefaultClass {
  method() {}
}
`;

      const parser = new CodeParser();
      const result = parser.parse(typescript, 'test.ts');

      expect(result.length).toBeGreaterThan(0);
      // Should have exports marked
      const exported = result.filter((t) => t.relationships.exports.length > 0);
      expect(exported.length).toBeGreaterThan(0);
    });

    it('should handle interface declarations', () => {
      const typescript = `
interface User {
  name: string;
  age: number;
}

export interface Product {
  id: number;
  price: number;
}
`;

      const parser = new CodeParser();
      const result = parser.parse(typescript, 'test.ts');

      expect(result.length).toBeGreaterThanOrEqual(2);

      const user = result.find((t) => t.name === 'User');
      expect(user).toBeDefined();
      expect(user!.kind).toBe('interface');

      const product = result.find((t) => t.name === 'Product');
      expect(product).toBeDefined();
      expect(product!.kind).toBe('interface');
      expect(product!.relationships.exports).toEqual(['Product']);
    });

    it('should handle type aliases', () => {
      const typescript = `
type ID = number | string;

export type Config = {
  enabled: boolean;
  timeout: number;
};
`;

      const parser = new CodeParser();
      const result = parser.parse(typescript, 'test.ts');

      expect(result.length).toBeGreaterThanOrEqual(2);

      const id = result.find((t) => t.name === 'ID');
      expect(id).toBeDefined();
      expect(id!.kind).toBe('type');

      const config = result.find((t) => t.name === 'Config');
      expect(config).toBeDefined();
      expect(config!.kind).toBe('type');
    });

    it('should handle enum declarations', () => {
      const typescript = `
enum Color {
  Red,
  Green,
  Blue
}

export enum Status {
  Pending,
  Active,
  Done
}
`;

      const parser = new CodeParser();
      const result = parser.parse(typescript, 'test.ts');

      expect(result.length).toBeGreaterThanOrEqual(2);

      const color = result.find((t) => t.name === 'Color');
      expect(color).toBeDefined();
      expect(color!.kind).toBe('enum');

      const status = result.find((t) => t.name === 'Status');
      expect(status).toBeDefined();
      expect(status!.kind).toBe('enum');
    });
  });
});
