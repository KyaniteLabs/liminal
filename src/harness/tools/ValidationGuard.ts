/**
 * Validation Guard for Meta-Harness
 * 
 * Safety checks before applying changes:
 * - Path validation (only src/, test/, docs/, scripts/)
 * - File size limits
 * - Change size limits
 * - Forbidden patterns
 */

import path from 'node:path';
import fs from 'node:fs/promises';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface PathValidationOptions {
  allowedPrefixes?: string[];
  allowAbsolute?: boolean;
}

export interface ContentValidationOptions {
  maxLines?: number;
  maxLineLength?: number;
  forbiddenPatterns?: RegExp[];
}

export class ValidationGuard {
  private allowedPrefixes: string[];

  constructor() {
    const cwd = process.cwd();
    this.allowedPrefixes = [
      path.join(cwd, 'src'),
      path.join(cwd, 'test'),
      path.join(cwd, 'docs'),
      path.join(cwd, 'scripts'),
    ];
  }

  /**
   * Validate file path is within allowed directories
   */
  validatePath(filePath: string, options?: PathValidationOptions): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const resolved = path.resolve(filePath);
    const prefixes = options?.allowedPrefixes || this.allowedPrefixes;

    // Check if path is within allowed prefixes
    const isAllowed = prefixes.some(prefix => resolved.startsWith(prefix));
    
    if (!isAllowed) {
      errors.push(`Path '${filePath}' is outside allowed directories (${prefixes.join(', ')})`);
    }

    // Check for path traversal attempts
    if (filePath.includes('..')) {
      errors.push(`Path '${filePath}' contains '..' which is not allowed`);
    }

    // Check for absolute paths
    if (path.isAbsolute(filePath) && !options?.allowAbsolute) {
      warnings.push(`Path '${filePath}' is absolute - prefer relative paths`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate file content meets constraints
   */
  async validateContent(filePath: string, options?: ContentValidationOptions): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const opts = {
      maxLines: 1000,
      maxLineLength: 500,
      forbiddenPatterns: [
        /eval\s*\(/,  // No eval()
        /new\s+Function/,  // No new Function()
        /child_process/,  // No child_process
        /require\s*\(\s*['"]child_process/,  // No child_process require
      ],
      ...options,
    };

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      // Check line count
      if (lines.length > opts.maxLines!) {
        errors.push(`File has ${lines.length} lines, max allowed is ${opts.maxLines}`);
      }

      // Check line lengths
      lines.forEach((line, idx) => {
        if (line.length > opts.maxLineLength!) {
          warnings.push(`Line ${idx + 1} is ${line.length} chars, max recommended is ${opts.maxLineLength}`);
        }
      });

      // Check forbidden patterns
      opts.forbiddenPatterns!.forEach(pattern => {
        if (pattern.test(content)) {
          errors.push(`Forbidden pattern detected: ${pattern.source}`);
        }
      });

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [`Failed to read file: ${error instanceof Error ? error.message : String(error)}`],
        warnings,
      };
    }
  }

  /**
   * Validate a code change (diff)
   */
  validateChange(oldContent: string, newContent: string, maxLinesChanged: number = 50): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');

    // Check total size change
    const sizeDiff = Math.abs(newContent.length - oldContent.length);
    if (sizeDiff > 10000) {
      warnings.push(`Large size change: ${sizeDiff} bytes`);
    }

    // Check line count change
    const lineDiff = Math.abs(newLines.length - oldLines.length);
    if (lineDiff > maxLinesChanged) {
      errors.push(`Too many lines changed: ${lineDiff}, max allowed is ${maxLinesChanged}`);
    }

    // Check for suspicious patterns in new content
    const suspiciousPatterns = [
      { pattern: /DELETE\s+FROM|DROP\s+TABLE/i, message: 'Possible SQL injection' },
      { pattern: /rm\s+-rf/i, message: 'Dangerous shell command' },
      { pattern: /process\.exit\s*\(\s*0\s*\)/, message: 'Process termination' },
    ];

    suspiciousPatterns.forEach(({ pattern, message }) => {
      if (pattern.test(newContent)) {
        errors.push(`Suspicious pattern: ${message}`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Quick path validation (for frequent checks)
   */
  isPathAllowed(filePath: string): boolean {
    const resolved = path.resolve(filePath);
    return this.allowedPrefixes.some(prefix => resolved.startsWith(prefix));
  }
}

// Singleton instance
export const validationGuard = new ValidationGuard();
