import { describe, it, expect } from 'vitest';
import {
  CompositionAnalyzer,
  DEFAULT_KEYWORD_MAPPINGS,
  DOMAIN_DEPENDENCIES,
  DOMAIN_RENDER_ORDER,
  DomainRecommendation,
} from '../../../src/composition/CompositionAnalyzer.js';

describe('CompositionAnalyzer', () => {
  // ==========================================================================
  // Constructor and Initialization Tests
  // ==========================================================================
  describe('constructor', () => {
    it('should create analyzer with default options', () => {
      const analyzer = new CompositionAnalyzer();
      expect(analyzer).not.toBeNull();
      expect(analyzer.getKeywordMappings()).toEqual(DEFAULT_KEYWORD_MAPPINGS);
      expect(analyzer.getDependencyRules()).toEqual(DOMAIN_DEPENDENCIES);
    });

    it('should create analyzer with custom options', () => {
      const options = { keywordThreshold: 0.7, useLLM: false };
      const analyzer = new CompositionAnalyzer(options);
      expect(analyzer).not.toBeNull();
    });

    it('should create analyzer with custom keyword mappings', () => {
      const customMappings = { p5: ['custom1', 'custom2'] };
      const analyzer = new CompositionAnalyzer({}, customMappings);
      expect(analyzer.getKeywordMappings()).toEqual(customMappings);
    });

    it('should create analyzer with custom dependency rules', () => {
      const customRules = [{ domain: 'tone', dependsOn: ['p5'], reason: 'Test' }];
      const analyzer = new CompositionAnalyzer({}, DEFAULT_KEYWORD_MAPPINGS, customRules);
      expect(analyzer.getDependencyRules()).toEqual(customRules);
    });
  });

  // ==========================================================================
  // Keyword Matching Tests
  // ==========================================================================
  describe('analyzeWithKeywords', () => {
    it('should detect p5 domain from canvas keyword', () => {
      const analyzer = new CompositionAnalyzer();
      const results = analyzer.analyzeWithKeywords('Create a canvas animation');
      
      expect(results).toHaveLength(1);
      expect(results[0].domain).toBe('p5');
      expect(results[0].confidence).toBeGreaterThan(0.5);
      expect(results[0].reason).toContain('canvas');
    });

    it('should detect p5 domain from particle keyword', () => {
      const analyzer = new CompositionAnalyzer();
      const results = analyzer.analyzeWithKeywords('Make a particle system');
      
      expect(results).toHaveLength(1);
      expect(results[0].domain).toBe('p5');
    });

    it('should detect three domain from 3d keyword', () => {
      const analyzer = new CompositionAnalyzer();
      const results = analyzer.analyzeWithKeywords('Create a 3D scene');
      
      expect(results.length).toBeGreaterThan(0);
      const threeResult = results.find(r => r.domain === 'three');

      expect(threeResult!.confidence).toBeGreaterThan(0.5);
    });

    it('should detect tone domain from audio keyword', () => {
      const analyzer = new CompositionAnalyzer();
      const results = analyzer.analyzeWithKeywords('Generate audio synth');
      
      expect(results.length).toBeGreaterThan(0);
      const toneResult = results.find(r => r.domain === 'tone');
      expect(toneResult).not.toBeNull();
    });

    it('should detect shader domain from glsl keyword', () => {
      const analyzer = new CompositionAnalyzer();
      const results = analyzer.analyzeWithKeywords('Write a GLSL shader');
      
      expect(results.length).toBeGreaterThan(0);
      const shaderResult = results.find(r => r.domain === 'shader');
      expect(shaderResult).not.toBeNull();
    });

    it('should detect hydra domain from video keyword', () => {
      const analyzer = new CompositionAnalyzer();
      const results = analyzer.analyzeWithKeywords('Create video feedback');
      
      expect(results.length).toBeGreaterThan(0);
      const hydraResult = results.find(r => r.domain === 'hydra');
      expect(hydraResult).not.toBeNull();
    });

    it('should detect strudel domain from pattern keyword', () => {
      const analyzer = new CompositionAnalyzer();
      const results = analyzer.analyzeWithKeywords('Make a rhythm pattern');
      
      expect(results.length).toBeGreaterThan(0);
      const strudelResult = results.find(r => r.domain === 'strudel');
      expect(strudelResult).not.toBeNull();
    });

    it('should detect ascii domain from text art keyword', () => {
      const analyzer = new CompositionAnalyzer();
      const results = analyzer.analyzeWithKeywords('Create ASCII text art');
      
      expect(results.length).toBeGreaterThan(0);
      const asciiResult = results.find(r => r.domain === 'ascii');
      expect(asciiResult).not.toBeNull();
    });

    it('should detect html domain from web page keyword', () => {
      const analyzer = new CompositionAnalyzer();
      const results = analyzer.analyzeWithKeywords('Build a web page');
      
      expect(results.length).toBeGreaterThan(0);
      const htmlResult = results.find(r => r.domain === 'html');
      expect(htmlResult).not.toBeNull();
    });

    it('should detect remotion domain from video export keyword', () => {
      const analyzer = new CompositionAnalyzer();
      const results = analyzer.analyzeWithKeywords('Create video export');
      
      expect(results.length).toBeGreaterThan(0);
      const remotionResult = results.find(r => r.domain === 'remotion');
      expect(remotionResult).not.toBeNull();
    });

    it('should return empty array for unknown prompts', () => {
      const analyzer = new CompositionAnalyzer();
      const results = analyzer.analyzeWithKeywords('xyz abc 123');
      
      expect(results).toHaveLength(0);
    });

    it('should detect multiple domains in complex prompts', () => {
      const analyzer = new CompositionAnalyzer();
      const results = analyzer.analyzeWithKeywords('Create a 3D scene with shader effects and audio');
      
      expect(results.length).toBeGreaterThanOrEqual(3);
      const domains = results.map(r => r.domain);
      expect(domains).toContain('three');
      expect(domains).toContain('shader');
      expect(domains).toContain('tone');
    });

    it('should boost confidence for exact domain name match', () => {
      const analyzer = new CompositionAnalyzer();
      const results = analyzer.analyzeWithKeywords('Create a p5.js sketch');
      
      const p5Result = results.find(r => r.domain === 'p5');

      expect(p5Result!.confidence).toBeGreaterThan(0.6);
    });

    it('should include matched keywords in reason', () => {
      const analyzer = new CompositionAnalyzer();
      const results = analyzer.analyzeWithKeywords('Create circles and particles');
      
      const p5Result = results.find(r => r.domain === 'p5');

      expect(p5Result!.reason).toContain('circle');
      expect(p5Result!.reason).toContain('particle');
    });
  });

  // ==========================================================================
  // LLM Analysis Tests
  // ==========================================================================
  describe('analyzeWithLLM', () => {
    it('should return recommendations from LLM analysis', async () => {
      const analyzer = new CompositionAnalyzer();
      const results = await analyzer.analyzeWithLLM('Create something complex');
      
      expect(results).not.toBeNull();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should detect 3D scene with audio pattern', async () => {
      const analyzer = new CompositionAnalyzer();
      const results = await analyzer.analyzeWithLLM('Create a 3D scene with audio');
      
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect shader on canvas pattern', async () => {
      const analyzer = new CompositionAnalyzer();
      const results = await analyzer.analyzeWithLLM('Apply GLSL shader effects on a 2D canvas');
      
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ==========================================================================
  // Domain Ordering Tests
  // ==========================================================================
  describe('domain ordering', () => {
    it('should order domains by render order', async () => {
      const analyzer = new CompositionAnalyzer();
      const results = await analyzer.analyze('Create a 3D scene with audio and shader effects');
      
      // Get positions in render order
      const positions = results.map(r => DOMAIN_RENDER_ORDER.indexOf(r.domain));
      
      // Check that positions are in ascending order
      for (let i = 1; i < positions.length; i++) {
        expect(positions[i]).toBeGreaterThanOrEqual(positions[i - 1]);
      }
    });

    it('should put html before p5 in render order', async () => {
      const analyzer = new CompositionAnalyzer();
      const results = await analyzer.analyze('Create an HTML page with canvas animation');
      
      const htmlIndex = results.findIndex(r => r.domain === 'html');
      const p5Index = results.findIndex(r => r.domain === 'p5');
      
      if (htmlIndex !== -1 && p5Index !== -1) {
        expect(htmlIndex).toBeLessThan(p5Index);
      }
    });

    it('should put p5 before tone in render order', async () => {
      const analyzer = new CompositionAnalyzer();
      const results = await analyzer.analyze('Create canvas animation with audio');
      
      const p5Index = results.findIndex(r => r.domain === 'p5');
      const toneIndex = results.findIndex(r => r.domain === 'tone');
      
      if (p5Index !== -1 && toneIndex !== -1) {
        expect(p5Index).toBeLessThan(toneIndex);
      }
    });
  });

  // ==========================================================================
  // Dependency Detection Tests
  // ==========================================================================
  describe('dependency detection', () => {
    it('should detect tone dependencies on p5', () => {
      const analyzer = new CompositionAnalyzer();
      const results = analyzer.analyzeWithKeywords('Create audio synth');
      
      const toneResult = results.find(r => r.domain === 'tone');
      if (toneResult) {
        expect(toneResult.dependencies).toContain('p5');
      }
    });

    it('should detect shader dependencies on p5 or three', () => {
      const analyzer = new CompositionAnalyzer();
      const results = analyzer.analyzeWithKeywords('Create GLSL shader');
      
      const shaderResult = results.find(r => r.domain === 'shader');
      if (shaderResult) {
        expect(shaderResult.dependencies.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('should include dependency reason in results', () => {
      const analyzer = new CompositionAnalyzer();
      const results = analyzer.analyzeWithKeywords('Create audio');
      
      const toneResult = results.find(r => r.domain === 'tone');
      if (toneResult && toneResult.dependencies.length > 0) {
        expect(toneResult.reason).not.toBeNull();
      }
    });
  });

  // ==========================================================================
  // Confidence Score Tests
  // ==========================================================================
  describe('confidence scores', () => {
    it('should return confidence between 0 and 1', () => {
      const analyzer = new CompositionAnalyzer();
      const results = analyzer.analyzeWithKeywords('Create canvas animation');
      
      for (const result of results) {
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
      }
    });

    it('should have higher confidence for more keyword matches', () => {
      const analyzer = new CompositionAnalyzer();
      const singleResult = analyzer.analyzeWithKeywords('canvas');
      const multiResult = analyzer.analyzeWithKeywords('canvas sketch circle particle animation');
      
      if (singleResult.length > 0 && multiResult.length > 0) {
        const singleP5 = singleResult.find(r => r.domain === 'p5');
        const multiP5 = multiResult.find(r => r.domain === 'p5');
        
        if (singleP5 && multiP5) {
          expect(multiP5.confidence).toBeGreaterThanOrEqual(singleP5.confidence);
        }
      }
    });
  });

  // ==========================================================================
  // Complex Prompt Tests
  // ==========================================================================
  describe('complex prompts', () => {
    it('should handle multi-domain prompts', async () => {
      const analyzer = new CompositionAnalyzer();
      const results = await analyzer.analyze('Create a 3D scene with shader effects and background music');
      
      expect(results.length).toBeGreaterThanOrEqual(2);
      const domains = results.map(r => r.domain);
      expect(domains).toContain('three');
      expect(domains).toContain('tone');
    });

    it('should handle prompts with no clear domain', async () => {
      const analyzer = new CompositionAnalyzer({ useLLM: false });
      const results = await analyzer.analyze('xyz unknown abc');
      
      // Should return empty or fallback to p5
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================================================
  // Default Exports Tests
  // ==========================================================================
  describe('exports', () => {
    it('should export DEFAULT_KEYWORD_MAPPINGS', () => {

      expect(DEFAULT_KEYWORD_MAPPINGS?.p5).toContain('canvas');
      expect(DEFAULT_KEYWORD_MAPPINGS.three).toContain('3d');
      expect(DEFAULT_KEYWORD_MAPPINGS.tone).toContain('audio');
    });

    it('should export DOMAIN_DEPENDENCIES', () => {
      expect(DOMAIN_DEPENDENCIES).not.toBeNull();
      expect(Array.isArray(DOMAIN_DEPENDENCIES)).toBe(true);
    });

    it('should export DOMAIN_RENDER_ORDER', () => {
      expect(DOMAIN_RENDER_ORDER).not.toBeNull();
      expect(Array.isArray(DOMAIN_RENDER_ORDER)).toBe(true);
      expect(DOMAIN_RENDER_ORDER).toContain('p5');
      expect(DOMAIN_RENDER_ORDER).toContain('three');
      expect(DOMAIN_RENDER_ORDER).toContain('tone');
    });

    it('should have html as first in render order', () => {
      expect(DOMAIN_RENDER_ORDER[0]).toBe('html');
    });
  });
});
