#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import puppeteer from 'puppeteer';
import sharp from 'sharp';

import { CodeValidator } from '../../dist/core/CodeValidator.js';
import { generatorRegistry } from '../../dist/generators/GeneratorRegistry.js';
import { KineticWrapper } from '../../dist/generators/kinetic/KineticWrapper.js';
import { registerAllGenerators } from '../../dist/generators/registerGenerators.js';
import { HTMLWrapper } from '../../dist/utils/htmlWrapper.js';
import {
  relativeLuminance,
  classifyRenderQuality,
  BRIGHT_PIXEL_LUMINANCE,
  WHITE_LUMINANCE,
  WHITE_SATURATION_MAX,
} from '../quality/luminance.mjs';

const DEFAULT_OUT_DIR = '.quality/gauntlet';
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_RENDER_WAIT_MS = 4_000;

export const DOMAIN_GAUNTLET_DOMAINS = [
  {
    id: 'svg',
    label: 'SVG',
    generator: 'svg',
    validationDomain: 'svg',
    hasDedicatedValidator: true,
    renderMode: 'png',
    artifactExtension: 'svg',
    prompt: 'Target creative domain: SVG. Generate raw safe SVG vector art of a threshold doorway observatory made from nested paths. Never-used gauntlet nonce:',
  },
  {
    id: 'p5',
    label: 'p5.js',
    generator: 'p5',
    validationDomain: 'p5',
    hasDedicatedValidator: true,
    renderMode: 'png',
    artifactExtension: 'js',
    prompt: 'Target creative domain: p5. Generate a runnable p5.js sketch with setup(), draw(), createCanvas(), and animated luminous contour rings. Never-used gauntlet nonce:',
  },
  {
    id: 'glsl',
    label: 'GLSL',
    generator: 'shader',
    validationDomain: 'glsl',
    wrapDomain: 'shader',
    hasDedicatedValidator: true,
    renderMode: 'png',
    artifactExtension: 'frag',
    prompt: 'Target creative domain: GLSL fragment shader. Generate a complete WebGL fragment shader with precision, uniforms, void main(), and visible color output. Never-used gauntlet nonce:',
  },
  {
    id: 'hydra',
    label: 'Hydra',
    generator: 'hydra',
    validationDomain: 'hydra',
    hasDedicatedValidator: true,
    renderMode: 'png',
    artifactExtension: 'js',
    prompt: 'Target creative domain: Hydra. Generate runnable hydra-synth code using osc(), kaleid(), color(), modulate(), and out(o0). Never-used gauntlet nonce:',
  },
  {
    id: 'three',
    label: 'Three.js',
    generator: 'three',
    validationDomain: 'three',
    hasDedicatedValidator: true,
    renderMode: 'png',
    artifactExtension: 'js',
    prompt: 'Target creative domain: Three.js. Generate a runnable Three.js scene with camera, renderer, lights, rotating geometry, and animation loop. Never-used gauntlet nonce:',
  },
  {
    id: 'tone',
    label: 'Tone.js',
    generator: 'tone',
    validationDomain: 'tone',
    hasDedicatedValidator: true,
    renderMode: 'receipt',
    artifactExtension: 'html',
    prompt: 'Target creative domain: Tone.js. Generate complete browser Tone.js audio code with a start button, Tone.start(), Transport bpm, and audible synth loop. Never-used gauntlet nonce:',
  },
  {
    id: 'strudel',
    label: 'Strudel',
    generator: 'strudel',
    validationDomain: 'strudel',
    hasDedicatedValidator: true,
    renderMode: 'receipt',
    artifactExtension: 'js',
    prompt: 'Target creative domain: Strudel. Generate runnable Strudel live-coding music using bpm(), s("bd hh"), note() or stack(), and .out(). Never-used gauntlet nonce:',
  },
  {
    id: 'revideo',
    label: 'Revideo',
    generator: 'revideo',
    validationDomain: 'revideo',
    hasDedicatedValidator: true,
    renderMode: 'png',
    artifactExtension: 'tsx',
    prompt: 'Target creative domain: Revideo. Generate a compact Revideo scene using makeScene2D, Txt, Rect, createRef, and timed animation. Never-used gauntlet nonce:',
  },
  {
    id: 'html',
    label: 'HTML',
    generator: 'html',
    validationDomain: 'html',
    hasDedicatedValidator: true,
    renderMode: 'png',
    artifactExtension: 'html',
    prompt: 'Target creative domain: HTML. Generate a complete self-contained HTML/CSS/JS artifact: an interactive control panel for liminal color fields. Never-used gauntlet nonce:',
  },
  {
    id: 'ascii',
    label: 'ASCII',
    generator: 'ascii',
    validationDomain: 'ascii',
    hasDedicatedValidator: true,
    renderMode: 'receipt',
    artifactExtension: 'txt',
    prompt: 'Target creative domain: ASCII. Generate dense ASCII art of a moonlit portal using only printable text characters. Never-used gauntlet nonce:',
  },
  {
    id: 'kinetic',
    label: 'Kinetic Typography',
    generator: 'kinetic',
    validationDomain: 'kinetic',
    hasDedicatedValidator: true,
    renderMode: 'png',
    artifactExtension: 'html',
    prompt: 'Target creative domain: Kinetic Typography. Generate CSS kinetic typography HTML with animated words orbiting a central phrase. Never-used gauntlet nonce:',
  },
  {
    id: 'textgen',
    label: 'TextGen',
    generator: 'textgen',
    validationDomain: 'textgen',
    hasDedicatedValidator: true,
    renderMode: 'receipt',
    artifactExtension: 'txt',
    prompt: 'Target creative domain: TextGen. Generate concrete-poetry text art about a threshold machine learning its own name. Never-used gauntlet nonce:',
  },
];

