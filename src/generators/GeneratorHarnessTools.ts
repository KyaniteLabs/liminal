import { MetabolicEntropyEngine } from '../entropy/MetabolicEntropyEngine.js';
import type { GenerationEvaluation } from '../core/types/GenerationEvaluation.js';

/**
 * GeneratorHarnessTools - Thin domain-contract harness helpers
 *
 * Provides bounded, stochastic rails that help LLMs produce valid domain output
 * without replacing LLM generation with static template fallback.
 *
 * Core principle: generators are thin harnesses. They give the model better rails
 * before generation (via skeleton/API/hint sampling) and better repair instructions
 * after validation failures (via failure classification + targeted prompts).
 *
 * NON-GOALS:
 * - NOT a static template fallback system
 * - NOT a deterministic code generator
 * - NOT a multimodal evaluator
 *
 * This slice implements only the helper service + wiring into TierBasedGenerator.
 * Success memory is in-memory only (file-backed storage is optional/non-blocking).
 */

export type FailureClass =
  | 'wrong_domain'
  | 'missing_required_api'
  | 'too_short'
  | 'truncated'
  | 'empty_after_reasoning_strip'
  | 'wrapper_contract_mismatch'
  | 'runtime_error'
  | 'unknown';

// ---------------------------------------------------------------------------
// Failure Classification Normalization (DF3 Flywheel Unlock)
// ---------------------------------------------------------------------------

/**
 * Map domain-specific FailureClass values to the shared GenerationEvaluation contract.
 */
export function classifyFailureForEvaluation(
  failure: FailureClass | string,
  context?: { renderFailed?: boolean; validationFailed?: boolean; scoreFailed?: boolean }
): GenerationEvaluation['failureClass'] {
  if (context?.renderFailed) {
    return 'render';
  }
  if (context?.validationFailed) {
    return 'validator';
  }
  if (context?.scoreFailed) {
    return 'scorer';
  }

  switch (failure) {
    case 'runtime_error':
    case 'wrapper_contract_mismatch':
    case 'wrong_domain':
    case 'missing_required_api':
    case 'too_short':
    case 'truncated':
    case 'empty_after_reasoning_strip':
      return 'validator';
    default:
      return 'none';
  }
}

/**
 * Build a minimal GenerationEvaluation pick from a classified failure.
 */
export function buildFailureEvaluation(
  failure: FailureClass | string,
  context?: { renderFailed?: boolean; validationFailed?: boolean; scoreFailed?: boolean }
): Pick<GenerationEvaluation, 'score' | 'confidence' | 'failureClass'> {
  return {
    score: 0,
    confidence: 1,
    failureClass: classifyFailureForEvaluation(failure, context),
  };
}

// ---------------------------------------------------------------------------
// Domain Skeleton & API Data
// ---------------------------------------------------------------------------

interface DomainSkeleton {
  domain: string;
  skeletonText: string;
  requiredApis: string[];
  shapeNotes: string;
}

interface DomainApiVocab {
  domain: string;
  apis: string[];
  contaminationDomains: string[];
}

