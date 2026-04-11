import { describe, it, expect } from 'vitest';
import {
  buildChatPrompt,
  CHAT_SYSTEM_PROMPT,
  CHAT_TEMPERATURE,
  type ChatContext,
} from '../../../src/prompts/specialized/chat.js';
import {
  DEFAULT_DESIGN_CONSTRAINTS,
  DESIGN_TEMPERATURE,
  DESIGN_SYSTEM_PROMPT,
  resolveConstraints,
  buildDesignPrompt,
  type DesignConstraints,
} from '../../../src/prompts/specialized/design.js';
import {
  EVALUATION_TEMPERATURE,
  DEFAULT_EVALUATION_CRITERIA,
  EVALUATION_SYSTEM_PROMPT,
  buildEvaluationPrompt,
  type EvaluationCriteria,
} from '../../../src/prompts/specialized/evaluation.js';

// ===========================================================================
// Chat Prompt
// ===========================================================================

describe('chat prompt', () => {
  describe('CHAT_SYSTEM_PROMPT', () => {
    it('is a non-empty string', () => {
      expect(CHAT_SYSTEM_PROMPT.length).toBeGreaterThan(100);
    });

    it('contains grounding rules', () => {
      expect(CHAT_SYSTEM_PROMPT).toContain('GROUNDING RULES');
    });

    it('contains response format section', () => {
      expect(CHAT_SYSTEM_PROMPT).toContain('RESPONSE FORMAT');
    });
  });

  it('CHAT_TEMPERATURE is 0.7', () => {
    expect(CHAT_TEMPERATURE).toBe(0.7);
  });

  describe('buildChatPrompt', () => {
    it('returns raw message when no context is provided', () => {
      const result = buildChatPrompt('Hello world');
      expect(result).toBe('Hello world');
    });

    it('returns raw message when context is empty object', () => {
      const result = buildChatPrompt('Hello', {});
      expect(result).toBe('Hello');
    });

    it('includes domain in the prompt', () => {
      const context: ChatContext = { domain: 'visual' };
      const result = buildChatPrompt('Draw something', context);
      expect(result).toContain('<domain>visual</domain>');
      expect(result).toContain('Draw something');
    });

    it('includes currentPhase in the prompt', () => {
      const context: ChatContext = { currentPhase: 'exploration' };
      const result = buildChatPrompt('Try something', context);
      expect(result).toContain('<current_phase>exploration</current_phase>');
    });

    it('includes userPreferences as bullet list', () => {
      const context: ChatContext = {
        userPreferences: { color: 'warm', style: 'abstract' },
      };
      const result = buildChatPrompt('Make art', context);
      expect(result).toContain('<user_preferences>');
      expect(result).toContain('- color: warm');
      expect(result).toContain('- style: abstract');
      expect(result).toContain('</user_preferences>');
    });

    it('omits userPreferences when empty record', () => {
      const context: ChatContext = { userPreferences: {} };
      const result = buildChatPrompt('Make art', context);
      expect(result).not.toContain('<user_preferences>');
    });

    it('includes previousOutputs as numbered list', () => {
      const context: ChatContext = {
        previousOutputs: ['sketch-001', 'sketch-002'],
      };
      const result = buildChatPrompt('Iterate', context);
      expect(result).toContain('<previous_outputs>');
      expect(result).toContain('1. sketch-001');
      expect(result).toContain('2. sketch-002');
      expect(result).toContain('</previous_outputs>');
    });

    it('omits previousOutputs when empty array', () => {
      const context: ChatContext = { previousOutputs: [] };
      const result = buildChatPrompt('Iterate', context);
      expect(result).not.toContain('<previous_outputs>');
    });

    it('includes all context sections together', () => {
      const context: ChatContext = {
        domain: 'audio',
        currentPhase: 'refinement',
        userPreferences: { tempo: '120' },
        previousOutputs: ['beat-v1'],
      };
      const result = buildChatPrompt('Add reverb', context);

      expect(result).toContain('<domain>audio</domain>');
      expect(result).toContain('<current_phase>refinement</current_phase>');
      expect(result).toContain('- tempo: 120');
      expect(result).toContain('1. beat-v1');
      expect(result).toContain('<user_message>');
      expect(result).toContain('Add reverb');
    });

    it('wraps the user message in explicit tags', () => {
      const context: ChatContext = { domain: 'p5.js' };
      const result = buildChatPrompt('Draw circles', context);
      expect(result).toContain('<user_message>');
      expect(result).toContain('Draw circles');
      expect(result).toContain('</user_message>');
    });
  });
});

// ===========================================================================
// Design Prompt
// ===========================================================================

