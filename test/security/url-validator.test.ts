import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateUrl, validateUrlSync, SSRFError, getAllowedHostsFromEnv } from '../../src/security/UrlValidator.js';

// For tests that need the async validateUrl, provide a safe mock dnsLookup.
// This avoids real DNS calls while allowing validateUrl to be properly tested.
async function mockDnsLookup(hostname: string): Promise<{ address: string; family: number }> {
  // Map known hosts to stable IPs so tests are deterministic
  const map: Record<string, string> = {
    'localhost': '127.0.0.1',
    '127.0.0.1': '127.0.0.1',
    '::1': '::1',
    'api.openai.com': '8.8.8.8',
    'api.minimax.io': '8.8.8.8',
    'sub.api.openai.com': '8.8.8.8',
    'custom.llm.provider.com': '8.8.8.8',
    'evil.com': '8.8.8.8',
    '10.0.0.1': '10.0.0.1',
    '10.255.255.255': '10.255.255.255',
    '172.16.0.1': '172.16.0.1',
    '172.31.255.255': '172.31.255.255',
    '192.168.1.1': '192.168.1.1',
    '192.168.0.1': '192.168.0.1',
  };
  return { address: map[hostname] ?? '8.8.8.8', family: 4 };
}

describe('UrlValidator', () => {
  describe('validateUrlSync', () => {
    // All sync tests use validateUrlSync — no DNS calls needed, no async issues

    it('should allow OpenAI API', () => {
      expect(() => validateUrlSync('https://api.openai.com/v1/chat/completions')).not.toThrow();
    });

    it('should allow Minimax API', () => {
      expect(() => validateUrlSync('https://api.minimax.io/v1/chat/completions')).not.toThrow();
    });

    it('should block AWS metadata endpoint', () => {
      expect(() => validateUrlSync('http://169.254.169.254/latest/meta-data/')).toThrow(SSRFError);
    });

    it('should block GCP metadata endpoint', () => {
      expect(() => validateUrlSync('http://metadata.google.internal/computeMetadata/v1/')).toThrow(SSRFError);
    });

    it('should block Oracle Cloud metadata endpoint', () => {
      expect(() => validateUrlSync('http://metadata.oraclecloud.com/')).toThrow(SSRFError);
    });

    it('should block AWS ECS metadata endpoint', () => {
      expect(() => validateUrlSync('http://169.254.170.2/v2/credentials/')).toThrow(SSRFError);
    });

    it('should block private IP ranges (10.x.x.x)', () => {
      expect(() => validateUrlSync('http://10.0.0.1/secret')).toThrow(SSRFError);
      expect(() => validateUrlSync('http://10.255.255.255/admin')).toThrow(SSRFError);
    });

    it('should block private IP ranges (172.16-31.x.x)', () => {
      expect(() => validateUrlSync('http://172.16.0.1/internal')).toThrow(SSRFError);
      expect(() => validateUrlSync('http://172.31.255.255/api')).toThrow(SSRFError);
    });

    it('should block private IP ranges (192.168.x.x)', () => {
      expect(() => validateUrlSync('http://192.168.1.1/admin')).toThrow(SSRFError);
      expect(() => validateUrlSync('http://192.168.0.1/router')).toThrow(SSRFError);
    });

    it('should allow localhost by default', () => {
      expect(() => validateUrlSync('http://localhost:1234/v1')).not.toThrow();
      expect(() => validateUrlSync('http://127.0.0.1:1234/v1')).not.toThrow();
    });

    it('should block localhost when disabled', () => {
      expect(() => validateUrlSync('http://localhost:1234/v1', { allowLocalhost: false })).toThrow(SSRFError);
      expect(() => validateUrlSync('http://127.0.0.1:1234/v1', { allowLocalhost: false })).toThrow(SSRFError);
    });

    it('should allow private IPs when explicitly enabled', () => {
      expect(() => validateUrlSync('http://10.0.0.1/api', { allowPrivateIPs: true })).not.toThrow();
      expect(() => validateUrlSync('http://192.168.1.1/admin', { allowPrivateIPs: true })).not.toThrow();
    });

    it('should block invalid URLs', () => {
      expect(() => validateUrlSync('not-a-valid-url')).toThrow(SSRFError);
      expect(() => validateUrlSync('')).toThrow(SSRFError);
    });

    it('should block hosts not in whitelist when whitelist is provided', () => {
      expect(() => validateUrlSync('https://evil.com/api', {
        allowedHosts: ['custom.llm.provider.com']
      })).toThrow(SSRFError);
    });

    it('should be case insensitive for hostnames', () => {
      expect(() => validateUrlSync('http://169.254.169.254/LATEST/META-DATA/')).toThrow(SSRFError);
      expect(() => validateUrlSync('HTTP://LOCALHOST:1234/V1')).not.toThrow();
    });

    it('should block Azure metadata endpoint', () => {
      expect(() => validateUrlSync('http://169.254.169.254/metadata/v1/maintenance')).toThrow(SSRFError);
    });
  });

  describe('validateUrl (async with mock DNS)', () => {
    // These tests exercise the async validateUrl path with a controlled DNS mock

    it('should allow localhost via async path (mocked DNS)', async () => {
      await expect(validateUrl('http://localhost:1234/v1', {}, mockDnsLookup)).resolves.toBeUndefined();
    });

    it('should allow public host via async path', async () => {
      await expect(validateUrl('https://api.openai.com/v1', {}, mockDnsLookup)).resolves.toBeUndefined();
    });

    it('should block private IP when DNS resolves to private address', async () => {
      // Provide a custom dnsLookup that returns a private IP for a public-looking hostname
      const badLookup = async (): Promise<{ address: string; family: number }> =>
        ({ address: '10.0.0.1', family: 4 });
      await expect(validateUrl('https://api.company.com/v1', {}, badLookup))
        .rejects.toThrow(SSRFError);
    });

    it('should allow localhost resolving to ::1 via async path (IPv6 fix)', async () => {
      // localhost resolving to ::1 should NOT be blocked — it bypasses DNS entirely
      // via the isLocalhost hostname check and allowLocalhost=true default
      await expect(validateUrl('http://localhost:11434/api/generate', {}, mockDnsLookup))
        .resolves.toBeUndefined();
    });
  });

  describe('getAllowedHostsFromEnv', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
      delete process.env.LIMINAL_ALLOWED_HOSTS;
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should return empty array when env var is not set', () => {
      expect(getAllowedHostsFromEnv()).toEqual([]);
    });

    it('should parse comma-separated hosts', () => {
      process.env.LIMINAL_ALLOWED_HOSTS = 'host1.com, host2.com, host3.com';
      expect(getAllowedHostsFromEnv()).toEqual(['host1.com', 'host2.com', 'host3.com']);
    });

    it('should handle empty env var', () => {
      process.env.LIMINAL_ALLOWED_HOSTS = '';
      expect(getAllowedHostsFromEnv()).toEqual([]);
    });

    it('should filter out empty entries', () => {
      process.env.LIMINAL_ALLOWED_HOSTS = 'host1.com,,host2.com, ,host3.com';
      expect(getAllowedHostsFromEnv()).toEqual(['host1.com', 'host2.com', 'host3.com']);
    });
  });
});
