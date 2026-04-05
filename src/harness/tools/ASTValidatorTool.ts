/**
 * ASTValidatorTool - Parse and validate code structure using AST
 * 
 * Deterministic validation:
 * - Syntax validation (is code parseable?)
 * - Import/require validation
 * - Function definition checks
 * - Export validation
 * - Cyclomatic complexity check
 */

import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import type { File } from '@babel/types';
import { Tool, type ToolResult } from './types.js';

export interface ASTValidateParams {
  code: string;
  filename?: string;
  checks?: Array<'syntax' | 'imports' | 'exports' | 'functions' | 'complexity'>;
}

export interface ASTValidateResult {
  valid: boolean;
  syntaxError?: {
    message: string;
    line?: number;
    column?: number;
  };
  imports: Array<{
    source: string;
    specifiers: string[];
    type: 'import' | 'require';
  }>;
  exports: Array<{
    name: string;
    type: 'default' | 'named';
  }>;
  functions: Array<{
    name: string;
    async: boolean;
    params: number;
    line: number;
  }>;
  complexity: number;
  issues: string[];
}

export class ASTValidatorTool extends Tool {
  readonly name = 'astValidate';
  readonly description = 'Parse and validate code using AST';

  // eslint-disable-next-line @typescript-eslint/require-await
  async execute(params: unknown): Promise<ToolResult<ASTValidateResult>> {
    const { code, checks = ['syntax', 'imports', 'exports'] } = params as ASTValidateParams;

    if (!code || code.trim().length === 0) {
      return {
        success: false,
        error: 'Empty code provided',
        data: {
          valid: false,
          imports: [],
          exports: [],
          functions: [],
          complexity: 0,
          issues: ['Empty code'],
        },
      };
    }

    try {
      // Parse with TypeScript support
      const ast = parse(code, {
        sourceType: 'module',
        allowImportExportEverywhere: true,
        plugins: [
          'typescript',
          'jsx',
          'decorators-legacy',
          'classProperties',
          'asyncGenerators',
          'dynamicImport',
        ],
      });

      const result: ASTValidateResult = {
        valid: true,
        imports: [],
        exports: [],
        functions: [],
        complexity: 0,
        issues: [],
      };

      // Analyze AST
      this.analyzeAST(ast, result, checks);

      // Additional checks
      if (checks.includes('complexity')) {
        this.checkComplexity(ast, result);
      }

      return {
        success: result.issues.length === 0,
        data: result,
      };

    } catch (error) {
      const err = error as Error;
      const match = err.message.match(/\((\d+):(\d+)\)/);
      
      return {
        success: false,
        error: `Syntax error: ${err.message}`,
        data: {
          valid: false,
          syntaxError: {
            message: err.message,
            line: match ? parseInt(match[1], 10) : undefined,
            column: match ? parseInt(match[2], 10) : undefined,
          },
          imports: [],
          exports: [],
          functions: [],
          complexity: 0,
          issues: [`Syntax error: ${err.message}`],
        },
      };
    }
  }

  private analyzeAST(ast: File, result: ASTValidateResult, checks: string[]): void {
    const state = {
      imports: [] as ASTValidateResult['imports'],
      exports: [] as ASTValidateResult['exports'],
      functions: [] as ASTValidateResult['functions'],
    };

    traverse(ast, {
      ImportDeclaration(path) {
        if (!checks.includes('imports')) return;
        
        const source = path.node.source.value;
        const specifiers = path.node.specifiers.map(s => {
          if (s.type === 'ImportDefaultSpecifier') return s.local.name;
          if (s.type === 'ImportSpecifier') return s.imported.type === 'Identifier' ? s.imported.name : s.imported.value;
          if (s.type === 'ImportNamespaceSpecifier') return `* as ${s.local.name}`;
          return '';
        }).filter(Boolean);

        state.imports.push({ source, specifiers, type: 'import' });
      },

      CallExpression(path) {
        if (!checks.includes('imports')) return;
        
        // Detect require() calls
        if (path.node.callee.type === 'Identifier' && path.node.callee.name === 'require') {
          const arg = path.node.arguments[0];
          if (arg?.type === 'StringLiteral') {
            state.imports.push({
              source: arg.value,
              specifiers: [],
              type: 'require',
            });
          }
        }
      },

      ExportDefaultDeclaration(path) {
        if (!checks.includes('exports')) return;
        
        const declaration = path.node.declaration;
        let name = 'default';
        if (declaration.type === 'Identifier') {
          name = declaration.name;
        } else if (declaration.type === 'FunctionDeclaration' && declaration.id) {
          name = declaration.id.name;
        }
        
        state.exports.push({ name, type: 'default' });
      },

      ExportNamedDeclaration(path) {
        if (!checks.includes('exports')) return;
        
        path.node.specifiers.forEach(spec => {
          if (spec.type === 'ExportSpecifier') {
            const name = spec.exported.type === 'Identifier' ? spec.exported.name : spec.exported.value;
            state.exports.push({ name, type: 'named' });
          }
        });
      },

      FunctionDeclaration(path) {
        if (!checks.includes('functions')) return;
        
        if (path.node.id) {
          state.functions.push({
            name: path.node.id.name,
            async: path.node.async,
            params: path.node.params.length,
            line: path.node.loc?.start.line || 0,
          });
        }
      },

      FunctionExpression(path) {
        if (!checks.includes('functions')) return;
        
        const parent = path.parent;
        let name = 'anonymous';
        
        if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
          name = parent.id.name;
        } else if (parent.type === 'AssignmentExpression' && parent.left.type === 'Identifier') {
          name = parent.left.name;
        }
        
        state.functions.push({
          name,
          async: path.node.async,
          params: path.node.params.length,
          line: path.node.loc?.start.line || 0,
        });
      },
    });

    result.imports = state.imports;
    result.exports = state.exports;
    result.functions = state.functions;
  }

  private checkComplexity(ast: File, result: ASTValidateResult): void {
    let complexity = 1; // Base complexity

    traverse(ast, {
      IfStatement() { complexity++; },
      ConditionalExpression() { complexity++; },
      SwitchCase() { complexity++; },
      ForStatement() { complexity++; },
      ForInStatement() { complexity++; },
      ForOfStatement() { complexity++; },
      WhileStatement() { complexity++; },
      DoWhileStatement() { complexity++; },
      CatchClause() { complexity++; },
      LogicalExpression() { complexity++; },
    });

    result.complexity = complexity;

    if (complexity > 10) {
      result.issues.push(`High cyclomatic complexity: ${complexity} (recommended: <10)`);
    }
  }
}

export const astValidatorTool = new ASTValidatorTool();
