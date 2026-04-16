import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');

function readRepoFile(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

describe('Bubble Tea docs consistency', () => {
  it('tracks current branch and guardrail state in THE_BIBLE', () => {
    const bible = readRepoFile('docs/THE_BIBLE.md');

    expect(bible).toContain('**Date:**');
    expect(bible).toContain('**Branch:**');
    expect(bible).toContain('**28 Documented Systems**');
    expect(bible).toContain('**18 Guardrails** (M1-M18 implemented)');
    expect(bible).toContain('M12-M18: ✅ Compliance (Privacy → Resilience)');
    expect(bible).not.toContain('M12-M18 planned');
    expect(bible).not.toContain('M12-M18: ⚪ Planned/Future');
    expect(bible).not.toContain('Not yet implemented (M1-M11 complete)');
    expect(bible).toContain('generation progress card');
  });

  it('keeps the visual bible aligned with Bubble Tea operator-surface docs', () => {
    const visualBible = readRepoFile('docs/archive/html/visual-bible.html');

    expect(visualBible).toContain('28 Documented Systems');
    expect(visualBible).toContain('Core Platform Systems (19 major systems)');
    expect(visualBible).toContain('AccessibilityGuardrails (M11)');
    expect(visualBible).toContain('RuntimeHealthMonitor (M10)');
    expect(visualBible).toContain('76710307');
    expect(visualBible).toContain('generation progress card');
  });
});
