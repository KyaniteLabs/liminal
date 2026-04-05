import { describe, it, expect } from 'vitest';
import {
  selectRemotionTemplate,
  templates,
  type RemotionTemplateType,
} from '../../../src/generators/remotion/RemotionTemplates.js';

// ---------------------------------------------------------------------------
// selectRemotionTemplate routing
// ---------------------------------------------------------------------------
describe('selectRemotionTemplate routing', () => {
  // Particle animation triggers
  it('returns particle-animation for "particle" keyword', () => {
    expect(selectRemotionTemplate('particle explosion')).toContain('ParticleAnimation');
  });

  it('returns particle-animation for "galaxy" keyword', () => {
    expect(selectRemotionTemplate('galaxy simulation')).toContain('ParticleAnimation');
  });

  it('returns particle-animation for "star" keyword', () => {
    expect(selectRemotionTemplate('star field')).toContain('ParticleAnimation');
  });

  it('returns particle-animation for "dust" keyword', () => {
    expect(selectRemotionTemplate('floating dust')).toContain('ParticleAnimation');
  });

  it('returns particle-animation for "float" keyword', () => {
    expect(selectRemotionTemplate('float upward')).toContain('ParticleAnimation');
  });

  it('returns particle-animation for "orbit" keyword', () => {
    expect(selectRemotionTemplate('orbiting planets')).toContain('ParticleAnimation');
  });

  it('returns particle-animation for "sparkle" keyword', () => {
    expect(selectRemotionTemplate('sparkle effect')).toContain('ParticleAnimation');
  });

  // Text reveal triggers
  it('returns text-reveal for "text" keyword', () => {
    expect(selectRemotionTemplate('animated text')).toContain('TextReveal');
  });

  it('returns text-reveal for "typo" keyword', () => {
    expect(selectRemotionTemplate('typographic motion')).toContain('TextReveal');
  });

  it('returns text-reveal for "letter" keyword', () => {
    expect(selectRemotionTemplate('letter animation')).toContain('TextReveal');
  });

  it('returns text-reveal for "word" keyword', () => {
    expect(selectRemotionTemplate('word by word reveal')).toContain('TextReveal');
  });

  it('returns text-reveal for "reveal" keyword', () => {
    expect(selectRemotionTemplate('reveal title')).toContain('TextReveal');
  });

  it('returns text-reveal for "title" keyword', () => {
    expect(selectRemotionTemplate('title sequence')).toContain('TextReveal');
  });

  it('returns text-reveal for "caption" keyword', () => {
    expect(selectRemotionTemplate('caption overlay')).toContain('TextReveal');
  });

  it('returns text-reveal for "headline" keyword', () => {
    expect(selectRemotionTemplate('headline animation')).toContain('TextReveal');
  });

  // Geometric patterns triggers
  it('returns geometric-patterns for "geometric" keyword', () => {
    expect(selectRemotionTemplate('geometric design')).toContain('GeometricPatterns');
  });

  it('returns geometric-patterns for "shape" keyword', () => {
    expect(selectRemotionTemplate('shape composition')).toContain('GeometricPatterns');
  });

  it('returns geometric-patterns for "pattern" keyword', () => {
    expect(selectRemotionTemplate('pattern grid')).toContain('GeometricPatterns');
  });

  it('returns geometric-patterns for "grid" keyword', () => {
    expect(selectRemotionTemplate('grid of shapes')).toContain('GeometricPatterns');
  });

  it('returns geometric-patterns for "circle" keyword', () => {
    expect(selectRemotionTemplate('circle pattern')).toContain('GeometricPatterns');
  });

  it('returns geometric-patterns for "square" keyword', () => {
    expect(selectRemotionTemplate('square grid')).toContain('GeometricPatterns');
  });

  it('returns geometric-patterns for "polygon" keyword', () => {
    expect(selectRemotionTemplate('polygon tessellation')).toContain('GeometricPatterns');
  });

  it('returns geometric-patterns for "hexagon" keyword', () => {
    expect(selectRemotionTemplate('hexagon pattern')).toContain('GeometricPatterns');
  });

  // Gradient loop triggers
  it('returns gradient-loop for "gradient" keyword', () => {
    expect(selectRemotionTemplate('gradient background')).toContain('GradientLoop');
  });

  it('returns gradient-loop for "color" keyword', () => {
    expect(selectRemotionTemplate('color blend animation')).toContain('GradientLoop');
  });

  it('returns gradient-loop for "blend" keyword', () => {
    expect(selectRemotionTemplate('blend colors smoothly')).toContain('GradientLoop');
  });

  it('returns gradient-loop for "smooth" keyword', () => {
    expect(selectRemotionTemplate('smooth color transition')).toContain('GradientLoop');
  });

  it('returns gradient-loop for "transition" keyword', () => {
    expect(selectRemotionTemplate('transition effect')).toContain('GradientLoop');
  });

  it('returns gradient-loop for "ambient" keyword', () => {
    expect(selectRemotionTemplate('ambient background')).toContain('GradientLoop');
  });

  // Default fallback
  it('returns gradient-loop as default fallback for unmatched prompts', () => {
    expect(selectRemotionTemplate('something totally unrelated')).toContain('GradientLoop');
  });

  it('returns gradient-loop as default for empty string', () => {
    expect(selectRemotionTemplate('')).toContain('GradientLoop');
  });
});

