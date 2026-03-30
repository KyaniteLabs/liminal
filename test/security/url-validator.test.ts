import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateUrl, SSRFError, getAllowedHostsFromEnv } from '../../src/security/UrlValidator.js';

describe('UrlValidator', () => {
  describe('validateUrl', () => {
    it('should allow OpenAI API', () => {
      expect(() => validateUrl('https://api.openai.com/v1/chat/completions')).not.toThrow();
    });
    
    it('should allow Minimax API', () => {
      expect(() => validateUrl('https://api.minimax.io/v1/chat/completions')).not.toThrow();
    });
    
    it('should block AWS metadata endpoint', () => {
      expect(() => validateUrl('http://169.254.169.254/latest/meta-data/'))
        .toThrow(SSRFError);
    });
    
    it('should block GCP metadata endpoint', () => {
      expect(() => validateUrl('http://metadata.google.internal/computeMetadata/v1/'))
        .toThrow(SSRFError);
    });
    
    it('should block Oracle Cloud metadata endpoint', () => {
      expect(() => validateUrl('http://metadata.oraclecloud.com/'))
        .toThrow(SSRFError);
    });
    
    it('should block AWS ECS metadata endpoint', () => {
      expect(() => validateUrl('http://169.254.170.2/v2/credentials/'))
        .toThrow(SSRFError);
    });
    
    it('should block private IP ranges (10.x.x.x)', () => {
      expect(() => validateUrl('http://10.0.0.1/secret'))
        .toThrow(SSRFError);
      expect(() => validateUrl('http://10.255.255.255/admin'))
        .toThrow(SSRFError);
    });
    
    it('should block private IP ranges (172.16-31.x.x)', () => {
      expect(() => validateUrl('http://172.16.0.1/internal'))
        .toThrow(SSRFError);
      expect(() => validateUrl('http://172.31.255.255/api'))
        .toThrow(SSRFError);
    });
    
    it('should block private IP ranges (192.168.x.x)', () => {
      expect(() => validateUrl('http://192.168.1.1/admin'))
        .toThrow(SSRFError);
      expect(() => validateUrl('http://192.168.0.1/router'))
        .toThrow(SSRFError);
    });
    
    it('should allow localhost by default', () => {
      expect(() => validateUrl('http://localhost:1234/v1')).not.toThrow();
      expect(() => validateUrl('http://127.0.0.1:1234/v1')).not.toThrow();
      expect(() => validateUrl('http://localhost:11434/api/generate')).not.toThrow();
    });
    
    it('should block localhost when disabled', () => {
      expect(() => validateUrl('http://localhost:1234/v1', { allowLocalhost: false }))
        .toThrow(SSRFError);
      expect(() => validateUrl('http://127.0.0.1:1234/v1', { allowLocalhost: false }))
        .toThrow(SSRFError);
    });
    
    it('should allow private IPs when explicitly enabled', () => {
      expect(() => validateUrl('http://10.0.0.1/api', { allowPrivateIPs: true }))
        .not.toThrow();
      expect(() => validateUrl('http://192.168.1.1/admin', { allowPrivateIPs: true }))
        .not.toThrow();
    });
    
    it('should block invalid URLs', () => {
      expect(() => validateUrl('not-a-valid-url'))
        .toThrow(SSRFError);
      expect(() => validateUrl(''))
        .toThrow(SSRFError);
    });
    
    it('should respect custom allowed hosts whitelist', () => {
      expect(() => validateUrl('https://custom.llm.provider.com/api', { 
        allowedHosts: ['custom.llm.provider.com'] 
      })).not.toThrow();
    });
    
    it('should block hosts not in whitelist when whitelist is provided', () => {
      expect(() => validateUrl('https://evil.com/api', { 
        allowedHosts: ['custom.llm.provider.com'] 
      })).toThrow(SSRFError);
    });
    
    it('should handle subdomains correctly', () => {
      expect(() => validateUrl('https://sub.api.openai.com/v1', {
        allowedHosts: []
      })).not.toThrow();
    });
    
    it('should be case insensitive for hostnames', () => {
      expect(() => validateUrl('http://169.254.169.254/LATEST/META-DATA/'))
        .toThrow(SSRFError);
      expect(() => validateUrl('HTTP://LOCALHOST:1234/V1')).not.toThrow();
    });

    it('should block Azure metadata endpoint', () => {
      expect(() => validateUrl('http://169.254.169.254/metadata/v1/maintenance'))
        .toThrow(SSRFError);
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
