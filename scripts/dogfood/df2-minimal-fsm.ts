#!/usr/bin/env node
/**
 * DF2 Minimal Deterministic FSM
 *
 * Bounded product dogfood loop: generate up to two candidates, validate,
 * execute runtime, evaluate only eligible candidates, then adjudicate without
 * putting an LLM in the hot-path control loop.
 */

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CodeValidator } from '../../src/core/CodeValidator.js';
import { HTMLWebGenerator } from '../../src/generators/html/HTMLWebGenerator.js';
import { KineticGenerator } from '../../src/generators/kinetic/KineticGenerator.js';
import { LLMClient, type LLMConfig, type LLMResponse } from '../../src/llm/LLMClient.js';
import { P5GeneratorV2 } from '../../src/generators/p5/P5GeneratorV2.js';
import { HeadlessRenderer, type RenderDomain } from '../../src/render/HeadlessRenderer.js';
import { ShaderGenerator } from '../../src/generators/glsl/ShaderGenerator.js';
import { ThreeGenerator } from '../../src/generators/three/ThreeGenerator.js';

export type Df2Domain = 'p5' | 'glsl' | 'three' | 'kinetic' | 'html' | 'strudel' | 'tone' | 'ascii';
export type RuntimeDomain = Extract<Df2Domain, 'p5' | 'glsl' | 'three' | 'kinetic' | 'html'>;
export type Df2PresetName = 'qwen-local' | 'glm-ab';
export type Df2ProviderName = 'active' | 'openai' | 'glm' | 'kimi' | 'minimax' | 'lmstudio' | 'ollama';
export type RunState =
  | 'RUN_INIT'
  | 'PREFLIGHT_TASK'
  | 'PREFLIGHT_CANARY'
  | 'ATTEMPT_1'
  | 'ATTEMPT_2'
  | 'GENERATE'
  | 'NORMALIZE'
  | 'DETERMINISTIC_VALIDATE'
  | 'RUNTIME_EXECUTE'
  | 'EVALUATE'
  | 'CANDIDATE_SUMMARY'
  | 'DECIDE_NEXT'
  | 'FINAL_ADJUDICATE'
  | 'TERMINAL_LAUNCH_READY_PASS'
  | 'TERMINAL_FUNCTIONAL_PASS'
  | 'TERMINAL_QUALITY_WARNING'
  | 'TERMINAL_GENERATOR_COMPATIBILITY_FAILURE'
  | 'TERMINAL_HARNESS_VALIDATOR_WRAPPER_FAILURE';

export type FailureStage = 'generate' | 'normalize' | 'validate' | 'runtime' | 'evaluate';
export type TerminalOutcome =
  | 'launch_ready_pass'
  | 'functional_pass'
  | 'quality_warning'
  | 'generator_compatibility_failure'
  | 'harness_validator_wrapper_failure';
export type CandidateStatus = 'generate_fail' | 'normalize_fail' | 'validate_fail' | 'runtime_fail' | 'evaluated';
export type RuntimeStatus = 'pass' | 'fail' | 'timeout' | 'crash' | 'not_run';
export type FinalBand = 'launch_ready' | 'functional' | 'warning' | 'fail';
export type NextAction = 'stop' | 'retry_same_generator' | 'switch_generator';

export interface FailureSignature {
  stage: FailureStage;
  class: string;
  ruleId?: string | null;
  domain: string;
  topEvidenceHash?: string | null;
}

export interface CandidateSummary {
  candidateId: string;
  attempt: number;
  generatorModel: string;
  status: CandidateStatus;
  deterministicValidation: 'pass' | 'fail';
  runtime: RuntimeStatus;
  runtimeHealthScore: number | null;
  evaluatorOverall: number | null;
  evaluatorConfidence: number | null;
  rankScore: number | null;
  finalBand: FinalBand;
  failureSignature: FailureSignature | null;
  artifactRoot: string;
  concreteRepairAdvice: RepairAdvice[];
}

export interface RepairAdvice {
  priority: 1 | 2 | 3;
  target: string;
  issue: string;
  change: string;
  expectedCheck: string;
}

export interface CandidateEvaluation {
  schemaVersion: 'df2-eval-v1';
  runId: string;
  candidateId: string;
  attempt: number;
  eligible: boolean;
  skipReason: null | 'deterministic_validation_fail' | 'runtime_fail' | 'missing_runtime_artifacts';
  evaluatorModel: string;
  fallbackEvaluatorModel: string | null;
  fallbackUsed: boolean;
  overallScore: number | null;
  confidence: number | null;
  qualityBand: 'launch_ready' | 'functional' | 'warning' | 'reject' | 'abstain';
  failureClass:
    | 'none'
    | 'visual_quality'
    | 'interaction_missing'
    | 'audio_silent'
    | 'timing_rhythm'
    | 'performance'
    | 'incomplete'
    | 'wrapper_contract_suspect'
    | 'validator_conflict'
    | 'insufficient_evidence'
    | 'domain_mismatch';
  agreementWithDeterministic: 'agree' | 'soft_conflict' | 'hard_conflict';
  dimensionScores: {
    domainFit: number;
    polish: number;
    completeness: number;
    responsiveness: number;
    creativity: number;
  };
  concreteRepairAdvice: RepairAdvice[];
  recommendation: 'accept' | 'retry_same_generator' | 'switch_generator' | 'stop';
  confidenceReason: string;
  evidenceRefs: string[];
}

export interface FinalCandidateSummary extends Omit<CandidateSummary, 'concreteRepairAdvice'> {}

export interface FinalAdjudication {
  schemaVersion: 'df2-final-v1';
  runId: string;
  taskId: string;
  domain: string;
  config: {
    primaryGenerator: string;
    fallbackGenerator: string | null;
    evaluator: string;
    evaluatorFallback: string | null;
    maxCandidates: 2;
    preflightCanaryEnabled: true;
    harnessDecisionMode: 'deterministic';
  };
  preflight: {
    taskSchemaPass: boolean;
    domainCanaryPass: boolean;
    canaryArtifactRef: string | null;
  };
  terminalOutcome: TerminalOutcome;
  selectedCandidateId: string | null;
  bestFunctionalCandidateId: string | null;
  bestQualityCandidateId: string | null;
  rootCause: 'generator' | 'provider' | 'harness' | 'validator' | 'wrapper' | 'task_spec' | 'unknown';
  stopReason: string;
  candidates: FinalCandidateSummary[];
  evidencePriority: ['deterministic', 'runtime', 'evaluator'];
  replay: {
    runManifestRef: string;
    envSnapshotRef: string;
    stateTraceRef: string;
  };
  capabilityCeiling: 'not_reached' | 'best_observed_for_config';
}

