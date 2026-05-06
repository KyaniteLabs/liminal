#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

import {
  buildCreativeDomainRouteTruth,
  previewDomainForCode,
  validateGeneratedDomainForRequest,
} from '../../src/tui-bridge/CreativeDomainRouting.js';
import { Domain } from '../../src/types/domains.js';

const repoRoot = process.cwd();
const outDir = path.join(repoRoot, '.omx', 'proof');
const outPath = path.join(outDir, 'route-performance-budget.json');

interface RouteCase {
  name: string;
  prompt: string;
  expected: {
    requestedDomain: Domain;
    selectedDomain: Domain;
    domains: Domain[];
    promptDomainLocked: boolean;
    source: 'prompt' | 'inferred';
  };
}

interface PreviewCase {
  name: string;
  code: string;
  requestedDomain: Domain;
  expectedPreviewDomain: string;
  expectValidationOk: boolean;
}

const routeCases: RouteCase[] = [
  {
    name: 'explicit p5',
    prompt: 'Create a p5.js sketch with particles orbiting a dark center.',
    expected: {
      requestedDomain: Domain.P5,
      selectedDomain: Domain.P5,
      domains: [Domain.P5],
      promptDomainLocked: true,
      source: 'prompt',
    },
  },
  {
    name: 'explicit three',
    prompt: 'Generate a Three.js scene with glass flowers orbiting a camera.',
    expected: {
      requestedDomain: Domain.THREE,
      selectedDomain: Domain.THREE,
      domains: [Domain.THREE],
      promptDomainLocked: true,
      source: 'prompt',
    },
  },
  {
    name: 'explicit glsl',
    prompt: 'Write a GLSL fragment shader with ray marched fog.',
    expected: {
      requestedDomain: Domain.GLSL,
      selectedDomain: Domain.GLSL,
      domains: [Domain.GLSL],
      promptDomainLocked: true,
      source: 'prompt',
    },
  },
  {
    name: 'explicit hydra',
    prompt: 'Make a Hydra video synth sketch with kaleidoscopic feedback.',
    expected: {
      requestedDomain: Domain.HYDRA,
      selectedDomain: Domain.HYDRA,
      domains: [Domain.HYDRA],
      promptDomainLocked: true,
      source: 'prompt',
    },
  },
  {
    name: 'explicit strudel',
    prompt: 'Create a Strudel live coding music pattern with tidal rhythm.',
    expected: {
      requestedDomain: Domain.STRUDEL,
      selectedDomain: Domain.STRUDEL,
      domains: [Domain.STRUDEL],
      promptDomainLocked: true,
      source: 'prompt',
    },
  },
  {
    name: 'explicit tone',
    prompt: 'Build a Tone.js web audio sequencer with a warm drone.',
    expected: {
      requestedDomain: Domain.TONE,
      selectedDomain: Domain.TONE,
      domains: [Domain.TONE],
      promptDomainLocked: true,
      source: 'prompt',
    },
  },
  {
    name: 'explicit revideo',
    prompt: 'Create a Revideo title-card composition with layered captions.',
    expected: {
      requestedDomain: Domain.REVIEWD,
      selectedDomain: Domain.REVIEWD,
      domains: [Domain.REVIEWD],
      promptDomainLocked: true,
      source: 'prompt',
    },
  },
  {
    name: 'explicit hyperframes',
    prompt: 'Create a HyperFrames promo slideshow with clips and timelines.',
    expected: {
      requestedDomain: Domain.HYPERFRAMES,
      selectedDomain: Domain.HYPERFRAMES,
      domains: [Domain.HYPERFRAMES],
      promptDomainLocked: true,
      source: 'prompt',
    },
  },
  {
    name: 'explicit kinetic',
    prompt: 'Create CSS kinetic typography as a complete animated HTML artifact.',
    expected: {
      requestedDomain: Domain.KINETIC,
      selectedDomain: Domain.KINETIC,
      domains: [Domain.KINETIC],
      promptDomainLocked: true,
      source: 'prompt',
    },
  },
  {
    name: 'explicit ascii',
    prompt: 'Make ASCII text art of a willow tree.',
    expected: {
      requestedDomain: Domain.ASCII,
      selectedDomain: Domain.ASCII,
      domains: [Domain.ASCII],
      promptDomainLocked: true,
      source: 'prompt',
    },
  },
  {
    name: 'implicit visual fallback',
    prompt: 'Create luminous particles orbiting a dark center with visible motion.',
    expected: {
      requestedDomain: Domain.THREE,
      selectedDomain: Domain.THREE,
      domains: [Domain.THREE, Domain.P5, Domain.HYDRA, Domain.GLSL],
      promptDomainLocked: false,
      source: 'inferred',
    },
  },
  {
    name: 'generic vector fallback',
    prompt: 'Create a single-line SVG vector logo for a moonlit flower.',
    expected: {
      requestedDomain: Domain.GENERIC,
      selectedDomain: Domain.THREE,
      domains: [Domain.THREE, Domain.P5, Domain.HYDRA, Domain.GLSL],
      promptDomainLocked: false,
      source: 'inferred',
    },
  },
];

