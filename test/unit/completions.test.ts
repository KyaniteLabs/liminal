/**
 * Shell completion tests
 */
import { generateCompletions } from '../../src/cli/Completions.js';

describe('Completions', () => {
  describe('generateCompletions()', () => {
    it('should generate zsh completions', () => {
      const script = generateCompletions('zsh');
      
      expect(script).toContain('liminal');
      expect(script).toContain('--prompt');
      expect(script).toContain('--recent');
      expect(script).toContain('--favorites');
      expect(script).toContain('--interactive');
    });

    it('should generate bash completions', () => {
      const script = generateCompletions('bash');

      expect(script).toContain('liminal');
      expect(script).toContain('--prompt');
      expect(script).toContain('--recent');
    });

    it('should return empty string for unknown shell', () => {
      const script = generateCompletions('fish');
      
      // Fish not implemented yet
      expect(script).toBe('');
    });
  });
});