interface Df2ModelConfig {
  provider: Df2ProviderName;
  baseUrl?: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export interface Df2Preset {
  schemaVersion: 'df2-config-v1';
  maxCandidates: 2;
  preflightCanaryEnabled: true;
  harnessDecisionMode: 'deterministic';
  primaryGenerator: Df2ModelConfig;
  fallbackGenerator: Df2ModelConfig | null;
  evaluatorPrimary: Df2ModelConfig;
  evaluatorFallback: Df2ModelConfig | null;
  shadowHarness: Df2ModelConfig | null;
  evaluateOnlyAfterDeterministicAndRuntimePass: true;
  repairAdviceMaxItems: 3;
  rankScoreWeights: {
    evaluatorOverall: 0.8;
    runtimeHealth: 0.2;
  };
  launchReadyThreshold: 82;
  functionalThreshold: 60;
  fallbackEvaluatorConfidenceThreshold: 0.55;
  shadowHarnessEnabled: boolean;
}

interface CliOptions {
  dryRun: boolean;
  dryScenario: string;
  domains: Df2Domain[];
  preset: Df2PresetName;
  outputRoot: string;
  primaryProvider?: Df2ProviderName;
  primaryBaseUrl?: string;
  primaryModel?: string;
  fallbackProvider?: Df2ProviderName;
  fallbackBaseUrl?: string;
  fallbackModel?: string;
  evaluatorProvider?: Df2ProviderName;
  evaluatorBaseUrl?: string;
  evaluatorModel?: string;
  fallbackEvaluatorProvider?: Df2ProviderName;
  fallbackEvaluatorBaseUrl?: string;
  fallbackEvaluatorModel?: string;
  shadowHarnessProvider?: Df2ProviderName;
  shadowHarnessBaseUrl?: string;
  shadowHarnessModel?: string;
  shadowHarness: boolean;
  maxTokens?: number;
  evaluatorMaxTokens?: number;
  runtimeTimeoutMs: number;
}

interface DomainSpec {
  name: RuntimeDomain;
  prompt: string;
  createGenerator: (llm?: LLMClient) => {
    generateFull?: (prompt: string) => Promise<LLMResponse>;
    generate: (prompt: string) => Promise<string>;
    wrapForGallery?: (code: string) => string;
  };
}

interface NormalizedCandidate {
  code: string;
  codeHash: string;
  rawHash: string;
  semanticMutation: false;
}

interface RuntimeReport {
  status: RuntimeStatus;
  passed: boolean;
  runtimeHealthScore: number | null;
  error?: string;
  logs: string[];
  errors: string[];
  durationMs: number;
  previewRef?: string;
}

const DF2_CONTRACT_VERSION = 'df2-minimal-fsm-v1';
const SUPPORTED_DOMAINS: RuntimeDomain[] = ['p5', 'glsl', 'three', 'kinetic', 'html'];
const DEFAULT_LMSTUDIO_BASE_URL = 'http://100.66.225.85:1234/v1';

const DOMAIN_SPECS: Record<RuntimeDomain, DomainSpec> = {
  p5: {
    name: 'p5',
    prompt: 'Create a bioluminescent tide-pool particle ecosystem: blue organisms drift in currents, cluster around invisible nutrients, and leave soft fading trails.',
    createGenerator: (llm) => new P5GeneratorV2(llm),
  },
  glsl: {
    name: 'glsl',
    prompt: 'Create a living aurora plasma shader: ribbon-like magnetic waves, deep teal-to-magenta color shifts, and slow breathing motion.',
    createGenerator: (llm) => new ShaderGenerator(llm),
  },
  three: {
    name: 'three',
    prompt: 'Create a floating obsidian cube shrine in deep space: rotating cube, rim lights, starfield depth, and a subtle glowing aura.',
    createGenerator: (llm) => new ThreeGenerator(llm),
  },
  kinetic: {
    name: 'kinetic',
    prompt: 'Create kinetic CSS art: orbital typography fragments and geometric glyphs drifting like a neon mechanical clock with perpetual motion.',
    createGenerator: (llm) => new KineticGenerator(llm),
  },
  html: {
    name: 'html',
    prompt: 'Create an infrastructure HTML wrapper smoke page with semantic HTML, responsive CSS, and a strong visual hierarchy.',
    createGenerator: (llm) => new HTMLWebGenerator(llm),
  },
};

export const CANARY_CODE: Record<RuntimeDomain, string> = {
  p5: `function setup(){createCanvas(320,240);noStroke();} function draw(){background(8,16,30);fill(80,180,255);circle(width/2,height/2,64);}`,
  glsl: `precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / u_resolution.xy;
  float shimmer = hash(floor(uv * 8.0 + u_time));
  vec3 color = mix(vec3(0.02,0.08,0.18), vec3(0.2,0.8,1.0), shimmer);
  color += vec3(uv.x, uv.y, 0.5 + 0.25 * sin(u_time)) * 0.2;
  fragColor = vec4(color, 1.0);
}`,
  three: `const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,0.1,1000);const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);document.body.appendChild(renderer.domElement);const cube=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial({color:0x58a6ff}));scene.add(cube);const stars=new THREE.Points(new THREE.BufferGeometry(),new THREE.PointsMaterial({color:0xffffff,size:0.02}));scene.add(stars);camera.position.z=4;function animate(){requestAnimationFrame(animate);cube.rotation.y+=0.02;renderer.render(scene,camera);}animate();`,
  kinetic: `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DF2 Kinetic Canary</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#07111f}.orb{width:120px;height:120px;border-radius:50%;background:#58a6ff;animation:pulse 2s infinite alternate}@keyframes pulse{from{transform:scale(.7)}to{transform:scale(1.2)}}</style></head><body><div class="orb"></div></body></html>`,
  html: `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Canary</title><style>body{font-family:sans-serif;margin:0;background:#101827;color:white}main{min-height:100vh;display:grid;place-items:center}</style></head><body><main><h1>DF2 Canary</h1></main></body></html>`,
};

const DRY_CANDIDATES: Record<string, Partial<Record<RuntimeDomain, string[]>>> = {
  'launch-ready': {
    p5: [CANARY_CODE.p5],
    glsl: [CANARY_CODE.glsl],
    three: [CANARY_CODE.three],
    kinetic: [CANARY_CODE.kinetic],
    html: [CANARY_CODE.html],
  },
  'validate-then-repair': {
    p5: ['function draw(){particles[i].show();}', CANARY_CODE.p5],
  },
  'timeout-then-fallback': {
    p5: ['', CANARY_CODE.p5],
  },
  'quality-warning': {
    p5: [CANARY_CODE.p5, CANARY_CODE.p5],
  },
  'canary-failure': {
    p5: [CANARY_CODE.p5],
  },
  'improved-not-great': {
    p5: [CANARY_CODE.p5, CANARY_CODE.p5],
  },
};

export function isRuntimeSupportedDomain(domain: string): domain is RuntimeDomain {
  return SUPPORTED_DOMAINS.includes(domain as RuntimeDomain);
}

export function sha256(value: string | Buffer): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function rankScore(evaluatorOverall: number, runtimeHealthScore: number): number {
  return Math.round((0.8 * evaluatorOverall + 0.2 * runtimeHealthScore) * 100) / 100;
}

export function resolveDf2Preset(name: Df2PresetName): Df2Preset {
  if (name === 'glm-ab') {
    return {
      schemaVersion: 'df2-config-v1',
      maxCandidates: 2,
      preflightCanaryEnabled: true,
      harnessDecisionMode: 'deterministic',
      primaryGenerator: { provider: 'glm', baseUrl: 'https://api.z.ai/api/anthropic', model: 'glm-4.5-air', maxTokens: 8192 },
      fallbackGenerator: { provider: 'lmstudio', baseUrl: DEFAULT_LMSTUDIO_BASE_URL, model: 'qwen3-coder-next-reap-40b-a3b-i1', maxTokens: 8192 },
      evaluatorPrimary: { provider: 'lmstudio', baseUrl: DEFAULT_LMSTUDIO_BASE_URL, model: 'qwen3.5-2b', maxTokens: 512, temperature: 0 },
      evaluatorFallback: { provider: 'lmstudio', baseUrl: DEFAULT_LMSTUDIO_BASE_URL, model: 'qwen3-coder-next-reap-40b-a3b-i1', maxTokens: 512, temperature: 0 },
      shadowHarness: { provider: 'kimi', baseUrl: 'https://api.kimi.com/coding', model: 'kimi-for-coding', maxTokens: 4096 },
      evaluateOnlyAfterDeterministicAndRuntimePass: true,
      repairAdviceMaxItems: 3,
      rankScoreWeights: { evaluatorOverall: 0.8, runtimeHealth: 0.2 },
      launchReadyThreshold: 82,
      functionalThreshold: 60,
      fallbackEvaluatorConfidenceThreshold: 0.55,
      shadowHarnessEnabled: true,
    };
  }

  return {
    schemaVersion: 'df2-config-v1',
    maxCandidates: 2,
    preflightCanaryEnabled: true,
    harnessDecisionMode: 'deterministic',
    primaryGenerator: { provider: 'lmstudio', baseUrl: DEFAULT_LMSTUDIO_BASE_URL, model: 'qwen3.5-2b', maxTokens: 8192 },
    fallbackGenerator: { provider: 'lmstudio', baseUrl: DEFAULT_LMSTUDIO_BASE_URL, model: 'qwen3-coder-next-reap-40b-a3b-i1', maxTokens: 8192 },
    evaluatorPrimary: { provider: 'lmstudio', baseUrl: DEFAULT_LMSTUDIO_BASE_URL, model: 'qwen3.5-2b', maxTokens: 512, temperature: 0 },
    evaluatorFallback: { provider: 'lmstudio', baseUrl: DEFAULT_LMSTUDIO_BASE_URL, model: 'qwen3-coder-next-reap-40b-a3b-i1', maxTokens: 512, temperature: 0 },
    shadowHarness: { provider: 'kimi', baseUrl: 'https://api.kimi.com/coding', model: 'kimi-for-coding', maxTokens: 4096 },
    evaluateOnlyAfterDeterministicAndRuntimePass: true,
    repairAdviceMaxItems: 3,
    rankScoreWeights: { evaluatorOverall: 0.8, runtimeHealth: 0.2 },
    launchReadyThreshold: 82,
    functionalThreshold: 60,
    fallbackEvaluatorConfidenceThreshold: 0.55,
    shadowHarnessEnabled: true,
  };
}

export function assertLegalTransition(
  from: RunState,
  to: RunState,
  context: { validationPassed?: boolean; runtimePassed?: boolean; candidate1Summarized?: boolean; deterministicFailure?: boolean; runtimeFailure?: boolean } = {},
): void {
  if (to === 'EVALUATE' && (context.validationPassed !== true || context.runtimePassed !== true)) {
    throw new Error('Illegal DF2 transition: EVALUATE requires deterministic validation and runtime pass');
  }
  if (to === 'ATTEMPT_2' && context.candidate1Summarized !== true) {
    throw new Error('Illegal DF2 transition: ATTEMPT(2) requires candidate 1 CANDIDATE_SUMMARY');
  }
  if (to.startsWith('TERMINAL_') && to.endsWith('_PASS') && (context.deterministicFailure || context.runtimeFailure)) {
    throw new Error('Illegal DF2 transition: pass terminal after deterministic/runtime failure');
  }

  const allowed: Partial<Record<RunState, RunState[]>> = {
    RUN_INIT: ['PREFLIGHT_TASK'],
    PREFLIGHT_TASK: ['PREFLIGHT_CANARY', 'TERMINAL_HARNESS_VALIDATOR_WRAPPER_FAILURE'],
    PREFLIGHT_CANARY: ['ATTEMPT_1', 'TERMINAL_HARNESS_VALIDATOR_WRAPPER_FAILURE'],
    ATTEMPT_1: ['GENERATE'],
    ATTEMPT_2: ['GENERATE'],
    GENERATE: ['NORMALIZE', 'CANDIDATE_SUMMARY'],
    NORMALIZE: ['DETERMINISTIC_VALIDATE', 'CANDIDATE_SUMMARY'],
    DETERMINISTIC_VALIDATE: ['RUNTIME_EXECUTE', 'CANDIDATE_SUMMARY'],
    RUNTIME_EXECUTE: ['EVALUATE', 'CANDIDATE_SUMMARY'],
    EVALUATE: ['CANDIDATE_SUMMARY'],
    CANDIDATE_SUMMARY: ['DECIDE_NEXT', 'FINAL_ADJUDICATE'],
    DECIDE_NEXT: ['ATTEMPT_2', 'FINAL_ADJUDICATE'],
    FINAL_ADJUDICATE: [
      'TERMINAL_LAUNCH_READY_PASS',
      'TERMINAL_FUNCTIONAL_PASS',
      'TERMINAL_QUALITY_WARNING',
      'TERMINAL_GENERATOR_COMPATIBILITY_FAILURE',
      'TERMINAL_HARNESS_VALIDATOR_WRAPPER_FAILURE',
    ],
  };

  if (!allowed[from]?.includes(to)) {
    throw new Error(`Illegal DF2 transition: ${from} -> ${to}`);
  }
}

export function evaluatorSkipReasonFor(input: {
  validationPassed: boolean;
  runtimePassed: boolean;
  runtimeArtifactPresent: boolean;
}): CandidateEvaluation['skipReason'] {
  if (!input.validationPassed) return 'deterministic_validation_fail';
  if (!input.runtimePassed) return 'runtime_fail';
  if (!input.runtimeArtifactPresent) return 'missing_runtime_artifacts';
  return null;
}

export function buildFailureSignature(input: {
  stage: FailureStage;
  className: string;
  ruleId?: string | null;
  domain: string;
  evidence?: string | null;
}): FailureSignature {
  return {
    stage: input.stage,
    class: input.className,
    ruleId: input.ruleId ?? null,
    domain: input.domain,
    topEvidenceHash: input.evidence ? sha256(input.evidence) : null,
  };
}

function sameFailureSignature(a: FailureSignature | null, b: FailureSignature | null): boolean {
  if (!a || !b) return false;
  return a.stage === b.stage && a.class === b.class && (a.ruleId ?? null) === (b.ruleId ?? null) && a.domain === b.domain;
}

export function decideNextAction(
  candidate: CandidateSummary,
  previousSignatures: FailureSignature[],
  fallbackAvailable: boolean,
): { action: NextAction; reason: string } {
  if (candidate.finalBand === 'launch_ready') return { action: 'stop', reason: 'Candidate is launch-ready.' };
  if (candidate.attempt >= 2) return { action: 'stop', reason: 'Minimal DF2 always stops after candidate 2.' };

  const signature = candidate.failureSignature;
  if (!signature) {
    if (candidate.finalBand === 'functional' && candidate.concreteRepairAdvice.length > 0) {
      return { action: 'retry_same_generator', reason: 'Functional candidate has concrete repair advice.' };
    }
    if (candidate.finalBand === 'warning' && candidate.concreteRepairAdvice.length > 0) {
      return { action: 'retry_same_generator', reason: 'Warning candidate has concrete repair advice.' };
    }
    return { action: 'stop', reason: 'No concrete repair signal.' };
  }

  const repeated = previousSignatures.some((previous) => sameFailureSignature(signature, previous));
  if (repeated && fallbackAvailable) return { action: 'switch_generator', reason: 'Failure signature repeated.' };

  if (signature.stage === 'generate') {
    if (/empty|timeout|truncated/i.test(signature.class) && fallbackAvailable) {
      return { action: 'switch_generator', reason: 'Generation empty/timeout/truncated.' };
    }
    return fallbackAvailable ? { action: 'switch_generator', reason: 'Generation failure.' } : { action: 'stop', reason: 'Generation failure and no fallback.' };
  }

  if (signature.stage === 'runtime' && /timeout|runaway|oversize|huge|artifact_size/i.test(signature.class) && fallbackAvailable) {
    return { action: 'switch_generator', reason: 'Runtime timeout/runaway/oversize.' };
  }

  if (signature.stage === 'normalize' || signature.stage === 'validate' || signature.stage === 'runtime') {
    return { action: 'retry_same_generator', reason: 'First concrete repairable failure.' };
  }

  return { action: 'stop', reason: 'No route for failure class.' };
}

export function candidateToFinalSummary(candidate: CandidateSummary): FinalCandidateSummary {
  const deterministicFailure = candidate.deterministicValidation === 'fail' || candidate.runtime !== 'pass';
  return {
    candidateId: candidate.candidateId,
    attempt: candidate.attempt,
    generatorModel: candidate.generatorModel,
    status: candidate.status,
    deterministicValidation: candidate.deterministicValidation,
    runtime: candidate.runtime,
    runtimeHealthScore: candidate.runtimeHealthScore,
    evaluatorOverall: candidate.evaluatorOverall,
    evaluatorConfidence: candidate.evaluatorConfidence,
    rankScore: deterministicFailure ? null : candidate.rankScore,
    finalBand: deterministicFailure ? 'fail' : candidate.finalBand,
    failureSignature: candidate.failureSignature,
    artifactRoot: candidate.artifactRoot,
  };
}

function bestBy(candidates: CandidateSummary[], predicate: (candidate: CandidateSummary) => boolean): CandidateSummary | null {
  const matching = candidates.filter(predicate);
  matching.sort((a, b) => (b.rankScore ?? -1) - (a.rankScore ?? -1));
  return matching[0] ?? null;
}

export function adjudicateFinal(
  candidates: CandidateSummary[],
  input: {
    runId?: string;
    taskId?: string;
    domain?: string;
    canaryPassed: boolean;
    canaryArtifactRef?: string | null;
    config?: FinalAdjudication['config'];
  },
): FinalAdjudication {
  const runId = input.runId ?? 'test-run';
  const taskId = input.taskId ?? 'test-task';
  const domain = input.domain ?? candidates[0]?.failureSignature?.domain ?? 'p5';
  const finalCandidates = candidates.map(candidateToFinalSummary);
  const bestLaunch = bestBy(candidates, (candidate) => candidate.finalBand === 'launch_ready');
  const bestFunctional = bestBy(candidates, (candidate) => candidate.finalBand === 'launch_ready' || candidate.finalBand === 'functional');
  const bestQuality = bestBy(candidates, (candidate) => candidate.finalBand !== 'fail');
  const improvedSecond = candidates.length > 1 && (candidates[1].rankScore ?? -1) > (candidates[0].rankScore ?? -1);

  let terminalOutcome: TerminalOutcome;
  let selectedCandidateId: string | null = null;
  let rootCause: FinalAdjudication['rootCause'] = 'generator';
  let stopReason = '';

  if (!input.canaryPassed) {
    terminalOutcome = 'harness_validator_wrapper_failure';
    rootCause = 'wrapper';
    stopReason = 'Preflight canary failed.';
  } else if (bestLaunch) {
    terminalOutcome = 'launch_ready_pass';
    selectedCandidateId = bestLaunch.candidateId;
    rootCause = 'unknown';
    stopReason = 'At least one candidate reached launch-ready threshold.';
  } else if (bestFunctional) {
    terminalOutcome = 'functional_pass';
    selectedCandidateId = bestFunctional.candidateId;
    rootCause = 'unknown';
    stopReason = 'At least one candidate reached functional threshold.';
  } else if (bestQuality) {
    terminalOutcome = 'quality_warning';
    selectedCandidateId = bestQuality.candidateId;
    rootCause = 'generator';
    stopReason = improvedSecond ? 'Candidate 2 improved but did not reach launch-ready.' : 'Best candidate is warning quality.';
  } else {
    const crossGeneratorShared = candidates.length > 1 && sameFailureSignature(candidates[0].failureSignature, candidates[1].failureSignature);
    terminalOutcome = crossGeneratorShared ? 'harness_validator_wrapper_failure' : 'generator_compatibility_failure';
    rootCause = crossGeneratorShared ? 'validator' : 'generator';
    stopReason = crossGeneratorShared
      ? 'Same failure signature appeared across generators.'
      : 'No candidate reached functional pass after two attempts.';
  }

  return {
    schemaVersion: 'df2-final-v1',
    runId,
    taskId,
    domain,
    config: input.config ?? {
      primaryGenerator: 'qwen3.5-2b',
      fallbackGenerator: 'qwen3-coder-next-reap-40b-a3b-i1',
      evaluator: 'qwen3.5-2b',
      evaluatorFallback: 'qwen3-coder-next-reap-40b-a3b-i1',
      maxCandidates: 2,
      preflightCanaryEnabled: true,
      harnessDecisionMode: 'deterministic',
    },
    preflight: {
      taskSchemaPass: true,
      domainCanaryPass: input.canaryPassed,
      canaryArtifactRef: input.canaryArtifactRef ?? null,
    },
    terminalOutcome,
    selectedCandidateId,
    bestFunctionalCandidateId: bestFunctional?.candidateId ?? null,
    bestQualityCandidateId: bestQuality?.candidateId ?? null,
    rootCause,
    stopReason,
    candidates: finalCandidates,
    evidencePriority: ['deterministic', 'runtime', 'evaluator'],
    replay: {
      runManifestRef: 'run.manifest.json',
      envSnapshotRef: 'env.snapshot.json',
      stateTraceRef: 'state-trace.jsonl',
    },
    capabilityCeiling: improvedSecond && terminalOutcome !== 'launch_ready_pass' ? 'best_observed_for_config' : 'not_reached',
  };
}

function parseArgs(argv: string[]): CliOptions {
  const args = new Map<string, string | boolean>();
  for (const arg of argv) {
    if (arg === '--dry-run') {
      args.set('dry-run', true);
      continue;
    }
    if (arg === '--shadow-harness') {
      args.set('shadow-harness', true);
      continue;
    }
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) args.set(match[1], match[2]);
  }