const DOMAIN_ALIASES = new Map([
  ['shader', 'glsl'],
  ['glsl', 'glsl'],
  ['p5js', 'p5'],
  ['p5.js', 'p5'],
  ['threejs', 'three'],
  ['three.js', 'three'],
  ['tonejs', 'tone'],
  ['tone.js', 'tone'],
  ['kinetic-typography', 'kinetic'],
  ['kinetic typography', 'kinetic'],
  ['text', 'textgen'],
  ['text-gen', 'textgen'],
]);

function boolCell(ok) {
  return ok ? 'PASS' : 'FAIL';
}

function cleanReason(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\|/g, '/')
    .trim()
    .slice(0, 220);
}

function firstFailureReason(input) {
  if (!input.generated.ok) return `generate: ${cleanReason(input.generated.error || 'generation failed')}`;
  if (!input.validation.ok) return `validate: ${cleanReason(input.validation.errors?.[0] || 'validation failed')}`;
  if (!input.render.ok) return `render-or-receipt: ${cleanReason(input.render.errors?.[0] || 'render-or-receipt failed')}`;
  return '';
}

export function buildDomainReceipt(input) {
  const failureReason = firstFailureReason(input);
  return {
    domain: input.domain,
    prompt: input.prompt,
    status: failureReason ? 'FAIL' : 'PASS',
    failureReason,
    generated: input.generated,
    validation: input.validation,
    renderOrReceipt: input.render,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
  };
}

export function buildMarkdownTable(receipts) {
  const lines = [
    '| Domain | Generate | Validate | Render/Receipt | Status | Failure reason |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  for (const receipt of receipts) {
    lines.push(`| ${receipt.domain} | ${boolCell(receipt.generated.ok)} | ${boolCell(receipt.validation.ok)} | ${boolCell(receipt.renderOrReceipt.ok)} | ${receipt.status} | ${cleanReason(receipt.failureReason)} |`);
  }
  return lines.join('\n');
}

export function selectDomains(options) {
  if (options.all) return DOMAIN_GAUNTLET_DOMAINS;
  if (!options.domain) throw new Error('Pass --all or --domain <domain>');
  const requested = String(options.domain).trim().toLowerCase();
  const normalized = DOMAIN_ALIASES.get(requested) ?? requested;
  const domain = DOMAIN_GAUNTLET_DOMAINS.find((candidate) => candidate.id === normalized);
  if (!domain) {
    throw new Error(`Unknown domain "${options.domain}". Known domains: ${DOMAIN_GAUNTLET_DOMAINS.map((candidate) => candidate.id).join(', ')}`);
  }
  return [domain];
}

