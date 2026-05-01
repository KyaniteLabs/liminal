import { Domain, SHADER_DOMAINS } from '../../types/domains.js';

export interface DomainEvaluationResult {
  domain: Domain;
  evaluator: string;
  signals: Record<string, boolean | number>;
  issues: string[];
}

export interface DomainEvaluator {
  readonly domain: Domain;
  readonly name: string;
  evaluate(output: string): DomainEvaluationResult;
}

export class ShaderDomainEvaluator implements DomainEvaluator {
  readonly domain = Domain.SHADER;
  readonly name = 'shader-domain-evaluator';

  evaluate(output: string): DomainEvaluationResult {
    const hasMainImage = /void\s+mainImage\s*\(/.test(output);
    const hasMain = /void\s+main\s*\(/.test(output);
    const writesFragmentColor = /gl_FragColor\b|fragColor\b|out\s+vec4\s+\w+/.test(output);
    const usesUvCoordinates = /fragCoord\b|uv\b|gl_FragCoord\b/.test(output);
    const usesColorVector = /vec3\s*\(|vec4\s*\(/.test(output);
    const usesTimeUniform = /iTime\b|u_time\b|time\b/.test(output);
    const usesResolutionUniform = /iResolution\b|u_resolution\b|resolution\b/.test(output);

    return {
      domain: Domain.SHADER,
      evaluator: this.name,
      signals: {
        hasMainImage,
        hasMain,
        writesFragmentColor,
        usesUvCoordinates,
        usesColorVector,
        usesTimeUniform,
        usesResolutionUniform,
        outputRelevantSignalCount: [
          hasMainImage || hasMain,
          writesFragmentColor,
          usesUvCoordinates,
          usesColorVector,
          usesTimeUniform,
          usesResolutionUniform,
        ].filter(Boolean).length,
      },
      issues: [
        ...(hasMainImage || hasMain ? [] : ['shader is missing a main entrypoint']),
        ...(writesFragmentColor ? [] : ['shader does not write a fragment color']),
      ],
    };
  }
}

export class DomainEvaluatorRegistry {
  private readonly evaluators = new Map<Domain, DomainEvaluator>();

  static withDefaults(): DomainEvaluatorRegistry {
    const registry = new DomainEvaluatorRegistry();
    const shader = new ShaderDomainEvaluator();
    registry.register(shader, ...SHADER_DOMAINS);
    return registry;
  }

  register(evaluator: DomainEvaluator, ...domains: Domain[]): void {
    const keys = domains.length > 0 ? domains : [evaluator.domain];
    for (const domain of keys) {
      this.evaluators.set(domain, evaluator);
    }
  }

  evaluate(domain: Domain | undefined, output: string): DomainEvaluationResult | undefined {
    if (!domain) return undefined;
    return this.evaluators.get(domain)?.evaluate(output);
  }
}
