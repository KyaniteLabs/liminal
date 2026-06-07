/**
 * LIR (Sinter Intermediate Representation) Core Type Definitions
 *
 * This module defines the source-of-truth TypeScript types for LIR tokens.
 * LIR tokens are the atomic units of code, documentation, and text representation
 * used throughout the Sinter system for analysis, retrieval, and processing.
 */

/**
 * Symbol kinds supported in LIR code tokens.
 * These correspond to common programming language constructs.
 */
export type SymbolKind =
  | 'function'
  | 'class'
  | 'method'
  | 'interface'
  | 'variable'
  | 'property'
  | 'enum'
  | 'type';

/**
 * Base token properties shared by all LIR token types.
 */
interface LIRTokenBase {
  /** Unique identifier for this token */
  id: string;
  /** Domain/category this token belongs to (e.g., 'data-processing', 'ui-components') */
  domain: string;
  /** Architectural layer (e.g., 'presentation', 'business-logic', 'data-access') */
  layer: string;
  /** Arbitrary metadata for extensibility */
  metadata: Record<string, unknown>;
  /** User-defined tags for categorization and filtering */
  tags: string[];
  /** Optional relevance score (0-1) for ranking */
  score?: number;
}

/**
 * LIR Code Token - represents a code symbol (function, class, method, etc.)
 *
 * Code tokens capture structural, relational, and metric information about
 * code symbols extracted from source files.
 */
export interface LIRCodeToken extends LIRTokenBase {
  /** Discriminator: identifies this as a code token */
  type: 'code';
  /** Symbol name (e.g., function name, class name) */
  name: string;
  /** Kind of symbol (function, class, method, etc.) */
  kind: SymbolKind;
  /** Function/class signature with parameters and return type */
  signature: string;
  /** AI-generated or docstring-derived summary of purpose */
  summary: string;
  /** Full source code of the symbol */
  source: string;
  /** Programming language (e.g., 'typescript', 'python') */
  language: string;
  /** Source file location */
  location: {
    /** File path relative to project root */
    file: string;
    /** Start line number (1-indexed) */
    startLine: number;
    /** End line number (1-indexed) */
    endLine: number;
  };
  /** Relationships to other code symbols */
  relationships: {
    /** IDs of functions/methods called by this symbol */
    calls: string[];
    /** Module/dependency names imported */
    imports: string[];
    /** Exported symbols (if this is an export) */
    exports: string[];
    /** IDs of parent classes/interfaces extended */
    extends: string[];
    /** Detailed import graph: callee to module mapping */
    importGraph: Array<{
      /** Function/symbol being imported */
      callee: string;
      /** Module the symbol comes from */
      module: string;
    }>;
  };
  /** Code complexity and size metrics */
  metrics: {
    /** Lines of code (excluding whitespace/comments) */
    loc: number;
    /** Cyclomatic complexity (decision points + 1) */
    cyclomaticComplexity: number;
    /** Number of function/method parameters */
    paramCount: number;
    /** Number of import statements */
    importCount: number;
    /** Number of export statements */
    exportCount: number;
    /** Number of function/method calls within */
    callCount: number;
    /** Depth in class inheritance hierarchy */
    classDepth: number;
    /** Maximum nesting depth of control structures */
    nestingDepth: number;
  };
}

/**
 * LIR Documentation Token - represents a documentation section
 *
 * Doc tokens represent structured documentation extracted from markdown,
 *_RST, or other documentation formats, preserving hierarchy and relationships.
 */
export interface LIRDocToken extends LIRTokenBase {
  /** Discriminator: identifies this as a documentation token */
  type: 'doc';
  /** Section heading text */
  heading: string;
  /** Heading level (1 = top-level, higher = nested) */
  level: number;
  /** AI-generated or first-sentence summary */
  summary: string;
  /** Full content of this section (markdown/plaintext) */
  content: string;
  /** Hierarchical structure within document */
  hierarchy: {
    /** ID of parent section (null for top-level) */
    parent: string | null;
    /** IDs of child sections */
    children: string[];
    /** IDs of sections in path from root to this section */
    path: string[];
  };
  /** IDs of code symbols referenced in this documentation */
  codeReferences: string[];
  /** Documentation metrics */
  metrics: {
    /** Total word count */
    wordCount: number;
    /** Number of code blocks in section */
    codeBlockCount: number;
    /** Number of links/references */
    linkCount: number;
    /** Depth from document root (0 = root) */
    depth: number;
  };
}

/**
 * LIR Text Token - represents unstructured or semi-structured text
 *
 * Text tokens capture plain text content with minimal structure,
 * useful for processing natural language documents, comments, etc.
 */
export interface LIRTextToken extends LIRTokenBase {
  /** Discriminator: identifies this as a text token */
  type: 'text';
  /** Full text content */
  content: string;
  /** Extracted structural elements */
  structure: {
    /** Headings found in text */
    headings: Array<{
      level: number;
      text: string;
    }>;
    /** Code blocks found in text */
    codeBlocks: Array<{
      language: string;
      code: string;
    }>;
  };
  /** Text metrics */
  metrics: {
    /** Total word count */
    wordCount: number;
    /** Estimated paragraph count */
    paragraphCount: number;
    /** Total heading count */
    headingCount: number;
  };
}

/**
 * Union type of all LIR token types.
 * Use the `type` field for discrimination.
 */
export type LIRToken = LIRCodeToken | LIRDocToken | LIRTextToken;