function parseArgs(argv) {
  const options = {
    all: false,
    domain: '',
    outDir: DEFAULT_OUT_DIR,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    renderWaitMs: DEFAULT_RENDER_WAIT_MS,
    markdown: '',
    strict: false,
    ratchet: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--all') options.all = true;
    else if (arg === '--strict') options.strict = true;
    else if (arg === '--ratchet') options.ratchet = true;
    else if (arg === '--domain') options.domain = argv[++index] ?? '';
    else if (arg === '--out-dir') options.outDir = argv[++index] ?? DEFAULT_OUT_DIR;
    else if (arg === '--timeout-ms') options.timeoutMs = Number(argv[++index] ?? DEFAULT_TIMEOUT_MS);
    else if (arg === '--render-wait-ms') options.renderWaitMs = Number(argv[++index] ?? DEFAULT_RENDER_WAIT_MS);
    else if (arg === '--markdown') options.markdown = argv[++index] ?? '';
    else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function usage() {
  return [
    'Usage: node scripts/domains/gauntlet.mjs --all [--strict]',
    '       node scripts/domains/gauntlet.mjs --domain <domain> [--strict]',
    '',
    'Options:',
    '  --all                         Run every FINISH_LINE creative domain',
    '  --domain <domain>             Run one domain, e.g. p5, glsl, hydra, textgen',
    '  --out-dir <path>              Receipt/artifact output directory (default .quality/gauntlet)',
    '  --markdown <path>             Write a markdown audit table',
    '  --timeout-ms <ms>             Per-domain generation timeout',
    '  --render-wait-ms <ms>         Browser wait before PNG capture',
    '  --strict                      Exit 1 if any domain FAILs',
    '  --ratchet                     Exit 1 if any domain in passing-domains.json FAILs',
  ].join('\n');
}

function promptFor(domain, runId) {
  return `${domain.prompt} ${runId}-${domain.id}`;
}

async function withTimeout(label, timeoutMs, fn) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  try {
    return await Promise.race([
      fn(controller.signal),
      new Promise((_, reject) => {
        controller.signal.addEventListener('abort', () => reject(controller.signal.reason), { once: true });
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeGeneratedResult(result) {
  if (typeof result === 'string') return result;
  if (result && typeof result === 'object' && typeof result.code === 'string') return result.code;
  return '';
}

async function generateForDomain(domain, prompt, timeoutMs) {
  try {
    const entry = generatorRegistry.getAll().find((candidate) => candidate.name === domain.generator);
    if (!entry) {
      return { ok: false, code: '', codeBytes: 0, error: `generator "${domain.generator}" is not registered` };
    }
    const code = await withTimeout(`${domain.id} generation`, timeoutMs, async (signal) => normalizeGeneratedResult(await entry.generate(prompt, {
      bypassCache: true,
      signal,
      maxTokens: domain.id === 'strudel' || domain.id === 'textgen' ? 1200 : undefined,
    })));
    if (!code.trim()) return { ok: false, code: '', codeBytes: 0, error: 'generator returned empty code' };
    return { ok: true, code, codeBytes: Buffer.byteLength(code, 'utf8'), generator: domain.generator };
  } catch (error) {
    return { ok: false, code: '', codeBytes: 0, error: error instanceof Error ? error.message : String(error), generator: domain.generator };
  }
}

function validateForDomain(domain, code) {
  const result = CodeValidator.validate(code, domain.validationDomain);
  const errors = [...result.errors];
  if (!domain.hasDedicatedValidator) {
    errors.unshift(`No dedicated CodeValidator/domain validator registered for ${domain.id}`);
  }
  return {
    ok: result.valid && domain.hasDedicatedValidator,
    cleanedCode: result.cleanedCode,
    cleanedBytes: Buffer.byteLength(result.cleanedCode ?? '', 'utf8'),
    errors,
    validator: domain.hasDedicatedValidator ? `CodeValidator(${domain.validationDomain})` : `CodeValidator(${domain.validationDomain}) fallback only`,
  };
}

function escapePre(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function wrapTextReceipt(code, title) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>html,body{margin:0;min-height:100%;background:#06080f;color:#cfe;font:14px ui-monospace,Menlo,monospace}pre{padding:18px;white-space:pre-wrap}</style></head><body><pre>${escapePre(code)}</pre></body></html>`;
}

function htmlForVisualDomain(domain, code) {
  if (domain.id === 'kinetic') return KineticWrapper.wrap(code, { title: 'Kinetic Typography Gauntlet' });
  if (domain.id === 'html') return code;
  if (domain.id === 'glsl') return HTMLWrapper.wrap(code, { domain: 'shader', title: 'GLSL Gauntlet' });
  if (domain.id === 'svg') return HTMLWrapper.wrap(code, { domain: 'svg', title: 'SVG Gauntlet' });
  if (domain.id === 'revideo') return HTMLWrapper.wrap(code, { domain: 'revideo', showPreview: true, title: 'Revideo Gauntlet' });
  return HTMLWrapper.wrap(code, { domain: domain.wrapDomain ?? domain.id, title: `${domain.label} Gauntlet` });
}

function calculateEdgeDensity(grayPixels, width, height) {
  let horizontalDiff = 0;
  let verticalDiff = 0;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 1; x < width; x++) {
      horizontalDiff += Math.abs(grayPixels[rowOffset + x] - grayPixels[rowOffset + x - 1]);
    }
  }

  for (let y = 1; y < height; y++) {
    const rowOffset = y * width;
    const previousRowOffset = (y - 1) * width;
    for (let x = 0; x < width; x++) {
      verticalDiff += Math.abs(grayPixels[rowOffset + x] - grayPixels[previousRowOffset + x]);
    }
  }

  const horizontalSamples = height * Math.max(0, width - 1);
  const verticalSamples = Math.max(0, height - 1) * width;
  const horizontalMean = horizontalSamples > 0 ? horizontalDiff / horizontalSamples : 0;
  const verticalMean = verticalSamples > 0 ? verticalDiff / verticalSamples : 0;
  return (horizontalMean + verticalMean) / 2;
}

async function renderToPng(domain, code, outDir, runId, waitMs) {
  const html = htmlForVisualDomain(domain, code);
  const htmlPath = path.join(outDir, `${runId}-${domain.id}.html`);
  const pngPath = path.join(outDir, `${runId}-${domain.id}.png`);
  await fs.writeFile(htmlPath, html, 'utf8');

  const browser = await puppeteer.launch({
    headless: 'new',
    protocolTimeout: 60_000,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--disable-gpu-sandbox',
    ],
  });
  const page = await browser.newPage();
  const errors = [];
  try {
    await page.setViewport({ width: 900, height: 600, deviceScaleFactor: 1 });
    page.on('pageerror', (error) => errors.push(String(error.message ?? error).slice(0, 180)));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text().slice(0, 180));
    });
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    await page.screenshot({ path: pngPath });
    const stat = await fs.stat(pngPath);
    if (stat.size < 1500) errors.push(`PNG is suspiciously small (${stat.size}b)`);

    try {
      const { data, info } = await sharp(pngPath).raw().toBuffer({ resolveWithObject: true });
      const pixelCount = info.width * info.height;
      const grayPixels = new Float32Array(pixelCount);
      let totalLuminance = 0;
      let brightCount = 0;
      let whiteCount = 0;
      let sumGray = 0;
      let sumRgb = 0;
      let sumSqRgb = 0;

      for (let i = 0, pixelIndex = 0; i < data.length; i += info.channels, pixelIndex++) {
        const r = data[i], g = data[i+1], b = data[i+2];
        const lum = relativeLuminance(r, g, b);
        const gray = (r + g + b) / 3;
        grayPixels[pixelIndex] = gray;

        totalLuminance += lum;
        sumGray += gray;
        sumRgb += r + g + b;
        sumSqRgb += (r * r) + (g * g) + (b * b);
        if (lum > BRIGHT_PIXEL_LUMINANCE) brightCount++;
        if (lum > WHITE_LUMINANCE && (Math.max(r, g, b) - Math.min(r, g, b)) < WHITE_SATURATION_MAX) whiteCount++;
      }
      const rgbSampleCount = pixelCount * 3;
      const meanGray = sumGray / pixelCount;
      const colorStdev = Math.sqrt(Math.max(0, (sumSqRgb / rgbSampleCount) - ((sumRgb / rgbSampleCount) ** 2)));
      const edgeDensity = calculateEdgeDensity(grayPixels, info.width, info.height);
      const issue = classifyRenderQuality({
        meanGray,
        colorStdev,
        edgeDensity,
        meanLuminance: totalLuminance / pixelCount,
        brightFraction: brightCount / pixelCount,
        whiteFraction: whiteCount / pixelCount,
      });
      if (issue) errors.push(issue);
    } catch (err) {
      errors.push(`Failed to analyze visual output: ${err.message}`);
    }

    return {
      ok: errors.length === 0,
      mode: 'png',
      artifact: pngPath,
      htmlArtifact: htmlPath,
      bytes: stat.size,
      errors,
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return { ok: false, mode: 'png', artifact: pngPath, htmlArtifact: htmlPath, errors };
  } finally {
    await page.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

function receiptCheck(domain, code) {
  const errors = [];
  const trimmed = code.trim();
  if (!trimmed) errors.push('receipt code is empty');

  if (domain.id === 'tone') {
    if (!/\bTone\./.test(trimmed)) errors.push('missing Tone.js API usage');
    if (!/\bTone\.start\s*\(/.test(trimmed)) errors.push('missing Tone.start() user gesture path');
    if (!/\bTransport\.bpm\.value\s*=/.test(trimmed)) errors.push('missing Tone.Transport.bpm.value');
  } else if (domain.id === 'strudel') {
    if (!/\b(?:bpm|setcps|setcpm)\s*\(/.test(trimmed)) errors.push('missing Strudel tempo call');
    if (!/\b(?:s|sound|note|stack|seq|n)\s*\(/.test(trimmed)) errors.push('missing Strudel pattern source');
  } else if (domain.id === 'ascii') {
    const lines = trimmed.split('\n').filter((line) => line.trim().length > 0);
    const artChars = trimmed.match(/[█▓▒░@#%*+=~^_/\\|(){}[\].,:;'"-]/g)?.length ?? 0;
    if (lines.length < 3) errors.push('ASCII receipt has fewer than 3 non-empty lines');
    if (artChars < 16) errors.push('ASCII receipt has too few art characters');
  } else if (domain.id === 'textgen') {
    const lines = trimmed.split('\n').filter((line) => line.trim().length > 0);
    if (trimmed.length < 100) errors.push('TextGen receipt is under 100 characters');
    if (lines.length < 3) errors.push('TextGen receipt has fewer than 3 non-empty lines');
  } else {
    if (trimmed.length < 80) errors.push(`${domain.id} receipt is too short`);
  }

  return { ok: errors.length === 0, mode: 'receipt', errors };
}

async function renderOrReceipt(domain, validation, outDir, runId, renderWaitMs) {
  if (!validation.ok) {
    return { ok: false, mode: domain.renderMode, errors: ['validation failed'] };
  }
  if (domain.renderMode === 'png') {
    return renderToPng(domain, validation.cleanedCode, outDir, runId, renderWaitMs);
  }
  return receiptCheck(domain, validation.cleanedCode);
}

async function writeCodeArtifact(domain, code, outDir, runId) {
  const codePath = path.join(outDir, `${runId}-${domain.id}.${domain.artifactExtension}`);
  await fs.writeFile(codePath, code, 'utf8');
  return codePath;
}

async function runDomain(domain, options, runId) {
  const startedAt = new Date().toISOString();
  const prompt = promptFor(domain, runId);
  const generated = await generateForDomain(domain, prompt, options.timeoutMs);
  if (generated.ok) {
    generated.artifact = await writeCodeArtifact(domain, generated.code, options.outDir, runId);
  }

  const validation = generated.ok
    ? validateForDomain(domain, generated.code)
    : { ok: false, cleanedCode: '', cleanedBytes: 0, errors: ['generation failed'], validator: `CodeValidator(${domain.validationDomain})` };
  const render = await renderOrReceipt(domain, validation, options.outDir, runId, options.renderWaitMs);
  const finishedAt = new Date().toISOString();
  const receipt = buildDomainReceipt({ domain: domain.id, prompt, generated: redactCode(generated), validation: redactCode(validation), render, startedAt, finishedAt });
  const receiptPath = path.join(options.outDir, `${runId}-${domain.id}.receipt.json`);
  await fs.writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  return { ...receipt, receiptPath };
}

function redactCode(value) {
  const copy = { ...value };
  delete copy.code;
  delete copy.cleanedCode;
  return copy;
}

function auditMarkdown(receipts, runId) {
  const pass = receipts.filter((receipt) => receipt.status === 'PASS').map((receipt) => receipt.domain);
  const fail = receipts.filter((receipt) => receipt.status === 'FAIL').map((receipt) => receipt.domain);
  const previewDescription = (domain) => {
    if (domain.renderMode === 'receipt') return 'code receipt check';
    if (domain.id === 'kinetic') return 'headless PNG via KineticWrapper/render pattern';
    return 'headless PNG via HTMLWrapper/render pattern';
  };
  return [
    '# Domain Gauntlet Audit - 2026-06-08',
    '',
    `Run id: \`${runId}\``,
    '',
    'This audit enumerates the FINISH_LINE creative domains and runs the product generator, CodeValidator path, and render-or-receipt smoke for each one. Prompts include a run-specific never-used nonce to avoid stale generation cache hits.',
    '',
    buildMarkdownTable(receipts),
    '',
    `PASS domains: ${pass.length ? pass.map((domain) => `\`${domain}\``).join(', ') : 'none'}.`,
    '',
    `FAIL domains: ${fail.length ? fail.map((domain) => `\`${domain}\``).join(', ') : 'none'}.`,
    '',
    'Generation/validation/preview map:',
    '',
    ...DOMAIN_GAUNTLET_DOMAINS.map((domain) => `- ${domain.id}: generator \`${domain.generator}\`, validator \`CodeValidator(${domain.validationDomain})\`${domain.hasDedicatedValidator ? '' : ' fallback only; no dedicated domain validator'}, ${previewDescription(domain)}.`),
    '',
    'Notes:',
    '',
    '- `scripts/domains/passing-domains.json` is a conservative CI ratchet floor, not the full live scoreboard; domains move into it only after repeatable gauntlet and visual-quality evidence.',
    '- `glsl` uses the existing `shader` generator entry and validates through the GLSL validator family.',
    '- `kinetic` now has a dedicated domain validator, but remains outside the ratchet floor until repeatable gauntlet and visual-quality evidence justify locking it.',
    '- `hydra` and `three` are intentionally not in the ratchet floor yet: they can pass the mechanical gauntlet, but fresh headless screenshots still need visual-quality hardening before they are treated as perfect.',
  ].join('\n');
}

export async function runCli(argv) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(usage());
    return 0;
  }
  if (!options.all && !options.domain) throw new Error(`${usage()}\n\nMissing --all or --domain <domain>`);
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) throw new Error('--timeout-ms must be a positive number');
  if (!Number.isFinite(options.renderWaitMs) || options.renderWaitMs < 0) throw new Error('--render-wait-ms must be a non-negative number');

  await fs.mkdir(options.outDir, { recursive: true });
  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  await registerAllGenerators();

  const domains = selectDomains(options);
  const receipts = [];
  for (const domain of domains) {
    console.log(`[gauntlet] ${domain.id}: generate -> validate -> ${domain.renderMode}`);
    const receipt = await runDomain(domain, options, runId);
    receipts.push(receipt);
    console.log(`[gauntlet] ${domain.id}: ${receipt.status}${receipt.failureReason ? ` (${receipt.failureReason})` : ''}`);
  }

  const table = buildMarkdownTable(receipts);
  console.log(table);

  const summaryPath = path.join(options.outDir, `${runId}-summary.json`);
  await fs.writeFile(summaryPath, `${JSON.stringify({ runId, receipts }, null, 2)}\n`, 'utf8');
  if (options.markdown) {
    await fs.mkdir(path.dirname(options.markdown), { recursive: true });
    await fs.writeFile(options.markdown, `${auditMarkdown(receipts, runId)}\n`, 'utf8');
  }

  let ratchetExitCode = 0;
  if (options.ratchet) {
    try {
      const ratchetConfig = JSON.parse(await fs.readFile(path.join(process.cwd(), 'scripts/domains/passing-domains.json'), 'utf8'));
      const failedPassingDomains = receipts.filter((r) => r.status === 'FAIL' && ratchetConfig.includes(r.domain));
      if (failedPassingDomains.length > 0) {
        console.error(`\n[RATCHET] ERROR: The following domains were expected to pass but failed:`);
        failedPassingDomains.forEach((f) => console.error(`  - ${f.domain}: ${f.failureReason}`));
        ratchetExitCode = 1;
      } else {
        console.log(`\n[RATCHET] SUCCESS: All expected domains passed.`);
      }
    } catch (e) {
      console.error(`\n[RATCHET] ERROR: Could not read passing-domains.json (${e.message})`);
      ratchetExitCode = 1;
    }
  }

  if (options.strict && receipts.some((receipt) => receipt.status === 'FAIL')) return 1;
  return ratchetExitCode || 0;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  runCli(process.argv.slice(2)).then((code) => {
    process.exit(code);
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