const PILOT_DOMAINS: DomainSkeleton[] = [
  {
    domain: 'tone',
    skeletonText: `// Tone.js synthesis skeleton
const synth = new Tone.Synth().toDestination();
// Transport pattern:
Tone.Transport.scheduleRepeat((time) => {
  synth.triggerAttackRelease("C4", "8n", time);
}, "4n");
Tone.Transport.start();`,
    requiredApis: ['Tone.Synth', 'Tone.PolySynth', 'Tone.LFO', 'Tone.Reverb', 'Tone.Transport', 'Tone.Sequence', 'Tone.Part', 'Tone.Sampler'],
    shapeNotes: 'full Tone.js synth chain with Transport',
  },
  {
    domain: 'strudel',
    skeletonText: `// Strudel pattern skeleton
stack(
  s("bd cp:2 ~ hh").swing(0.1),
  note("C4 ~ D4 E4 ~").swing(0.1)
).out()`,
    requiredApis: ['stack', 's(', 'sound(', 'note(', '.out()', 'slow(', 'fast(', 'gain', '.delay(', '.room(', '.pan('],
    shapeNotes: 'Strudel REPL pattern with stack + sound/note calls',
  },
  {
    domain: 'ascii',
    skeletonText: `// ASCII art -- 40 chars wide, allowed: . - ~ + = * # % @ / \\ | _ ( ) [ ]
// Example line:    . - ~ + = * # % @ / \\ | _ ( ) [ ]
   .-..   .-..
  /   \\ |   |
 | ^   || ^ |
  \\   / \\   /
   \`-.-'   \`-.`,
    requiredApis: [],
    shapeNotes: 'fixed-width monospace grid, 40 columns, no code fences',
  },
  {
    domain: 'three',
    skeletonText: `// Three.js scene skeleton
import * as THREE from 'three';
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, w/h, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setSize(w, h);
// Mesh:
const geo = new THREE.BoxGeometry(1, 1, 1);
const mat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const mesh = new THREE.Mesh(geo, mat);
scene.add(mesh);
camera.position.z = 5;
// Render loop:
function animate() { requestAnimationFrame(animate); renderer.render(scene, camera); }
animate();`,
    requiredApis: ['THREE.Scene', 'THREE.WebGLRenderer', 'THREE.PerspectiveCamera', 'THREE.Mesh', 'THREE.BoxGeometry', 'THREE.MeshStandardMaterial', 'scene.add', 'requestAnimationFrame'],
    shapeNotes: 'Three.js scene + camera + renderer + mesh + render loop',
  },
  {
    domain: 'glsl',
    skeletonText: `// GLSL fragment shader skeleton
precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec3 color = vec3(uv.x, uv.y, 0.5 + 0.5 * sin(u_time));
  gl_FragColor = vec4(color, 1.0);
}
//// Alternative mainImage variant:
// void mainImage(out vec4 fragColor, in vec2 fragCoord) {
//   vec2 uv = fragCoord / u_resolution;
//   fragColor = vec4(uv, 0.5, 1.0);
// }`,
    requiredApis: ['precision', 'uniform float u_time', 'uniform vec2 u_resolution', 'gl_FragColor', 'void main', 'mainImage', 'vec2', 'vec3', 'vec4'],
    shapeNotes: 'GLSL fragment shader with precision + uniforms + main() or mainImage()',
  },
  {
    domain: 'revideo',
    skeletonText: `// Revideo scene skeleton -- generator function shape, not React component
// Do not use Remotion, @revideo/react, React.FC, useFrame, useCurrentFrame, or makeScene({ render: ... }).
import { makeScene, createRef } from '@revideo/core';
import { Txt, Rect } from '@revideo/2d';

export default makeScene('TypingScene', function* (view) {
  const text = createRef<Txt>();
  view.add(
    <Rect width={'100%'} height={'100%'} fill={'#111'}>
      <Txt ref={text} text={'Hello'} fill={'#fff'} fontSize={72} />
    </Rect>
  );
  yield* text().opacity(1, 0.5);
});`,
    requiredApis: ['makeScene', 'createRef', '@revideo/core', '@revideo/2d', 'Txt', 'Rect', 'view.add', 'yield*'],
    shapeNotes: 'Revideo makeScene(name, function* (view) { view.add(...); yield* ... }) scene',
  },
];

