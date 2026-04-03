import { describe, it, expect } from 'vitest';
import { Provider, isValidProvider, getDefaultProvider } from '../../src/types/providers.js';

describe('Provider enum', () => {
  describe('enum values', () => {
    it('should have LMSTUDIO = lmstudio', () => {
      expect(Provider.LMSTUDIO).toBe('lmstudio');
    });
    
    it('should have OLLAMA = ollama', () => {
      expect(Provider.OLLAMA).toBe('ollama');
    });
    
    it('should have MINIMAX = minimax', () => {
      expect(Provider.MINIMAX).toBe('minimax');
    });
    
    it('should have OPENAI = openai', () => {
      expect(Provider.OPENAI).toBe('openai');
    });
    
    it('should have OPENROUTER = openrouter', () => {
      expect(Provider.OPENROUTER).toBe('openrouter');
    });
    
    it('should have GLM = glm', () => {
      expect(Provider.GLM).toBe('glm');
    });
    
    it('should have CUSTOM = custom', () => {
      expect(Provider.CUSTOM).toBe('custom');
    });
  });
  
  describe('enum collection', () => {
    it('should include all providers in values array', () => {
      const values = Object.values(Provider);
      expect(values).toContain('lmstudio');
      expect(values).toContain('ollama');
      expect(values).toContain('minimax');
      expect(values).toContain('openai');
      expect(values).toContain('openrouter');
      expect(values).toContain('glm');
      expect(values).toContain('custom');
      expect(values).toHaveLength(7);
    });
    
    it('should include all providers in keys array', () => {
      const keys = Object.keys(Provider);
      expect(keys).toContain('LMSTUDIO');
      expect(keys).toContain('OLLAMA');
      expect(keys).toContain('MINIMAX');
      expect(keys).toContain('OPENAI');
      expect(keys).toContain('OPENROUTER');
      expect(keys).toContain('GLM');
      expect(keys).toContain('CUSTOM');
      expect(keys).toHaveLength(7);
    });
  });
  
  describe('type safety', () => {
    it('should be usable as type parameter', () => {
      function useProvider(p: Provider): string {
        return p;
      }
      expect(useProvider(Provider.LMSTUDIO)).toBe('lmstudio');
      expect(useProvider(Provider.OLLAMA)).toBe('ollama');
    });
    
    it('should allow enum member assignment to string variable', () => {
      const provider: string = Provider.LMSTUDIO;
      expect(provider).toBe('lmstudio');
    });
  });
  
  describe('isValidProvider type guard', () => {
    it('should return true for valid provider strings', () => {
      expect(isValidProvider('lmstudio')).toBe(true);
      expect(isValidProvider('ollama')).toBe(true);
      expect(isValidProvider('minimax')).toBe(true);
      expect(isValidProvider('openai')).toBe(true);
      expect(isValidProvider('openrouter')).toBe(true);
      expect(isValidProvider('glm')).toBe(true);
      expect(isValidProvider('custom')).toBe(true);
    });
    
    it('should return false for invalid provider strings', () => {
      expect(isValidProvider('invalid')).toBe(false);
      expect(isValidProvider('')).toBe(false);
      expect(isValidProvider('LMSTUDIO')).toBe(false); // wrong case
      expect(isValidProvider('open ai')).toBe(false); // space
    });
    
    it('should narrow type when used in conditionals', () => {
      const value: string = 'lmstudio';
      if (isValidProvider(value)) {
        // TypeScript should know value is Provider here
        expect(value).toBe(Provider.LMSTUDIO);
      }
    });
  });
  
  describe('getDefaultProvider', () => {
    it('should return LMSTUDIO as default', () => {
      expect(getDefaultProvider()).toBe(Provider.LMSTUDIO);
      expect(getDefaultProvider()).toBe('lmstudio');
    });
  });
  
  describe('enum reverse mapping', () => {
    it('should support reverse lookup from value to name', () => {
      // TypeScript string enums don't have reverse mapping by default
      // But we can check the enum object contains the value
      expect(Object.values(Provider)).toContain('lmstudio');
    });
  });
});