const previewCases: PreviewCase[] = [
  {
    name: 'p5 preview',
    code: 'function setup() { createCanvas(800, 600); } function draw() { ellipse(mouseX, mouseY, 20); }',
    requestedDomain: Domain.P5,
    expectedPreviewDomain: 'p5',
    expectValidationOk: true,
  },
  {
    name: 'three preview',
    code: 'const scene = new THREE.Scene(); const renderer = new THREE.WebGLRenderer();',
    requestedDomain: Domain.THREE,
    expectedPreviewDomain: 'three',
    expectValidationOk: true,
  },
  {
    name: 'shader preview',
    code: 'precision mediump float; uniform vec2 u_resolution; void main() { gl_FragColor = vec4(1.0); }',
    requestedDomain: Domain.GLSL,
    expectedPreviewDomain: 'shader',
    expectValidationOk: true,
  },
  {
    name: 'tone preview',
    code: '<script src="https://unpkg.com/tone@14.8.49/build/Tone.js"></script><script>Tone.Transport.start();</script>',
    requestedDomain: Domain.TONE,
    expectedPreviewDomain: 'tone',
    expectValidationOk: true,
  },
  {
    name: 'hyperframes preview',
    code: '<div data-composition-id="demo"></div><script>window.__timelines = { demo: gsap.timeline() };</script>',
    requestedDomain: Domain.HYPERFRAMES,
    expectedPreviewDomain: 'hyperframes',
    expectValidationOk: true,
  },
  {
    name: 'mismatch stays visible',
    code: 'const scene = new THREE.Scene();',
    requestedDomain: Domain.P5,
    expectedPreviewDomain: 'three',
    expectValidationOk: false,
  },
];

const iterations = Number(process.env.LIMINAL_ROUTE_PERF_ITERATIONS || 1_000);
const budgets = {
  routeTotalMs: Number(process.env.LIMINAL_ROUTE_PERF_TOTAL_MS || 1_000),
  routeSingleMs: Number(process.env.LIMINAL_ROUTE_PERF_SINGLE_MS || 25),
  previewTotalMs: Number(process.env.LIMINAL_PREVIEW_ROUTE_PERF_TOTAL_MS || 500),
  previewSingleMs: Number(process.env.LIMINAL_PREVIEW_ROUTE_PERF_SINGLE_MS || 25),
};