const DOMAIN_API_VOCAB: DomainApiVocab[] = [
  {
    domain: 'tone',
    apis: ['Tone.Synth', 'Tone.PolySynth', 'Tone.FMSynth', 'Tone.AMSynth', 'Tone.MembraneSynth', 'Tone.MetalSynth', 'Tone.LFO', 'Tone.Reverb', 'Tone.Delay', 'Tone.Chorus', 'Tone.Distortion', 'Tone.Phaser', 'Tone.Tremolo', 'Tone.Transport', 'Tone.Sequence', 'Tone.Part', 'Tone.Sampler', 'Tone.Channel', 'Tone.Filter', 'Tone.Panner', '.toDestination()', '.triggerAttackRelease('],
    contaminationDomains: ['p5.sound', 'Howler.js', 'Tone.js sync with seconds not 4n'],
  },
  {
    domain: 'strudel',
    apis: ['stack(', 's(', 'sound(', 'note(', '.out()', '.slow(', '.fast(', '.gain(', '.delay(', '.room(', '.pan(', '.cutoff(', '.resonance(', '.attack(', '.decay(', '.sustain(', '.release(', '.every(', '.cat(', '.seq(', '.struct(', '// $:'],
    contaminationDomains: ['TidalCycles', 'SuperDirt', 'hydra', 'p5.sound'],
  },
  {
    domain: 'ascii',
    apis: [],
    contaminationDomains: ['SVG', 'HTML canvas', 'WebGL', 'unicode art symbols'],
  },
  {
    domain: 'three',
    apis: ['THREE.Scene', 'THREE.WebGLRenderer', 'THREE.PerspectiveCamera', 'THREE.OrthographicCamera', 'THREE.Mesh', 'THREE.BoxGeometry', 'THREE.SphereGeometry', 'THREE.PlaneGeometry', 'THREE.MeshStandardMaterial', 'THREE.MeshBasicMaterial', 'THREE.Color', 'THREE.DirectionalLight', 'THREE.AmbientLight', 'THREE.PointLight', 'THREE.BufferGeometry', 'THREE.BufferAttribute', 'scene.add(', 'requestAnimationFrame', 'renderer.render(', 'camera.position', '.setSize(', 'import * as THREE from'],
    contaminationDomains: ['three-glfx', 'three-bokeh', 'generic WebGL without THREE namespace', 'Remotion THREE import'],
  },
  {
    domain: 'glsl',
    apis: ['precision mediump float', 'uniform float u_time', 'uniform vec2 u_resolution', 'uniform vec2 u_mouse', 'gl_FragColor', 'gl_FragCoord', 'void main()', 'void mainImage(', 'vec2 uv', 'vec3 color', 'vec4(', 'float ', 'int ', 'mat2', 'mat3', 'mat4', 'sampler2D', 'texture2D(', 'sin(', 'cos(', 'mix(', 'smoothstep(', 'length(', 'distance(', 'normalize(', 'reflect('],
    contaminationDomains: ['three-glsl', 'Unity HLSL', 'WebGL1 without precision', 'shadertoy without gl_FragColor'],
  },
  {
    domain: 'revideo',
    apis: ['makeScene', 'createRef', '@revideo/core', '@revideo/2d', 'Txt', 'Rect', 'view.add(', 'yield*', 'function* (view)', 'export default makeScene('],
    contaminationDomains: ['remotion', '@revideo/react', 'useFrame', 'useCurrentFrame', 'React.FC', 'makeScene({ render:', 'elements: ['],
  },
];

// ---------------------------------------------------------------------------
// Prompt Hardening Hints
// ---------------------------------------------------------------------------

interface HardeningHint {
  id: string;
  text: string;
  domains: string[] | 'all';
}

