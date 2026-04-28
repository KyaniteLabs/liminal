import { describe, it, expect } from 'vitest';
import { Domain, isValidDomain, getDefaultDomain, WRAPPED_DOMAINS, SHADER_DOMAINS, MUSIC_DOMAINS } from '../../src/types/domains.js';

describe('Domain enum', () => {
  it('should have P5 = p5', () => {
    expect(Domain.P5).toBe('p5');
  });
  
  it('should have GLSL = glsl', () => {
    expect(Domain.GLSL).toBe('glsl');
  });
  
  it('should have THREE = three', () => {
    expect(Domain.THREE).toBe('three');
  });
  
  it('should have TONE = tone', () => {
    expect(Domain.TONE).toBe('tone');
  });
  
  it('should have HYDRA = hydra', () => {
    expect(Domain.HYDRA).toBe('hydra');
  });
  
  it('should have UNKNOWN = unknown', () => {
    expect(Domain.UNKNOWN).toBe('unknown');
  });
  
  it('should have GENERIC = generic', () => {
    expect(Domain.GENERIC).toBe('generic');
  });
  
  it('should have WEBGL = webgl', () => {
    expect(Domain.WEBGL).toBe('webgl');
  });
  
  it('should have SHADER = shader', () => {
    expect(Domain.SHADER).toBe('shader');
  });
  
  it('should have STRUDEL = strudel', () => {
    expect(Domain.STRUDEL).toBe('strudel');
  });
  
  it('should have ASCII = ascii', () => {
    expect(Domain.ASCII).toBe('ascii');
  });
  
  it('should have MUSIC = music', () => {
    expect(Domain.MUSIC).toBe('music');
  });
  
  it('should have CODE = code', () => {
    expect(Domain.CODE).toBe('code');
  });
  
  it('should have REVIEWD = revideo', () => {
    expect(Domain.REVIEWD).toBe('revideo');
  });
  
  it('should have EMPTY = ""', () => {
    expect(Domain.EMPTY).toBe('');
  });
  
  it('should include all domains in values array', () => {
    const values = Object.values(Domain);
    expect(values).toContain('p5');
    expect(values).toContain('glsl');
    expect(values).toContain('three');
    expect(values).toContain('tone');
    expect(values).toContain('hydra');
    expect(values).toContain('ascii');
    expect(values).toContain('music');
    expect(values).toContain('code');
    expect(values).toContain('revideo');
  });
});

describe('Domain helpers', () => {
  describe('isValidDomain', () => {
    it('should return true for valid domain strings', () => {
      expect(isValidDomain('p5')).toBe(true);
      expect(isValidDomain('glsl')).toBe(true);
      expect(isValidDomain('three')).toBe(true);
      expect(isValidDomain('tone')).toBe(true);
    });
    
    it('should return false for invalid domain strings', () => {
      expect(isValidDomain('invalid')).toBe(false);
      expect(isValidDomain('')).toBe(true); // EMPTY is valid
      expect(isValidDomain('random')).toBe(false);
    });
  });
  
  describe('getDefaultDomain', () => {
    it('should return Domain.UNKNOWN', () => {
      expect(getDefaultDomain()).toBe(Domain.UNKNOWN);
    });
  });
  
  describe('WRAPPED_DOMAINS', () => {
    it('should include P5, THREE, TONE, HYDRA', () => {
      expect(WRAPPED_DOMAINS).toContain(Domain.P5);
      expect(WRAPPED_DOMAINS).toContain(Domain.THREE);
      expect(WRAPPED_DOMAINS).toContain(Domain.TONE);
      expect(WRAPPED_DOMAINS).toContain(Domain.HYDRA);
    });
  });
  
  describe('SHADER_DOMAINS', () => {
    it('should include GLSL, SHADER, WEBGL', () => {
      expect(SHADER_DOMAINS).toContain(Domain.GLSL);
      expect(SHADER_DOMAINS).toContain(Domain.SHADER);
      expect(SHADER_DOMAINS).toContain(Domain.WEBGL);
    });
  });
  
  describe('MUSIC_DOMAINS', () => {
    it('should include TONE, STRUDEL, HYDRA', () => {
      expect(MUSIC_DOMAINS).toContain(Domain.TONE);
      expect(MUSIC_DOMAINS).toContain(Domain.STRUDEL);
      expect(MUSIC_DOMAINS).toContain(Domain.HYDRA);
    });
  });
});
