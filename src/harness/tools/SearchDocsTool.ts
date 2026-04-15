import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Tool, type CommandRunner, type ToolResult } from './types.js';
import { defaultJDocRepo } from './repoContext.js';

const execFileAsync = promisify(execFile);

export interface SearchDocsParams {
  query: string;
  repo?: string;
  docPath?: string;
  maxResults?: number;
}

export interface SearchDocsResult {
  repo: string;
  resultCount: number;
  results: Array<Record<string, unknown>>;
}

const SEARCH_DOCS_SCRIPT = `
import json
import sys
from jdocmunch_mcp.tools.search_sections import search_sections

repo = sys.argv[1]
query = sys.argv[2]
doc_path = None if sys.argv[3] == "__NONE__" else sys.argv[3]
max_results = int(sys.argv[4])

print(json.dumps(search_sections(
    repo=repo,
    query=query,
    doc_path=doc_path,
    max_results=max_results,
)))
`.trim();

export class SearchDocsTool extends Tool {
  readonly name = 'searchDocs';
  readonly description = 'Search indexed docs using jdocmunch';

  constructor(
    private readonly runner: CommandRunner = (command, args, options) =>
      execFileAsync(command, args, options),
  ) {
    super();
  }

  async execute(params: unknown): Promise<ToolResult<SearchDocsResult>> {
    const {
      query,
      repo = defaultJDocRepo(),
      docPath,
      maxResults = 10,
    } = params as SearchDocsParams;

    if (!query) {
      return { success: false, error: 'query is required' };
    }

    try {
      const { stdout } = await this.runner(
        'python3',
        ['-c', SEARCH_DOCS_SCRIPT, repo, query, docPath || '__NONE__', String(maxResults)],
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

export const searchDocsTool = new SearchDocsTool();