const HARDENING_HINTS: HardeningHint[] = [
  { id: 'raw_code_only', text: 'Output only raw code. No prose, no markdown fences, no explanation.', domains: 'all' },
  { id: 'include_required_imports', text: 'Include all required import statements or CDN links for the target library.', domains: 'all' },
  { id: 'full_html_shell', text: 'Wrap output in a complete, runnable HTML document (doctype + html + head + body).', domains: 'all' },
  { id: 'tone_transport_pattern', text: 'Use Tone.Transport.scheduleRepeat or Tone.Sequence for rhythmic patterns. Do not use Tone.start() without Transport.', domains: ['tone'] },
  { id: 'tone_synth_chain', text: 'Chain: Synth -> Channel/Effects -> toDestination(). Include Tone.Transport.start().', domains: ['tone'] },
  { id: 'strudel_stack', text: 'Wrap patterns in stack() to combine multiple voices. Use .out() at the end.', domains: ['strudel'] },
  { id: 'strudel_sound_note', text: 'Use s() for samples and note() for synthesized notes.', domains: ['strudel'] },
  { id: 'strudel_pattern_strings', text: 'Pass quoted pattern strings to s(), sound(), and note() — never raw numbers like s(100).', domains: ['strudel'] },
  { id: 'strudel_complete_structure', text: 'If you open stack(, close it and include complete child patterns; do not leave truncated stack(...) output.', domains: ['strudel'] },
  { id: 'ascii_monospace', text: 'ASCII art must be fixed-width monospace. Prefer standard ASCII symbols, but extended art glyphs like box drawing, block elements, stars, and diagonal strokes are allowed when they improve the piece.', domains: ['ascii'] },
  { id: 'ascii_no_fences', text: 'Output raw ASCII only. No code fences, no triple-backtick, no markdown markers.', domains: ['ascii'] },
  { id: 'three_scene_camera_renderer', text: 'Include THREE.Scene, THREE.PerspectiveCamera, THREE.WebGLRenderer, and a mesh in scene. Call renderer.render in a loop.', domains: ['three'] },
  { id: 'three_module_import', text: 'Use ES module import: import * as THREE from "three". Use importmap or CDN URL for three.js.', domains: ['three'] },
  { id: 'three_no_nested_html', text: 'If you return HTML, include exactly one HTML document. Never place a second <!DOCTYPE html> or <html> document inside a <script> block.', domains: ['three'] },
  { id: 'glsl_precision', text: 'Always start with precision mediump float; and declare all uniforms (u_time, u_resolution).', domains: ['glsl'] },
  { id: 'glsl_main_or_mainimage', text: 'Use either void main() with gl_FragColor, or void mainImage(out vec4, in vec2) -- not both mixed.', domains: ['glsl'] },
  { id: 'revideo_makescene_shape', text: 'Use export default makeScene("SceneName", function* (view) { ... }). Do not use makeScene({ render: ... }).', domains: ['revideo'] },
  { id: 'revideo_no_react', text: 'Do not use Remotion, @revideo/react, React.FC, useFrame, or useCurrentFrame. Use @revideo/core plus @revideo/2d.', domains: ['revideo'] },
  { id: 'revideo_scene_components', text: 'Use view.add(...), yield* animations, and @revideo/2d components such as Txt and Rect.', domains: ['revideo'] },
  { id: 'no_contamination', text: 'Do not mix frameworks. For Three.js, use only THREE namespace. For GLSL, use only WebGL/GLSL conventions.', domains: 'all' },
  { id: 'wrapper_full_html', text: 'Return a complete HTML file. Do not return a fragment or code block -- wrapForGallery depends on full HTML.', domains: ['tone', 'strudel', 'three'] },
];

// ---------------------------------------------------------------------------
// Failure-Class Repair Prompts
// ---------------------------------------------------------------------------

interface RepairPromptTemplate {
  failureClass: FailureClass;
  template: string;
}

const REPAIR_PROMPT_TEMPLATES: RepairPromptTemplate[] = [
  {
    failureClass: 'wrong_domain',
    template: 'The output used the wrong framework or domain.\nREGENERATE in the exact target domain. Forbidden frameworks: {forbiddenDomains}.\nRequired domain APIs: {requiredApis}.\nOutput only raw code, no prose.',
  },
  {
    failureClass: 'missing_required_api',
    template: 'The output is missing required API tokens for this domain.\nPATCH or REGENERATE using these required APIs: {requiredApis}\nKeep the same intent and structure, but ensure at least 2 of these APIs appear in the output.\nOutput only raw code, no prose.',
  },
  {
    failureClass: 'too_short',
    template: 'The output is too short to be a complete {domain} artifact.\nEXPAND while preserving the domain and intent.\nAdd more content: fuller implementation, more detail, more complete structure.\nOutput only the expanded code, no prose.',
  },
  {
    failureClass: 'truncated',
    template: 'The output appears to be truncated (unclosed braces, incomplete expression, or missing trailing characters).\nCONTINUE from the exact last character. Return ONLY the missing tail -- do not repeat any existing code.\nOutput only the continuation, no markdown fences.',
  },
  {
    failureClass: 'empty_after_reasoning_strip',
    template: 'All content was stripped away (reasoning tags, explanation, etc.) and nothing usable remains.\nREGENERATE: output only the final raw {domain} code/art with zero reasoning, explanation, or prose.\nNo <think> tags. No markdown fences. No comments explaining the output.',
  },
  {
    failureClass: 'wrapper_contract_mismatch',
    template: 'The output does not match the wrapper contract for {domain}.\nExpected: {wrapperExpectation}\nREGENERATE to match the exact contract. For HTML domains, return a full DOCTYPE document. For fragment-returning wrappers, return the fragment only.\nOutput only the correctly formatted code, no explanation.',
  },
  {
    failureClass: 'runtime_error',
    template: 'The output caused a runtime or compile error.\nMINIMAL REPAIR: include the exact error message and provide a corrected version of the failing section.\nError: {runtimeError}\nOutput only the corrected code, no explanation.',
  },
  {
    failureClass: 'unknown',
    template: 'The output failed validation for an unknown reason.\nREGENERATE from scratch with more care. Ensure the output:\n1. Is valid {domain} code/art\n2. Contains required APIs: {requiredApis}\n3. Is a complete, non-empty artifact\nOutput only the regenerated code, no prose.',
  },
];

