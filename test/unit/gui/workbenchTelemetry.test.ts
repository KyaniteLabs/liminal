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
    expect(source).toContain("label: 'Reflection'");
    expect(source).toContain('generation.cognitive_receipt');
    expect(source).toContain('Reflection receipt');
    expect(source).toContain('summarizeCognitiveReceipt');
  });

  it('keeps memory compost and dreaming write-back receipts on details-only surfaces', () => {
    const telemetrySource = readFileSync(path.join(repoRoot, 'gui/src/gui/workbenchTelemetry.ts'), 'utf8');
    const appSource = readFileSync(path.join(repoRoot, 'gui/src/App.tsx'), 'utf8');
    const cockpitSource = readFileSync(path.join(repoRoot, 'gui/src/components/OperatorCockpit.tsx'), 'utf8');

    expect(telemetrySource).toContain("['memory', 'compost', 'dreaming']");
    expect(telemetrySource).toContain('writeBackSummary');
    expect(appSource).toContain('liminal-cognitive-receipt');
    expect(appSource).toContain('write-back {cognitiveReceipt.writeBackStatus}');
    expect(cockpitSource).toContain('Cognitive Loop Receipt');
    expect(cockpitSource).toContain('cognitiveReceipt.writeBackItems');
  });
});
