import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');

describe('workbench cognitive receipt source contract', () => {
  it('surfaces cognitive-loop receipts in process steps and recent activity', () => {
    const source = readFileSync(path.join(repoRoot, 'gui/src/gui/workbenchTelemetry.ts'), 'utf8');

    expect(source).toContain("id: 'cognition'");
    expect(source).toContain("label: 'Cognition'");
    expect(source).toContain('generation.cognitive_receipt');
    expect(source).toContain('Cognitive receipt');
    expect(source).toContain('summarizeCognitiveReceipt');
  });
});
