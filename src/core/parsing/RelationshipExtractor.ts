/**
 * RelationshipExtractor - Tier 1 and Tier 2 relationship extraction from TypeScript AST
 *
 * Extracts:
 * - Tier 1: Import graph (callee to module mapping)
 * - Tier 2: Local call graph (caller to callee relationships)
 *
 * This is a standalone utility that can be used by CodeParser or other analysis tools.
 */

import * as ts from 'typescript';

/**
 * Symbol information for tracking function/method boundaries
 */
export interface SymbolInfo {
  name: string;
  kind: 'function' | 'method' | 'class';
}

/**
 * Tier 1: Import relationship
 */
export interface ImportRelationship {
  callee: string;
  module: string;
}

/**
 * Tier 2: Call relationship
 */
export interface CallRelationship {
  caller: string;
  callee: string;
  argCount: number;
}

/**
 * RelationshipExtractor provides static methods for extracting relationships
 * from TypeScript AST nodes.
 */
export class RelationshipExtractor {
  /**
   * Extract Tier 1 import graph from source file
   *
   * @param sourceFile - TypeScript SourceFile to analyze
   * @returns Array of import relationships with callee and module
   */
  static extractImports(sourceFile: ts.SourceFile): ImportRelationship[] {
    const importGraph: ImportRelationship[] = [];

    const visit = (node: ts.Node) => {
      if (ts.isImportDeclaration(node)) {
        const modulePath = (node.moduleSpecifier as ts.StringLiteral).text;
        const importClause = node.importClause;

        if (importClause) {
          // Handle named imports: import { a, b } from 'module'
          if (importClause.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
            for (const element of importClause.namedBindings.elements) {
              importGraph.push({
                callee: element.name.text,
                module: modulePath,
              });
            }
          }

          // Handle namespace imports: import * as name from 'module'
          if (importClause.namedBindings && ts.isNamespaceImport(importClause.namedBindings)) {
            importGraph.push({
              callee: importClause.namedBindings.name.text,
              module: modulePath,
            });
          }

          // Handle default imports: import name from 'module'
          if (importClause.name) {
            importGraph.push({
              callee: importClause.name.text,
              module: modulePath,
            });
          }
        }

        // Handle bare import: import 'module'
        if (!importClause) {
          importGraph.push({
            callee: modulePath,
            module: modulePath,
          });
        }
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return importGraph;
  }

  /**
   * Extract Tier 2 local call graph from source file
   *
   * @param sourceFile - TypeScript SourceFile to analyze
   * @param symbols - Array of symbols in the file (functions, methods, classes)
   * @returns Array of call relationships with caller, callee, and argCount
   */
  static extractCalls(sourceFile: ts.SourceFile, symbols: SymbolInfo[]): CallRelationship[] {
    const calls: CallRelationship[] = [];
    const symbolSet = new Set(symbols.map(s => s.name));

    // Track which function/method we're currently inside
    let currentSymbol: string | null = null;

    const visit = (node: ts.Node) => {
      // Track when we enter a function/method body
      if (ts.isFunctionDeclaration(node) && node.name) {
        currentSymbol = node.name.text;
      } else if (ts.isMethodDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
        currentSymbol = node.name.text;
      } else if (ts.isVariableStatement(node)) {
        const declaration = node.declarationList.declarations[0];
        if (declaration.name && ts.isIdentifier(declaration.name)) {
          const name = declaration.name.text;
          if (symbolSet.has(name)) {
            currentSymbol = name;
          }
        }
      }

      // Extract call expressions
      if (ts.isCallExpression(node) && currentSymbol) {
        const callee = this.extractCalleeName(node.expression);
        if (callee) {
          const argCount = node.arguments.length;
          calls.push({
            caller: currentSymbol,
            callee,
            argCount,
          });
        }
      }

      // Handle new expressions (constructor calls)
      if (ts.isNewExpression(node) && currentSymbol) {
        if (node.expression && ts.isIdentifier(node.expression)) {
          const argCount = node.arguments ? node.arguments.length : 0;
          calls.push({
            caller: currentSymbol,
            callee: node.expression.text,
            argCount,
          });
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    // Deduplicate calls (same caller-callee pair)
    const uniqueCalls = new Map<string, CallRelationship>();
    for (const call of calls) {
      const key = `${call.caller}:${call.callee}`;
      if (!uniqueCalls.has(key)) {
        uniqueCalls.set(key, call);
      }
    }

    return Array.from(uniqueCalls.values());
  }

  /**
   * Extract callee name from call expression
   */
  private static extractCalleeName(expression: ts.Expression): string | null {
    if (ts.isIdentifier(expression)) {
      return expression.text;
    }
    if (ts.isPropertyAccessExpression(expression)) {
      // For obj.method(), return method name
      if (ts.isIdentifier(expression.name)) {
        return expression.name.text;
      }
    }
    return null;
  }

  /**
   * Extract call names from a specific node (for per-symbol analysis)
   *
   * This is useful when you need to extract calls from a single function/method
   * without having the full symbol table.
   *
   * @param node - AST node to extract calls from (e.g., function body)
   * @returns Array of callee names called within this node
   */
  static extractCallNames(node: ts.Node): string[] {
    const calls: string[] = [];

    const visit = (n: ts.Node) => {
      if (ts.isCallExpression(n)) {
        const expression = n.expression;
        if (ts.isIdentifier(expression)) {
          calls.push(expression.text);
        } else if (ts.isPropertyAccessExpression(expression)) {
          // Handle method calls like obj.method()
          const name = this.extractCalleeName(expression);
          if (name) {
            calls.push(name);
          }
        }
      }
      ts.forEachChild(n, visit);
    };

    visit(node);
    return calls;
  }
}