describe('design prompt', () => {
  describe('constants', () => {
    it('DEFAULT_DESIGN_CONSTRAINTS has correct defaults', () => {
      expect(DEFAULT_DESIGN_CONSTRAINTS.maxWidth).toBe(1920);
      expect(DEFAULT_DESIGN_CONSTRAINTS.maxHeight).toBe(1080);
      expect(DEFAULT_DESIGN_CONSTRAINTS.targetFPS).toBe(60);
      expect(DEFAULT_DESIGN_CONSTRAINTS.maxParticles).toBe(5000);
      expect(DEFAULT_DESIGN_CONSTRAINTS.colorProfile).toBe('srgb');
      expect(DEFAULT_DESIGN_CONSTRAINTS.accessibilityLevel).toBe('AA');
    });

    it('DEFAULT_DESIGN_CONSTRAINTS is a plain object with expected keys', () => {
      expect(typeof DEFAULT_DESIGN_CONSTRAINTS).toBe('object');
      expect(DEFAULT_DESIGN_CONSTRAINTS).toHaveProperty('maxParticles');
      expect(DEFAULT_DESIGN_CONSTRAINTS).toHaveProperty('colorProfile');
    });

    it('DESIGN_TEMPERATURE is 0.4', () => {
      expect(DESIGN_TEMPERATURE).toBe(0.4);
    });

    it('DESIGN_SYSTEM_PROMPT is a non-empty string', () => {
      expect(DESIGN_SYSTEM_PROMPT.length).toBeGreaterThan(100);
    });

    it('DESIGN_SYSTEM_PROMPT mentions CLARIFY and DELIVERY modes', () => {
      expect(DESIGN_SYSTEM_PROMPT).toContain('CLARIFY MODE');
      expect(DESIGN_SYSTEM_PROMPT).toContain('DELIVERY MODE');
    });
  });

  describe('resolveConstraints', () => {
    it('returns defaults when called with no arguments', () => {
      const result = resolveConstraints();
      expect(result.maxWidth).toBe(1920);
      expect(result.maxHeight).toBe(1080);
      expect(result.targetFPS).toBe(60);
      expect(result.maxParticles).toBe(5000);
      expect(result.colorProfile).toBe('srgb');
      expect(result.accessibilityLevel).toBe('AA');
    });

    it('returns frozen object', () => {
      const result = resolveConstraints();
      expect(Object.isFrozen(result)).toBe(true);
    });

    it('merges partial overrides', () => {
      const result = resolveConstraints({ maxWidth: 800, targetFPS: 30 });
      expect(result.maxWidth).toBe(800);
      expect(result.targetFPS).toBe(30);
      // Non-overridden fields keep defaults
      expect(result.maxHeight).toBe(1080);
      expect(result.maxParticles).toBe(5000);
    });

    it('overrides all fields when provided', () => {
      const result = resolveConstraints({
        maxWidth: 3840,
        maxHeight: 2160,
        targetFPS: 120,
        maxParticles: 10000,
        colorProfile: 'display-p3',
        accessibilityLevel: 'AAA',
      });
      expect(result.maxWidth).toBe(3840);
      expect(result.maxHeight).toBe(2160);
      expect(result.targetFPS).toBe(120);
      expect(result.maxParticles).toBe(10000);
      expect(result.colorProfile).toBe('display-p3');
      expect(result.accessibilityLevel).toBe('AAA');
    });
  });

  describe('buildDesignPrompt', () => {
    it('builds delivery mode prompt by default', () => {
      const result = buildDesignPrompt('A particle system', 'p5.js');
      expect(result).toContain('Mode: DELIVERY');
      expect(result).toContain('Domain: p5.js');
      expect(result).toContain('A particle system');
      expect(result).toContain('INSTRUCTION:');
      expect(result).toContain('DELIVERY mode');
    });

    it('includes constraint block with defaults', () => {
      const result = buildDesignPrompt('Spec here', 'three.js');
      expect(result).toContain('maxCanvasWidth:  1920px');
      expect(result).toContain('maxCanvasHeight: 1080px');
      expect(result).toContain('targetFPS:       60');
      expect(result).toContain('maxParticles:    5000');
      expect(result).toContain('colorProfile:    srgb');
      expect(result).toContain('WCAG AA');
    });

    it('includes custom constraints when provided', () => {
      const result = buildDesignPrompt('Spec', 'glsl', {
        maxWidth: 800,
        maxParticles: 100,
        colorProfile: 'display-p3',
        accessibilityLevel: 'AAA',
      });
      expect(result).toContain('maxCanvasWidth:  800px');
      expect(result).toContain('maxParticles:    100');
      expect(result).toContain('colorProfile:    display-p3');
      expect(result).toContain('WCAG AAA');
    });

    it('builds clarify mode prompt when mode is clarify', () => {
      const result = buildDesignPrompt('Ambiguous spec', 'p5.js', undefined, 'clarify');
      expect(result).toContain('Mode: CLARIFY');
      expect(result).toContain('Do NOT generate code');
      expect(result).toContain('CLARIFY mode');
    });

    it('clarify mode includes numbered question instruction', () => {
      const result = buildDesignPrompt('Unclear', 'hydra', undefined, 'clarify');
      expect(result).toContain('numbered questions');
      expect(result).toContain('ambiguity');
    });

    it('delivery mode does not contain clarify instructions', () => {
      const result = buildDesignPrompt('Clear spec', 'hydra', undefined, 'delivery');
      expect(result).not.toContain('Do NOT generate code');
      expect(result).toContain('production-ready code');
    });
  });
});

