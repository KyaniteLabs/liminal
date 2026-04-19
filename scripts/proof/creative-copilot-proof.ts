#!/usr/bin/env tsx
/**
 * Creative copilot automated proof runner.
 *
 * Runs representative creative prompts through Liminal generators and writes
 * durable artifacts, screenshot previews, JSON, Markdown, and issue evidence.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer';
import sharp from 'sharp';

import { LLMClient, type LLMConfig } from '../../src/llm/LLMClient.js';
import { getProviderConfig, type ProviderType } from '../../src/harness/MultiProviderConfig.js';
import { P5GeneratorV2 } from '../../src/generators/p5/P5GeneratorV2.js';
import { ShaderGenerator } from '../../src/generators/glsl/ShaderGenerator.js';
import { ThreeGenerator } from '../../src/generators/three/ThreeGenerator.js';
import { KineticGenerator } from '../../src/generators/kinetic/KineticGenerator.js';
import { ASCIIArtGenerator } from '../../src/generators/ascii/ASCIIArtGenerator.js';
import { TextGenerativeGenerator } from '../../src/generators/textgen/TextGenerativeGenerator.js';
import { StrudelGenerator } from '../../src/generators/strudel/StrudelGenerator.js';
import { HydraGenerator } from '../../src/generators/hydra/HydraGenerator.js';
import { ToneGenerator } from '../../src/generators/tone/ToneGenerator.js';
import { RevideoGenerator } from '../../src/generators/revideo/RevideoGenerator.js';
import { createColorTheoryPalette, type ColorTheoryPalette } from '../../src/aesthetic/ColorTheoryEngine.js';

type DomainName = 'p5' | 'shader' | 'three' | 'kinetic' | 'ascii' | 'textgen' | 'strudel' | 'hydra' | 'tone' | 'revideo';
type Status = 'pass' | 'fail' | 'blocked';
type PreviewKind = 'image' | 'inline-text' | 'code-display' | 'audio-playable' | 'audio-external' | 'video-code' | 'blocked';

interface DomainSpec {
  domain: DomainName;
  prompt: string;
  artifactExtension: 'js' | 'html' | 'txt';
  previewKind: PreviewKind;
  generator: new (llm?: LLMClient | Partial<LLMConfig>) => {
    generate(prompt: string, options?: unknown): Promise<string> | string;
    wrapForGallery?: (code: string) => string;
  };
}

interface DomainResult {
  domain: DomainName;
  status: Status;
  previewKind: PreviewKind;
  prompt?: string;
  colorTheoryGuidance?: string;
  generationAttempts?: number;
  previewAttempts?: number;
  provider: string;
  model: string;
  artifactPath?: string;
  htmlPath?: string;
  screenshotPath?: string;
  durationMs: number;
  error?: string;
  notes?: string[];
}

interface ProofReport {
  generatedAt: string;
  provider: string;
  model: string;
  dryRun: boolean;
  outputDir: string;
  colorTheory: ColorTheoryPalette;
  summary: { total: number; passed: number; failed: number; blocked: number };
  results: DomainResult[];
  issues: Array<{
    domain: DomainName;
    severity: 'p0' | 'p1' | 'p2';
    failureClass: string;
    error: string;
    recommendedFix: string;
  }>;
}

const DOMAIN_SPECS: DomainSpec[] = [
  { domain: 'p5', artifactExtension: 'js', previewKind: 'image', generator: P5GeneratorV2, prompt: 'Create an interactive cybernetic koi pond at night with glowing koi fish, ripples following the mouse, neon lily pads, and drifting fireflies. Return concise raw p5.js sketch code only, no HTML document, no markdown fences, keep under 180 lines.' },
  { domain: 'shader', artifactExtension: 'js', previewKind: 'image', generator: ShaderGenerator, prompt: 'Create a GLSL fragment shader with bioluminescent waves and slow domain-warped color fields.' },
  { domain: 'three', artifactExtension: 'js', previewKind: 'image', generator: ThreeGenerator, prompt: 'Create a Three.js scene with a glowing crystalline garden, orbiting camera, and floating particles.' },
  { domain: 'kinetic', artifactExtension: 'html', previewKind: 'image', generator: KineticGenerator, prompt: 'Create a CSS-only kinetic artwork: abstract animated typography and shapes, no landing page, no marketing copy, no JavaScript, just expressive motion.' },
  { domain: 'hydra', artifactExtension: 'js', previewKind: 'image', generator: HydraGenerator, prompt: 'Create a Hydra video-synth patch with neon feedback, kaleidoscope geometry, and slow color drift. Use bright visible generated sources only.' },
  { domain: 'ascii', artifactExtension: 'txt', previewKind: 'inline-text', generator: ASCIIArtGenerator, prompt: 'Create ASCII art of a moonlit koi pond with glowing water and fireflies.' },
  { domain: 'textgen', artifactExtension: 'txt', previewKind: 'inline-text', generator: TextGenerativeGenerator, prompt: 'Create a concrete poem shaped like ripples in a nocturnal koi pond.' },
  { domain: 'strudel', artifactExtension: 'js', previewKind: 'audio-external', generator: StrudelGenerator, prompt: 'Create a Strudel pattern for a nocturnal koi pond: soft bells, water-like delay, and slow pulse.' },
  { domain: 'tone', artifactExtension: 'js', previewKind: 'audio-playable', generator: ToneGenerator, prompt: 'Create a Tone.js ambient patch with slow bell-like notes, filtered shimmer, delay, and reverb.' },
  { domain: 'revideo', artifactExtension: 'js', previewKind: 'video-code', generator: RevideoGenerator, prompt: 'Create a Revideo kinetic title scene for “Nocturnal Pond” with glowing text and slow reveal.' },
];

const DEFAULT_GENERATION_TIMEOUT_MS = 120_000;
const PROOF_COLOR_THEORY = createColorTheoryPalette({
  seed: '#2563eb',
  harmonyMode: 'split-complementary',
  temperatureBalance: 'cool',
  contrastTarget: 4.5,
});

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (name: string) => {
    const prefix = `--${name}=`;
    return args.find(arg => arg.startsWith(prefix))?.slice(prefix.length);
  };
  const domainsArg = get('domains');
  return {
    provider: (get('provider') || 'glm') as ProviderType,
    domains: args.includes('--all') || !domainsArg
      ? DOMAIN_SPECS.map(spec => spec.domain)
      : domainsArg.split(',').map(v => v.trim()).filter(Boolean) as DomainName[],
    dryRun: args.includes('--dry'),
    outputRoot: get('out') || path.join('.omx', 'proof', 'creative-copilot'),
    maxTokens: Number(get('max-tokens') || 4096),
    generationTimeoutMs: Number(get('timeout-ms') || DEFAULT_GENERATION_TIMEOUT_MS),
  };
}

function slug(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

async function writeJson(filePath: string, value: unknown) {
  await fs.writeFile(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

async function renderScreenshot(htmlPath: string, screenshotPath: string): Promise<void> {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  let page: Awaited<ReturnType<typeof browser.newPage>> | null = null;
  const runtimeErrors: string[] = [];
  try {
    page = await browser.newPage();
    page.on('console', msg => {
      if (msg.type() === 'error') runtimeErrors.push(msg.text());
    });
    page.on('pageerror', err => runtimeErrors.push(err.message));
    await page.setViewport({ width: 960, height: 640 });
    await page.goto(pathToFileURL(path.resolve(htmlPath)).href, { waitUntil: 'load', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    if (runtimeErrors.length > 0) {
      throw new Error(`Preview runtime error: ${runtimeErrors.slice(0, 3).join(' | ')}`);
    }
    await page.screenshot({ path: screenshotPath, type: 'png', fullPage: false });
  } finally {
    if (page) await page.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

async function validateScreenshotVisible(screenshotPath: string): Promise<string | null> {
  const stats = await sharp(screenshotPath).stats();
  const channels = stats.channels.slice(0, 3);
  const avgStdDev = channels.reduce((sum, channel) => sum + channel.stdev, 0) / channels.length;
  const maxSpread = Math.max(...channels.map(channel => channel.max - channel.min));
  return avgStdDev < 0.5 || maxSpread < 2
    ? `Screenshot appears blank (avg RGB stdev ${avgStdDev.toFixed(2)}, max channel spread ${maxSpread}).`
    : null;
}

function wrapArtifact(spec: DomainSpec, code: string): string {
  if (spec.artifactExtension === 'html') return code;
  if (spec.generator.prototype.wrapForGallery) {
    return spec.generator.prototype.wrapForGallery.call(Object.create(spec.generator.prototype), code);
  }
  const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${spec.domain}</title></head>
<body style="margin:0;background:#111;color:#eee;font-family:monospace;display:flex;min-height:100vh;align-items:center;justify-content:center">
<pre>${escaped}</pre>
</body>
</html>`;
}

function shouldRenderScreenshot(kind: PreviewKind): boolean {
  return kind === 'image' || kind === 'inline-text';
}

function nativePendingNote(kind: PreviewKind): string | null {
  if (kind === 'audio-playable') return 'Playable Tone.js HTML artifact saved; click Play in the HTML page to hear it.';
  if (kind === 'audio-external') return 'Native Strudel audio capture pending; saved pattern with external playback link.';
  if (kind === 'video-code') return 'Native rendered video/still proof pending; saved generated Revideo code only.';
  return null;
}

function promptWithColorTheory(prompt: string): string {
  return [
    prompt,
    '',
    'Launch color theory guidance:',
    PROOF_COLOR_THEORY.guidance,
    'Apply this palette as a principle-based design system, not as a brand or artist imitation.',
  ].join('\n');
}

async function runDomain(spec: DomainSpec, llm: LLMClient, outDir: string, provider: string, model: string, dryRun: boolean, generationTimeoutMs: number): Promise<DomainResult> {
  const started = Date.now();
  const base = slug(spec.domain);
  const artifactPath = path.join(outDir, `${base}.${spec.artifactExtension}`);
  const htmlPath = path.join(outDir, `${base}.html`);
  const screenshotPath = path.join(outDir, `${base}.png`);

  if (dryRun) {
    return {
      domain: spec.domain,
      status: 'blocked',
      previewKind: spec.previewKind,
      prompt: promptWithColorTheory(spec.prompt),
      colorTheoryGuidance: PROOF_COLOR_THEORY.guidance,
      generationAttempts: 0,
      previewAttempts: 0,
      provider,
      model,
      durationMs: 0,
      notes: ['Dry run: no provider call made.'],
    };
  }

  try {
    const generator = new spec.generator(llm);
    const notes: string[] = [];
    let code: string;
    let generationAttempts = 1;
    let previewAttempts = 0;
    const generateWithTimeout = async (prompt: string): Promise<string> => {
      const controller = new AbortController();
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          Promise.resolve(generator.generate(prompt, { signal: controller.signal })),
          new Promise<string>((_, reject) => {
            timeout = setTimeout(() => {
              controller.abort();
              reject(new Error(`Generation timed out after ${generationTimeoutMs / 1000}s`));
            }, generationTimeoutMs);
          }),
        ]);
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    };

    try {
      code = await generateWithTimeout(promptWithColorTheory(spec.prompt));
    } catch (firstErr) {
      const reason = firstErr instanceof Error ? firstErr.message : String(firstErr);
      generationAttempts++;
      code = await generateWithTimeout([
        promptWithColorTheory(spec.prompt),
        '',
        `Previous generation failed validation: ${reason}`,
        `Regenerate a valid ${spec.domain} artifact that directly fixes that failure.`,
        'Return only the final artifact. Do not include prose or markdown fences.',
      ].join('\n'));
      notes.push(`Recovered after generation retry: ${reason}`);
    }

    if (!code || code.trim().length === 0) throw new Error('Generator returned empty output');
    await fs.writeFile(artifactPath, code, 'utf8');
    let html = wrapArtifact(spec, code);
    await fs.writeFile(htmlPath, html, 'utf8');

    let status: Status = 'pass';
    let screenshotWritten = false;
    const retryPreview = async (reason: string): Promise<string | null> => {
      generationAttempts++;
      const retryCode = await generateWithTimeout([
        promptWithColorTheory(spec.prompt),
        '',
        `Previous preview failed: ${reason}`,
        'Regenerate the artifact so the preview is visibly nonblank in a headless browser screenshot.',
        'Use bright visible output and avoid black-only frames.',
      ].join('\n'));
      if (!retryCode || retryCode.trim().length === 0) return 'Preview retry returned empty output.';
      code = retryCode;
      await fs.writeFile(artifactPath, code, 'utf8');
      html = wrapArtifact(spec, code);
      await fs.writeFile(htmlPath, html, 'utf8');
      previewAttempts++;
      await renderScreenshot(htmlPath, screenshotPath);
      return validateScreenshotVisible(screenshotPath);
    };

    const pendingNote = nativePendingNote(spec.previewKind);
    if (pendingNote) notes.push(pendingNote);
    if (spec.previewKind === 'video-code') status = 'blocked';

    if (shouldRenderScreenshot(spec.previewKind)) {
      try {
        previewAttempts++;
        await renderScreenshot(htmlPath, screenshotPath);
        screenshotWritten = true;
        const blankReason = await validateScreenshotVisible(screenshotPath);
        if (blankReason) {
          const retryReason = spec.previewKind === 'image' ? await retryPreview(blankReason) : blankReason;
          screenshotWritten = true;
          if (retryReason) {
            status = 'fail';
            notes.push(retryReason);
          } else {
            notes.push(`Recovered after preview retry: ${blankReason}`);
          }
        }
      } catch (err) {
        const reason = `Screenshot render failed: ${err instanceof Error ? err.message : String(err)}`;
        if (spec.previewKind === 'image') {
          try {
            const retryReason = await retryPreview(reason);
            screenshotWritten = true;
            if (retryReason) {
              status = 'fail';
              notes.push(retryReason);
            } else {
              notes.push(`Recovered after preview retry: ${reason}`);
            }
          } catch (retryErr) {
            status = 'fail';
            notes.push(`Preview retry failed: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`);
          }
        } else {
          status = 'blocked';
          notes.push(reason);
        }
      }
    }

    return {
      domain: spec.domain,
      status,
      previewKind: spec.previewKind,
      prompt: promptWithColorTheory(spec.prompt),
      colorTheoryGuidance: PROOF_COLOR_THEORY.guidance,
      generationAttempts,
      previewAttempts,
      provider,
      model,
      artifactPath,
      htmlPath,
      screenshotPath: screenshotWritten ? screenshotPath : undefined,
      durationMs: Date.now() - started,
      notes: notes.length > 0 ? notes : undefined,
    };
  } catch (err) {
    const context = err && typeof err === 'object' && 'context' in err ? (err as { context?: Record<string, unknown> }).context : undefined;
    const generatedCode = typeof context?.generatedCode === 'string' ? context.generatedCode : '';
    const notes: string[] = [];
    let screenshotWritten = false;
    if (generatedCode.trim()) {
      await fs.writeFile(artifactPath, generatedCode, 'utf8');
      notes.push('Saved failed generated output for remediation.');
      try {
        const html = wrapArtifact(spec, generatedCode);
        await fs.writeFile(htmlPath, html, 'utf8');
        if (spec.previewKind === 'code-display' || spec.previewKind === 'inline-text') {
          await renderScreenshot(htmlPath, screenshotPath);
          screenshotWritten = true;
          notes.push('Saved screenshot of failed output for inspection.');
        }
      } catch (previewErr) {
        notes.push(`Failed-output preview render failed: ${previewErr instanceof Error ? previewErr.message : String(previewErr)}`);
      }
    }
    return {
      domain: spec.domain,
      status: 'fail',
      previewKind: spec.previewKind,
      prompt: promptWithColorTheory(spec.prompt),
      colorTheoryGuidance: PROOF_COLOR_THEORY.guidance,
      provider,
      model,
      artifactPath,
      htmlPath: generatedCode.trim() ? htmlPath : undefined,
      screenshotPath: screenshotWritten ? screenshotPath : undefined,
      durationMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
      notes: notes.length > 0 ? notes : undefined,
    };
  }
}

function issueFor(result: DomainResult): ProofReport['issues'][number] | null {
  if (result.status === 'pass') return null;
  const error = result.error || result.notes?.join('; ') || 'No artifact/preview produced';
  return {
    domain: result.domain,
    severity: result.domain === 'p5' ? 'p0' : 'p1',
    failureClass: result.status === 'blocked' ? 'preview_or_provider_blocked' : 'generation_or_validation_failed',
    error,
    recommendedFix: result.status === 'blocked' ? 'Implement or document this domain preview path before manual launch testing.' : `Fix ${result.domain} generator/validator so it produces a valid artifact and preview.`,
  };
}

function markdownReport(report: ProofReport): string {
  const lines = [
    '# Creative Copilot Proof Report',
    '',
    `Generated: ${report.generatedAt}`,
    `Provider: ${report.provider}`,
    `Model: ${report.model}`,
    `Dry run: ${report.dryRun}`,
    `Output dir: ${report.outputDir}`,
    `Color theory: ${report.colorTheory.harmonyMode} / ${report.colorTheory.temperatureBalance} / ${report.colorTheory.colors.map(color => `${color.role} ${color.hex}`).join(', ')}`,
    '',
    `Summary: ${report.summary.passed} pass, ${report.summary.failed} fail, ${report.summary.blocked} blocked / ${report.summary.total} total`,
    '',
    '| Domain | Status | Preview | Gen attempts | Preview attempts | Artifact | Screenshot | Error |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...report.results.map(result => [
      result.domain,
      result.status,
      result.previewKind,
      result.generationAttempts ?? '',
      result.previewAttempts ?? '',
      result.artifactPath || '',
      result.screenshotPath || '',
      result.error || result.notes?.join('; ') || '',
    ].map(cell => String(cell).replace(/\|/g, '\\|')).join(' | ')).map(row => `| ${row} |`),
    '',
    '## Color Theory Guidance',
    '',
    report.colorTheory.guidance,
    '',
    '## Issues',
    '',
    ...(report.issues.length === 0 ? ['No issues recorded.'] : report.issues.flatMap(issue => [`### ${issue.domain} (${issue.severity})`, '', `- Failure class: ${issue.failureClass}`, `- Error: ${issue.error}`, `- Recommended fix: ${issue.recommendedFix}`, ''])),
  ];
  return lines.join('\n');
}

async function main() {
  const options = parseArgs();
  const providerConfig = getProviderConfig(options.provider);
  const providerName = options.provider;
  const model = providerConfig?.model || 'unknown';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(options.outputRoot, timestamp);
  await fs.mkdir(outDir, { recursive: true });

  if (!providerConfig?.apiKey && !['lmstudio', 'ollama'].includes(providerName)) {
    const report: ProofReport = {
      generatedAt: new Date().toISOString(),
      provider: providerName,
      model,
      dryRun: options.dryRun,
      outputDir: outDir,
      colorTheory: PROOF_COLOR_THEORY,
      summary: { total: options.domains.length, passed: 0, failed: 0, blocked: options.domains.length },
      results: options.domains.map(domain => {
        const spec = DOMAIN_SPECS.find(item => item.domain === domain);
        return {
          domain,
          status: 'blocked',
          previewKind: spec?.previewKind || 'blocked',
          prompt: spec ? promptWithColorTheory(spec.prompt) : undefined,
          colorTheoryGuidance: PROOF_COLOR_THEORY.guidance,
          generationAttempts: 0,
          previewAttempts: 0,
          provider: providerName,
          model,
          durationMs: 0,
          error: `Provider ${providerName} is not configured`,
        };
      }),
      issues: [],
    };
    report.issues = report.results.map(issueFor).filter(Boolean) as ProofReport['issues'];
    await writeJson(path.join(outDir, 'report.json'), report);
    await fs.writeFile(path.join(outDir, 'report.md'), markdownReport(report), 'utf8');
    console.log(`Report: ${path.join(outDir, 'report.md')}`);
    process.exit(1);
  }

  const llm = new LLMClient({ baseUrl: providerConfig?.baseUrl || '', model, apiKey: providerConfig?.apiKey, temperature: 0.7, maxTokens: options.maxTokens });
  const specs = options.domains.map(domain => DOMAIN_SPECS.find(spec => spec.domain === domain)).filter(Boolean) as DomainSpec[];
  const results: DomainResult[] = [];
  for (const spec of specs) {
    console.log(`Running ${spec.domain}...`);
    const result = await runDomain(spec, llm, outDir, providerName, model, options.dryRun, options.generationTimeoutMs);
    results.push(result);
    console.log(`${spec.domain}: ${result.status}${result.error ? ` - ${result.error}` : ''}`);
  }

  const report: ProofReport = { generatedAt: new Date().toISOString(), provider: providerName, model, dryRun: options.dryRun, outputDir: outDir, colorTheory: PROOF_COLOR_THEORY, summary: { total: results.length, passed: results.filter(r => r.status === 'pass').length, failed: results.filter(r => r.status === 'fail').length, blocked: results.filter(r => r.status === 'blocked').length }, results, issues: results.map(issueFor).filter(Boolean) as ProofReport['issues'] };
  await writeJson(path.join(outDir, 'report.json'), report);
  await fs.writeFile(path.join(outDir, 'report.md'), markdownReport(report), 'utf8');
  console.log(`Report: ${path.join(outDir, 'report.md')}`);
  console.log(`Summary: ${report.summary.passed} pass, ${report.summary.failed} fail, ${report.summary.blocked} blocked`);
  process.exit(report.summary.failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