  const domains = String(args.get('domains') || 'p5')
    .split(',')
    .map((domain) => domain.trim())
    .filter(Boolean);
  return {
    dryRun: args.get('dry-run') === true,
    dryScenario: String(args.get('dry-scenario') || 'launch-ready'),
    domains: domains as Df2Domain[],
    preset: (String(args.get('preset') || 'qwen-local') === 'glm-ab' ? 'glm-ab' : 'qwen-local'),
    outputRoot: String(args.get('output') || '.omx/logs/df2-runs'),
    primaryProvider: args.get('primary-provider') as Df2ProviderName | undefined,
    primaryBaseUrl: typeof args.get('primary-base-url') === 'string' ? String(args.get('primary-base-url')) : undefined,
    primaryModel: typeof args.get('primary-model') === 'string' ? String(args.get('primary-model')) : undefined,
    fallbackProvider: args.get('fallback-provider') as Df2ProviderName | undefined,
    fallbackBaseUrl: typeof args.get('fallback-base-url') === 'string' ? String(args.get('fallback-base-url')) : undefined,
    fallbackModel: typeof args.get('fallback-model') === 'string' ? String(args.get('fallback-model')) : undefined,
    evaluatorProvider: args.get('evaluator-provider') as Df2ProviderName | undefined,
    evaluatorBaseUrl: typeof args.get('evaluator-base-url') === 'string' ? String(args.get('evaluator-base-url')) : undefined,
    evaluatorModel: typeof args.get('evaluator-model') === 'string' ? String(args.get('evaluator-model')) : undefined,
    fallbackEvaluatorProvider: args.get('fallback-evaluator-provider') as Df2ProviderName | undefined,
    fallbackEvaluatorBaseUrl: typeof args.get('fallback-evaluator-base-url') === 'string' ? String(args.get('fallback-evaluator-base-url')) : undefined,
    fallbackEvaluatorModel: typeof args.get('fallback-evaluator-model') === 'string' ? String(args.get('fallback-evaluator-model')) : undefined,
    shadowHarnessProvider: args.get('shadow-harness-provider') as Df2ProviderName | undefined,
    shadowHarnessBaseUrl: typeof args.get('shadow-harness-base-url') === 'string' ? String(args.get('shadow-harness-base-url')) : undefined,
    shadowHarnessModel: typeof args.get('shadow-harness-model') === 'string' ? String(args.get('shadow-harness-model')) : undefined,
    shadowHarness: args.get('shadow-harness') === true,
    maxTokens: typeof args.get('max-tokens') === 'string' ? Number(args.get('max-tokens')) : undefined,
    evaluatorMaxTokens: typeof args.get('evaluator-max-tokens') === 'string' ? Number(args.get('evaluator-max-tokens')) : undefined,
    runtimeTimeoutMs: typeof args.get('runtime-timeout-ms') === 'string' ? Number(args.get('runtime-timeout-ms')) : 15000,
  };
}

