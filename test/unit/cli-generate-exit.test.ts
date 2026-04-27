import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('CLI generate exit contract', () => {
  it('exits after successful generation instead of leaving handles alive', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'bin', 'liminal'), 'utf-8');
    const generateStart = source.indexOf("if (cmd === 'generate'");
    const serveStart = source.indexOf("else if (cmd === 'serve'", generateStart);
    const generateBlock = source.slice(generateStart, serveStart);

    expect(generateBlock).toContain('✅ Generation complete!');
    expect(generateBlock).toContain('process.exit(0)');
  });
});
