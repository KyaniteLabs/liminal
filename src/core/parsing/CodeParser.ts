/**
 * CodeParser - TypeScript/JavaScript symbol extraction using TypeScript Compiler API
 *
 * Replaces tree-sitter which doesn't compile on Node 25.
 * Extracts symbols, computes metrics, and builds relationship graphs.
 */

import * as ts from 'typescript';
import crypto from 'node:crypto';
import type { LIRCodeToken, SymbolKind } from '../lir/types.js';
import { LIRParseError } from '../lir/errors.js';
import { RelationshipExtractor } from './RelationshipExtractor.js';

/**
 * Configuration for CodeParser
 */
interface CodeParserConfig {
  /** Maximum symbols to extract per file (prevents memory issues) */
  maxSymbolsPerFile: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: CodeParserConfig = {
  maxSymbolsPerFile: 200,
};

/**
 * Result of parsing a single symbol
 */
interface SymbolParseResult {
  name: string;
  kind: SymbolKind;
  signature: string;
  source: string;
  startLine: number;
  endLine: number;
  isExported: boolean;
  isDefault: boolean;
  extends: string[];
  calls: string[];
  metrics: {
    loc: number;
    cyclomaticComplexity: number;
    paramCount: number;
    nestingDepth: number;
    callCount: number;
    classDepth: number;
  };
}

/**
 * CodeParser extracts symbols from TypeScript/JavaScript source code
 */
export class CodeParser {
  private config: CodeParserConfig;

  constructor(config: Partial<CodeParserConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Parse source code and extract LIR code tokens
   *
   * @param content - Source file content
   * @param filePath - File path (used for language detection and error reporting)
   * @returns Array of LIR code tokens
   * @throws {LIRParseError} If source has syntax errors
   */
  parse(content: string, filePath: string): LIRCodeToken[] {
    const language = this.detectLanguage(filePath);
    const sourceFile = this.createSourceFile(content, filePath);

    // Collect all imports first using RelationshipExtractor
    const importGraph = RelationshipExtractor.extractImports(sourceFile);
    const imports = importGraph.map(ig => ig.module);

    // Extract symbols with metrics
    const symbols = this.extractSymbols(sourceFile, language, filePath, imports, importGraph);

    // Apply symbol limit
    return symbols.slice(0, this.config.maxSymbolsPerFile);
  }

  /**
   * Detect programming language from file extension
   */
  private detectLanguage(filePath: string): string {
    const ext = filePath.toLowerCase();
    if (ext.endsWith('.ts') || ext.endsWith('.tsx')) {
      return 'typescript';
    }
    if (ext.endsWith('.js') || ext.endsWith('.jsx') || ext.endsWith('.mjs')) {
      return 'javascript';
    }
    // Default to typescript for unknown extensions
    return 'typescript';
  }

  /**
   * Create TypeScript SourceFile from content
   */
  private createSourceFile(content: string, filePath: string): ts.SourceFile {
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true, // setParentNodes
    );

    // Check for parse errors (parseDiagnostics is an internal TS API)
    // @ts-expect-error — accessing internal compiler API
    const diagnostics = sourceFile.parseDiagnostics as ts.Diagnostic[] | undefined;
    if (diagnostics && diagnostics.length > 0) {
      const error = diagnostics[0] as ts.Diagnostic;
      const line = error.start !== undefined
        ? sourceFile.getLineAndCharacterOfPosition(error.start).line + 1
        : undefined;

      throw new LIRParseError(
        ts.flattenDiagnosticMessageText(error.messageText, '\n'),
        filePath,
        line,
      );
    }

    return sourceFile;
  }