export function applyModelOverride(
  base: Df2ModelConfig,
  override: { provider?: Df2ProviderName; baseUrl?: string; model?: string; maxTokens?: number },
): Df2ModelConfig {
  const providerChanged = Boolean(override.provider && override.provider !== base.provider);
  return {
    ...base,
    provider: override.provider || base.provider,
    baseUrl: override.baseUrl ?? (providerChanged ? undefined : base.baseUrl),
    model: override.model || base.model,
    maxTokens: override.maxTokens || base.maxTokens,
  };
}

function applyOverrides(preset: Df2Preset, options: CliOptions): Df2Preset {
  const primaryGenerator = applyModelOverride(preset.primaryGenerator, {
    provider: options.primaryProvider,
    baseUrl: options.primaryBaseUrl,
    model: options.primaryModel,
    maxTokens: options.maxTokens,
  });
  const fallbackGenerator = preset.fallbackGenerator
    ? applyModelOverride(preset.fallbackGenerator, {
        provider: options.fallbackProvider,
        baseUrl: options.fallbackBaseUrl,
        model: options.fallbackModel,
        maxTokens: options.maxTokens,
      })
    : null;
  const evaluatorPrimary = applyModelOverride(preset.evaluatorPrimary, {
    provider: options.evaluatorProvider,
    baseUrl: options.evaluatorBaseUrl,
    model: options.evaluatorModel,
    maxTokens: options.evaluatorMaxTokens,
  });
  const evaluatorFallback = preset.evaluatorFallback
    ? applyModelOverride(preset.evaluatorFallback, {
        provider: options.fallbackEvaluatorProvider,
        baseUrl: options.fallbackEvaluatorBaseUrl,
        model: options.fallbackEvaluatorModel,
        maxTokens: options.evaluatorMaxTokens,
      })
    : null;
  const shadowHarness = preset.shadowHarness
    ? applyModelOverride(preset.shadowHarness, {
        provider: options.shadowHarnessProvider,
        baseUrl: options.shadowHarnessBaseUrl,
        model: options.shadowHarnessModel,
      })
    : null;

  return {
    ...preset,
    primaryGenerator,
    fallbackGenerator,
    evaluatorPrimary,
    evaluatorFallback,
    shadowHarnessEnabled: options.shadowHarness,
    shadowHarness: options.shadowHarness ? shadowHarness : null,
  };
}

async function loadProviderConfig(modelConfig: Df2ModelConfig): Promise<Partial<LLMConfig>> {
  const configPath = path.join(os.homedir(), '.liminal', 'config.json');
  const fileConfig = fsSync.existsSync(configPath)
    ? JSON.parse(await fs.readFile(configPath, 'utf8'))
    : {};
  const providers = fileConfig.providers || {};
  const providerConfig = providers[modelConfig.provider] || {};
  const baseUrl = modelConfig.baseUrl || providerConfig.baseUrl || defaultBaseUrlFor(modelConfig.provider);
  const model = modelConfig.model || providerConfig.model;
  const apiKey = providerConfig.apiKey || apiKeyFor(modelConfig.provider);

  if (!baseUrl || !model) {
    throw new Error(`DF2 provider ${modelConfig.provider} missing baseUrl/model.`);
  }

  return {
    baseUrl,
    model,
    apiKey,
    temperature: modelConfig.temperature,
    maxTokens: modelConfig.maxTokens,
  };
}

function defaultBaseUrlFor(provider: Df2ProviderName): string {
  switch (provider) {
    case 'glm': return 'https://api.z.ai/api/anthropic';
    case 'kimi': return 'https://api.kimi.com/coding';
    case 'minimax': return 'https://api.minimax.io/anthropic';
    case 'openai': return 'https://api.openai.com/v1';
    case 'lmstudio': return DEFAULT_LMSTUDIO_BASE_URL;
    case 'ollama': return 'http://localhost:11434';
    case 'active': return process.env.LIMINAL_LLM_BASE_URL || DEFAULT_LMSTUDIO_BASE_URL;
  }
}

function apiKeyFor(provider: Df2ProviderName): string | undefined {
  switch (provider) {
    case 'glm': return process.env.GLM_API_KEY;
    case 'kimi': return process.env.KIMI_API_KEY;
    case 'minimax': return process.env.MINIMAX_API_KEY;
    case 'openai': return process.env.OPENAI_API_KEY;
    default: return undefined;
  }
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(value, jsonReplacer, 2), 'utf8');
}

function jsonReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return value;
}

async function appendTrace(runDir: string, event: Record<string, unknown>): Promise<void> {
  await fs.appendFile(path.join(runDir, 'state-trace.jsonl'), `${JSON.stringify({ timestamp: new Date().toISOString(), ...event })}\n`, 'utf8');
}

function renderDomainFor(domain: RuntimeDomain): RenderDomain {
  if (domain === 'kinetic' || domain === 'html') return 'unknown';
  return domain;
}

function buildPreview(domain: RuntimeDomain, generator: ReturnType<DomainSpec['createGenerator']>, code: string): string {
  if (typeof generator.wrapForGallery === 'function') return generator.wrapForGallery(code);
  return code;
}

function normalizeCandidate(raw: string): NormalizedCandidate {
  const code = raw.match(/```(?:\w+)?\s*([\s\S]*?)```/)?.[1]?.trim() ?? raw.trim();
  return {
    code,
    codeHash: sha256(code),
    rawHash: sha256(raw),
    semanticMutation: false,
  };
}

function classifyGenerationError(error: unknown, domain: RuntimeDomain): FailureSignature {
  const message = error instanceof Error ? error.message : String(error);
  const className = /timeout|aborted/i.test(message)
    ? 'timeout'
    : /empty/i.test(message)
      ? 'empty'
      : 'provider_error';
  return buildFailureSignature({ stage: 'generate', className, ruleId: className, domain, evidence: message });
}

function classifyValidationError(errors: string[], domain: RuntimeDomain): FailureSignature {
  const evidence = errors.join('; ');
  const first = errors[0] || 'validation failed';
  const ruleId = first.includes('syntax')
    ? 'syntax'
    : first.includes('Undefined function')
      ? 'undefined_function'
      : first.split(':')[0].slice(0, 48);
  return buildFailureSignature({ stage: 'validate', className: 'validation_failure', ruleId, domain, evidence });
}

function classifyRuntimeError(report: RuntimeReport, domain: RuntimeDomain): FailureSignature {
  const evidence = report.error || report.errors.join('; ') || report.status;
  const className = report.status === 'timeout'
    ? 'timeout'
    : /timeout/i.test(evidence)
      ? 'timeout'
      : 'fatal_error';
  return buildFailureSignature({ stage: 'runtime', className, ruleId: className, domain, evidence });
}

async function runRuntime(domain: RuntimeDomain, preview: string, candidateDir: string, dryRun: boolean, timeout: number): Promise<RuntimeReport> {
  const startedAt = Date.now();
  if (dryRun) {
    const report: RuntimeReport = {
      status: 'pass',
      passed: true,
      runtimeHealthScore: 95,
      logs: [],
      errors: [],
      durationMs: 0,
      previewRef: 'runtime.preview.png',
    };
    await writeJson(path.join(candidateDir, 'runtime.report.json'), report);
    await fs.writeFile(path.join(candidateDir, 'runtime.console.log'), '', 'utf8');
    await writeJson(path.join(candidateDir, 'runtime.metrics.json'), { runtimeHealthScore: 95, durationMs: 0 });
    return report;
  }

  const renderer = new HeadlessRenderer();
  try {
    const result = await renderer.render(preview, {
      domain: renderDomainFor(domain),
      timeout,
      stabilizationTime: 1000,
    });
    if (result.screenshot?.buffer?.length) {
      await fs.writeFile(path.join(candidateDir, 'runtime.preview.png'), result.screenshot.buffer);
    }
    const errors = [...(result.errors || []), result.error, result.screenshot?.error].filter((value): value is string => Boolean(value));
    const status: RuntimeStatus = result.success && errors.length === 0 ? 'pass' : /timeout/i.test(errors.join(' ')) ? 'timeout' : 'fail';
    const health = status === 'pass' ? Math.max(70, 100 - errors.length * 15) : null;
    const report: RuntimeReport = {
      status,
      passed: status === 'pass',
      runtimeHealthScore: health,
      error: errors.join('; ') || undefined,
      logs: result.logs,
      errors,
      durationMs: Date.now() - startedAt,
      previewRef: result.screenshot?.buffer?.length ? 'runtime.preview.png' : undefined,
    };
    await writeJson(path.join(candidateDir, 'runtime.report.json'), report);
    await fs.writeFile(path.join(candidateDir, 'runtime.console.log'), [...result.logs, ...errors.map((error) => `[error] ${error}`)].join('\n'), 'utf8');
    await writeJson(path.join(candidateDir, 'runtime.metrics.json'), { runtimeHealthScore: health, durationMs: report.durationMs, status });
    return report;
  } finally {
    await renderer.close();
  }
}

function dryEvaluation(runId: string, candidateId: string, attempt: number, scenario: string, runtimeHealth: number): CandidateEvaluation {
  const score = scenario === 'quality-warning' ? 55 : scenario === 'improved-not-great' ? (attempt === 1 ? 45 : 58) : 88;
  const confidence = scenario === 'quality-warning' ? 0.8 : 0.82;
  return {
    schemaVersion: 'df2-eval-v1',
    runId,
    candidateId,
    attempt,
    eligible: true,
    skipReason: null,
    evaluatorModel: 'dry-run-evaluator',
    fallbackEvaluatorModel: null,
    fallbackUsed: false,
    overallScore: score,
    confidence,
    qualityBand: score >= 82 && runtimeHealth >= 85 ? 'launch_ready' : score >= 60 ? 'functional' : 'warning',
    failureClass: score >= 82 ? 'none' : 'visual_quality',
    agreementWithDeterministic: 'agree',
    dimensionScores: { domainFit: score, polish: score, completeness: score, responsiveness: runtimeHealth, creativity: score },
    concreteRepairAdvice: score >= 82 ? [] : [{ priority: 1, target: 'artifact', issue: 'Needs more polish.', change: 'Increase specificity and visual richness.', expectedCheck: 'Evaluator score improves.' }],
    recommendation: score >= 82 ? 'accept' : 'retry_same_generator',
    confidenceReason: 'Dry-run deterministic evaluator fixture.',
    evidenceRefs: ['validate.report.json', 'runtime.report.json'],
  };
}

async function runEvaluator(
  runId: string,
  candidateId: string,
  attempt: number,
  domain: RuntimeDomain,
  prompt: string,
  code: string,
  candidateDir: string,
  validationPassed: boolean,
  runtimeReport: RuntimeReport,
  evaluatorConfig: Partial<LLMConfig>,
  fallbackConfig: Partial<LLMConfig> | null,
  preset: Df2Preset,
  dryRun: boolean,
  dryScenario: string,
): Promise<CandidateEvaluation> {
  const skipReason = evaluatorSkipReasonFor({
    validationPassed,
    runtimePassed: runtimeReport.passed,
    runtimeArtifactPresent: fsSync.existsSync(path.join(candidateDir, 'runtime.report.json')),
  });

  const evaluatorInput = {
    schemaVersion: 'df2-evaluator-input-v1',
    runId,
    candidateId,
    attempt,
    domain,
    prompt,
    validationPassed,
    runtime: runtimeReport,
    code,
    evidenceRefs: ['validate.report.json', 'runtime.report.json', 'runtime.console.log'],
  };
  await writeJson(path.join(candidateDir, 'evaluator.input.json'), evaluatorInput);

  if (skipReason) {
    const skipped: CandidateEvaluation = {
      schemaVersion: 'df2-eval-v1',
      runId,
      candidateId,
      attempt,
      eligible: false,
      skipReason,
      evaluatorModel: evaluatorConfig.model || 'unknown',
      fallbackEvaluatorModel: fallbackConfig?.model || null,
      fallbackUsed: false,
      overallScore: null,
      confidence: null,
      qualityBand: 'abstain',
      failureClass: skipReason === 'deterministic_validation_fail' ? 'validator_conflict' : 'insufficient_evidence',
      agreementWithDeterministic: 'agree',
      dimensionScores: { domainFit: 0, polish: 0, completeness: 0, responsiveness: 0, creativity: 0 },
      concreteRepairAdvice: [],
      recommendation: 'stop',
      confidenceReason: `Evaluator skipped: ${skipReason}`,
      evidenceRefs: ['validate.report.json', 'runtime.report.json'],
    };
    await writeJson(path.join(candidateDir, 'evaluator.final.json'), skipped);
    return skipped;
  }

  if (dryRun) {
    const evaluation = dryEvaluation(runId, candidateId, attempt, dryScenario, runtimeReport.runtimeHealthScore ?? 95);
    await writeJson(path.join(candidateDir, 'evaluator.primary.parsed.json'), evaluation);
    await fs.writeFile(path.join(candidateDir, 'evaluator.primary.raw.txt'), JSON.stringify(evaluation), 'utf8');
    await writeJson(path.join(candidateDir, 'evaluator.final.json'), evaluation);
    return evaluation;
  }

  const promptText = `Evaluate this DF2 candidate. Return compact JSON only matching schema df2-eval-v1.
Domain: ${domain}
Task prompt: ${prompt}
Validation passed: ${validationPassed}
Runtime status: ${runtimeReport.status}
Runtime health: ${runtimeReport.runtimeHealthScore}
Runtime errors: ${(runtimeReport.errors || []).join('; ')}

Generated code:
${code.slice(0, 12000)}`;

  const runOne = async (config: Partial<LLMConfig>, label: 'primary' | 'fallback') => {
    const llm = new LLMClient({ ...config, role: 'evaluator' });
    const response = await llm.generate(EVALUATOR_SYSTEM_PROMPT, promptText);
    await fs.writeFile(path.join(candidateDir, `evaluator.${label}.raw.txt`), response.code || response.error || '', 'utf8');
    const parsed = parseEvaluationJson(response.code, runId, candidateId, attempt, config.model || 'unknown', fallbackConfig?.model || null, label === 'fallback');
    await writeJson(path.join(candidateDir, `evaluator.${label}.parsed.json`), parsed);
    return parsed;
  };

  let evaluation: CandidateEvaluation;
  try {
    evaluation = await runOne(evaluatorConfig, 'primary');
    if (fallbackConfig && (evaluation.confidence !== null && evaluation.confidence < preset.fallbackEvaluatorConfidenceThreshold || evaluation.agreementWithDeterministic !== 'agree')) {
      evaluation = await runOne(fallbackConfig, 'fallback');
    }
  } catch (error) {
    if (!fallbackConfig) throw error;
    evaluation = await runOne(fallbackConfig, 'fallback');
  }

  await writeJson(path.join(candidateDir, 'evaluator.final.json'), evaluation);
  return evaluation;
}

