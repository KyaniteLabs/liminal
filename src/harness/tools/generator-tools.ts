/**
 * Generator & Evaluator Tool Definitions
 *
 * Lightweight tool set for creative generators and evaluators.
 * Uses existing harness tool singletons (astValidator, importGuard)
 * but exposes them through the provider-native tool calling API.
 */

import type { ToolDefinition } from '../../llm/ProviderTypes.js';
import { astValidatorTool } from './ASTValidatorTool.js';
import { importGuardTool } from './ImportGuardTool.js';
import { searchToolCatalog } from './ToolCatalogTool.js';

const GENERATOR_EXECUTABLE_TOOL_NAMES = ['validate_syntax', 'check_imports', 'submit_code'] as const;

export const GENERATOR_TOOLS: ToolDefinition[] = [
  {
    name: 'search_tools',
    description: 'Search the local tool catalog for the best available validation, repair, submission, or inspection tools. Deterministic and cheap; does not call another model.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural-language description of the capability needed' },
        domain: { type: 'string', description: 'Optional creative domain: p5, three, glsl, hydra, strudel, tone, html, svg' },
        phase: { type: 'string', description: 'Optional phase: inspect, validate, recover, verify, evaluate, render, general' },
        maxResults: { type: 'number', description: 'Maximum tools to return, default 5, max 10' },
      },
      required: ['query'],
    },
  },
  {
    name: 'validate_syntax',
    description: 'Validate JavaScript/TypeScript syntax of generated code. Returns pass/fail with error details.',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'The code to validate' },
        filename: { type: 'string', description: 'Optional filename for context (e.g. sketch.js)' },
      },
      required: ['code'],
    },
  },
  {
    name: 'check_imports',
    description: 'Check whether imports in the code are allowed for the target creative domain (p5, three, glsl, etc.).',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'The code to check imports in' },
        domain: { type: 'string', description: 'Target domain: p5, three, glsl, hydra, strudel, tone, html, revideo' },
      },
      required: ['code', 'domain'],
    },
  },
  {
    name: 'submit_code',
    description: 'Submit the final generated artifact/source code once it is ready. Use this when the artifact is complete.',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'The complete final artifact or source code' },
        language: { type: 'string', description: 'Optional language/domain label' },
      },
      required: ['code'],
    },
  },
];

export const EVALUATOR_TOOLS: ToolDefinition[] = GENERATOR_TOOLS;

export function createGeneratorToolExecutor(domain: string): (name: string, args: Record<string, unknown>) => Promise<string> {
  return async (name: string, args: Record<string, unknown>): Promise<string> => {
    try {
      switch (name) {
        case 'validate_syntax': {
          const result = await astValidatorTool.execute({
            code: args.code as string,
            filename: args.filename as string | undefined,
          });
          return JSON.stringify(result);
        }
        case 'check_imports': {
          const result = await importGuardTool.execute({
            code: args.code as string,
            domain: (args.domain as string) || domain,
          });
          return JSON.stringify(result);
        }
        case 'search_tools': {
          const result = searchToolCatalog({
            query: args.query as string,
            domain: (args.domain as string | undefined) || domain,
            phase: args.phase as string | undefined,
            maxResults: args.maxResults as number | undefined,
            allowedTools: [...GENERATOR_EXECUTABLE_TOOL_NAMES],
          });
          return JSON.stringify(result);
        }
        case 'submit_code':
          return JSON.stringify({ ok: true, submitted: true });
        default:
          return JSON.stringify({ error: `Unknown tool: ${name}` });
      }
    } catch (err) {
      return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
    }
  };
}