// ---------------------------------------------------------------------------
// Wrapper Contract Descriptions
// ---------------------------------------------------------------------------

const WRAPPER_CONTRACTS: Record<string, string> = {
  tone: 'Complete HTML page with Tone.js loaded via CDN, synth/pattern code in a <script type="module">, audio-playing pattern.',
  strudel: 'Complete HTML page with Strudel REPL loaded via CDN, pattern code calling .out() in a <script type="module">.',
  ascii: 'Raw fixed-width ASCII art text only -- no HTML, no code fences, no markdown.',
  three: 'Complete HTML page with Three.js loaded via ES module importmap/CDN, scene code in <script type="module">.',
  glsl: 'GLSL fragment shader code only (precision + uniforms + main or mainImage), no HTML wrapper.',
  shader: 'GLSL fragment shader code only (precision + uniforms + main or mainImage), no HTML wrapper.',
  hydra: 'Complete HTML page with Hydra loaded via CDN, visual synth code in <script type="module">.',
  kinetic: 'Complete HTML page with kineticjs or raw DOM animation, full document structure.',
  revideo: 'Revideo scene file using export default makeScene("SceneName", function* (view) { ... }), @revideo/core, @revideo/2d components, view.add(...), and yield* animations. No Remotion, @revideo/react, React.FC, useFrame, useCurrentFrame, or makeScene({ render: ... }).',
  p5: 'Complete HTML page with p5.js loaded via CDN, draw() and setup() functions in <script>.',
};

// ---------------------------------------------------------------------------
// GeneratorHarnessTools
// ---------------------------------------------------------------------------

export interface GeneratorHarnessContext {
  domain: string;
  skeletonHint: string;
  sampledApis: string[];
  hardeningHints: string[];
  hintsWereSampled: boolean;
}

export interface FailureClassification {
  failureClass: FailureClass;
  evidence: string;
  suggestedApis?: string[];
  forbiddenDomains?: string[];
  runtimeError?: string;
}

export interface SuccessMetadata {
  domain: string;
  codeLength: number;
  apiCount: number;
  timestamp: string;
}

/**
 * GeneratorHarnessTools - thin domain-contract harness helpers
 *
 * @param options - optional constructor options. Either `seededRandom` or `entropySource`
 *                  must be provided; the constructor throws if neither is given.

 */
export class GeneratorHarnessTools {
  private rng: () => number;
  private successMemory: SuccessMetadata[] = [];

  // Maximum artifacts kept in memory before eviction
  private static readonly MAX_MEMORY = 100;

  constructor(options?: { seededRandom?: () => number; entropySource?: MetabolicEntropyEngine }) {
    if (options?.seededRandom) {
      this.rng = options.seededRandom;
    } else if (options?.entropySource) {
      const entropySource = options.entropySource;
      this.rng = () => entropySource.nextFloat();
    } else {
      throw new Error('GeneratorHarnessTools: either seededRandom or entropySource must be provided');
    }
  }

  // -------------------------------------------------------------------------
  // prepare() -- build harness context with sampled rails
  // -------------------------------------------------------------------------