function arraysMatch<T>(actual: T[], expected: T[]): boolean {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function timeRouteCases() {
  const failures: string[] = [];
  const cases = routeCases.map((routeCase) => {
    const start = performance.now();
    const actual = buildCreativeDomainRouteTruth(routeCase.prompt);
    const durationMs = performance.now() - start;
    const expected = routeCase.expected;
    const ok = actual.requestedDomain === expected.requestedDomain
      && actual.selectedDomain === expected.selectedDomain
      && actual.promptDomainLocked === expected.promptDomainLocked
      && actual.source === expected.source
      && arraysMatch(actual.domains, expected.domains);

    if (!ok) {
      failures.push(`${routeCase.name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
    if (durationMs > budgets.routeSingleMs) {
      failures.push(`${routeCase.name}: ${durationMs.toFixed(3)}ms exceeded single-route budget ${budgets.routeSingleMs}ms`);
    }

    return {
      name: routeCase.name,
      prompt: routeCase.prompt,
      expected,
      actual,
      durationMs: Number(durationMs.toFixed(3)),
      passed: ok && durationMs <= budgets.routeSingleMs,
    };
  });

  const aggregateStart = performance.now();
  for (let index = 0; index < iterations; index += 1) {
    const routeCase = routeCases[index % routeCases.length];
    buildCreativeDomainRouteTruth(routeCase.prompt);
  }
  const totalMs = performance.now() - aggregateStart;
  if (totalMs > budgets.routeTotalMs) {
    failures.push(`${iterations} route iterations took ${totalMs.toFixed(3)}ms; budget ${budgets.routeTotalMs}ms`);
  }

  return {
    cases,
    aggregate: {
      iterations,
      totalMs: Number(totalMs.toFixed(3)),
      averageMs: Number((totalMs / iterations).toFixed(6)),
      budgetMs: budgets.routeTotalMs,
      passed: totalMs <= budgets.routeTotalMs,
    },
    failures,
  };
}

function timePreviewCases() {
  const failures: string[] = [];
  const cases = previewCases.map((previewCase) => {
    const start = performance.now();
    const previewDomain = previewDomainForCode(previewCase.code, previewCase.requestedDomain);
    const validation = validateGeneratedDomainForRequest(previewCase.code, previewCase.requestedDomain);
    const durationMs = performance.now() - start;
    const ok = previewDomain === previewCase.expectedPreviewDomain && validation.ok === previewCase.expectValidationOk;

    if (!ok) {
      failures.push(`${previewCase.name}: expected preview ${previewCase.expectedPreviewDomain} / ok ${previewCase.expectValidationOk}, got preview ${previewDomain} / ok ${validation.ok}`);
    }
    if (durationMs > budgets.previewSingleMs) {
      failures.push(`${previewCase.name}: ${durationMs.toFixed(3)}ms exceeded single-preview budget ${budgets.previewSingleMs}ms`);
    }

    return {
      name: previewCase.name,
      requestedDomain: previewCase.requestedDomain,
      expectedPreviewDomain: previewCase.expectedPreviewDomain,
      actualPreviewDomain: previewDomain,
      validation,
      durationMs: Number(durationMs.toFixed(3)),
      passed: ok && durationMs <= budgets.previewSingleMs,
    };
  });

  const aggregateStart = performance.now();
  for (let index = 0; index < iterations; index += 1) {
    const previewCase = previewCases[index % previewCases.length];
    previewDomainForCode(previewCase.code, previewCase.requestedDomain);
  }
  const totalMs = performance.now() - aggregateStart;
  if (totalMs > budgets.previewTotalMs) {
    failures.push(`${iterations} preview iterations took ${totalMs.toFixed(3)}ms; budget ${budgets.previewTotalMs}ms`);
  }

  return {
    cases,
    aggregate: {
      iterations,
      totalMs: Number(totalMs.toFixed(3)),
      averageMs: Number((totalMs / iterations).toFixed(6)),
      budgetMs: budgets.previewTotalMs,
      passed: totalMs <= budgets.previewTotalMs,
    },
    failures,
  };
}

const routeResults = timeRouteCases();
const previewResults = timePreviewCases();
const failures = [...routeResults.failures, ...previewResults.failures];
const result = {
  generatedAt: new Date().toISOString(),
  contract: 'liminal-route-performance-budget-v1',
  passed: failures.length === 0,
  budgets,
  routeResults,
  previewResults,
  failures,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

if (!result.passed) {
  console.error(`Route performance proof failed. See ${outPath}`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Route performance proof written: ${outPath}`);
