import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Tool, type CommandRunner, type ToolResult } from './types.js';
import { defaultJCodeRepo } from './repoContext.js';

const execFileAsync = promisify(execFile);

export interface SearchCodeParams {
  query: string;
  repo?: string;
  filePattern?: string;
  maxResults?: number;
  contextLines?: number;
}

export interface SearchCodeResult {
  repo: string;
  resultCount: number;
  results: Array<{
    file: string;
    matches: Array<{
      line: number;
      text: string;
      before?: string[];
      after?: string[];
    }>;
  }>;
}

const SEARCH_CODE_SCRIPT = `
import json
import sys
from jcodemunch_mcp.tools.search_text import search_text

repo = sys.argv[1]
query = sys.argv[2]
file_pattern = None if sys.argv[3] == "__NONE__" else sys.argv[3]
max_results = int(sys.argv[4])
context_lines = int(sys.argv[5])

print(json.dumps(search_text(
    repo=repo,
    query=query,
    file_pattern=file_pattern,
    max_results=max_results,
    context_lines=context_lines,
)))
`.trim();

export class SearchCodeTool extends Tool {
  readonly name = 'searchCode';
  readonly description = 'Search indexed code using jcodemunch';

  constructor(
    private readonly runner: CommandRunner = (command, args, options) =>
      execFileAsync(command, args, options),
  ) {
    super();
  }

  async execute(params: unknown): Promise<ToolResult<SearchCodeResult>> {
    const rawParams = params as Partial<SearchCodeParams> | null | undefined;
    const queryValue = rawParams?.query;
    if (typeof queryValue !== 'string' || queryValue.trim() === '') {
      return {
        success: false,
        error: `searchCode requires params.query to be a non-empty string; received ${Array.isArray(queryValue) ? 'array' : typeof queryValue}. Use {"query":"package.json"} or another exact search query.`,
      };
    }

    const {
      repo = defaultJCodeRepo(),
      filePattern,
      maxResults = 10,
      contextLines = 0,
    } = rawParams ?? {};
    const query = queryValue;

    try {
      const { stdout } = await this.runner(
        'python3',
        [
          '-c',
          SEARCH_CODE_SCRIPT,
          repo,
          query,
          filePattern || '__NONE__',
          String(maxResults),
          String(contextLines),
        ],
        { cwd: process.cwd(), timeout: 30000 },
      );

      const parsed = JSON.parse(stdout);
      if (parsed.error) {
        return { success: false, error: String(parsed.error) };
      }

      return {
        success: true,
        data: {
          repo: parsed.repo,
          resultCount: parsed.result_count ?? 0,
          results: parsed.results ?? [],
        },
      };
    } catch (error) {
      return { success: false, error: this.formatError(error) };
    }
  }
}

export const searchCodeTool = new SearchCodeTool();
