import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getChromeArgs,
  isSandboxEnabled,
  SECURE_CHROME_ARGS,
  DANGEROUS_CHROME_ARGS,
} from '../../src/security/SandboxConfig.js';

describe('SandboxConfig', () => {
  const originalEnv = process.env;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.LIMINAL_DISABLE_SANDBOX;
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    consoleWarnSpy.mockRestore();
  });

  describe('getChromeArgs', () => {
    it('should return secure args by default (sandbox enabled)', () => {
      const args = getChromeArgs();
      
      // Should include secure args
      expect(args).toContain('--disable-dev-shm-usage');
      expect(args).toContain('--no-first-run');
      expect(args).toContain('--disable-gpu');
      
      // Should NOT include dangerous args
      expect(args).not.toContain('--no-sandbox');
      expect(args).not.toContain('--disable-setuid-sandbox');
    });

    it('should NOT disable sandbox when only forceDisableSandbox is true', () => {
      // Environment variable is NOT set
      const args = getChromeArgs({ forceDisableSandbox: true });
      
      // Should NOT include dangerous args because env var is not set
      expect(args).not.toContain('--no-sandbox');
      expect(args).not.toContain('--disable-setuid-sandbox');
      
      // Warning should NOT be logged
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should NOT disable sandbox when only env var is set', () => {
      // Set environment variable
      process.env.LIMINAL_DISABLE_SANDBOX = 'true';
      
      // But forceDisableSandbox is NOT set
      const args = getChromeArgs();
      
      // Should NOT include dangerous args because forceDisableSandbox is false
      expect(args).not.toContain('--no-sandbox');
      expect(args).not.toContain('--disable-setuid-sandbox');
      
      // Warning should NOT be logged
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should disable sandbox ONLY when both conditions are met', () => {
      // Set environment variable
      process.env.LIMINAL_DISABLE_SANDBOX = 'true';
      
      // AND forceDisableSandbox is true
      const args = getChromeArgs({ forceDisableSandbox: true });
      
      // Should include dangerous args
      expect(args).toContain('--no-sandbox');
      expect(args).toContain('--disable-setuid-sandbox');
      
      // Warning SHOULD be logged
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[SECURITY WARNING]')
      );
    });

    it('should include all secure args even when sandbox is disabled', () => {
      process.env.LIMINAL_DISABLE_SANDBOX = 'true';
      const args = getChromeArgs({ forceDisableSandbox: true });
      
      // Should still have secure args
      expect(args).toContain('--disable-dev-shm-usage');
      expect(args).toContain('--no-first-run');
      expect(args).toContain('--disable-gpu');
    });

    it('should handle env var value "false" correctly', () => {
      process.env.LIMINAL_DISABLE_SANDBOX = 'false';
      const args = getChromeArgs({ forceDisableSandbox: true });
      
      // Should NOT disable sandbox because env var is "false"
      expect(args).not.toContain('--no-sandbox');
    });

    it('should handle empty env var correctly', () => {
      process.env.LIMINAL_DISABLE_SANDBOX = '';
      const args = getChromeArgs({ forceDisableSandbox: true });
      
      // Should NOT disable sandbox because env var is empty
      expect(args).not.toContain('--no-sandbox');
    });
  });

  describe('isSandboxEnabled', () => {
    it('should return true when --no-sandbox is NOT in args', () => {
      const args = ['--disable-dev-shm-usage', '--no-first-run'];
      expect(isSandboxEnabled(args)).toBe(true);
    });

    it('should return false when --no-sandbox IS in args', () => {
      const args = ['--disable-dev-shm-usage', '--no-sandbox', '--no-first-run'];
      expect(isSandboxEnabled(args)).toBe(false);
    });

    it('should return true for default secure args', () => {
      expect(isSandboxEnabled(SECURE_CHROME_ARGS)).toBe(true);
    });

    it('should return false for dangerous args', () => {
      expect(isSandboxEnabled(DANGEROUS_CHROME_ARGS)).toBe(false);
    });
  });

  describe('SECURE_CHROME_ARGS', () => {
    it('should contain expected secure arguments', () => {
      expect(SECURE_CHROME_ARGS).toContain('--disable-dev-shm-usage');
      expect(SECURE_CHROME_ARGS).toContain('--no-first-run');
      expect(SECURE_CHROME_ARGS).toContain('--no-zygote');
      expect(SECURE_CHROME_ARGS).toContain('--single-process');
      expect(SECURE_CHROME_ARGS).toContain('--disable-gpu');
      expect(SECURE_CHROME_ARGS).toContain('--disable-web-security=false');
    });

    it('should NOT contain --no-sandbox', () => {
      expect(SECURE_CHROME_ARGS).not.toContain('--no-sandbox');
    });

    it('should NOT contain --disable-setuid-sandbox', () => {
      expect(SECURE_CHROME_ARGS).not.toContain('--disable-setuid-sandbox');
    });
  });

  describe('DANGEROUS_CHROME_ARGS', () => {
    it('should contain dangerous arguments', () => {
      expect(DANGEROUS_CHROME_ARGS).toContain('--no-sandbox');
      expect(DANGEROUS_CHROME_ARGS).toContain('--disable-setuid-sandbox');
    });
  });
});
