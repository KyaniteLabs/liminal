import { describe, expect, it } from 'vitest';
import { DomainEvaluatorRegistry } from '../../../src/core/evaluators/DomainEvaluatorRegistry.js';
import { Domain } from '../../../src/types/domains.js';

const shader = `
uniform float iTime;
uniform vec2 iResolution;
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec3 color = 0.5 + 0.5 * cos(iTime + uv.xyx + vec3(0.0, 2.0, 4.0));
  fragColor = vec4(color, 1.0);
}`;

describe('DomainEvaluatorRegistry', () => {
  it('exposes shader output signals without scoring the aggregate itself', () => {
    const result = DomainEvaluatorRegistry.withDefaults().evaluate(Domain.SHADER, shader);

    expect(result).toMatchObject({ domain: Domain.SHADER, evaluator: 'shader-domain-evaluator', issues: [] });
    expect(result?.signals).toMatchObject({
      hasMainImage: true,
      writesFragmentColor: true,
      usesUvCoordinates: true,
      usesColorVector: true,
      usesTimeUniform: true,
      usesResolutionUniform: true,
      outputRelevantSignalCount: 6,
    });
  });

  it('flags shader outputs that do not write a fragment color', () => {
    const result = DomainEvaluatorRegistry.withDefaults().evaluate(Domain.GLSL, 'void main() { float x = 1.0; }');

    expect(result?.signals.writesFragmentColor).toBe(false);
    expect(result?.issues).toContain('shader does not write a fragment color');
  });
});