  /**
   * Build a GeneratorHarnessContext with sampled skeleton, APIs, and hints.
   *
   * Returns null skeleton/API/hints if domain is not supported.
   * Always returns a context object (never null).
   */
  prepare(domain: string): GeneratorHarnessContext {
    const skeleton = this.sampleDomainSkeleton(domain);
    const apis = this.sampleApis(domain, 3);
    const hints = this.sampleHardeningHints(domain, 2);

    return {
      domain,
      skeletonHint: skeleton ?? '',
      sampledApis: apis,
      hardeningHints: hints,
      hintsWereSampled: (skeleton !== null || apis.length > 0 || hints.length > 0),
    };
  }

  // -------------------------------------------------------------------------
  // classifyFailure() -- classify a validation or runtime failure
  // -------------------------------------------------------------------------

  /**
   * Classify a failure into a FailureClass with evidence and suggested hints.
   *
   * @param error - the validation error message or runtime error string
   * @param code - the generated code that failed (used for structural analysis)
   */
  classifyFailure(error: string, code: string): FailureClassification {
    const errorLower = error.toLowerCase();
    const codeLower = code.toLowerCase();
    const trimmedCode = code.trim();
    const lastChar = trimmedCode.slice(-1);

    // wrong_domain: error mentions wrong framework, OR code contains contamination
    if (
      /\b(p5|hydra|strudel|tone|three|remotion|revideo|glsl|shader|canvas|svg)\b/.test(errorLower) &&
      /wrong|incorrect|not valid|does not use|framework/i.test(error)
    ) {
      return {
        failureClass: 'wrong_domain',
        evidence: error,
        forbiddenDomains: this.getContaminationDomains(codeLower),
      };
    }

    if (/does not use|not use|no .*(three|tone|hydra|strudel|tidal)/i.test(error)) {
      return {
        failureClass: 'wrong_domain',
        evidence: error,
        forbiddenDomains: this.getContaminationDomains(codeLower),
      };
    }

    // missing_required_api: error or code missing key APIs
    const domainApis = this.getDomainApis(codeLower);
    if (domainApis.length === 0 && code.trim().length > 0) {
      return {
        failureClass: 'missing_required_api',
        evidence: error,
        suggestedApis: this.getDomainSuggestedApis(codeLower),
      };
    }

    // too_short: code is suspiciously short
    if (code.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').trim().length < 30) {
      return {
        failureClass: 'too_short',
        evidence: `Code is only ${code.trim().length} chars after stripping comments`,
      };
    }

    // empty_after_reasoning_strip: code is empty or whitespace after LLM reasoning removal
    if (trimmedCode.length === 0) {
      return {
        failureClass: 'empty_after_reasoning_strip',
        evidence: 'Code is empty after stripping',
      };
    }

    // truncated: unclosed braces, parens, or missing terminating characters
    const openBraces = (code.match(/\{/g) || []).length;
    const closeBraces = (code.match(/\}/g) || []).length;
    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;
    const openBrackets = (code.match(/\[/g) || []).length;
    const closeBrackets = (code.match(/\]/g) || []).length;

    if (
      openBraces > closeBraces ||
      openParens > closeParens ||
      openBrackets > closeBrackets ||
      (!['}', ';', '\n', ')', ']'].includes(lastChar) && lastChar.length > 0 && !/^\s+$/.test(lastChar))
    ) {
      return {
        failureClass: 'truncated',
        evidence: `Unclosed: {${openBraces}>${closeBraces} (${openBraces - closeBraces}), (${openParens}>${closeParens} (${openParens - closeParens}), [${openBrackets}>${closeBrackets} (${openBrackets - closeBrackets})`,
      };
    }

    // wrapper_contract_mismatch: missing expected wrapper structure
    if (/full html|doctype|wrapper|complete document/i.test(error)) {
      return {
        failureClass: 'wrapper_contract_mismatch',
        evidence: error,
      };
    }

    // runtime_error: error message contains runtime/compile keywords
    if (
      /\b(error|exception|undefined|cannot read|is not a|failed to|unexpected|syntax error|runtime)\b/i.test(error) &&
      !/validation|valid/i.test(error)
    ) {
      return {
        failureClass: 'runtime_error',
        evidence: error,
        runtimeError: error,
      };
    }

    // unknown
    return {
      failureClass: 'unknown',
      evidence: error,
    };
  }

