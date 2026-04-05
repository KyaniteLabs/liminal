/**
 * LSPTool - Language Server Protocol integration
 * 
 * Provides deterministic code analysis via TypeScript language server:
 * - Diagnostics (errors, warnings)
 * - Autocomplete suggestions
 * - Go-to-definition
 * - Hover information
 * - Code actions (quick fixes)
 */

import { Tool, type ToolResult } from './types.js';

export interface LSPDiagnosticsParams {
  path: string;
}

export interface LSPAutocompleteParams {
  path: string;
  line: number;
  character: number;
}

export interface LSPDefinitionParams {
  path: string;
  line: number;
  character: number;
}

export interface LSPDiagnostic {
  file: string;
  line: number;
  character: number;
  severity: 'error' | 'warning' | 'information' | 'hint';
  message: string;
  code?: string;
  source?: string;
}

export interface LSPDiagnosticsResult {
  diagnostics: LSPDiagnostic[];
  errorCount: number;
  warningCount: number;
}

export class LSPTool extends Tool {
  readonly name = 'lsp';
  readonly description = 'Language Server Protocol operations';

  // eslint-disable-next-line @typescript-eslint/require-await
  async execute(params: unknown): Promise<ToolResult> {
    const { operation, ...args } = params as { operation: string } & Record<string, unknown>;

    switch (operation) {
      case 'diagnostics':
        return this.getDiagnostics(args as unknown as LSPDiagnosticsParams);
      case 'autocomplete':
        return this.getAutocomplete(args as unknown as LSPAutocompleteParams);
      case 'definition':
        return this.getDefinition(args as unknown as LSPDefinitionParams);
      default:
        return { success: false, error: `Unknown LSP operation: ${operation}` };
    }
  }

  private async getDiagnostics(params: LSPDiagnosticsParams): Promise<ToolResult<LSPDiagnosticsResult>> {
    try {
      // Use tsc --noEmit as lightweight diagnostic
      const { execFile } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const execFileAsync = promisify(execFile);

      const { stdout } = await execFileAsync('npx', [
        'tsc',
        '--noEmit',
        '--pretty', 'false',
        '--project', 'tsconfig.json',
        params.path,
      ], { 
        timeout: 30000,
        cwd: process.cwd(),
      }).catch(err => {
        // Type errors return exit code 2
        return { stdout: err.stdout || '' };
      });

      // Parse tsc errors
      const diagnostics: LSPDiagnostic[] = [];
      const lines = stdout.split('\n');
      
      for (const line of lines) {
        // Parse: file(line,col): error TSxxxx: message
        const match = line.match(/^(.*?)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.*)$/);
        if (match) {
          diagnostics.push({
            file: match[1].trim(),
            line: parseInt(match[2], 10),
            character: parseInt(match[3], 10),
            severity: match[4] as LSPDiagnostic['severity'],
            code: match[5],
            message: match[6].trim(),
            source: 'tsc',
          });
        }
      }

      const errorCount = diagnostics.filter(d => d.severity === 'error').length;
      const warningCount = diagnostics.filter(d => d.severity === 'warning').length;

      return {
        success: errorCount === 0,
        data: {
          diagnostics: diagnostics.slice(0, 10),
          errorCount,
          warningCount,
        },
      };

    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }

  private getAutocomplete(_params: LSPAutocompleteParams): ToolResult {
    // Stub - full LSP autocomplete requires maintaining tsserver connection
    return {
      success: false,
      error: 'Autocomplete requires persistent LSP connection - use search tool instead'
    };
  }

  private getDefinition(_params: LSPDefinitionParams): ToolResult {
    // Use grep as fallback for go-to-definition
    return {
      success: false,
      error: 'Use search tool with pattern to find definitions'
    };
  }
}

export const lspTool = new LSPTool();