// ===========================================================================
// Evaluation Prompt
// ===========================================================================

describe('evaluation prompt', () => {
  describe('constants', () => {
    it('EVALUATION_TEMPERATURE is 0.2', () => {
      expect(EVALUATION_TEMPERATURE).toBe(0.2);
    });

    it('DEFAULT_EVALUATION_CRITERIA has 5 dimensions', () => {
      expect(DEFAULT_EVALUATION_CRITERIA.dimensions).toHaveLength(5);
      expect(DEFAULT_EVALUATION_CRITERIA.dimensions).toContain('technical_quality');
      expect(DEFAULT_EVALUATION_CRITERIA.dimensions).toContain('creativity');
      expect(DEFAULT_EVALUATION_CRITERIA.dimensions).toContain('novelty');
      expect(DEFAULT_EVALUATION_CRITERIA.dimensions).toContain('aesthetic_coherence');
      expect(DEFAULT_EVALUATION_CRITERIA.dimensions).toContain('emergence_potential');
    });

    it('DEFAULT_EVALUATION_CRITERIA scaleRange is [1, 10]', () => {
      expect(DEFAULT_EVALUATION_CRITERIA.scaleRange).toEqual([1, 10]);
    });

    it('DEFAULT_EVALUATION_CRITERIA requiredPassThreshold is 6.0', () => {
      expect(DEFAULT_EVALUATION_CRITERIA.requiredPassThreshold).toBe(6.0);
    });

    it('EVALUATION_SYSTEM_PROMPT contains scale placeholders', () => {
      expect(EVALUATION_SYSTEM_PROMPT).toContain('{{scaleMin}}');
      expect(EVALUATION_SYSTEM_PROMPT).toContain('{{scaleMax}}');
    });

    it('EVALUATION_SYSTEM_PROMPT contains grounding rule', () => {
      expect(EVALUATION_SYSTEM_PROMPT).toContain('GROUNDING RULE');
    });
  });

  describe('buildEvaluationPrompt', () => {
    it('includes the domain', () => {
      const result = buildEvaluationPrompt('const x = 1;', 'p5.js');
      expect(result).toContain('DOMAIN: p5.js');
    });

    it('includes the code to evaluate', () => {
      const code = 'function setup() { createCanvas(400, 400); }';
      const result = buildEvaluationPrompt(code, 'p5.js');
      expect(result).toContain('<generated_code>');
      expect(result).toContain(code);
      expect(result).toContain('</generated_code>');
    });

    it('replaces scale placeholders with default values', () => {
      const result = buildEvaluationPrompt('code', 'hydra');
      expect(result).not.toContain('{{scaleMin}}');
      expect(result).not.toContain('{{scaleMax}}');
      expect(result).toContain('1-10');
    });

    it('lists default dimensions', () => {
      const result = buildEvaluationPrompt('code', 'p5.js');
      expect(result).toContain('- technical_quality');
      expect(result).toContain('- creativity');
      expect(result).toContain('- novelty');
      expect(result).toContain('- aesthetic_coherence');
      expect(result).toContain('- emergence_potential');
    });

    it('includes default pass threshold', () => {
      const result = buildEvaluationPrompt('code', 'p5.js');
      expect(result).toContain('PASS THRESHOLD: 6');
    });

    it('uses custom scale range', () => {
      const criteria: Partial<EvaluationCriteria> = { scaleRange: [0, 5] };
      const result = buildEvaluationPrompt('code', 'hydra', criteria);
      expect(result).toContain('0-5');
      expect(result).not.toContain('1-10');
    });

    it('uses custom dimensions', () => {
      const criteria: Partial<EvaluationCriteria> = {
        dimensions: ['rhythm', 'timbre'],
      };
      const result = buildEvaluationPrompt('code', 'strudel', criteria);
      expect(result).toContain('- rhythm');
      expect(result).toContain('- timbre');
      expect(result).not.toContain('- technical_quality');
    });

    it('uses custom pass threshold', () => {
      const criteria: Partial<EvaluationCriteria> = { requiredPassThreshold: 8.5 };
      const result = buildEvaluationPrompt('code', 'p5.js', criteria);
      expect(result).toContain('PASS THRESHOLD: 8.5');
    });

    it('merges partial criteria with defaults', () => {
      const criteria: Partial<EvaluationCriteria> = { requiredPassThreshold: 7.0 };
      const result = buildEvaluationPrompt('code', 'p5.js', criteria);
      // Default dimensions still present
      expect(result).toContain('- technical_quality');
      // Default scale still used
      expect(result).toContain('1-10');
      // Custom threshold applied
      expect(result).toContain('PASS THRESHOLD: 7');
    });

    it('includes anti-hallucination instruction', () => {
      const result = buildEvaluationPrompt('code', 'p5.js');
      expect(result).toContain('every score requires concrete evidence');
    });

    it('uses explicit evaluation context tags', () => {
      const result = buildEvaluationPrompt('code', 'p5.js');
      expect(result).toContain('<evaluation_context>');
      expect(result).toContain('</evaluation_context>');
    });
  });
});
