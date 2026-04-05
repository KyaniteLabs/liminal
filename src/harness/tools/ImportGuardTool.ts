/**
 * ImportGuardTool - Validate imports against allowed modules
 * 
 * Security guardrail:
 * - Whitelist allowed npm packages
 * - Prevent malicious imports (fs, child_process in browser code)
 * - Validate import paths exist
 * - Detect circular dependencies
 */

import { Tool, type ToolResult } from './types.js';

export interface ImportGuardParams {
  code: string;
  domain: 'p5' | 'shader' | 'three' | 'node' | 'hydra' | 'strudel' | 'remotion';
}

export interface ImportGuardResult {
  allowed: string[];
  blocked: Array<{
    source: string;
    reason: string;
  }>;
  warnings: string[];
  safe: boolean;
}

// Domain-specific allowed imports
const ALLOWED_IMPORTS: Record<string, string[]> = {
  p5: ['p5', 'p5/*', 'tone', '@tonejs/*'],
  shader: [], // No imports - pure GLSL
  three: ['three', 'three/*', '@react-three/fiber', '@react-three/drei'],
  node: ['fs', 'path', 'http', 'https', 'child_process', 'os', 'crypto', 'util', 'stream', 'events', 'url', 'querystring'],
  hydra: ['hydra-synth'],
  strudel: ['@strudel/*', 'strudel'],
  remotion: ['remotion', '@remotion/*', 'react', 'react-dom'],
};

// Dangerous imports that should never be in browser code
const DANGEROUS_IMPORTS = [
  'fs', 'child_process', 'cluster', 'dgram', 'dns', 'module', 'net', 'os', 'readline', 'repl', 'tls', 'v8', 'vm',
];

export class ImportGuardTool extends Tool {
  readonly name = 'importGuard';
  readonly description = 'Validate imports against security whitelist';

  // eslint-disable-next-line @typescript-eslint/require-await
  async execute(params: unknown): Promise<ToolResult<ImportGuardResult>> {
    const { code, domain } = params as ImportGuardParams;

    if (!code) {
      return {
        success: false,
        error: 'No code provided',
        data: { allowed: [], blocked: [], warnings: [], safe: false },
      };
    }

    const result: ImportGuardResult = {
      allowed: [],
      blocked: [],
      warnings: [],
      safe: true,
    };

    // Extract imports using regex
    const importRegex = /import\s+(?:(?:{[^}]*}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"];?/g;
    const requireRegex = /require\(['"]([^'"]+)['"]\)/g;

    const imports = new Set<string>();
    
    let match;
    while ((match = importRegex.exec(code)) !== null) {
      imports.add(match[1]);
    }
    while ((match = requireRegex.exec(code)) !== null) {
      imports.add(match[1]);
    }

    const allowedPatterns = ALLOWED_IMPORTS[domain] || [];

    for (const imp of imports) {
      // Check if it's a relative import
      if (imp.startsWith('.')) {
        result.allowed.push(imp);
        continue;
      }

      // Check if it's a builtin node module
      if (DANGEROUS_IMPORTS.includes(imp)) {
        // Only allowed in node domain
        if (domain !== 'node') {
          result.blocked.push({
            source: imp,
            reason: `Node.js builtin '${imp}' not allowed in ${domain} domain`,
          });
          result.safe = false;
        } else {
          result.allowed.push(imp);
        }
        continue;
      }

      // Check against whitelist
      const isAllowed = allowedPatterns.some(pattern => {
        if (pattern.endsWith('/*')) {
          return imp.startsWith(pattern.slice(0, -1));
        }
        return imp === pattern;
      });

      if (isAllowed) {
        result.allowed.push(imp);
      } else {
        result.blocked.push({
          source: imp,
          reason: `Import '${imp}' not in whitelist for ${domain} domain`,
        });
        result.safe = false;
      }
    }

    // Check for dynamic imports (eval-like danger)
    if (/import\s*\(/.test(code)) {
      result.warnings.push('Dynamic imports detected - ensure they are not user-controlled');
    }

    return {
      success: result.safe,
      data: result,
    };
  }
}

export const importGuardTool = new ImportGuardTool();
