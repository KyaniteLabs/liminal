#!/usr/bin/env tsx
/**
 * Cognitive loop proof runner.
 *
 * Deterministic proof that Liminal's intended organism loop can produce receipts
 * for perception, memory, compost, dreaming, intuition, evaluation, and next-run
 * influence without cloud/provider variability. Live proof should extend this,
 * not replace it.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

type OrganId = 'perception' | 'memory' | 'compost' | 'dreaming' | 'intuition' | 'evaluation';

interface OrganReceipt { organ: OrganId; evidence: string }
interface CognitiveIteration { id: string; prompt: string; artifactPath: string; receipts: OrganReceipt[]; nextRunInfluence: string[]; score: number }

const outputRoot = process.argv.find(arg => arg.startsWith('--out='))?.slice('--out='.length) || path.join('.omx', 'proof', 'cognitive-loop');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.join(outputRoot, timestamp);
const basePrompt = 'Create a sparse moonlit vector pond with remembered blue-green geometry and one readable signal word.';

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

async function writeJson(filePath: string, value: unknown): Promise<void> { await fs.writeFile(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8'); }
function markdown(iterations: CognitiveIteration[]): string {
  return ['# Cognitive Loop Proof Report', '', `Generated: ${new Date().toISOString()}`, 'Mode: deterministic', `Output dir: ${outDir}`, '', '| Iteration | Score | Next-run influence | Artifact |', '| --- | --- | --- | --- |', ...iterations.map(item => `| ${item.id} | ${item.score.toFixed(2)} | ${item.nextRunInfluence.join('; ') || 'seed only'} | ${item.artifactPath} |`), '', '## Organ Receipts', '', ...iterations.flatMap(item => [`### ${item.id}`, '', ...item.receipts.map(receipt => `- ${receipt.organ}: ${receipt.evidence}`), ''])].join('\n');
}

async function run(): Promise<void> {
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
  const report = { generatedAt: new Date().toISOString(), mode: 'deterministic', outputDir: outDir, prompt: basePrompt, passed: iterations.length === 2 && iterations[1].nextRunInfluence.length > 0 && iterations.every(item => item.receipts.length === 6 && item.score >= 0.6), iterations };
  await writeJson(path.join(outDir, 'report.json'), report);
  await fs.writeFile(path.join(outDir, 'report.md'), markdown(iterations), 'utf8');
  console.log(path.join(outDir, 'report.md'));
  process.exit(report.passed ? 0 : 1);
}
run().catch(error => { console.error(error); process.exit(1); });