  // -------------------------------------------------------------------------
  // buildRepairPrompt() -- build a targeted repair prompt from a failure
  // -------------------------------------------------------------------------

  /**
   * Build a repair prompt string from a classified failure.
   */
  buildRepairPrompt(domain: string, _prompt: string, code: string, failure: FailureClassification): string {
    const tmpl = REPAIR_PROMPT_TEMPLATES.find(t => t.failureClass === failure.failureClass);
    if (!tmpl) return '';

    let result = tmpl.template;

    result = result.replace('{forbiddenDomains}', (failure.forbiddenDomains ?? []).join(', ') || 'other frameworks');
    const _apis = failure.suggestedApis ?? this.getDomainSuggestedApis(code.toLowerCase());
    result = result.replace('{requiredApis}', _apis.length > 0 ? _apis.join(', ') : 'domain-specific APIs');
    result = result.replace('{domain}', domain);
    result = result.replace('{wrapperExpectation}', WRAPPER_CONTRACTS[domain] ?? 'complete, runnable artifact');
    result = result.replace('{runtimeError}', failure.runtimeError ?? '');

    return result;
  }

  // -------------------------------------------------------------------------
  // recordSuccess() -- in-memory success memory
  // -------------------------------------------------------------------------

  /**
   * Record a successful generation for future hint sampling.
   * Storage is in-memory only in this slice.
   * Failures to store do NOT throw or fail the generation.
   */
  recordSuccess(domain: string, code: string, _metadata?: Record<string, unknown>): void {
    try {
      const apis = this.getDomainApis(code.toLowerCase());
      const entry: SuccessMetadata = {
        domain,
        codeLength: code.length,
        apiCount: apis.length,
        timestamp: new Date().toISOString(),
      };

      this.successMemory.push(entry);

      // Evict oldest entries if over limit
      if (this.successMemory.length > GeneratorHarnessTools.MAX_MEMORY) {
        this.successMemory = this.successMemory.slice(-GeneratorHarnessTools.MAX_MEMORY);
      }
    } catch {
      // Swallow: memory recording must never block generation
    }
  }

  /**
   * Get a compact summary of recorded successes for a domain.
   */
  getSuccessSummary(domain?: string): SuccessMetadata[] {
    if (domain) {
      return this.successMemory.filter(m => m.domain === domain);
    }
    return [...this.successMemory];
  }

  // -------------------------------------------------------------------------
  // buildRepairPacket() -- compact repair packet with repeated-failure detection
  // -------------------------------------------------------------------------

  /**
   * Build a compact repair packet from a GenerationEvaluation.
   *
   * @param evaluation - the evaluation containing repairAdvice
   * @param history - optional prior evaluations to detect repeated failures
   * @returns a compact string suitable for injection into a generation prompt
   */
  buildRepairPacket(
    evaluation: GenerationEvaluation,
    history?: GenerationEvaluation[]
  ): string {
    const advice = evaluation.repairAdvice;
    if (!advice) return '';

    const parts: string[] = [];
    parts.push(`[repair] issue: ${advice.issue}`);
    parts.push(`[repair] fix: ${advice.fix}`);
    parts.push(`[repair] constraint: ${advice.constraint}`);

    if (history && history.length > 0) {
      const repeated = history.filter(
        h => h.failureClass === evaluation.failureClass ||
          (h.repairAdvice && advice.issue && h.repairAdvice.issue.toLowerCase() === advice.issue.toLowerCase())
      ).length;
      if (repeated >= 2) {
        parts.push(`[repair] escalation: This failure has occurred ${repeated} times. Try a fundamentally different approach.`);
      }
    }

    return parts.join('\n');
  }

  // -------------------------------------------------------------------------
  // buildRuntimeFeedbackHint() -- placeholder for future multimodal feedback
  // -------------------------------------------------------------------------

