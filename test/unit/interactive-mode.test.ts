import { describe, it, expect, beforeEach, afterEach } from 'vitest';
/**
 * Interactive mode tests - TUI for Sinter
 */
import { InteractiveMode } from '../../src/tui/InteractiveMode.js';
import { PromptHistory } from '../../src/config/PromptHistory.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const TEST_DIR = path.join(os.tmpdir(), 'atelier-tui-test');

describe('InteractiveMode', () => {
  let history: PromptHistory;
  let mode: InteractiveMode;

  beforeEach(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
    history = new PromptHistory(path.join(TEST_DIR, 'history.json'));
    mode = new InteractiveMode(history);
  });

  afterEach(async () => {
    mode.close();
    try { await fs.rm(TEST_DIR, { recursive: true, force: true }); } catch {}
  });

  describe('getProviders()', () => {
    it('should list available providers', () => {
      const providers = mode.getProviders();

      expect(providers).toContain('lmstudio');
      expect(providers).toContain('minimax');
      expect(providers).toContain('ollama');
      expect(providers).toContain('openai');
      expect(providers).toContain('hybrid');
      expect(providers.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('selectPrompt()', () => {
    it('should return null when no history', async () => {
      const result = await mode.selectPrompt();
      expect(result).toBeNull();
    });
  });
});