const EVALUATOR_SYSTEM_PROMPT = `You are a strict DF2 creative-code evaluator.
Return JSON only. No markdown.
Schema keys: schemaVersion, eligible, skipReason, overallScore, confidence, qualityBand, failureClass, agreementWithDeterministic, dimensionScores, concreteRepairAdvice, recommendation, confidenceReason, evidenceRefs.
Only score quality; deterministic validation and runtime pass/fail are authoritative.`;

function parseEvaluationJson(
  raw: string,
  runId: string,
  candidateId: string,
  attempt: number,
  evaluatorModel: string,
  fallbackEvaluatorModel: string | null,
  fallbackUsed: boolean,
): CandidateEvaluation {
  const json = raw.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new Error('Evaluator returned no JSON');
  const parsed = JSON.parse(json) as Partial<CandidateEvaluation>;
  const overallScore = normalizeScore100(parsed.overallScore);
  const confidence = clampNumber(parsed.confidence, 0, 1);
  return {
    schemaVersion: 'df2-eval-v1',
    runId,
    candidateId,
    attempt,
    eligible: true,
    skipReason: null,
    evaluatorModel,
    fallbackEvaluatorModel,
    fallbackUsed,
    overallScore,
    confidence,
    qualityBand: normalizeQualityBand(parsed.qualityBand, overallScore),
    failureClass: normalizeFailureClass(parsed.failureClass),
    agreementWithDeterministic: normalizeAgreement(parsed.agreementWithDeterministic),
    dimensionScores: {
      domainFit: normalizeScore100(parsed.dimensionScores?.domainFit) ?? overallScore ?? 0,
      polish: normalizeScore100(parsed.dimensionScores?.polish) ?? overallScore ?? 0,
      completeness: normalizeScore100(parsed.dimensionScores?.completeness) ?? overallScore ?? 0,
      responsiveness: normalizeScore100(parsed.dimensionScores?.responsiveness) ?? overallScore ?? 0,
      creativity: normalizeScore100(parsed.dimensionScores?.creativity) ?? overallScore ?? 0,
    },
    concreteRepairAdvice: Array.isArray(parsed.concreteRepairAdvice) ? parsed.concreteRepairAdvice.slice(0, 3) as RepairAdvice[] : [],
    recommendation: normalizeRecommendation(parsed.recommendation),
    confidenceReason: typeof parsed.confidenceReason === 'string' ? parsed.confidenceReason : 'Evaluator response normalized by DF2.',
    evidenceRefs: Array.isArray(parsed.evidenceRefs) ? parsed.evidenceRefs.filter((ref): ref is string => typeof ref === 'string') : ['validate.report.json', 'runtime.report.json'],
  };
}

function clampNumber(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return Math.min(max, Math.max(min, value));
}

export function normalizeScore100(value: unknown): number | null {
  const clamped = clampNumber(value, 0, 100);
  if (clamped === null) return null;
  return clamped > 0 && clamped <= 1 ? Math.round(clamped * 10000) / 100 : clamped;
}

function normalizeQualityBand(value: unknown, score: number | null): CandidateEvaluation['qualityBand'] {
  if (value === 'launch_ready' || value === 'functional' || value === 'warning' || value === 'reject' || value === 'abstain') return value;
  if (score !== null && score >= 82) return 'launch_ready';
  if (score !== null && score >= 60) return 'functional';
  return 'warning';
}

function normalizeFailureClass(value: unknown): CandidateEvaluation['failureClass'] {
  const allowed = new Set(['none', 'visual_quality', 'interaction_missing', 'audio_silent', 'timing_rhythm', 'performance', 'incomplete', 'wrapper_contract_suspect', 'validator_conflict', 'insufficient_evidence', 'domain_mismatch']);
  return typeof value === 'string' && allowed.has(value) ? value as CandidateEvaluation['failureClass'] : 'none';
}

function normalizeAgreement(value: unknown): CandidateEvaluation['agreementWithDeterministic'] {
  return value === 'soft_conflict' || value === 'hard_conflict' ? value : 'agree';
}

function normalizeRecommendation(value: unknown): CandidateEvaluation['recommendation'] {
  return value === 'retry_same_generator' || value === 'switch_generator' || value === 'stop' ? value : 'accept';
}

function finalBandFor(evaluation: CandidateEvaluation, runtime: RuntimeReport): FinalBand {
  if (!evaluation.eligible || runtime.status !== 'pass' || runtime.runtimeHealthScore === null || evaluation.overallScore === null || evaluation.confidence === null) return 'fail';
  const score = rankScore(evaluation.overallScore, runtime.runtimeHealthScore);
  if (runtime.runtimeHealthScore >= 85 && evaluation.overallScore >= 82 && evaluation.confidence >= 0.7 && score >= 82 && evaluation.agreementWithDeterministic === 'agree') return 'launch_ready';
  if (runtime.runtimeHealthScore >= 70 && evaluation.overallScore >= 60 && evaluation.confidence >= 0.55 && score >= 60) return 'functional';
  return 'warning';
}

function statusFor(validationPassed: boolean, runtime: RuntimeReport, evaluation: CandidateEvaluation): CandidateStatus {
  if (!validationPassed) return 'validate_fail';
  if (runtime.status !== 'pass') return 'runtime_fail';
  if (!evaluation.eligible) return 'runtime_fail';
  return 'evaluated';
}