  /**
   * Placeholder for future runtime/artifact feedback integration.
   * In this slice, returns an empty string.
   *
   * Future implementation would parse:
   * - WebGL compile errors
   * - blank screenshots
   * - audio graphs with no source
   * - video scenes missing makeScene
   * - screenshots that are nearly monochrome
   */
  buildRuntimeFeedbackHint(_domain: string, _runtimeResult: unknown): string {
    return '';
  }

  // -------------------------------------------------------------------------
  // Private sampling helpers
  // -------------------------------------------------------------------------

  private sampleDomainSkeleton(domain: string): string | null {
    const skeleton = PILOT_DOMAINS.find(d => d.domain === domain);
    if (!skeleton) return null;

    // Sample at most 1 skeleton (deterministic index via rng)
    const idx = Math.floor(this.rng() * 1);
    if (idx === 0) {
      return `// Domain scaffold for ${domain}\n${skeleton.skeletonText}`;
    }
    return null;
  }

  private sampleApis(domain: string, count: number): string[] {
    const vocab = DOMAIN_API_VOCAB.find(v => v.domain === domain);
    if (!vocab || vocab.apis.length === 0) return [];

    // Deterministic shuffle via Fisher-Yates with injected rng
    const shuffled = [...vocab.apis];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  private sampleHardeningHints(domain: string, count: number): string[] {
    const eligible = HARDENING_HINTS.filter(
      h => h.domains === 'all' || h.domains.includes(domain)
    );
    if (eligible.length === 0) return [];

    // Deterministic shuffle via Fisher-Yates with injected rng
    const shuffled = [...eligible];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.slice(0, Math.min(count, shuffled.length)).map(h => h.text);
  }

  private getDomainApis(codeLower: string): string[] {
    const matches: string[] = [];

    if (/Tone\.\w+|tone\.\w+/.test(codeLower)) matches.push('Tone.js');
    if (/THREE\.\w+/.test(codeLower)) matches.push('THREE');
    if (/\b(stack|sound|note|\.out)\b/.test(codeLower)) matches.push('strudel');
    if (/hydra|osc\(|\.out\(/.test(codeLower)) matches.push('hydra');
    if (/precision|uniform|void main/.test(codeLower)) matches.push('glsl');
    if (/makeScene|@revideo\/core|useTime|createSignal/.test(codeLower)) matches.push('revideo');
    if (/p5|setup\(\)|draw\(\)/.test(codeLower)) matches.push('p5');
    if (/^[\s.\-~+=*#%@]+$/.test(codeLower)) matches.push('ascii');

    return matches;
  }

  private getDomainSuggestedApis(codeLower: string): string[] {
    const vocab = DOMAIN_API_VOCAB.find(v => {
      if (/tone|tonedot/.test(codeLower)) return v.domain === 'tone';
      if (/three/i.test(codeLower)) return v.domain === 'three';
      if (/strudel|sound\(|\note\(/.test(codeLower)) return v.domain === 'strudel';
      if (/hydra|osc\(/.test(codeLower)) return v.domain === 'hydra';
      if (/glsl|shader|void main|precision/.test(codeLower)) return v.domain === 'glsl';
      if (/makeScene|revideo/.test(codeLower)) return v.domain === 'revideo';
      return false;
    });
    return vocab ? vocab.apis.slice(0, 4) : [];
  }

  private getContaminationDomains(codeLower: string): string[] {
    const found: string[] = [];

    const vocabList = DOMAIN_API_VOCAB.find(v => {
      if (/tone|tonedot/.test(codeLower)) return v.domain === 'tone';
      if (/three/i.test(codeLower)) return v.domain === 'three';
      if (/strudel/.test(codeLower)) return v.domain === 'strudel';
      if (/hydra/.test(codeLower)) return v.domain === 'hydra';
      if (/glsl|shader/.test(codeLower)) return v.domain === 'glsl';
      return false;
    });

    if (vocabList) {
      for (const api of vocabList.apis) {
        if (new RegExp(api.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(codeLower)) {
          found.push(api);
        }
      }
    }

    return found.slice(0, 3);
  }
}
