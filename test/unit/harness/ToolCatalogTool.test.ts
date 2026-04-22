import { describe, expect, it } from 'vitest';
import { createGeneratorToolExecutor } from '../../../src/harness/tools/generator-tools.js';
import {
  searchToolCatalog,
  toolCatalogTool,
} from '../../../src/harness/tools/index.js';

describe('ToolCatalogTool', () => {
  it('ranks domain-specific validation tools for a Three.js render request', () => {
    const result = searchToolCatalog({
      query: 'preview generated Three.js code and catch runtime errors',
      domain: 'three',
      phase: 'validate',
      maxResults: 4,
    });

    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0].name).toBe('validate_syntax');
    expect(result.results.map((entry) => entry.name)).toContain('check_imports');
    expect(result.results.every((entry) => entry.name !== 'search_tools')).toBe(true);
    expect(result.results[0].confidence).toBeGreaterThan(0.5);
  });

  it('does not recurse into the search tool unless explicitly allowed', () => {
    const result = searchToolCatalog({
      query: 'which tool searches tools',
      maxResults: 10,
    });

    expect(result.results.some((entry) => entry.name === 'search_tools')).toBe(false);
  });

  it('keeps short technical tokens useful for tool matching', () => {
    const result = searchToolCatalog({
      query: 'validate js ts 3d sketch',
      phase: 'validate',
      maxResults: 3,
    });

    expect(result.results[0].name).toBe('validate_syntax');
    expect(result.results[0].reason).toContain('matched');
  });

  it('can execute through the harness tool interface', async () => {
    const result = await toolCatalogTool.execute({
      query: 'find files and inspect code',
      phase: 'inspect',
      maxResults: 3,
    });

    expect(result.success).toBe(true);
    expect(result.data?.results.map((entry) => entry.name)).toContain('readFile');
  });

  it('scopes generator-facing search results to tools the generator executor can run', async () => {
    const executor = createGeneratorToolExecutor('three');
    const raw = await executor('search_tools', {
      query: 'inspect files and run build for generated three code',
      domain: 'three',
      maxResults: 10,
    });

    const parsed = JSON.parse(raw) as ReturnType<typeof searchToolCatalog>;
    const names = parsed.results.map((entry) => entry.name);
    expect(names).toContain('validate_syntax');
    expect(names).not.toContain('readFile');
    expect(names).not.toContain('runBuild');
    expect(names).not.toContain('applyEdit');
  });
});