  /**
   * Extract all symbols from source file
   */
  private extractSymbols(
    sourceFile: ts.SourceFile,
    language: string,
    filePath: string,
    imports: string[],
    importGraph: Array<{ callee: string; module: string }>,
  ): LIRCodeToken[] {
    const symbols: LIRCodeToken[] = [];
    const classHierarchy = this.buildClassHierarchy(sourceFile);

    const visit = (node: ts.Node) => {
      const symbol = this.tryExtractSymbol(node, sourceFile, classHierarchy);
      if (symbol) {
        symbols.push(this.buildLIRToken(symbol, filePath, language, imports, importGraph));
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return symbols;
  }

  /**
   * Build class inheritance hierarchy for computing class depth
   */
  private buildClassHierarchy(sourceFile: ts.SourceFile): Map<string, number> {
    const depths = new Map<string, number>();
    const extendsMap = new Map<string, string>();

    // First pass: collect all extends relationships
    const visit = (node: ts.Node) => {
      if (ts.isClassDeclaration(node) && node.name) {
        const className = node.name.text;
        if (node.heritageClauses) {
          for (const clause of node.heritageClauses) {
            if (clause.token === ts.SyntaxKind.ExtendsKeyword && clause.types.length > 0) {
              const baseType = clause.types[0];
              const baseName = this.getTypeName(baseType.expression);
              if (baseName) {
                extendsMap.set(className, baseName);
              }
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    // Second pass: compute depths using DFS
    for (const className of extendsMap.keys()) {
      depths.set(className, this.computeClassDepth(className, extendsMap, new Set()));
    }

    // Classes with no inheritance have depth 0
    const visit2 = (node: ts.Node) => {
      if (ts.isClassDeclaration(node) && node.name) {
        if (!depths.has(node.name.text)) {
          depths.set(node.name.text, 0);
        }
      }
      ts.forEachChild(node, visit2);
    };

    visit2(sourceFile);

    return depths;
  }

  /**
   * Recursively compute class depth in inheritance hierarchy
   */
  private computeClassDepth(
    className: string,
    extendsMap: Map<string, string>,
    visiting: Set<string>,
  ): number {
    if (visiting.has(className)) {
      // Circular dependency - return 0
      return 0;
    }

    if (!extendsMap.has(className)) {
      return 0;
    }

    visiting.add(className);
    const baseClass = extendsMap.get(className)!;
    const depth = 1 + this.computeClassDepth(baseClass, extendsMap, visiting);
    visiting.delete(className);

    return depth;
  }

  /**
   * Get type name from type expression
   */
  private getTypeName(expression: ts.Expression): string | null {
    if (ts.isIdentifier(expression)) {
      return expression.text;
    }
    if (ts.isPropertyAccessExpression(expression)) {
      return this.getTypeName(expression.name);
    }
    return null;
  }

  /**
   * Get type name from TypeNode
   */
  private getTypeNodeName(type: ts.TypeNode): string | null {
    if (ts.isIdentifier(type)) {
      return type.text;
    }
    if (ts.isUnionTypeNode(type)) {
      return type.types.map((t) => this.getTypeNodeName(t)).filter(Boolean).join(' | ');
    }
    // For complex types, return a simplified representation
    return type.kind.toString();
  }

  /**
   * Try to extract a symbol from a node
   */
  private tryExtractSymbol(
    node: ts.Node,
    sourceFile: ts.SourceFile,
    classHierarchy: Map<string, number>,
  ): SymbolParseResult | null {
    // Function declarations
    if (ts.isFunctionDeclaration(node) && node.name) {
      return this.extractFunction(node, sourceFile, classHierarchy);
    }

    // Arrow functions in variable declarations
    if (ts.isVariableStatement(node)) {
      const declaration = node.declarationList.declarations[0];
      if (declaration.initializer && ts.isArrowFunction(declaration.initializer)) {
        return this.extractArrowFunction(declaration, sourceFile, classHierarchy);
      }
    }

    // Class declarations
    if (ts.isClassDeclaration(node) && node.name) {
      return this.extractClass(node, sourceFile, classHierarchy);
    }

    // Method declarations
    if (ts.isMethodDeclaration(node)) {
      return this.extractMethod(node, sourceFile, classHierarchy);
    }

    // Interface declarations
    if (ts.isInterfaceDeclaration(node) && node.name) {
      return this.extractInterface(node, sourceFile);
    }

    // Type aliases
    if (ts.isTypeAliasDeclaration(node) && node.name) {
      return this.extractTypeAlias(node, sourceFile);
    }

    // Enum declarations
    if (ts.isEnumDeclaration(node) && node.name) {
      return this.extractEnum(node, sourceFile);
    }

    // Export default function/class
    if (ts.isExportDeclaration(node)) {
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        // Handle export { name } from 'module'
        // These are already captured by the original declarations
      }
    }

    return null;
  }

  /**
   * Extract function declaration
   */
  private extractFunction(
    node: ts.FunctionDeclaration,
    sourceFile: ts.SourceFile,
    _classHierarchy: Map<string, number>,
  ): SymbolParseResult {
    const name = node.name!.text;
    const signature = this.getFunctionSignature(node);
    const source = this.getNodeSource(node, sourceFile);
    const { start, end } = this.getNodeRange(node, sourceFile);

    const metrics = this.computeFunctionMetrics(node, sourceFile);
    const calls = RelationshipExtractor.extractCallNames(node);

    const isExported = this.hasExportModifier(node);
    const isDefault = this.hasDefaultModifier(node);

    return {
      name,
      kind: 'function',
      signature,
      source,
      startLine: start.line,
      endLine: end.line,
      isExported,
      isDefault,
      extends: [],
      calls,
      metrics: {
        ...metrics,
        classDepth: 0,
      },
    };
  }

  /**
   * Extract arrow function from variable declaration
   */
  private extractArrowFunction(
    declaration: ts.VariableDeclaration,
    sourceFile: ts.SourceFile,
    _classHierarchy: Map<string, number>,
  ): SymbolParseResult | null {
    if (!declaration.name || !ts.isIdentifier(declaration.name)) {
      return null;
    }

    const arrowFunction = declaration.initializer as ts.ArrowFunction;
    const name = declaration.name.text;
    const signature = this.getArrowFunctionSignature(declaration);
    const source = this.getNodeSource(arrowFunction, sourceFile);
    const { start, end } = this.getNodeRange(declaration, sourceFile);

    const metrics = this.computeFunctionMetrics(arrowFunction, sourceFile);
    const calls = RelationshipExtractor.extractCallNames(arrowFunction);

    // Check for export on the variable statement or variable declaration list
    const varStatement = declaration.parent.parent;
    const isExported = this.hasExportModifier(varStatement) ||
                       this.hasExportModifier(declaration.parent);
    const isDefault = this.hasDefaultModifier(varStatement) ||
                      this.hasDefaultModifier(declaration.parent);

    return {
      name,
      kind: 'function',
      signature,
      source,
      startLine: start.line,
      endLine: end.line,
      isExported,
      isDefault,
      extends: [],
      calls,
      metrics: {
        ...metrics,
        classDepth: 0,
      },
    };
  }

  /**
   * Extract class declaration
   */
  private extractClass(
    node: ts.ClassDeclaration,
    sourceFile: ts.SourceFile,
    classHierarchy: Map<string, number>,
  ): SymbolParseResult {
    if (!node.name) {
      throw new Error('Class declaration must have a name');
    }

    const name = node.name.text;
    const signature = this.getClassSignature(node);
    const source = this.getNodeSource(node, sourceFile);
    const { start, end } = this.getNodeRange(node, sourceFile);

    const metrics = this.computeClassMetrics(node, sourceFile, classHierarchy);
    const calls = RelationshipExtractor.extractCallNames(node);

    const isExported = this.hasExportModifier(node);
    const isDefault = this.hasDefaultModifier(node);

    const extendsList: string[] = [];
    if (node.heritageClauses) {
      for (const clause of node.heritageClauses) {
        if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
          for (const type of clause.types) {
            const baseName = this.getTypeName(type.expression);
            if (baseName) {
              extendsList.push(baseName);
            }
          }
        }
      }
    }

    return {
      name,
      kind: 'class',
      signature,
      source,
      startLine: start.line,
      endLine: end.line,
      isExported,
      isDefault,
      extends: extendsList,
      calls,
      metrics,
    };
  }

  /**
   * Extract method declaration
   */
  private extractMethod(
    node: ts.MethodDeclaration,
    sourceFile: ts.SourceFile,
    classHierarchy: Map<string, number>,
  ): SymbolParseResult | null {
    if (!node.name || !ts.isIdentifier(node.name)) {
      return null;
    }

    const name = node.name.text;
    const signature = this.getMethodSignature(node);
    const source = this.getNodeSource(node, sourceFile);
    const { start, end } = this.getNodeRange(node, sourceFile);

    const metrics = this.computeFunctionMetrics(node, sourceFile);
    const calls = RelationshipExtractor.extractCallNames(node);

    const isExported = false; // Methods inherit export from class
    const isDefault = false;

    return {
      name,
      kind: 'method',
      signature,
      source,
      startLine: start.line,
      endLine: end.line,
      isExported,
      isDefault,
      extends: [],
      calls,
      metrics: {
        ...metrics,
        classDepth: classHierarchy.get(name) ?? 0,
      },
    };
  }

  /**
   * Extract interface declaration
   */
  private extractInterface(
    node: ts.InterfaceDeclaration,
    sourceFile: ts.SourceFile,
  ): SymbolParseResult {
    const name = node.name.text;
    const signature = `interface ${name}`;
    const source = this.getNodeSource(node, sourceFile);
    const { start, end } = this.getNodeRange(node, sourceFile);

    const isExported = this.hasExportModifier(node);
    const isDefault = false;

    return {
      name,
      kind: 'interface',
      signature,
      source,
      startLine: start.line,
      endLine: end.line,
      isExported,
      isDefault,
      extends: [],
      calls: [],
      metrics: {
        loc: 0,
        cyclomaticComplexity: 1,
        paramCount: 0,
        nestingDepth: 0,
        callCount: 0,
        classDepth: 0,
      },
    };
  }

  /**
   * Extract type alias declaration
   */
  private extractTypeAlias(
    node: ts.TypeAliasDeclaration,
    sourceFile: ts.SourceFile,
  ): SymbolParseResult {
    const name = node.name.text;
    const signature = `type ${name}`;
    const source = this.getNodeSource(node, sourceFile);
    const { start, end } = this.getNodeRange(node, sourceFile);

    const isExported = this.hasExportModifier(node);
    const isDefault = false;

    return {
      name,
      kind: 'type',
      signature,
      source,
      startLine: start.line,
      endLine: end.line,
      isExported,
      isDefault,
      extends: [],
      calls: [],
      metrics: {
        loc: 0,
        cyclomaticComplexity: 1,
        paramCount: 0,
        nestingDepth: 0,
        callCount: 0,
        classDepth: 0,
      },
    };
  }

  /**
   * Extract enum declaration
   */
  private extractEnum(
    node: ts.EnumDeclaration,
    sourceFile: ts.SourceFile,
  ): SymbolParseResult {
    const name = node.name.text;
    const signature = `enum ${name}`;
    const source = this.getNodeSource(node, sourceFile);
    const { start, end } = this.getNodeRange(node, sourceFile);

    const isExported = this.hasExportModifier(node);
    const isDefault = false;

    return {
      name,
      kind: 'enum',
      signature,
      source,
      startLine: start.line,
      endLine: end.line,
      isExported,
      isDefault,
      extends: [],
      calls: [],
      metrics: {
        loc: 0,
        cyclomaticComplexity: 1,
        paramCount: 0,
        nestingDepth: 0,
        callCount: 0,
        classDepth: 0,
      },
    };
  }

  /**
   * Get function signature
   */
  private getFunctionSignature(node: ts.FunctionDeclaration): string {
    const name = node.name!.text;
    const params = this.getParameterList(node.parameters);
    const returnType = node.type ? `: ${this.getTypeNodeName(node.type) ?? 'unknown'}` : '';
    return `function ${name}(${params})${returnType}`;
  }

  /**
   * Get arrow function signature
   */
  private getArrowFunctionSignature(declaration: ts.VariableDeclaration): string {
    const name = (declaration.name as ts.Identifier).text;
    const arrowFunction = declaration.initializer as ts.ArrowFunction;
    const params = this.getParameterList(arrowFunction.parameters);
    const returnType = arrowFunction.type ? `: ${this.getTypeNodeName(arrowFunction.type) ?? 'unknown'}` : '';
    return `const ${name} = (${params})${returnType} =>`;
  }

  /**
   * Get class signature
   */
  private getClassSignature(node: ts.ClassDeclaration): string {
    if (!node.name) {
      return 'class <anonymous>';
    }
    const name = node.name.text;
    const extendsClause = node.heritageClauses?.find(
      (c) => c.token === ts.SyntaxKind.ExtendsKeyword,
    );
    const extendsPart = extendsClause
      ? ` extends ${extendsClause.types.map((t) => this.getTypeName(t.expression)).join(', ')}`
      : '';
    return `class ${name}${extendsPart}`;
  }

  /**
   * Get method signature
   */
  private getMethodSignature(node: ts.MethodDeclaration): string {
    const name = (node.name as ts.Identifier).text;
    const params = this.getParameterList(node.parameters);
    const returnType = node.type ? `: ${this.getTypeNodeName(node.type) ?? 'unknown'}` : '';
    return `${name}(${params})${returnType}`;
  }

  /**
   * Get parameter list as string
   */
  private getParameterList(parameters: ts.NodeArray<ts.ParameterDeclaration>): string {
    return parameters.map((p) => {
      const name = (p.name as ts.Identifier).text;
      const type = p.type ? `: ${this.getTypeNodeName(p.type) ?? 'unknown'}` : '';
      return `${name}${type}`;
    }).join(', ');
  }

  /**
   * Get node source code
   */
  private getNodeSource(node: ts.Node, sourceFile: ts.SourceFile): string {
    const { start, end } = this.getNodeRange(node, sourceFile);
    const lines = sourceFile.getFullText().split('\n');
    return lines.slice(start.line - 1, end.line).join('\n');
  }

  /**
   * Get node line range
   */
  private getNodeRange(node: ts.Node, sourceFile: ts.SourceFile): {
    start: { line: number };
    end: { line: number };
  } {
    const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
    return {
      start: { line: start.line + 1 },
      end: { line: end.line + 1 },
    };
  }

  /**
   * Compute function metrics
   */
  private computeFunctionMetrics(
    node: ts.FunctionLikeDeclaration | ts.ArrowFunction,
    sourceFile: ts.SourceFile,
  ): {
    loc: number;
    cyclomaticComplexity: number;
    paramCount: number;
    nestingDepth: number;
    callCount: number;
  } {
    const body = node.body;
    if (!body) {
      return {
        loc: 0,
        cyclomaticComplexity: 1,
        paramCount: node.parameters.length,
        nestingDepth: 0,
        callCount: 0,
      };
    }

    const loc = this.computeLOC(body, sourceFile);
    const cyclomaticComplexity = this.computeCyclomaticComplexity(body);
    const paramCount = node.parameters.length;
    const nestingDepth = this.computeNestingDepth(body);
    const callCount = RelationshipExtractor.extractCallNames(body).length;

    return {
      loc,
      cyclomaticComplexity,
      paramCount,
      nestingDepth,
      callCount,
    };
  }

  /**
   * Compute class metrics
   */
  private computeClassMetrics(
    node: ts.ClassDeclaration,
    sourceFile: ts.SourceFile,
    classHierarchy: Map<string, number>,
  ): {
    loc: number;
    cyclomaticComplexity: number;
    paramCount: number;
    nestingDepth: number;
    callCount: number;
    classDepth: number;
  } {
    if (!node.name) {
      return {
        loc: 0,
        cyclomaticComplexity: 1,
        paramCount: 0,
        nestingDepth: 0,
        callCount: 0,
        classDepth: 0,
      };
    }

    const loc = this.computeLOC(node, sourceFile);
    const cyclomaticComplexity = 1; // Base complexity for class
    const paramCount = 0;
    const nestingDepth = 0;
    const callCount = RelationshipExtractor.extractCallNames(node).length;
    const classDepth = classHierarchy.get(node.name.text) ?? 0;

    return {
      loc,
      cyclomaticComplexity,
      paramCount,
      nestingDepth,
      callCount,
      classDepth,
    };
  }

  /**
   * Compute lines of code (excluding blank lines and comments)
   */
  private computeLOC(node: ts.Node, sourceFile: ts.SourceFile): number {
    const source = this.getNodeSource(node, sourceFile);
    const lines = source.split('\n');

    return lines.filter((line) => {
      const trimmed = line.trim();
      // Skip empty lines
      if (trimmed.length === 0) return false;
      // Skip single-line comments
      if (trimmed.startsWith('//')) return false;
      // Skip multi-line comment markers (simplified)
      if (trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('*/')) {
        return false;
      }
      return true;
    }).length;
  }

  /**
   * Compute cyclomatic complexity
   * Counts decision points: if, for, while, do, switch, case, catch, &&, ||, ??, ?.
   */
  private computeCyclomaticComplexity(node: ts.Node): number {
    let complexity = 1; // Base complexity

    const visit = (n: ts.Node) => {
      // Conditional statements
      if (
        ts.isIfStatement(n) ||
        ts.isForStatement(n) ||
        ts.isForInStatement(n) ||
        ts.isForOfStatement(n) ||
        ts.isWhileStatement(n) ||
        ts.isDoStatement(n) ||
        ts.isSwitchStatement(n) ||
        ts.isCaseClause(n) ||
        ts.isCatchClause(n)
      ) {
        complexity++;
      }

      // Logical operators
      if (ts.isBinaryExpression(n)) {
        if (
          n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
          n.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
          n.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
        ) {
          complexity++;
        }
      }

      // Ternary operator
      if (ts.isConditionalExpression(n)) {
        complexity++;
      }

      // Nullish coalescing
      if (ts.isToken(n) && n.kind === ts.SyntaxKind.QuestionDotToken) {
        complexity++;
      }

      ts.forEachChild(n, visit);
    };

    visit(node);
    return complexity;
  }

  /**
   * Compute maximum nesting depth
   */
  private computeNestingDepth(node: ts.Node): number {
    let maxDepth = 0;

    const visit = (n: ts.Node, currentDepth: number): void => {
      // Check if this node increases nesting depth
      let depthIncrease = 0;
      if (
        ts.isIfStatement(n) ||
        ts.isForStatement(n) ||
        ts.isForInStatement(n) ||
        ts.isForOfStatement(n) ||
        ts.isWhileStatement(n) ||
        ts.isDoStatement(n) ||
        ts.isSwitchStatement(n) ||
        ts.isCatchClause(n)
      ) {
        depthIncrease = 1;
      }

      const newDepth = currentDepth + depthIncrease;
      maxDepth = Math.max(maxDepth, newDepth);

      ts.forEachChild(n, (child) => visit(child, newDepth));
    };

    visit(node, 0);
    return maxDepth;
  }

  /**
   * Check if node has export modifier
   */
  private hasExportModifier(node: ts.Node): boolean {
    if (ts.canHaveModifiers(node)) {
      const modifiers = ts.getModifiers(node);
      if (modifiers) {
        return modifiers.some(
          (m) => m.kind === ts.SyntaxKind.ExportKeyword,
        );
      }
    }
    return false;
  }

  /**
   * Check if node has default modifier
   */
  private hasDefaultModifier(node: ts.Node): boolean {
    if (ts.canHaveModifiers(node)) {
      const modifiers = ts.getModifiers(node);
      if (modifiers) {
        return modifiers.some(
          (m) => m.kind === ts.SyntaxKind.DefaultKeyword,
        );
      }
    }
    return false;
  }

  /**
   * Build LIR code token from symbol parse result
   */
  private buildLIRToken(
    symbol: SymbolParseResult,
    filePath: string,
    language: string,
    imports: string[],
    importGraph: Array<{ callee: string; module: string }>,
  ): LIRCodeToken {
    const exports = symbol.isExported ? [symbol.name] : [];

    return {
      id: this.generateId(),
      type: 'code',
      domain: 'code',
      layer: 'implementation',
      metadata: {},
      tags: [],
      name: symbol.name,
      kind: symbol.kind,
      signature: symbol.signature,
      summary: this.generateSummary(symbol),
      source: symbol.source,
      language,
      location: {
        file: filePath,
        startLine: symbol.startLine,
        endLine: symbol.endLine,
      },
      relationships: {
        calls: symbol.calls,
        imports,
        exports,
        extends: symbol.extends,
        importGraph,
      },
      metrics: {
        loc: symbol.metrics.loc,
        cyclomaticComplexity: symbol.metrics.cyclomaticComplexity,
        paramCount: symbol.metrics.paramCount,
        importCount: imports.length,
        exportCount: exports.length,
        callCount: symbol.metrics.callCount,
        classDepth: symbol.metrics.classDepth,
        nestingDepth: symbol.metrics.nestingDepth,
      },
    };
  }

  /**
   * Generate unique ID for token
   */
  private generateId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Generate summary from source or signature
   */
  private generateSummary(symbol: SymbolParseResult): string {
    // Try to extract JSDoc comment
    const lines = symbol.source.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('/**') || trimmed.startsWith('*')) {
        // Found JSDoc - extract first meaningful line
        const cleaned = trimmed.replace(/^\/\*\*/, '').replace(/^\*\s?/, '').trim();
        if (cleaned.length > 0 && !cleaned.startsWith('@')) {
          return cleaned;
        }
      }
    }

    // Fallback to first line of source or signature
    const firstLine = lines.find((l) => l.trim().length > 0 && !l.trim().startsWith('//'));
    if (firstLine) {
      return firstLine.trim().substring(0, 200);
    }

    return symbol.signature;
  }
}
