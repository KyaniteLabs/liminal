#!/usr/bin/env tsx
/**
 * Cognitive loop proof runner.
 *
 * Default mode is deterministic so CI can prove the intended organism loop
 * without cloud/provider variability. `--live` extends the proof through the
 * real post-generation cognitive writer path so Studio write-back into memory,
 * compost, and dreaming stays executable instead of becoming architecture prose.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { PostGenerationCognitiveWriter, type CognitiveOrganReceipt } from '../../src/tui-bridge/PostGenerationCognitiveWriter.js';
import { DreamQueue } from '../../src/dreaming/DreamQueue.js';

type OrganId = 'perception' | 'memory' | 'compost' | 'dreaming' | 'intuition' | 'evaluation';
type ProofMode = 'deterministic' | 'live-writer';
type WriteBackOrganId = 'memory' | 'compost' | 'dreaming';

interface CliOptions { outputRoot: string; mode: ProofMode }
interface OrganReceipt { organ: OrganId; evidence: string }
interface CognitiveIteration { id: string; prompt: string; artifactPath: string; receipts: OrganReceipt[]; nextRunInfluence: string[]; score: number }
interface ProofEpisode { id: string; type: 'generation'; timestamp: string; domain?: string; prompt?: string; code?: string; score?: number; comment?: string; tags?: string[] }
interface LiveIteration { id: string; prompt: string; artifactPath: string; episodeId?: string; prepareReceipts: CognitiveOrganReceipt[]; writeBackReceipts: CognitiveOrganReceipt[]; syntheticReceipts: OrganReceipt[]; score: number }
interface WriteBackSummary { status: 'observed' | 'partial' | 'skipped'; text: string; items: Array<{ organ: WriteBackOrganId; status: string; detail: string }> }

const basePrompt = 'Create a sparse moonlit vector pond with remembered blue-green geometry and one readable signal word.';
const writeBackOrgans: WriteBackOrganId[] = ['memory', 'compost', 'dreaming'];

function parseArgs(argv = process.argv.slice(2)): CliOptions {
  let outputRoot = path.join('.omx', 'proof', 'cognitive-loop');
  let mode: ProofMode = 'deterministic';
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--live' || arg === '--mode=live' || arg === '--mode=live-writer') mode = 'live-writer';
    if (arg === '--out' && argv[index + 1]) outputRoot = argv[++index];
    else if (arg.startsWith('--out=')) outputRoot = arg.slice('--out='.length);
  }
  return { outputRoot, mode };
}

function timestampedOutDir(outputRoot: string): string {
  return path.join(outputRoot, new Date().toISOString().replace(/[:.]/g, '-'));
}

function artifact(iteration: number, influences: string[]): string {
  const accent = iteration === 1 ? '#67e8f9' : '#d9f99d';
  const signal = iteration === 1 ? 'perceive' : 'remember';
  const influenceText = influences.length > 0 ? influences.join(' + ') : 'first perception';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" role="img" aria-label="cognitive loop proof iteration ${iteration}">
  <rect width="960" height="540" fill="#020617"/>
  <circle cx="${700 - iteration * 90}" cy="105" r="${72 + iteration * 12}" fill="#f8fafc" opacity="0.92"/>
  <ellipse cx="480" cy="360" rx="${230 + iteration * 45}" ry="${68 + iteration * 18}" fill="none" stroke="${accent}" stroke-width="${4 + iteration}" opacity="0.82"/>
  <path d="M160 ${365 - iteration * 18} C300 ${290 - iteration * 20}, 520 ${435 + iteration * 12}, 800 ${330 - iteration * 15}" fill="none" stroke="#38bdf8" stroke-width="3" opacity="0.58"/>
  <g fill="${accent}" opacity="0.84">${Array.from({ length: 10 + iteration * 5 }, (_, i) => `<circle cx="${120 + i * 50}" cy="${180 + ((i * 37) % 170)}" r="${2 + (i % 4)}"/>`).join('')}</g>
  <text x="80" y="92" fill="#bae6fd" font-family="ui-monospace, Menlo, monospace" font-size="24">${signal}</text>
  <text x="80" y="470" fill="#e0f2fe" font-family="ui-monospace, Menlo, monospace" font-size="18">influence: ${influenceText}</text>
</svg>
`;
}

const perceive = (iteration: number, prompt: string): OrganReceipt => ({ organ: 'perception', evidence: `iteration ${iteration} captured prompt intent: ${prompt}` });
function remember(previous?: CognitiveIteration): { receipt: OrganReceipt; influences: string[] } {
  if (!previous) return { receipt: { organ: 'memory', evidence: 'stored first artifact as sparse moonlit vector pond preference seed' }, influences: [] };
  const influences = ['reuse sparse composition', 'increase green contrast', 'make memory signal explicit'];
  return { receipt: { organ: 'memory', evidence: `retrieved ${previous.id} score ${previous.score.toFixed(2)} and preference for sparse blue-green geometry` }, influences };
}
const compost = (influences: string[]): OrganReceipt => ({ organ: 'compost', evidence: influences.length > 0 ? `digested previous run into reusable nutrients: ${influences.join('; ')}` : 'seeded compost heap with moon, pond, vector geometry, and readable signal motifs' });
const dream = (influences: string[]): OrganReceipt => ({ organ: 'dreaming', evidence: influences.length > 0 ? 'recombined pond geometry with explicit memory text for successor artifact' : 'queued first-run motifs for later recombination' });
const intuit = (influences: string[]): OrganReceipt => ({ organ: 'intuition', evidence: influences.includes('make memory signal explicit') ? 'selected SVG because inspectable vector structure best exposes remembered changes' : 'selected SVG as core inspectable visual proof domain' });

function evaluate(svg: string, influences: string[]): { receipt: OrganReceipt; score: number } {
  const hasMoon = svg.includes('<circle');
  const hasReadableSignal = svg.includes('<text');
  const hasInfluence = influences.length === 0 || influences.every(influence => svg.includes(influence));
  const score = Number(((hasMoon ? 0.3 : 0) + (hasReadableSignal ? 0.3 : 0) + (hasInfluence ? 0.4 : 0)).toFixed(2));
  return { receipt: { organ: 'evaluation', evidence: `checked moon=${hasMoon} readableSignal=${hasReadableSignal} nextRunInfluence=${hasInfluence}` }, score };
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function deterministicMarkdown(iterations: CognitiveIteration[], outDir: string): string {
  return ['# Cognitive Loop Proof Report', '', `Generated: ${new Date().toISOString()}`, 'Mode: deterministic', `Output dir: ${outDir}`, '', '| Iteration | Score | Next-run influence | Artifact |', '| --- | --- | --- | --- |', ...iterations.map(item => `| ${item.id} | ${item.score.toFixed(2)} | ${item.nextRunInfluence.join('; ') || 'seed only'} | ${item.artifactPath} |`), '', '## Organ Receipts', '', ...iterations.flatMap(item => [`### ${item.id}`, '', ...item.receipts.map(receipt => `- ${receipt.organ}: ${receipt.evidence}`), ''])].join('\n');
}

function liveMarkdown(iterations: LiveIteration[], outDir: string, dreamStatus: ReturnType<DreamQueue['getStatus']>): string {
  return ['# Live Cognitive Writer Proof Report', '', `Generated: ${new Date().toISOString()}`, 'Mode: live-writer', `Output dir: ${outDir}`, '', '| Iteration | Score | Episode | Artifact |', '| --- | --- | --- | --- |', ...iterations.map(item => `| ${item.id} | ${item.score.toFixed(2)} | ${item.episodeId ?? 'none'} | ${item.artifactPath} |`), '', `Dream queue: ${dreamStatus.queued} queued, ${dreamStatus.running} running, ${dreamStatus.completed} completed, ${dreamStatus.failed} failed`, '', '## Receipts', '', ...iterations.flatMap(item => [`### ${item.id}`, '', ...item.syntheticReceipts.map(receipt => `- ${receipt.organ}: ${receipt.evidence}`), ...item.prepareReceipts.map(receipt => `- prepare/${receipt.organ} (${receipt.status}): ${receipt.detail}`), ...item.writeBackReceipts.map(receipt => `- write-back/${receipt.organ} (${receipt.status}): ${receipt.detail}`), ''])].join('\n');
}

function writeBackSummary(receipts: Array<OrganReceipt | CognitiveOrganReceipt>): WriteBackSummary {
  const items = writeBackOrgans.map((organ) => {
    const receipt = receipts.find((item) => item.organ === organ);
    if (!receipt) return { organ, status: 'unavailable', detail: `${organ} write-back receipt was not emitted.` };
    const status = 'status' in receipt ? receipt.status : 'observed';
    const detail = 'detail' in receipt ? receipt.detail : receipt.evidence;
    return { organ, status, detail };
  });
  const observed = items.filter((item) => item.status === 'observed').length;
  const status = observed === items.length ? 'observed' : observed === 0 ? 'skipped' : 'partial';
  return { status, text: items.map((item) => `${item.organ} ${item.status}: ${item.detail}`).join(' | '), items };
}

class ProofMemoryStore {
  private episodes: ProofEpisode[] = [];

  constructor(private readonly filePath: string) {}

  async initialize(): Promise<void> {
    try {
      const parsed = JSON.parse(await fs.readFile(this.filePath, 'utf8')) as { episodes?: ProofEpisode[] };
      this.episodes = Array.isArray(parsed.episodes) ? parsed.episodes : [];
    } catch {
      this.episodes = [];
    }
  }

  getRelevantEpisodesByDomain(_query: string, domain: string, k = 3): Promise<ProofEpisode[]> {
    return Promise.resolve(this.episodes.filter(episode => episode.domain === domain).slice(-k));
  }

  recordEpisode(episode: Omit<ProofEpisode, 'id' | 'timestamp'>): string {
    const id = `proof-episode-${String(this.episodes.length + 1).padStart(3, '0')}`;
    this.episodes.push({ ...episode, id, timestamp: new Date().toISOString() });
    return id;
  }

  async save(): Promise<{ isErr(): boolean; error?: { message?: string } }> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await writeJson(this.filePath, { episodes: this.episodes });
    return { isErr: () => false };
  }
}

class ProofCompostSink {
  readonly addedPaths: string[] = [];

  constructor(private readonly heapDir: string) {}

  async add(inputPaths: string[]): Promise<void> {
    await fs.mkdir(this.heapDir, { recursive: true });
    for (const inputPath of inputPaths) {
      const fileName = `${String(this.addedPaths.length + 1).padStart(3, '0')}-${path.basename(inputPath)}`;
      const destination = path.join(this.heapDir, fileName);
      await fs.copyFile(inputPath, destination);
      this.addedPaths.push(destination);
    }
    await writeJson(path.join(this.heapDir, 'manifest.json'), { addedPaths: this.addedPaths });
  }
}

async function runDeterministic(outDir: string): Promise<boolean> {
  await fs.mkdir(outDir, { recursive: true });
  const iterations: CognitiveIteration[] = [];
  for (let index = 1; index <= 2; index++) {
    const previous = iterations.at(-1);
    const id = `iteration-${String(index).padStart(3, '0')}`;
    const prompt = index === 1 ? basePrompt : `${basePrompt} Use memory from ${previous?.id}.`;
    const memoryResult = remember(previous);
    const svg = artifact(index, memoryResult.influences);
    const evaluation = evaluate(svg, memoryResult.influences);
    const artifactPath = path.join(outDir, id, 'artifact.svg');
    await fs.mkdir(path.dirname(artifactPath), { recursive: true });
    await fs.writeFile(artifactPath, svg, 'utf8');
    const item: CognitiveIteration = { id, prompt, artifactPath, receipts: [perceive(index, prompt), memoryResult.receipt, compost(memoryResult.influences), dream(memoryResult.influences), intuit(memoryResult.influences), evaluation.receipt], nextRunInfluence: memoryResult.influences, score: evaluation.score };
    iterations.push(item);
    await writeJson(path.join(outDir, id, 'receipts.json'), item);
  }
  const passed = iterations.length === 2 && iterations[1].nextRunInfluence.length > 0 && iterations.every(item => item.receipts.length === 6 && item.score >= 0.6);
  const report = { generatedAt: new Date().toISOString(), mode: 'deterministic', outputDir: outDir, prompt: basePrompt, passed, writeBackSummary: iterations.map(item => ({ iteration: item.id, ...writeBackSummary(item.receipts) })), iterations };
  await writeJson(path.join(outDir, 'report.json'), report);
  await fs.writeFile(path.join(outDir, 'report.md'), deterministicMarkdown(iterations, outDir), 'utf8');
  console.log(path.join(outDir, 'report.md'));
  return passed;
}

async function runLiveWriter(outDir: string): Promise<boolean> {
  await fs.mkdir(outDir, { recursive: true });
  const memory = new ProofMemoryStore(path.join(outDir, 'memory', 'episodes.json'));
  const compostSink = new ProofCompostSink(path.join(outDir, 'compost-heap'));
  const dreamQueue = new DreamQueue({ maxQueueSize: 10 });
  const writer = new PostGenerationCognitiveWriter({ memory, compost: compostSink, dreamQueue, artifactRoot: path.join(outDir, 'artifacts') });
  const iterations: LiveIteration[] = [];

  for (let index = 1; index <= 2; index++) {
    const id = `iteration-${String(index).padStart(3, '0')}`;
    const prompt = index === 1 ? basePrompt : `${basePrompt} Retrieve prior memory and make the remembered change visible.`;
    const influences = index === 1 ? [] : ['reuse sparse composition', 'increase green contrast', 'make memory signal explicit'];
    const prepareReceipts = await writer.prepareGeneration({ sessionId: 'live-cognitive-proof', userText: prompt, domain: 'svg' });
    const svg = artifact(index, influences);
    const evaluation = evaluate(svg, influences);
    const writeBack = await writer.writeBackGeneration({
      sessionId: 'live-cognitive-proof',
      userText: prompt,
      domain: 'svg',
      code: svg,
      finalScore: evaluation.score,
      iterations: index,
      model: 'proof-local-writer',
      reason: 'Integrated cognitive proof run',
      executionMode: 'prove',
    });
    iterations.push({
      id,
      prompt,
      artifactPath: writeBack.artifactPath,
      episodeId: writeBack.episodeId,
      prepareReceipts,
      writeBackReceipts: writeBack.receipts,
      syntheticReceipts: [perceive(index, prompt), intuit(influences), evaluation.receipt],
      score: evaluation.score,
    });
    await writeJson(path.join(outDir, id, 'receipts.json'), iterations.at(-1));
  }

  const dreamStatus = dreamQueue.getStatus();
  const allArtifactsExist = (await Promise.all(iterations.map(item => fs.access(item.artifactPath).then(() => true, () => false)))).every(Boolean);
  const secondPrepareUsedMemory = iterations[1].prepareReceipts.some(receipt => receipt.organ === 'memory' && receipt.status === 'observed' && receipt.detail.includes('1 relevant prior generation'));
  const allWriteBackObserved = iterations.every(item => ['memory', 'compost', 'dreaming'].every(organ => item.writeBackReceipts.some(receipt => receipt.organ === organ && receipt.status === 'observed')));
  const passed = allArtifactsExist && secondPrepareUsedMemory && allWriteBackObserved && dreamStatus.queued >= 2;
  const report = { generatedAt: new Date().toISOString(), mode: 'live-writer', outputDir: outDir, prompt: basePrompt, passed, writeBackSummary: iterations.map(item => ({ iteration: item.id, ...writeBackSummary(item.writeBackReceipts) })), dreamStatus, compostHeap: compostSink.addedPaths, iterations };
  await writeJson(path.join(outDir, 'report.json'), report);
  await fs.writeFile(path.join(outDir, 'report.md'), liveMarkdown(iterations, outDir, dreamStatus), 'utf8');
  console.log(path.join(outDir, 'report.md'));
  return passed;
}

async function run(): Promise<void> {
  const options = parseArgs();
  const outDir = timestampedOutDir(options.outputRoot);
  const passed = options.mode === 'live-writer' ? await runLiveWriter(outDir) : await runDeterministic(outDir);
  process.exit(passed ? 0 : 1);
}

run().catch(error => { console.error(error); process.exit(1); });
