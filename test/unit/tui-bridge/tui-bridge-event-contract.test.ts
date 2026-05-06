import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { deriveCockpit } from '../../../gui/src/gui/cockpitDerivation';
import { summarizeWorkbenchBridge } from '../../../gui/src/gui/workbenchTelemetry';
import type { TuiBridgeEvent } from '../../../src/tui-bridge/types.js';

const rootDir = process.cwd();

describe('GUI bridge event contract', () => {
  it('derives GUI state from canonical TuiBridgeEvent payloads', () => {
    const events: TuiBridgeEvent[] = [
      {
        type: 'generation.domain_plan',
        sessionId: 'session-contract',
        domains: ['p5', 'three'],
        timeoutMinutes: 3,
        candidateCount: 2,
        executionMode: 'draft',
      },
      {
        type: 'generation.attempt.started',
        sessionId: 'session-contract',
        domain: 'p5',
        attempt: 1,
        attemptTotal: 2,
      },
      {
        type: 'generation.complete',
        sessionId: 'session-contract',
        iterations: 1,
        finalScore: 0.91,
        duration: 1200,
        model: 'contract-model',
        reason: 'preview ready',
      },
    ];

    expect(deriveCockpit(events).phase).toBe('complete');
    expect(summarizeWorkbenchBridge(events).timelinePrimary).toBe('p5');
  });

  it('does not redeclare backend events as loose GUI-local type strings', () => {
    const workbenchTelemetry = readFileSync(join(rootDir, 'gui/src/gui/workbenchTelemetry.ts'), 'utf8');
    const cockpitDerivation = readFileSync(join(rootDir, 'gui/src/gui/cockpitDerivation.ts'), 'utf8');

    expect(workbenchTelemetry).toContain("from './bridgeEvents'");
    expect(cockpitDerivation).toContain("from './bridgeEvents'");
    expect(workbenchTelemetry).not.toMatch(/export\s+type\s+WorkbenchBridgeEvent\s*=\s*{[\s\S]*?type\s*:\s*string/);
    expect(cockpitDerivation).not.toMatch(/export\s+type\s+BridgeEvent\s*=\s*{[\s\S]*?type\s*:\s*string/);
  });
});
