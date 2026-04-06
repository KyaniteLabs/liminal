/**
 * Shared prompt-contract fragments.
 *
 * These fragments provide canonical instruction wording that can be reused
 * across prompt surfaces. The goal is to reduce drift between PromptLibrary,
 * PromptBuilder, and other runtime prompt entrypoints.
 */

export const RAW_CODE_OUTPUT_INSTRUCTION =
  'Output raw code only, with no markdown fences or explanatory prose.' as const;

export const RAW_HTML_OUTPUT_INSTRUCTION =
  'Output a single complete HTML file only, with no markdown fences or explanatory prose.' as const;

export const RAW_TSX_OUTPUT_INSTRUCTION =
  'Output raw valid TypeScript/React code only, with no markdown fences or explanatory prose.' as const;

export const RAW_CODE_NO_MARKDOWN_RULE =
  'No markdown fences or explanatory prose outside the code.' as const;

export const JSON_ONLY_OUTPUT_INSTRUCTION =
  'Return ONLY valid JSON, with no markdown fences and no text outside the JSON.' as const;

export const RAW_CODE_LOCAL_RULE =
  'Output raw code only' as const;

export const RAW_CODE_LOCAL_FORMAT_RULE =
  'No markdown fences or explanatory prose' as const;

export const RAW_CODE_TINY_RULE_SUMMARY =
  'RULES: raw code only, no markdown fences, no explanations.' as const;

export const TOOL_CALL_JSON_SCHEMA = `\{
  "thought": "Brief explanation of what you're doing",
  "tool": "toolName",
  "params": { ... },
  "expectedResult": "What you expect to happen"
\}` as const;

export function getRawCodeOutputLabel(domain: string): string {
  return `OUTPUT: Raw valid ${domain} code only.`;
}