async function runCandidate(input: {
  runId: string;
  domain: RuntimeDomain;
  spec: DomainSpec;
  runDir: string;
  attempt: number;
  generatorConfig: Partial<LLMConfig>;
  generatorModel: string;
  evaluatorConfig: Partial<LLMConfig>;
  fallbackEvaluatorConfig: Partial<LLMConfig> | null;
  preset: Df2Preset;
  repairPacket: unknown | null;
  dryRun: boolean;
  dryScenario: string;
  runtimeTimeoutMs: number;
}): Promise<CandidateSummary> {
  const candidateId = `candidate-${String(input.attempt).padStart(2, '0')}`;
  const candidateDir = path.join(input.runDir, candidateId);
  await fs.mkdir(candidateDir, { recursive: true });

  const prompt = input.repairPacket
    ? `${input.spec.prompt}\n\nDF2 compact repair packet:\n${JSON.stringify(input.repairPacket, null, 2)}`
    : input.spec.prompt;

  await writeJson(path.join(candidateDir, 'generator.request.json'), {
    runId: input.runId,
    candidateId,
    attempt: input.attempt,
    model: redactedConfig(input.generatorConfig),
    prompt,
  });

  let raw = '';
  const startedAt = Date.now();
  try {
    if (input.dryRun) {
      if (input.dryScenario === 'timeout-then-fallback' && input.attempt === 1) {
        throw new Error('Dry-run timeout fixture');
      }
      raw = DRY_CANDIDATES[input.dryScenario]?.[input.domain]?.[input.attempt - 1] || CANARY_CODE[input.domain];
    } else {
      const llm = new LLMClient(input.generatorConfig);
      const generator = input.spec.createGenerator(llm);
      const response = generator.generateFull
        ? await generator.generateFull(prompt)
        : { code: await generator.generate(prompt), success: true } as LLMResponse;
      raw = response.code || '';
      await writeJson(path.join(candidateDir, 'response.json'), response);
      if (!raw.trim()) throw new Error('Generator returned empty code');
    }
  } catch (error) {
    const signature = classifyGenerationError(error, input.domain);
    const summary = makeFailureCandidate(candidateId, input.attempt, input.generatorModel, 'generate_fail', 'not_run', signature, candidateDir, Date.now() - startedAt);
    await fs.writeFile(path.join(candidateDir, 'generator.response.raw.txt'), raw, 'utf8');
    await writeJson(path.join(candidateDir, 'generator.meta.json'), { model: input.generatorModel, latencyMs: Date.now() - startedAt, error });
    await writeJson(path.join(candidateDir, 'candidate.summary.json'), summary);
    return summary;
  }

  await fs.writeFile(path.join(candidateDir, 'generator.response.raw.txt'), raw, 'utf8');
  await writeJson(path.join(candidateDir, 'generator.meta.json'), { model: input.generatorModel, latencyMs: Date.now() - startedAt });

  const normalized = normalizeCandidate(raw);
  await writeJson(path.join(candidateDir, 'normalize.input.json'), { rawHash: normalized.rawHash });
  await writeJson(path.join(candidateDir, 'normalize.output.json'), normalized);
  await fs.writeFile(path.join(candidateDir, 'code.txt'), normalized.code, 'utf8');

  const validation = CodeValidator.validate(normalized.code, input.domain);
  await writeJson(path.join(candidateDir, 'validate.report.json'), validation);
  await fs.writeFile(path.join(candidateDir, 'validate.stdout.log'), validation.valid ? 'validation passed\n' : '', 'utf8');
  await fs.writeFile(path.join(candidateDir, 'validate.stderr.log'), validation.valid ? '' : validation.errors.join('\n'), 'utf8');

  const generator = input.spec.createGenerator();
  const preview = buildPreview(input.domain, generator, validation.cleanedCode || normalized.code);
  await fs.writeFile(path.join(candidateDir, 'preview.html'), preview, 'utf8');
  await writeJson(path.join(candidateDir, 'candidate.files.manifest.json'), {
    files: [
      { path: 'code.txt', sha256: sha256(normalized.code) },
      { path: 'preview.html', sha256: sha256(preview) },
    ],
  });

  if (!validation.valid) {
    const signature = classifyValidationError(validation.errors, input.domain);
    const summary = makeFailureCandidate(candidateId, input.attempt, input.generatorModel, 'validate_fail', 'not_run', signature, candidateDir, Date.now() - startedAt);
    await writeJson(path.join(candidateDir, 'runtime.report.json'), { status: 'not_run', reason: 'Validation failed before runtime.' });
    await fs.writeFile(path.join(candidateDir, 'runtime.console.log'), '', 'utf8');
    await writeJson(path.join(candidateDir, 'runtime.metrics.json'), { runtimeHealthScore: null });
    const evaluation = await runEvaluator(input.runId, candidateId, input.attempt, input.domain, input.spec.prompt, normalized.code, candidateDir, false, { status: 'not_run', passed: false, runtimeHealthScore: null, logs: [], errors: [], durationMs: 0 }, input.evaluatorConfig, input.fallbackEvaluatorConfig, input.preset, input.dryRun, input.dryScenario);
    await writeJson(path.join(candidateDir, 'candidate.summary.json'), summary);
    await writeJson(path.join(candidateDir, 'decision.json'), { status: summary.status, failureSignature: summary.failureSignature, evaluator: evaluation.skipReason });
    return summary;
  }

  const runtime = await runRuntime(input.domain, preview, candidateDir, input.dryRun, input.runtimeTimeoutMs);
  const evaluation = await runEvaluator(input.runId, candidateId, input.attempt, input.domain, input.spec.prompt, validation.cleanedCode || normalized.code, candidateDir, true, runtime, input.evaluatorConfig, input.fallbackEvaluatorConfig, input.preset, input.dryRun, input.dryScenario);
  const finalBand = finalBandFor(evaluation, runtime);
  const computedRank = evaluation.overallScore !== null && runtime.runtimeHealthScore !== null
    ? rankScore(evaluation.overallScore, runtime.runtimeHealthScore)
    : null;
  const signature = runtime.status === 'pass' ? null : classifyRuntimeError(runtime, input.domain);
  const summary: CandidateSummary = {
    candidateId,
    attempt: input.attempt,
    generatorModel: input.generatorModel,
    status: statusFor(true, runtime, evaluation),
    deterministicValidation: 'pass',
    runtime: runtime.status,
    runtimeHealthScore: runtime.runtimeHealthScore,
    evaluatorOverall: evaluation.overallScore,
    evaluatorConfidence: evaluation.confidence,
    rankScore: finalBand === 'fail' ? null : computedRank,
    finalBand,
    failureSignature: signature,
    artifactRoot: path.relative(input.runDir, candidateDir),
    concreteRepairAdvice: evaluation.concreteRepairAdvice,
  };
  await writeJson(path.join(candidateDir, 'candidate.summary.json'), summary);
  await writeJson(path.join(candidateDir, 'decision.json'), { finalBand, recommendation: evaluation.recommendation, failureSignature: signature });
  return summary;
}

function makeFailureCandidate(candidateId: string, attempt: number, generatorModel: string, status: CandidateStatus, runtime: RuntimeStatus, failureSignature: FailureSignature, candidateDir: string, durationMs: number): CandidateSummary {
  return {
    candidateId,
    attempt,
    generatorModel,
    status,
    deterministicValidation: status === 'validate_fail' ? 'fail' : 'fail',
    runtime,
    runtimeHealthScore: null,
    evaluatorOverall: null,
    evaluatorConfidence: null,
    rankScore: null,
    finalBand: 'fail',
    failureSignature,
    artifactRoot: path.basename(candidateDir),
    concreteRepairAdvice: [{
      priority: 1,
      target: failureSignature.stage,
      issue: failureSignature.class,
      change: 'Regenerate with the cited evidence fixed.',
      expectedCheck: `${failureSignature.stage} no longer fails`,
    }],
  };
}

function compactRepairPacket(taskSpec: DomainSpec, previous: CandidateSummary): unknown {
  return {
    taskSpec: {
      domain: taskSpec.name,
      prompt: taskSpec.prompt,
    },
    priorCandidateManifestHash: sha256(JSON.stringify(candidateToFinalSummary(previous))),
    mustFix: previous.concreteRepairAdvice.slice(0, 3).map((advice) => ({
      priority: advice.priority,
      issue: advice.issue,
      change: advice.change,
    })),
    evidenceRefs: ['candidate.summary.json', 'validate.report.json'].slice(0, 2),
    doNotRegress: [
      'Return code only.',
      'Keep the artifact self-contained.',
      'Do not depend on unavailable libraries beyond the domain wrapper.',
    ],
  };
}

function redactedConfig(config: Partial<LLMConfig>): Partial<LLMConfig> {
  return { ...config, apiKey: config.apiKey ? '[REDACTED]' : undefined };
}

async function runPreflight(input: { runDir: string; domain: RuntimeDomain; dryRun: boolean; dryScenario: string; runtimeTimeoutMs: number }): Promise<{ taskPass: boolean; canaryPass: boolean; canaryArtifactRef: string | null }> {
  await writeJson(path.join(input.runDir, 'preflight.task.json'), {
    schemaVersion: DF2_CONTRACT_VERSION,
    domain: input.domain,
    runtimeSupported: isRuntimeSupportedDomain(input.domain),
    pass: true,
  });

  const canaryDir = path.join(input.runDir, 'preflight-canary');
  await fs.mkdir(canaryDir, { recursive: true });
  const canaryCode = input.dryScenario === 'canary-failure' ? 'broken canary' : CANARY_CODE[input.domain];
  const validation = CodeValidator.validate(canaryCode, input.domain);
  await writeJson(path.join(canaryDir, 'validate.report.json'), validation);
  let runtimePass = false;
  if (validation.valid) {
    const generator = DOMAIN_SPECS[input.domain].createGenerator();
    const preview = buildPreview(input.domain, generator, validation.cleanedCode || canaryCode);
    const runtime = await runRuntime(input.domain, preview, canaryDir, input.dryRun, input.runtimeTimeoutMs);
    runtimePass = runtime.passed;
  }
  const canary = {
    schemaVersion: 'df2-canary-v1',
    domain: input.domain,
    validationPass: validation.valid,
    runtimePass,
    pass: validation.valid && runtimePass,
    artifactRef: 'preflight-canary',
  };
  await writeJson(path.join(input.runDir, 'preflight.canary.json'), canary);
  return { taskPass: true, canaryPass: canary.pass, canaryArtifactRef: 'preflight-canary' };
}

