import { describe, it, expect } from 'vitest';
import type {
  ToolResult, ReadFileParams, WriteFileParams, ToolCall, ToolResponse,
} from '../../src/harness/tools/types.js';
import { Tool } from '../../src/harness/tools/types.js';

describe('harness/tools/types', () => {
  it('exports ToolResult interface (usable as type)', () => {
    const result: ToolResult<string> = { success: true, data: 'ok' };
    expect(result.success).toBe(true);
    expect(result.data).toBe('ok');
  });

  it('Tool base class validatePath rejects outside dirs', () => {
    class TestTool extends Tool {
      readonly name = 'test';
      readonly description = 'test';
      execute() { return Promise.resolve({ success: true } as ToolResult); }
      callValidate(p: string) { return this.validatePath(p); }
    }
    const tool = new TestTool();
    expect(tool.callValidate('/etc/passwd')).toBe(false);
    expect(tool.callValidate('src/index.ts')).toBe(true);
    expect(tool.callValidate('.omx/self-improvement-prompt.md')).toBe(true);
    expect(tool.callValidate('harness-tasks/M1.json')).toBe(true);
  });

  it('Tool formatError handles Error and non-Error', () => {
    class TestTool extends Tool {
      readonly name = 'test';
      readonly description = 'test';
      execute() { return Promise.resolve({ success: true } as ToolResult); }
      callFormat(e: unknown) { return this.formatError(e); }
    }
    const tool = new TestTool();
    expect(tool.callFormat(new Error('boom'))).toBe('boom');
    expect(tool.callFormat('str')).toBe('str');
  });
});