// ---------------------------------------------------------------------------
// All templates contain required Remotion patterns
// ---------------------------------------------------------------------------
describe('Remotion template content — all templates', () => {
  const allTypes: RemotionTemplateType[] = [
    'particle-animation',
    'text-reveal',
    'geometric-patterns',
    'gradient-loop',
  ];

  for (const type of allTypes) {
    describe(`template: ${type}`, () => {
      const code = templates[type];

      it('is a non-empty string', () => {
        expect(typeof code).toBe('string');
        expect(code.length).toBeGreaterThan(100);
      });

      it('contains React import', () => {
        expect(code).toMatch(/import\s+React\s+from\s+['"]react['"]/);
      });

      it('contains Remotion useCurrentFrame import', () => {
        expect(code).toMatch(/useCurrentFrame/);
      });

      it('contains Remotion interpolate import or usage', () => {
        expect(code).toMatch(/interpolate/);
      });

      it('contains Remotion AbsoluteFill import or usage', () => {
        expect(code).toMatch(/AbsoluteFill/);
      });

      it('contains a named export', () => {
        expect(code).toMatch(/export\s+const\s+\w+/);
      });

      it('is valid TSX (contains JSX syntax)', () => {
        // All templates use JSX: <AbsoluteFill, <div, etc.
        expect(code).toMatch(/<\/?\w+/);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// Template-specific content checks
// ---------------------------------------------------------------------------
describe('particle-animation template specific content', () => {
  const code = templates['particle-animation'];

  it('contains ParticleAnimation component export', () => {
    expect(code).toContain('export const ParticleAnimation');
  });

  it('contains PARTICLE_COUNT constant', () => {
    expect(code).toContain('PARTICLE_COUNT');
  });

  it('contains Particle interface', () => {
    expect(code).toContain('interface Particle');
  });

  it('contains generateParticles function', () => {
    expect(code).toMatch(/function\s+generateParticles|const\s+particles\s*=\s*generateParticles/);
  });

  it('uses borderRadius: 50% for circular particles', () => {
    expect(code).toContain("borderRadius: '50%'");
  });
});

describe('text-reveal template specific content', () => {
  const code = templates['text-reveal'];

  it('contains TextReveal component export', () => {
    expect(code).toContain('export const TextReveal');
  });

  it('contains TEXT_LINES array', () => {
    expect(code).toContain('TEXT_LINES');
  });

  it('contains FONT_SIZE constant', () => {
    expect(code).toContain('FONT_SIZE');
  });

  it('contains LINE_DELAY constant', () => {
    expect(code).toContain('LINE_DELAY');
  });

  it('imports spring from remotion', () => {
    expect(code).toMatch(/import.*spring.*from\s+['"]remotion['"]/);
  });

  it('uses spring() for scale animation', () => {
    expect(code).toMatch(/spring\s*\(/);
  });

  it('has text content lines', () => {
    // One of the known text lines
    expect(code).toContain('Emerging from silence');
  });
});

describe('geometric-patterns template specific content', () => {
  const code = templates['geometric-patterns'];

  it('contains GeometricPatterns component export', () => {
    expect(code).toContain('export const GeometricPatterns');
  });

  it('contains GRID_SIZE constant', () => {
    expect(code).toContain('GRID_SIZE');
  });

  it('contains CELL_SIZE constant', () => {
    expect(code).toContain('CELL_SIZE');
  });

  it('contains COLORS array', () => {
    expect(code).toContain('COLORS');
  });

  it('uses CSS grid layout', () => {
    expect(code).toMatch(/gridTemplateColumns/);
  });

  it('uses Array.from for generating grid items', () => {
    expect(code).toMatch(/Array\.from/);
  });
});

describe('gradient-loop template specific content', () => {
  const code = templates['gradient-loop'];

  it('contains GradientLoop component export', () => {
    expect(code).toContain('export const GradientLoop');
  });

  it('contains PALETTE color array', () => {
    expect(code).toContain('PALETTE');
  });

  it('contains lerpColor helper function', () => {
    expect(code).toMatch(/function\s+lerpColor/);
  });

  it('uses linear-gradient CSS', () => {
    expect(code).toContain('linear-gradient');
  });

  it('uses radial-gradient CSS', () => {
    expect(code).toContain('radial-gradient');
  });

  it('has cycleDuration variable', () => {
    expect(code).toContain('cycleDuration');
  });
});

// ---------------------------------------------------------------------------
// Templates object structure
// ---------------------------------------------------------------------------
describe('templates object structure', () => {
  it('has exactly 4 template keys', () => {
    const keys = Object.keys(templates);
    expect(keys).toHaveLength(4);
  });

  it('contains all expected template type keys', () => {
    const keys = Object.keys(templates);
    expect(keys).toContain('particle-animation');
    expect(keys).toContain('text-reveal');
    expect(keys).toContain('geometric-patterns');
    expect(keys).toContain('gradient-loop');
  });

  it('every template value is a non-empty string', () => {
    for (const [key, value] of Object.entries(templates)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Edge cases for selectRemotionTemplate
// ---------------------------------------------------------------------------
describe('selectRemotionTemplate edge cases', () => {
  it('handles prompts with mixed case', () => {
    const code = selectRemotionTemplate('PARTICLE animation');
    expect(code).toContain('ParticleAnimation');
  });

  it('handles prompts with extra whitespace', () => {
    const code = selectRemotionTemplate('  geometric  pattern  ');
    expect(code).toContain('GeometricPatterns');
  });

  it('handles prompt matching first rule (particle wins over later rules)', () => {
    // "particle text" matches both particle and text — particle should win
    const code = selectRemotionTemplate('particle text');
    expect(code).toContain('ParticleAnimation');
  });

  it('handles prompts with special characters', () => {
    const code = selectRemotionTemplate('gradient #FF0000 to #0000FF');
    expect(code).toContain('GradientLoop');
  });
});