async function runShadowHarness(runDir: string, final: FinalAdjudication, config: Partial<LLMConfig> | null): Promise<void> {
  if (!config) return;
  const prompt = `Review this DF2 deterministic final adjudication in shadow mode only. Do not alter the result.
${JSON.stringify(final, null, 2)}`;
  try {
    const response = await new LLMClient({ ...config, role: 'harness' }).generate('You are a shadow DF2 harness reviewer. Produce concise markdown.', prompt);
    await writeJson(path.join(runDir, 'shadow-harness.json'), { config: redactedConfig(config), success: response.success, model: response.model, usage: response.usage, error: response.error });
    await fs.writeFile(path.join(runDir, 'shadow-harness.md'), response.code || response.error || '', 'utf8');
  } catch (error) {
    await writeJson(path.join(runDir, 'shadow-harness.json'), { config: redactedConfig(config), success: false, error });
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const preset = applyOverrides(resolveDf2Preset(options.preset), options);
  const runId = `df2-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const runDir = path.resolve(options.outputRoot, runId);
  await fs.mkdir(runDir, { recursive: true });
  await appendTrace(runDir, { state: 'RUN_INIT', runId });

  const primaryConfig = options.dryRun ? { baseUrl: 'dry-run', model: preset.primaryGenerator.model } : await loadProviderConfig(preset.primaryGenerator);
  const fallbackConfig = preset.fallbackGenerator
    ? options.dryRun ? { baseUrl: 'dry-run', model: preset.fallbackGenerator.model } : await loadProviderConfig(preset.fallbackGenerator)
    : null;
  const evaluatorConfig = options.dryRun ? { baseUrl: 'dry-run', model: preset.evaluatorPrimary.model, temperature: 0, maxTokens: 512 } : await loadProviderConfig(preset.evaluatorPrimary);
  const evaluatorFallbackConfig = preset.evaluatorFallback
    ? options.dryRun ? { baseUrl: 'dry-run', model: preset.evaluatorFallback.model, temperature: 0, maxTokens: 512 } : await loadProviderConfig(preset.evaluatorFallback)
    : null;
  const shadowConfig = preset.shadowHarness && !options.dryRun ? await loadProviderConfig(preset.shadowHarness) : null;

  const manifest = {
    schemaVersion: DF2_CONTRACT_VERSION,
    runId,
    startedAt: new Date().toISOString(),
    dryRun: options.dryRun,
    dryScenario: options.dryScenario,
    domains: options.domains,
    presetName: options.preset,
    preset,
    configs: {
      primaryGenerator: redactedConfig(primaryConfig),
      fallbackGenerator: fallbackConfig ? redactedConfig(fallbackConfig) : null,
      evaluator: redactedConfig(evaluatorConfig),
      evaluatorFallback: evaluatorFallbackConfig ? redactedConfig(evaluatorFallbackConfig) : null,
      shadowHarness: shadowConfig ? redactedConfig(shadowConfig) : null,
    },
  };
  await writeJson(path.join(runDir, 'run.manifest.json'), manifest);
  await writeJson(path.join(runDir, 'env.snapshot.json'), {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cwd: process.cwd(),
    runtimeTimeoutMs: options.runtimeTimeoutMs,
  });

  const allFinals: FinalAdjudication[] = [];
  for (const domain of options.domains) {
    const domainDir = path.join(runDir, domain);
    await fs.mkdir(domainDir, { recursive: true });
    if (!isRuntimeSupportedDomain(domain)) {
      await writeJson(path.join(domainDir, 'preflight.task.json'), {
        schemaVersion: DF2_CONTRACT_VERSION,
        domain,
        runtimeSupported: false,
        supportedDomains: SUPPORTED_DOMAINS,
        pass: false,
        error: 'DF2 v1 requires deterministic runtime support before a domain can enter the hot loop.',
      });
      const final = adjudicateFinal([], {
        runId,
        taskId: `df2-${domain}`,
        domain,
        canaryPassed: false,
        canaryArtifactRef: null,
        config: finalConfig(preset),
      });
      await writeJson(path.join(domainDir, 'preflight.canary.json'), {
        schemaVersion: 'df2-canary-v1',
        domain,
        pass: false,
        skipped: true,
        reason: 'Unsupported runtime domain for DF2 v1.',
      });
      await writeJson(path.join(domainDir, 'candidate-index.json'), []);
      await writeJson(path.join(domainDir, 'adjudication.final.json'), final);
      allFinals.push(final);
      await appendTrace(runDir, { state: 'PREFLIGHT_TASK', domain, pass: false });
      await appendTrace(runDir, { state: 'FINAL_ADJUDICATE', domain, terminalOutcome: final.terminalOutcome });
      continue;
    }
    await appendTrace(runDir, { state: 'PREFLIGHT_TASK', domain });
    const preflight = await runPreflight({ runDir: domainDir, domain, dryRun: options.dryRun, dryScenario: options.dryScenario, runtimeTimeoutMs: options.runtimeTimeoutMs });
    await appendTrace(runDir, { state: 'PREFLIGHT_CANARY', domain, pass: preflight.canaryPass });
    if (!preflight.canaryPass) {
      const final = adjudicateFinal([], {
        runId,
        taskId: `df2-${domain}`,
        domain,
        canaryPassed: false,
        canaryArtifactRef: preflight.canaryArtifactRef,
        config: finalConfig(preset),
      });
      await writeJson(path.join(domainDir, 'adjudication.final.json'), final);
      allFinals.push(final);
      continue;
    }

    const spec = DOMAIN_SPECS[domain];
    const candidates: CandidateSummary[] = [];
    let currentConfig = primaryConfig;
    let currentModel = primaryConfig.model || preset.primaryGenerator.model;
    let repairPacket: unknown | null = null;
    let nextAction: NextAction = 'retry_same_generator';
    for (let attempt = 1; attempt <= 2 && nextAction !== 'stop'; attempt++) {
      await appendTrace(runDir, { state: `ATTEMPT_${attempt}`, domain, model: currentModel });
      const summary = await runCandidate({
        runId,
        domain,
        spec,
        runDir: domainDir,
        attempt,
        generatorConfig: currentConfig,
        generatorModel: currentModel,
        evaluatorConfig,
        fallbackEvaluatorConfig: evaluatorFallbackConfig,
        preset,
        repairPacket,
        dryRun: options.dryRun,
        dryScenario: options.dryScenario,
        runtimeTimeoutMs: options.runtimeTimeoutMs,
      });
      candidates.push(summary);
      await appendTrace(runDir, { state: 'CANDIDATE_SUMMARY', domain, candidateId: summary.candidateId, finalBand: summary.finalBand });
      const previousSignatures = candidates.slice(0, -1).map((candidate) => candidate.failureSignature).filter((signature): signature is FailureSignature => Boolean(signature));
      const decision = decideNextAction(summary, previousSignatures, Boolean(fallbackConfig));
      nextAction = decision.action;
      await writeJson(path.join(domainDir, summary.candidateId, 'decision.json'), { ...decision, nextAttempt: attempt < 2 ? attempt + 1 : null });
      await appendTrace(runDir, { state: 'DECIDE_NEXT', domain, candidateId: summary.candidateId, decision });
      if (attempt >= 2 || decision.action === 'stop') break;
      repairPacket = compactRepairPacket(spec, summary);
      if (decision.action === 'switch_generator' && fallbackConfig) {
        currentConfig = fallbackConfig;
        currentModel = fallbackConfig.model || preset.fallbackGenerator?.model || currentModel;
      }
    }

    const final = adjudicateFinal(candidates, {
      runId,
      taskId: `df2-${domain}`,
      domain,
      canaryPassed: preflight.canaryPass,
      canaryArtifactRef: preflight.canaryArtifactRef,
      config: finalConfig(preset),
    });
    await appendTrace(runDir, { state: 'FINAL_ADJUDICATE', domain, terminalOutcome: final.terminalOutcome });
    await writeJson(path.join(domainDir, 'candidate-index.json'), candidates);
    await writeJson(path.join(domainDir, 'adjudication.final.json'), final);
    allFinals.push(final);
    await runShadowHarness(domainDir, final, shadowConfig);
  }

  await writeJson(path.join(runDir, 'candidate-index.json'), allFinals.flatMap((final) => final.candidates));
  await writeJson(path.join(runDir, 'adjudication.final.json'), {
    schemaVersion: 'df2-run-final-v1',
    runId,
    terminalOutcomes: Object.fromEntries(allFinals.map((final) => [final.domain, final.terminalOutcome])),
    finals: allFinals.map((final) => `${final.domain}/adjudication.final.json`),
  });

  const failed = allFinals.some((final) => final.terminalOutcome === 'generator_compatibility_failure' || final.terminalOutcome === 'harness_validator_wrapper_failure');
  console.log(JSON.stringify({ runDir, outcomes: Object.fromEntries(allFinals.map((final) => [final.domain, final.terminalOutcome])) }, null, 2));
  if (failed) process.exitCode = 1;
}

function finalConfig(preset: Df2Preset): FinalAdjudication['config'] {
  return {
    primaryGenerator: preset.primaryGenerator.model,
    fallbackGenerator: preset.fallbackGenerator?.model ?? null,
    evaluator: preset.evaluatorPrimary.model,
    evaluatorFallback: preset.evaluatorFallback?.model ?? null,
    maxCandidates: 2,
    preflightCanaryEnabled: true,
    harnessDecisionMode: 'deterministic',
  };
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main()
    .then(() => process.exit(process.exitCode ?? 0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
