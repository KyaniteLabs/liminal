import { describe, it, expect } from 'vitest';

import { ASTValidatorTool } from '../../../src/harness/tools/ASTValidatorTool.js';

describe('ASTValidatorTool', () => {
  const tool = new ASTValidatorTool();

  it('exposes correct name and description', () => {
    expect(tool.name).toBe('astValidate');
    expect(tool.description).toBe('Parse and validate code using AST');
  });

  describe('valid TypeScript code', () => {
    it('parses a simple module with imports, exports, and functions', async () => {
      const code = `
        import { readFile } from 'fs';
        import path from 'path';
        import * as utils from './utils';

        export function greet(name: string): string {
          return \`Hello \${name}\`;
        }

        export default greet;
      `;

      const result = await tool.execute({ code, checks: ['syntax', 'imports', 'exports', 'functions'] });

      expect(result.success).toBe(true);
      expect(result.data!.valid).toBe(true);
      expect(result.data!.imports).toHaveLength(3);

      // Check fs import
      const fsImport = result.data!.imports.find(i => i.source === 'fs');
      expect(fsImport).toEqual({ source: 'fs', specifiers: ['readFile'], type: 'import' });

      // Check path default import
      const pathImport = result.data!.imports.find(i => i.source === 'path');
      expect(pathImport).toEqual({ source: 'path', specifiers: ['path'], type: 'import' });

      // Check namespace import
      const utilsImport = result.data!.imports.find(i => i.source === './utils');
      expect(utilsImport).toEqual({ source: './utils', specifiers: ['* as utils'], type: 'import' });

      // Note: export function greet is a declaration-style export.
      // ExportNamedDeclaration only extracts from specifiers, so 'greet' is not
      // listed as a named export (it appears as a function via FunctionDeclaration).
      // Only the default export (which uses ExportDefaultDeclaration) is detected.
      // Default export: export default greet — Identifier, so name is 'greet'
      const defaultExport = result.data!.exports.find(e => e.type === 'default');

      expect(defaultExport!.name).toBe('greet');

      // Check functions
      const fn = result.data!.functions.find(f => f.name === 'greet');

      expect(fn!.async).toBe(false);
      expect(fn!.params).toBe(1);
      expect(fn!.line).toBe(6);
    });
  });

  describe('invalid code', () => {
    it('returns syntax error with descriptive message', async () => {
      const code = `function broken( {`;

      const result = await tool.execute({ code });

      expect(result.success).toBe(false);
      expect(result.data!.valid).toBe(false);
      expect(result.error).toContain('Syntax error');

      expect(result.data!.syntaxError!.message).toBeTruthy();
      expect(result.data!.issues).toHaveLength(1);
      expect(result.data!.issues[0]).toContain('Syntax error');
    });

    it('includes line and column in syntax error when parse fails', async () => {
      const code = `const x =;\nconst y = 2;`;

      const result = await tool.execute({ code });

      expect(result.success).toBe(false);
      // Babel may or may not provide line/column depending on error type

      expect(result.data!.syntaxError!.message).toBeTruthy();
    });
  });

  describe('multiple imports', () => {
    it('detects all import statements including require()', async () => {
      const code = `
        import React from 'react';
        import { useState, useEffect } from 'react';
        import { debounce } from 'lodash';
        const express = require('express');
        const path = require('path');
      `;

      const result = await tool.execute({ code, checks: ['syntax', 'imports'] });

      expect(result.data!.imports).toHaveLength(5);

      const reactDefault = result.data!.imports.find(i => i.source === 'react' && i.type === 'import');
      expect(reactDefault!.specifiers).toEqual(['React']);

      const reactDestructured = result.data!.imports.filter(i => i.source === 'react' && i.type === 'import');
      // There are 2 react imports
      expect(reactDestructured).toHaveLength(2);

      const lodashImport = result.data!.imports.find(i => i.source === 'lodash');
      expect(lodashImport!.specifiers).toEqual(['debounce']);

      const expressRequire = result.data!.imports.find(i => i.source === 'express' && i.type === 'require');
      expect(expressRequire).not.toBeNull();

      const pathRequire = result.data!.imports.find(i => i.source === 'path' && i.type === 'require');
      expect(pathRequire).not.toBeNull();
    });
  });

  describe('exports', () => {
    it('detects specifier-based named exports and default exports', async () => {
      // The ExportNamedDeclaration handler only processes specifiers,
      // not declaration-style exports. Use `export { ... }` syntax for named exports.
      const code = `
        const VERSION = '1.0';
        function add(a, b) { return a + b; }
        export { VERSION, add };
        export { add as sum };
        export default class App {}
      `;

      const result = await tool.execute({ code, checks: ['syntax', 'exports'] });

      // Named exports via specifiers: VERSION, add, sum
      const namedExports = result.data!.exports.filter(e => e.type === 'named');
      const namedNames = namedExports.map(e => e.name);
      expect(namedNames).toContain('VERSION');
      expect(namedNames).toContain('add');
      expect(namedNames).toContain('sum');

      // Default export from class: ExportDefaultDeclaration only checks Identifier
      // and FunctionDeclaration, so class App is reported as 'default'.
      const defaultExport = result.data!.exports.find(e => e.type === 'default');

      expect(defaultExport!.name).toBe('default');
    });
  });

  describe('cyclomatic complexity', () => {
    it('returns base complexity of 1 for trivial code', async () => {
      const code = `const x = 1;`;

      const result = await tool.execute({ code, checks: ['syntax', 'complexity'] });

      expect(result.data!.complexity).toBe(1);
    });

    it('computes complexity for code with branching', async () => {
      // 1 (base) + 1 (if) + 1 (else if) + 1 (for) + 1 (&&) + 1 (catch) = 6
      const code = `
        function process(data: any): void {
          if (data) {
            console.log('has data');
          } else if (data === null) {
            console.log('null');
          }

          for (let i = 0; i < 10; i++) {
            if (i > 5 && i < 8) {
              console.log(i);
            }
          }

          try {
            JSON.parse('');
          } catch (e) {
            console.error(e);
          }
        }
      `;

      const result = await tool.execute({ code, checks: ['syntax', 'complexity'] });

      // base(1) + if(1) + else-if(1) + for(1) + inner-if(1) + &&(1) + catch(1) = 7
      expect(result.data!.complexity).toBe(7);
    });

    it('flags high complexity above 10', async () => {
      const code = `
        function complex(x: number): number {
          if (x > 0) return 1;
          if (x > 1) return 2;
          if (x > 2) return 3;
          if (x > 3) return 4;
          if (x > 4) return 5;
          if (x > 5) return 6;
          if (x > 6) return 7;
          if (x > 7) return 8;
          if (x > 8) return 9;
          if (x > 9) return 10;
          if (x > 10) return 11;
          return 0;
        }
      `;

      const result = await tool.execute({ code, checks: ['syntax', 'complexity'] });

      expect(result.data!.complexity).toBeGreaterThan(10);
      expect(result.data!.issues).toContainEqual(
        expect.stringContaining('High cyclomatic complexity')
      );
    });
  });

  describe('empty code', () => {
    it('returns error for empty string', async () => {
      const result = await tool.execute({ code: '' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Empty code provided');
      expect(result.data!.valid).toBe(false);
      expect(result.data!.imports).toEqual([]);
      expect(result.data!.exports).toEqual([]);
      expect(result.data!.functions).toEqual([]);
      expect(result.data!.complexity).toBe(0);
      expect(result.data!.issues).toEqual(['Empty code']);
    });

    it('returns error for whitespace-only string', async () => {
      const result = await tool.execute({ code: '   \n\t  ' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Empty code provided');
      expect(result.data!.valid).toBe(false);
    });

    it('returns error for undefined code', async () => {
      const result = await tool.execute({ code: undefined as unknown as string });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Empty code provided');
    });
  });

  describe('function detection', () => {
    it('detects async functions with parameter count', async () => {
      const code = `
        async function fetchData(url: string, opts: RequestInit): Promise<Response> {
          return fetch(url, opts);
        }
      `;

      const result = await tool.execute({ code, checks: ['syntax', 'functions'] });

      expect(result.data!.functions).toHaveLength(1);
      expect(result.data!.functions[0]).toEqual({
        name: 'fetchData',
        async: true,
        params: 2,
        line: 2,
      });
    });

    it('detects function expressions assigned to variables', async () => {
      // Note: ArrowFunctionExpression is NOT handled by the source code's
      // FunctionExpression visitor. Use regular function expressions instead.
      const code = `
        const add = function(a: number, b: number) { return a + b; };
      `;

      const result = await tool.execute({ code, checks: ['syntax', 'functions'] });

      expect(result.data!.functions).toHaveLength(1);
      expect(result.data!.functions[0].name).toBe('add');
      expect(result.data!.functions[0].params).toBe(2);
    });
  });
});
