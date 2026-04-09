// SECURITY NOTICE: All API keys in this file are FAKE test values.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig, loadProjectConfig, getEffectiveConfig } from '../../src/config/ConfigLoader.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const TEST_CONFIG_DIR = path.join(os.tmpdir(), 'atelier-config-test');
const TEST_CONFIG_PATH = path.join(TEST_CONFIG_DIR, 'config.json');
const TEST_PROJECT_DIR = path.join(os.tmpdir(), 'atelier-project-config-test');

describe('ConfigLoader', () => {
  beforeEach(async () => {
    await fs.mkdir(TEST_CONFIG_DIR, { recursive: true });
    try { await fs.unlink(TEST_CONFIG_PATH); } catch {}
  });

  afterEach(async () => {
    try { await fs.rm(TEST_CONFIG_DIR, { recursive: true, force: true }); } catch {}
  });

  describe('loadConfig()', () => {
    it('should load LM Studio config from file', async () => {
      const config = {
        defaultProvider: 'lmstudio',
        providers: {
          lmstudio: {
            baseUrl: 'http://localhost:1234/v1',
            model: 'qwen3-coder-next-reap-40b-a3b-i1'
          }
        }
      };
      await fs.writeFile(TEST_CONFIG_PATH, JSON.stringify(config, null, 2));

      const result = await loadConfig(TEST_CONFIG_PATH);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.defaultProvider).toBe('lmstudio');
        expect(result.value.providers.lmstudio.baseUrl).toBe('http://localhost:1234/v1');
      }
    });

    it('should return Err if config file does not exist', async () => {
      const result = await loadConfig('/nonexistent/path/config.json');
      expect(result.isErr()).toBe(true);
    });
  });

  describe('loadProjectConfig()', () => {
    beforeEach(async () => {
      await fs.mkdir(path.join(TEST_PROJECT_DIR, 'config'), { recursive: true });
    });
    afterEach(async () => {
      try { await fs.rm(TEST_PROJECT_DIR, { recursive: true, force: true }); } catch {}
    });

    it('returns config when given path to dir containing config/atelier.json', async () => {
      const projectConfig = {
        name: 'test-project',
        llm: { model: 'test-model', baseUrl: 'https://test.example/v1' }
      };
      await fs.writeFile(
        path.join(TEST_PROJECT_DIR, 'config', 'atelier.json'),
        JSON.stringify(projectConfig, null, 2)
      );

      const result = await loadProjectConfig(TEST_PROJECT_DIR);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.name).toBe('test-project');
        expect(result.value.llm?.model).toBe('test-model');
        expect(result.value.llm?.baseUrl).toBe('https://test.example/v1');
      }
    });

    it('loads optional live config (midiOutput, oscHost, oscPort, syncMode) from project config', async () => {
      const projectConfig = {
        live: {
          midiOutput: 'Virtual MIDI',
          oscHost: '127.0.0.1',
          oscPort: 57120,
          syncMode: 'link'
        }
      };
      await fs.writeFile(
        path.join(TEST_PROJECT_DIR, 'config', 'atelier.json'),
        JSON.stringify(projectConfig, null, 2)
      );

      const result = await loadProjectConfig(TEST_PROJECT_DIR);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.live?.midiOutput).toBe('Virtual MIDI');
        expect(result.value.live?.oscHost).toBe('127.0.0.1');
        expect(result.value.live?.oscPort).toBe(57120);
        expect(result.value.live?.syncMode).toBe('link');
      }
    });
  });

  describe('getEffectiveConfig()', () => {
    beforeEach(async () => {
      await fs.mkdir(path.join(TEST_PROJECT_DIR, 'config'), { recursive: true });
    });
    afterEach(async () => {
      try { await fs.rm(TEST_PROJECT_DIR, { recursive: true, force: true }); } catch {}
    });

    it('uses LLM values from project config when project has llm.model and llm.baseUrl', async () => {
      const projectConfig = {
        llm: { model: 'project-model', baseUrl: 'https://project.example/v1' }
      };
      await fs.writeFile(
        path.join(TEST_PROJECT_DIR, 'config', 'atelier.json'),
        JSON.stringify(projectConfig, null, 2)
      );

      const effective = await getEffectiveConfig(undefined, TEST_PROJECT_DIR);

      expect(effective.model).toBe('project-model');
      expect(effective.baseUrl).toBe('https://project.example/v1');
    });
  });

  describe('getEffectiveConfig legacy provider mapping (W0-C)', () => {
    beforeEach(async () => {
      await fs.mkdir(path.join(TEST_PROJECT_DIR, 'config'), { recursive: true });
    });
    afterEach(async () => {
      try { await fs.rm(TEST_PROJECT_DIR, { recursive: true, force: true }); } catch {}
    });

    it('returns provider openai when project llm.provider is openai', async () => {
      const projectConfig = { llm: { provider: 'openai', model: 'gpt-4o-mini' } };
      await fs.writeFile(
        path.join(TEST_PROJECT_DIR, 'config', 'atelier.json'),
        JSON.stringify(projectConfig, null, 2)
      );
      const effective = await getEffectiveConfig(undefined, TEST_PROJECT_DIR);
      expect(effective.provider).toBe('openai');
      expect(effective.model).toBe('gpt-4o-mini');
    });

    it('maps legacy "inception" provider to "lmstudio"', async () => {
      const projectConfig = { llm: { provider: 'inception', model: 'local-model' } };
      await fs.writeFile(
        path.join(TEST_PROJECT_DIR, 'config', 'atelier.json'),
        JSON.stringify(projectConfig, null, 2)
      );
      const effective = await getEffectiveConfig(undefined, TEST_PROJECT_DIR);
      expect(effective.provider).toBe('lmstudio');
      expect(effective.model).toBe('local-model');
    });

    it('maps legacy "anthropic" provider to "openai"', async () => {
      const projectConfig = { llm: { provider: 'anthropic', model: 'claude-3-5-haiku-20241022' } };
      await fs.writeFile(
        path.join(TEST_PROJECT_DIR, 'config', 'atelier.json'),
        JSON.stringify(projectConfig, null, 2)
      );
      const effective = await getEffectiveConfig(undefined, TEST_PROJECT_DIR);
      expect(effective.provider).toBe('openai');
      expect(effective.model).toBe('claude-3-5-haiku-20241022');
    });
  });
});
