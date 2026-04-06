import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import {
  loadConfig,
  loadProjectConfig,
  getEffectiveConfig,
  saveConfig,
} from '../../../src/config/ConfigLoader.js';

const TEST_CONFIG_DIR = path.join(os.tmpdir(), 'liminal-config-test-' + process.pid);
const TEST_CONFIG_PATH = path.join(TEST_CONFIG_DIR, 'config.json');
const TEST_PROJECT_DIR = path.join(os.tmpdir(), 'liminal-project-test-' + process.pid);
const TEST_PROJECT_CONFIG_DIR = path.join(TEST_PROJECT_DIR, 'config');

describe('ConfigLoader', () => {
  beforeEach(async () => {
    await fs.mkdir(TEST_CONFIG_DIR, { recursive: true });
    await fs.mkdir(TEST_PROJECT_CONFIG_DIR, { recursive: true });
    try { await fs.unlink(TEST_CONFIG_PATH); } catch {}
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    try { await fs.rm(TEST_CONFIG_DIR, { recursive: true, force: true }); } catch {}
    try { await fs.rm(TEST_PROJECT_DIR, { recursive: true, force: true }); } catch {}
  });

  // ---------------------------------------------------------------------------
  // loadConfig
  // ---------------------------------------------------------------------------
  describe('loadConfig', () => {
    it('loads a valid config from file', async () => {
      const config = {
        defaultProvider: 'minimax',
        providers: {
          minimax: {
            baseUrl: 'https://api.minimax.io/v1',
            model: 'minimax-m2.7',
            apiKey: 'test-key-abc',
          },
        },
      };
      await fs.writeFile(TEST_CONFIG_PATH, JSON.stringify(config, null, 2));

      const loaded = await loadConfig(TEST_CONFIG_PATH);

      expect(loaded).not.toBeNull();
      expect(loaded!.defaultProvider).toBe('minimax');
      expect(loaded!.providers.minimax.baseUrl).toBe('https://api.minimax.io/v1');
      expect(loaded!.providers.minimax.model).toBe('minimax-m2.7');
      expect(loaded!.providers.minimax.apiKey).toBe('test-key-abc');
    });

    it('returns null if config file does not exist', async () => {
      const loaded = await loadConfig('/nonexistent/path/config.json');
      expect(loaded).toBeNull();
    });

    it('returns null if config file contains invalid JSON', async () => {
      await fs.writeFile(TEST_CONFIG_PATH, '{ invalid json }');
      const loaded = await loadConfig(TEST_CONFIG_PATH);
      expect(loaded).toBeNull();
    });

    it('loads config with optional loop settings', async () => {
      const config = {
        defaultProvider: 'lmstudio',
        providers: { lmstudio: { baseUrl: 'http://localhost:1234/v1' } },
        loop: { maxIterations: 20, timeoutMinutes: 30 },
      };
      await fs.writeFile(TEST_CONFIG_PATH, JSON.stringify(config, null, 2));

      const loaded = await loadConfig(TEST_CONFIG_PATH);

      expect(loaded!.loop!.maxIterations).toBe(20);
      expect(loaded!.loop!.timeoutMinutes).toBe(30);
    });

    it('loads config with optional creative settings', async () => {
      const config = {
        defaultProvider: 'lmstudio',
        providers: { lmstudio: {} },
        creative: { minQualityScore: 0.8 },
      };
      await fs.writeFile(TEST_CONFIG_PATH, JSON.stringify(config, null, 2));

      const loaded = await loadConfig(TEST_CONFIG_PATH);

      expect(loaded!.creative!.minQualityScore).toBe(0.8);
    });
  });

  // ---------------------------------------------------------------------------
  // saveConfig
  // ---------------------------------------------------------------------------
  describe('saveConfig', () => {
    it('writes config to a new file, creating directories', async () => {
      const newPath = path.join(TEST_CONFIG_DIR, 'subdir', 'config.json');
      const config = {
        defaultProvider: 'ollama',
        providers: { ollama: { baseUrl: 'http://localhost:11434' } },
      };

      await saveConfig(config, newPath);

      const content = await fs.readFile(newPath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.defaultProvider).toBe('ollama');
    });

    it('overwrites existing config file', async () => {
      const config1 = {
        defaultProvider: 'lmstudio',
        providers: { lmstudio: {} },
      };
      const config2 = {
        defaultProvider: 'minimax',
        providers: { minimax: {} },
      };

      await saveConfig(config1, TEST_CONFIG_PATH);
      await saveConfig(config2, TEST_CONFIG_PATH);

      const content = await fs.readFile(TEST_CONFIG_PATH, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.defaultProvider).toBe('minimax');
    });

    it('writes pretty-printed JSON', async () => {
      const config = {
        defaultProvider: 'lmstudio',
        providers: { lmstudio: { model: 'test' } },
      };

      await saveConfig(config, TEST_CONFIG_PATH);

      const content = await fs.readFile(TEST_CONFIG_PATH, 'utf-8');
      expect(content).toContain('\n'); // pretty printed
      expect(content).toContain('  '); // indented
    });
  });

  // ---------------------------------------------------------------------------
  // loadProjectConfig
  // ---------------------------------------------------------------------------
  describe('loadProjectConfig', () => {
    it('loads config from config/liminal.json when given directory path', async () => {
      const projectConfig = {
        name: 'test-project',
        version: '1.0.0',
        llm: { model: 'project-model', baseUrl: 'https://project.example/v1' },
      };
      await fs.writeFile(
        path.join(TEST_PROJECT_CONFIG_DIR, 'liminal.json'),
        JSON.stringify(projectConfig, null, 2),
      );

      const loaded = await loadProjectConfig(TEST_PROJECT_DIR);

      expect(loaded).not.toBeNull();
      expect(loaded!.name).toBe('test-project');
      expect(loaded!.llm!.model).toBe('project-model');
      expect(loaded!.llm!.baseUrl).toBe('https://project.example/v1');
    });

    it('loads config when given direct file path', async () => {
      const projectConfig = {
        name: 'direct-path-project',
        llm: { model: 'direct-model' },
      };
      const filePath = path.join(TEST_PROJECT_CONFIG_DIR, 'liminal.json');
      await fs.writeFile(filePath, JSON.stringify(projectConfig, null, 2));

      const loaded = await loadProjectConfig(filePath);

      expect(loaded).not.toBeNull();
      expect(loaded!.name).toBe('direct-path-project');
    });

    it('falls back to legacy atelier.json when liminal.json not found', async () => {
      const legacyConfig = {
        name: 'legacy-project',
        llm: { model: 'legacy-model' },
      };
      await fs.writeFile(
        path.join(TEST_PROJECT_CONFIG_DIR, 'atelier.json'),
        JSON.stringify(legacyConfig, null, 2),
      );

      const loaded = await loadProjectConfig(TEST_PROJECT_DIR);

      expect(loaded).not.toBeNull();
      expect(loaded!.name).toBe('legacy-project');
      expect(loaded!.llm!.model).toBe('legacy-model');
    });

    it('returns null when no config file exists', async () => {
      const loaded = await loadProjectConfig('/tmp/nonexistent-project-' + process.pid);
      expect(loaded).toBeNull();
    });

    it('returns null when config contains invalid JSON', async () => {
      await fs.writeFile(
        path.join(TEST_PROJECT_CONFIG_DIR, 'liminal.json'),
        '{ broken }',
      );

      // Both liminal.json and atelier.json fallback will fail
      const loaded = await loadProjectConfig(TEST_PROJECT_DIR);
      expect(loaded).toBeNull();
    });

    it('prefers liminal.json over atelier.json when both exist', async () => {
      await fs.writeFile(
        path.join(TEST_PROJECT_CONFIG_DIR, 'liminal.json'),
        JSON.stringify({ name: 'new-project' }),
      );
      await fs.writeFile(
        path.join(TEST_PROJECT_CONFIG_DIR, 'atelier.json'),
        JSON.stringify({ name: 'old-project' }),
      );

      const loaded = await loadProjectConfig(TEST_PROJECT_DIR);
      expect(loaded!.name).toBe('new-project');
    });

    it('defaults to cwd when no argument given', async () => {
      // This test just verifies the function doesn't throw when called with no args.
      // It may return null if cwd has no config, which is fine.
      const loaded = await loadProjectConfig();
      // Either a config object or null — both are valid outcomes
      expect(loaded === null || typeof loaded === 'object').toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // getEffectiveConfig
  // ---------------------------------------------------------------------------
  describe('getEffectiveConfig', () => {
    it('uses LLM env vars when set (highest priority)', async () => {
      vi.stubEnv('LIMINAL_LLM_BASE_URL', 'http://env-host:9999/v1');
      vi.stubEnv('LIMINAL_LLM_MODEL', 'env-model');
      vi.stubEnv('LIMINAL_LLM_API_KEY', 'env-key-789');

      const effective = await getEffectiveConfig();

      expect(effective.baseUrl).toBe('http://env-host:9999/v1');
      expect(effective.model).toBe('env-model');
      expect(effective.apiKey).toBe('env-key-789');
    });

    it('uses project config when env vars absent', async () => {
      const projectConfig = {
        llm: { model: 'project-model', baseUrl: 'https://project.example/v1' },
      };
      await fs.writeFile(
        path.join(TEST_PROJECT_CONFIG_DIR, 'liminal.json'),
        JSON.stringify(projectConfig, null, 2),
      );

      const effective = await getEffectiveConfig(undefined, TEST_PROJECT_DIR);

      expect(effective.model).toBe('project-model');
      expect(effective.baseUrl).toBe('https://project.example/v1');
    });

    it('env vars override project config', async () => {
      vi.stubEnv('LIMINAL_LLM_MODEL', 'env-override-model');

      const projectConfig = {
        llm: { model: 'project-model', baseUrl: 'https://project.example/v1' },
      };
      await fs.writeFile(
        path.join(TEST_PROJECT_CONFIG_DIR, 'liminal.json'),
        JSON.stringify(projectConfig, null, 2),
      );

      const effective = await getEffectiveConfig(undefined, TEST_PROJECT_DIR);

      expect(effective.model).toBe('env-override-model');
      expect(effective.baseUrl).toBe('https://project.example/v1'); // from project
    });

    it('uses file config when no env vars or project config', async () => {
      const fileConfig = {
        defaultProvider: 'lmstudio',
        providers: {
          lmstudio: {
            baseUrl: 'http://file-host:1234/v1',
            model: 'file-model',
            apiKey: 'file-key',
          },
        },
      };
      await fs.writeFile(TEST_CONFIG_PATH, JSON.stringify(fileConfig, null, 2));

      const effective = await getEffectiveConfig(TEST_CONFIG_PATH);

      expect(effective.model).toBe('file-model');
      expect(effective.baseUrl).toBe('http://file-host:1234/v1');
      expect(effective.apiKey).toBe('file-key');
    });

    it('returns default model "auto" when nothing is configured', async () => {
      const effective = await getEffectiveConfig('/nonexistent/path/config.json');
      expect(effective.model).toBe('auto');
    });

    it('returns provider "lmstudio" as default when nothing is configured', async () => {
      const effective = await getEffectiveConfig('/nonexistent/path/config.json');
      expect(effective.provider).toBe('lmstudio');
    });

    it('maps legacy "inception" provider to "lmstudio"', async () => {
      const projectConfig = { llm: { provider: 'inception', model: 'local-model' } };
      await fs.writeFile(
        path.join(TEST_PROJECT_CONFIG_DIR, 'liminal.json'),
        JSON.stringify(projectConfig, null, 2),
      );

      const effective = await getEffectiveConfig(undefined, TEST_PROJECT_DIR);
      expect(effective.provider).toBe('lmstudio');
    });

    it('maps legacy "anthropic" provider to "openai"', async () => {
      const projectConfig = { llm: { provider: 'anthropic', model: 'claude-test' } };
      await fs.writeFile(
        path.join(TEST_PROJECT_CONFIG_DIR, 'liminal.json'),
        JSON.stringify(projectConfig, null, 2),
      );

      const effective = await getEffectiveConfig(undefined, TEST_PROJECT_DIR);
      expect(effective.provider).toBe('openai');
    });

    it('maps "minimax" provider correctly', async () => {
      const projectConfig = { llm: { provider: 'minimax', model: 'minimax-m2.7' } };
      await fs.writeFile(
        path.join(TEST_PROJECT_CONFIG_DIR, 'liminal.json'),
        JSON.stringify(projectConfig, null, 2),
      );

      const effective = await getEffectiveConfig(undefined, TEST_PROJECT_DIR);
      expect(effective.provider).toBe('minimax');
    });

    it('maps "hybrid" provider correctly', async () => {
      const projectConfig = { llm: { provider: 'hybrid', model: 'test-model' } };
      await fs.writeFile(
        path.join(TEST_PROJECT_CONFIG_DIR, 'liminal.json'),
        JSON.stringify(projectConfig, null, 2),
      );

      const effective = await getEffectiveConfig(undefined, TEST_PROJECT_DIR);
      expect(effective.provider).toBe('hybrid');
    });

    it('falls back to OPENAI_API_KEY when LLM_API_KEY not set', async () => {
      vi.stubEnv('OPENAI_API_KEY', 'openai-fallback-key');

      const effective = await getEffectiveConfig('/nonexistent/path/config.json');

      expect(effective.apiKey).toBe('openai-fallback-key');
    });

    it('falls back to MINIMAX_API_KEY when LLM_API_KEY and OPENAI_API_KEY not set', async () => {
      vi.stubEnv('MINIMAX_API_KEY', 'minimax-fallback-key');

      const effective = await getEffectiveConfig('/nonexistent/path/config.json');

      expect(effective.apiKey).toBe('minimax-fallback-key');
    });

    it('prefers LLM_API_KEY over OPENAI_API_KEY and MINIMAX_API_KEY', async () => {
      vi.stubEnv('LIMINAL_LLM_API_KEY', 'llm-key');
      vi.stubEnv('OPENAI_API_KEY', 'openai-key');
      vi.stubEnv('MINIMAX_API_KEY', 'minimax-key');

      const effective = await getEffectiveConfig('/nonexistent/path/config.json');

      expect(effective.apiKey).toBe('llm-key');
    });

    it('uses file provider config matching provider name', async () => {
      const fileConfig = {
        defaultProvider: 'minimax',
        providers: {
          minimax: {
            baseUrl: 'https://api.minimax.io/v1',
            model: 'minimax-m2.5',
            apiKey: 'minimax-file-key',
          },
        },
      };
      await fs.writeFile(TEST_CONFIG_PATH, JSON.stringify(fileConfig, null, 2));

      const effective = await getEffectiveConfig(TEST_CONFIG_PATH);

      expect(effective.baseUrl).toBe('https://api.minimax.io/v1');
      expect(effective.model).toBe('minimax-m2.5');
      expect(effective.apiKey).toBe('minimax-file-key');
      expect(effective.provider).toBe('minimax');
    });

    it('uses project llm.apiKey over file config apiKey', async () => {
      const fileConfig = {
        defaultProvider: 'lmstudio',
        providers: { lmstudio: { apiKey: 'file-key' } },
      };
      await fs.writeFile(TEST_CONFIG_PATH, JSON.stringify(fileConfig, null, 2));

      const projectConfig = { llm: { apiKey: 'project-key' } };
      await fs.writeFile(
        path.join(TEST_PROJECT_CONFIG_DIR, 'liminal.json'),
        JSON.stringify(projectConfig, null, 2),
      );

      const effective = await getEffectiveConfig(TEST_CONFIG_PATH, TEST_PROJECT_DIR);

      expect(effective.apiKey).toBe('project-key');
    });

    it('returns undefined apiKey when no source provides one', async () => {
      const effective = await getEffectiveConfig('/nonexistent/path/config.json');
      expect(effective.apiKey).toBeUndefined();
    });

    it('returns undefined baseUrl when no source provides one', async () => {
      const effective = await getEffectiveConfig('/nonexistent/path/config.json');
      expect(effective.baseUrl).toBeUndefined();
    });
  });
});
