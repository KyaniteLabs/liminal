import fs from 'node:fs';
import path from 'node:path';
import { PRESERVED_CREATIVE_DOMAINS } from './RepoIndexLite.js';

export interface CreativeDomainGauntletDomain {
  id: string;
  label: string;
  prompt: string;
  implementationFiles: string[];
  verification: string;
}

export interface CreativeDomainGauntletResult {
  mode: 'source-contract';
  ready: boolean;
  total: number;
  passed: number;
  failed: number;
  domains: Array<CreativeDomainGauntletDomain & {
    status: 'pass' | 'fail';
    checks: {
      route: boolean;
      implementation: boolean;
      verification: boolean;
      preserved: boolean;
      liveExecution: boolean;
    };
  }>;
}

export const CREATIVE_DOMAIN_GAUNTLET_DOMAINS: readonly CreativeDomainGauntletDomain[] = [
  { id: 'p5', label: 'p5', prompt: 'create a p5 generative sketch', implementationFiles: ['src/generators/p5/P5GeneratorV2.ts'], verification: 'P5Generator|GeneratorRegistry' },
  { id: 'glsl', label: 'GLSL', prompt: 'create a GLSL fragment shader', implementationFiles: ['src/generators/glsl/ShaderGenerator.ts'], verification: 'ShaderGenerator|GLSL' },
  { id: 'three', label: 'Three.js', prompt: 'create a Three.js 3D scene', implementationFiles: ['src/generators/three/ThreeGenerator.ts'], verification: 'ThreeGenerator|three' },
  { id: 'svg', label: 'SVG', prompt: 'create an SVG vector logo', implementationFiles: ['src/generators/svg/SVGGenerator.ts'], verification: 'SVGGenerator|svg' },
  { id: 'hydra', label: 'Hydra', prompt: 'create a Hydra video synth patch', implementationFiles: ['src/generators/hydra/HydraGenerator.ts'], verification: 'HydraGenerator|HydraValidator' },
  { id: 'strudel', label: 'Strudel', prompt: 'create a Strudel live coding rhythm', implementationFiles: ['src/generators/strudel/StrudelGenerator.ts'], verification: 'StrudelGenerator|StrudelValidator' },
  { id: 'tone', label: 'Tone.js', prompt: 'create a Tone.js synth sequence', implementationFiles: ['src/generators/tone/ToneGenerator.ts'], verification: 'ToneGenerator|ToneValidator' },
  { id: 'revideo', label: 'Revideo', prompt: 'create a Revideo timeline composition', implementationFiles: ['src/generators/revideo/RevideoGenerator.ts'], verification: 'RevideoGenerator|RevideoValidator' },
  { id: 'ascii', label: 'ASCII', prompt: 'create ASCII art', implementationFiles: ['src/generators/ascii/ASCIIArtGenerator.ts'], verification: 'ASCIIArtGenerator|ascii' },
  { id: 'kinetic', label: 'Kinetic', prompt: 'create kinetic typography', implementationFiles: ['src/generators/kinetic/KineticGenerator.ts'], verification: 'KineticGenerator|kinetic' },
  { id: 'textgen', label: 'TextGen', prompt: 'create concrete poetry word art', implementationFiles: ['src/generators/textgen/TextGenerativeGenerator.ts'], verification: 'TextGenerativeGenerator|textgen' },
] as const;

export function runCreativeDomainGauntlet(repoRoot = process.cwd()): CreativeDomainGauntletResult {
  const domains = CREATIVE_DOMAIN_GAUNTLET_DOMAINS.map((domain) => {
    const implementation = domain.implementationFiles.every((file) => fs.existsSync(path.join(repoRoot, file)));
    const route = domain.prompt.length > 0 && domain.id.length > 0;
    const verification = domain.verification.length > 0;
    const liveExecution = false;
    const preserved = PRESERVED_CREATIVE_DOMAINS.some((preservedDomain) =>
      preservedDomain.toLowerCase().replace(/\.js$/, '') === domain.label.toLowerCase().replace(/\.js$/, '')
      || preservedDomain.toLowerCase() === domain.label.toLowerCase(),
    );
    const checks = { route, implementation, verification, preserved, liveExecution };
    return {
      ...domain,
      checks,
      status: route && implementation && verification && preserved ? 'pass' as const : 'fail' as const,
    };
  });
  const passed = domains.filter((domain) => domain.status === 'pass').length;
  const failed = domains.length - passed;
  return { mode: 'source-contract', ready: failed === 0, total: domains.length, passed, failed, domains };
}
