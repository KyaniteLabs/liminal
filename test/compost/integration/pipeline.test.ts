import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/**
 * Pipeline integration test — full end-to-end digestion.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { CompostMill } from '../../../src/compost/CompostMill.js';

describe('Pipeline Integration', () => {
  let tmpDir: string;
  let mill: CompostMill;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pipeline-test-'));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockFn: any = vi.fn();
    mockFn.mockResolvedValue({ success: true, code: 'Generated content' });

    mill = new CompostMill({ generate: mockFn }, {
      heapDir: path.join(tmpDir, 'heap'),
      digestDir: path.join(tmpDir, 'digest'),
      seedDir: path.join(tmpDir, 'seeds'),
      soupStatePath: path.join(tmpDir, 'soup-state.json'),
      soupEnabled: false,
    });
  });

  afterEach(async () => {
    mill.stopSoup();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('full pipeline: add file → digest → seeds → digest file saved', async () => {
    // Create test files
    const file = path.join(tmpDir, 'creative-doc.txt');
    await fs.writeFile(file, [
      '# Creative Ideas',
      '',
      'The intersection of ceramics and music reveals that glaze thermal dynamics',
      'mirror audio frequency spectrums. A Shino glaze carbon trapping pattern',
      'is essentially a noise cluster — render it as sound and you hear the kiln.',
      '',
      'Voice parameters (pitch contour, amplitude envelope) can map to pottery',
      'form dimensions (height, wall thickness, rim profile). This creates a new',
      'category of ceramic instruments.',
    ].join('\n'));

    // Add to heap
    await mill.add([file]);
    const filesBefore = await mill.getHeapFiles();
    expect(filesBefore.length).toBe(1);

    // Digest
    const result = await mill.digest();
    expect(result.stats.filesProcessed).toBe(1);
    expect(result.stats.fragmentCount).toBeGreaterThan(0);
    expect(result.digestPath).toBeTruthy();

    // Heap cleared
    const filesAfter = await mill.getHeapFiles();
    expect(filesAfter.length).toBe(0);

    // Digest file saved
    const digestExists = await fs.access(result.digestPath).then(() => true).catch(() => false);
    expect(digestExists).toBe(true);

    // Seed bank has promoted seeds
    const seedDirExists = await fs.access(path.join(tmpDir, 'seeds')).then(() => true).catch(() => false);
    expect(seedDirExists).toBe(true);
  }, 10000);

  it('handles mixed file types', async () => {
    const textFile = path.join(tmpDir, 'a.txt');
    const codeFile = path.join(tmpDir, 'b.ts');
    const jsonFile = path.join(tmpDir, 'c.json');

    await fs.writeFile(textFile, 'Text content about design patterns.');
    await fs.writeFile(codeFile, 'function hello() { return 42; }');
    await fs.writeFile(jsonFile, '{"key": "value"}');

    await mill.add([textFile, codeFile, jsonFile]);
    const files = await mill.getHeapFiles();
    expect(files.length).toBe(3);

    const result = await mill.digest();
    expect(result.stats.filesProcessed).toBe(3);
  }, 10000);
});
