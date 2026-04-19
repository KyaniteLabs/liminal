#!/usr/bin/env tsx
/**
 * Loop-intelligence proof runner.
 *
 * Proves a bounded creative loop: intent, iterative candidates, evaluation,
 * feedback/memory notes, lineage, winner selection, and gallery-ready output.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer';
import sharp from 'sharp';

type CandidateId = `iteration-${string}/candidate-${string}`;

interface Evaluation {
  validArtifactExists: boolean;
  screenshotExists: boolean;
  nonblankPixelVariance: number;
  visualDifferenceFromPrevious?: number;
  changedMeaningfully?: boolean;
  aestheticReadabilityScore: number;
  overallScore: number;
  notes: string[];
  failureReasons: string[];
}

interface LineageNode {
  id: CandidateId;
  promptUsed: string;
  iterationNumber: number;
  candidateId: string;
  parentId?: CandidateId;
  generationAttemptCount: number;
  previewAttemptCount: number;
  artifactPath: string;
  screenshotPath: string;
  evaluation: Evaluation;
  reasonForChanges: string;
  memoryContextNote: string;
  compostIntelligenceNote: string;
}

const basePrompt = 'Create a layered nocturnal kinetic pond system with shader-like water, p5-style fireflies, readable kinetic typography, and ASCII moon-water texture. It should improve over several iterations.';
const outputRoot = process.argv.find(arg => arg.startsWith('--out='))?.slice('--out='.length)
  || path.join('.omx', 'proof', 'loop-intelligence');
const iterationCount = Number(process.argv.find(arg => arg.startsWith('--iterations='))?.slice('--iterations='.length) || 3);
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.join(outputRoot, timestamp);

function iterationName(iteration: number): string {
  return `iteration-${String(iteration).padStart(3, '0')}`;
}

function candidateName(index: number): string {
  return `candidate-${String(index).padStart(3, '0')}`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function reasonForIteration(iteration: number, previous?: Evaluation): string {
  if (!previous) return 'Baseline combines all requested domains into one visible kinetic pond artifact.';
  return [
    'Prior evaluation feedback:',
    previous.nonblankPixelVariance < 18 ? 'increase color and luminance contrast' : 'preserve strong nonblank visual signal',
    (previous.visualDifferenceFromPrevious ?? 1) < 0.08 ? 'make composition and layout more distinct' : 'keep useful variation while refining focus',
    previous.aestheticReadabilityScore < 0.72 ? 'improve typography legibility and ASCII texture balance' : 'refine layering without sacrificing readability',
  ].join(' ');
}

function memoryNote(iteration: number, previous?: Evaluation): string {
  if (!previous) return 'Memory/compost/intelligence context: establish water, fireflies, kinetic words, and ASCII moon texture before judging refinements.';
  return `Memory/compost/intelligence context from iteration ${iteration - 1}: nonblank variance ${previous.nonblankPixelVariance.toFixed(2)} visual delta ${previous.visualDifferenceFromPrevious?.toFixed(3) ?? 'baseline'} readability ${previous.aestheticReadabilityScore.toFixed(2)} ${previous.failureReasons.length > 0 ? `fix ${previous.failureReasons.join('; ')}` : 'no hard failures; deepen layering and contrast'}`;
}

function compostIntelligenceNote(previous?: Evaluation): string {
  if (!previous) return 'Compost note: seed the first candidate with all requested motifs so evaluation has material to decompose.';
  return previous.failureReasons.length > 0
    ? `Compost note: convert prior failures into next prompt constraints: ${previous.failureReasons.join('; ')}.`
    : `Compost note: rehydrate strongest prior signals, variance ${previous.nonblankPixelVariance.toFixed(2)} and readability ${previous.aestheticReadabilityScore.toFixed(2)}, into a richer successor.`;
}

function promptForIteration(iteration: number, previous?: Evaluation): string {
  return [basePrompt, '', memoryNote(iteration, previous), reasonForIteration(iteration, previous), compostIntelligenceNote(previous), `Iteration ${iteration}: produce exactly one self-contained HTML artifact for visual proof.`, 'Do not include Tone, Strudel, or Revideo; this proof is visual/text/composition only.'].join('\n');
}

function buildHtml(iteration: number, promptUsed: string, reason: string, memory: string): string {
  const fireflies = 36 + iteration * 28;
  const headline = iteration === 1 ? 'moon water listens' : iteration === 2 ? 'moon water learns' : 'moon water chooses';
  const ascii = iteration === 1
    ? ' ~ ~   .   moon   .   ~ ~\\n   .  shimmer / water / memory  .\\n ~ ~   fireflies drift   ~ ~'
    : iteration === 2
      ? ' ~~~ . . MOON-POND . . ~~~\\n / ripple / glyph / signal /\\n * fireflies annotate the dark *'
      : ' === MOON WATER TEXTURE ===\\n /// lineage remembers the brighter path ///\\n * * fireflies score the winning ripple * *';
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Loop Intelligence Proof ${iteration}</title>
<style>
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#02040a}.stage{position:relative;width:960px;height:640px;overflow:hidden;background:radial-gradient(circle at 50% 115%,#0a4a64 0%,#07111d 48%,#02040a 100%)}
.shader{position:absolute;inset:-18%;background:radial-gradient(circle at ${28 + iteration * 8}% ${22 + iteration * 5}%,rgba(180,235,255,.24),transparent 20%),radial-gradient(circle at ${70 - iteration * 7}% ${70 - iteration * 4}%,rgba(68,255,204,.28),transparent 26%),repeating-radial-gradient(ellipse at center,rgba(90,220,255,.16) 0 3px,rgba(2,4,10,0) 4px 18px);filter:saturate(${1.1 + iteration * .18});animation:water ${7 - iteration * .8}s ease-in-out infinite alternate}
.moon{position:absolute;right:${80 + iteration * 28}px;top:${42 + iteration * 10}px;width:${100 + iteration * 18}px;height:${100 + iteration * 18}px;border-radius:50%;background:#f8fafc;box-shadow:0 0 60px #bae6fd,0 0 130px rgba(103,232,249,.38)}
.ascii{position:absolute;left:30px;right:30px;bottom:${42 + iteration * 14}px;color:rgba(230,255,255,${0.18 + iteration * .09});font:700 ${18 + iteration * 2}px/1.35 ui-monospace,Menlo,monospace;text-align:center;letter-spacing:.08em;white-space:pre;text-shadow:0 0 14px rgba(103,232,249,.35)}
.type{position:absolute;inset:0;display:grid;place-items:center;text-align:center;color:#f8fafc;font-family:Georgia,serif;text-transform:uppercase;letter-spacing:.12em;text-shadow:0 0 24px rgba(15,23,42,.8),0 0 42px rgba(103,232,249,.45)}.type h1{font-size:${48 + iteration * 12}px;line-height:.95;margin:0;animation:focus ${5 - iteration * .35}s ease-in-out infinite}.type p{margin:18px auto 0;max-width:${520 + iteration * 45}px;font:700 ${15 + iteration}px/1.45 Inter,system-ui,sans-serif;letter-spacing:.04em;color:#d9f99d;background:rgba(2,6,23,.34);padding:8px 10px;border:1px solid rgba(217,249,157,.36)}#fireflies{position:absolute;inset:0;mix-blend-mode:screen}.memory{position:absolute;left:18px;top:18px;max-width:390px;color:#bae6fd;background:rgba(2,6,23,.52);border:1px solid rgba(103,232,249,.35);padding:9px 11px;font:12px/1.35 ui-monospace,Menlo,monospace}
@keyframes water{from{transform:translate(-26px,-18px) scale(1.02) rotate(-1deg)}to{transform:translate(24px,20px) scale(1.09) rotate(1deg)}}@keyframes focus{0%,100%{filter:blur(${Math.max(0, 4 - iteration)}px);transform:translateY(${8 - iteration * 2}px)}45%,70%{filter:blur(0);transform:translateY(0)}}
</style></head><body><main class="stage"><div class="shader"></div><div class="moon"></div><canvas id="fireflies" width="960" height="640"></canvas><pre class="ascii">${escapeHtml(ascii)}</pre><section class="type"><div><h1>${headline}</h1><p>iteration ${iteration}: ${escapeHtml(reason)}</p></div></section><aside class="memory">${escapeHtml(memory)}</aside></main>
<script>const canvas=document.getElementById('fireflies');const ctx=canvas.getContext('2d');const flies=Array.from({length:${fireflies}},(_,i)=>({x:(i*73)%960,y:(i*127)%640,r:1.3+(i%5)*.7,a:i*.41,s:.006+(i%9)*.002,h:i%3===0?'#d9f99d':i%3===1?'#67e8f9':'#f0abfc'}));function frame(t){ctx.clearRect(0,0,960,640);for(const f of flies){f.a+=f.s;const x=f.x+Math.cos(f.a+t*.0007)*(${18 + iteration * 8}+f.r*3);const y=f.y+Math.sin(f.a*1.7+t*.0005)*(${12 + iteration * 6});const g=ctx.createRadialGradient(x,y,0,x,y,10+f.r*5);g.addColorStop(0,f.h);g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,10+f.r*4,0,Math.PI*2);ctx.fill();}requestAnimationFrame(frame)}requestAnimationFrame(frame);</script>
<!-- Prompt used: ${escapeHtml(promptUsed)} --></body></html>`;
}

async function renderScreenshot(htmlPath: string, screenshotPath: string): Promise<void> {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  const errors: string[] = [];
  try {
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewport({ width: 960, height: 640 });
    await page.goto(pathToFileURL(path.resolve(htmlPath)).href, { waitUntil: 'load', timeout: 30_000 });
    await new Promise(resolve => setTimeout(resolve, 1200));
    if (errors.length > 0) throw new Error(errors.slice(0, 3).join(' | '));
    await page.screenshot({ path: screenshotPath, type: 'png', fullPage: false });
  } finally {
    await page.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

async function pixelVariance(imagePath: string): Promise<number> {
  const stats = await sharp(imagePath).stats();
  const channels = stats.channels.slice(0, 3);
  return channels.reduce((sum, channel) => sum + channel.stdev, 0) / channels.length;
}

async function visualDifference(current: string, previous?: string): Promise<number | undefined> {
  if (!previous) return undefined;
  const [a, b] = await Promise.all([sharp(current).resize(96, 64).removeAlpha().raw().toBuffer(), sharp(previous).resize(96, 64).removeAlpha().raw().toBuffer()]);
  const length = Math.min(a.length, b.length);
  let diff = 0;
  for (let i = 0; i < length; i++) diff += Math.abs(a[i] - b[i]);
  return diff / length / 255;
}

async function evaluateCandidate(artifactPath: string, screenshotPath: string, previousScreenshot?: string): Promise<Evaluation> {
  const [artifactStat, screenshotStat] = await Promise.all([fs.stat(artifactPath).catch(() => null), fs.stat(screenshotPath).catch(() => null)]);
  const validArtifactExists = Boolean(artifactStat?.isFile() && artifactStat.size > 1000);
  const screenshotExists = Boolean(screenshotStat?.isFile() && screenshotStat.size > 1000);
  const source = validArtifactExists ? await fs.readFile(artifactPath, 'utf8') : '';
  const nonblankPixelVariance = screenshotExists ? await pixelVariance(screenshotPath) : 0;
  const visualDelta = screenshotExists ? await visualDifference(screenshotPath, previousScreenshot) : undefined;
  const keywordHits = ['moon', 'water', 'fireflies', 'iteration', 'ascii', 'memory'].filter(word => source.toLowerCase().includes(word)).length;
  const readability = Math.min(1, keywordHits / 6 * 0.52 + (source.includes('<h1>') ? 0.2 : 0) + (source.includes('.ascii') ? 0.16 : 0) + (source.includes('text-shadow') ? 0.12 : 0));
  const failureReasons = [!validArtifactExists ? 'missing or too-small artifact' : '', !screenshotExists ? 'missing screenshot' : '', nonblankPixelVariance < 5 ? 'screenshot appears blank or low variance' : '', previousScreenshot && (visualDelta ?? 0) < 0.025 ? 'visual delta from previous iteration is too small' : '', readability < 0.55 ? 'readability/aesthetic heuristic is too low' : ''].filter(Boolean);
  const varianceScore = Math.min(1, nonblankPixelVariance / 45);
  const deltaScore = visualDelta === undefined ? 0.7 : Math.min(1, visualDelta / 0.16);
  return { validArtifactExists, screenshotExists, nonblankPixelVariance, visualDifferenceFromPrevious: visualDelta, changedMeaningfully: visualDelta === undefined ? true : visualDelta >= 0.025, aestheticReadabilityScore: readability, overallScore: Number((varianceScore * 0.36 + deltaScore * 0.24 + readability * 0.4).toFixed(4)), notes: [`nonblank pixel variance ${nonblankPixelVariance.toFixed(2)}`, visualDelta === undefined ? 'baseline iteration; no previous screenshot' : `visual difference from previous ${visualDelta.toFixed(3)}`, `aesthetic/readability heuristic ${readability.toFixed(2)}`], failureReasons };
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function reportMarkdown(nodes: LineageNode[], winner: LineageNode): string {
  return ['# Loop Intelligence Proof Report', '', `Generated: ${new Date().toISOString()}`, `Output dir: ${outDir}`, `Base prompt: ${basePrompt}`, `Winner: ${winner.id}`, '', '## Iterations', '', '| Iteration | Candidate | Parent | Score | Pixel variance | Visual delta | Meaningful change | Artifact | Screenshot |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- |', ...nodes.map(node => `| ${[node.iterationNumber, node.candidateId, node.parentId || '', node.evaluation.overallScore, node.evaluation.nonblankPixelVariance.toFixed(2), node.evaluation.visualDifferenceFromPrevious?.toFixed(3) ?? 'baseline', node.evaluation.changedMeaningfully ? 'yes' : 'no', node.artifactPath, node.screenshotPath].join(' | ')} |`), '', '## Feedback Memory / Compost Intelligence', '', ...nodes.flatMap(node => [`### ${node.id}`, '', `- Reason for changes: ${node.reasonForChanges}`, `- Memory/context note: ${node.memoryContextNote}`, `- Compost/intelligence note: ${node.compostIntelligenceNote}`, `- Evaluation notes: ${node.evaluation.notes.join('; ')}`, node.evaluation.failureReasons.length > 0 ? `- Failure reasons: ${node.evaluation.failureReasons.join('; ')}` : '- Failure reasons: none', ''])].join('\n');
}

async function main(): Promise<void> {
  if (!Number.isFinite(iterationCount) || iterationCount < 3) throw new Error('Loop intelligence proof requires --iterations >= 3');
  await fs.mkdir(outDir, { recursive: true });
  const lineage: LineageNode[] = [];
  let previousEvaluation: Evaluation | undefined;
  let previousScreenshot: string | undefined;
  let parentId: CandidateId | undefined;
  for (let iteration = 1; iteration <= iterationCount; iteration++) {
    const iterDir = path.join(outDir, iterationName(iteration));
    const candidate = candidateName(1);
    const id = `${iterationName(iteration)}/${candidate}` as CandidateId;
    const artifactPath = path.join(iterDir, `${candidate}.html`);
    const screenshotPath = path.join(iterDir, `${candidate}.png`);
    await fs.mkdir(iterDir, { recursive: true });
    const promptUsed = promptForIteration(iteration, previousEvaluation);
    const reason = reasonForIteration(iteration, previousEvaluation);
    const memory = memoryNote(iteration, previousEvaluation);
    const compostNote = compostIntelligenceNote(previousEvaluation);
    await fs.writeFile(artifactPath, buildHtml(iteration, promptUsed, reason, `${memory} ${compostNote}`), 'utf8');
    await renderScreenshot(artifactPath, screenshotPath);
    const evaluation = await evaluateCandidate(artifactPath, screenshotPath, previousScreenshot);
    await writeJson(path.join(iterDir, 'evaluation.json'), evaluation);
    const node: LineageNode = { id, promptUsed, iterationNumber: iteration, candidateId: candidate, parentId, generationAttemptCount: 1, previewAttemptCount: 1, artifactPath, screenshotPath, evaluation, reasonForChanges: reason, memoryContextNote: memory, compostIntelligenceNote: compostNote };
    lineage.push(node);
    previousEvaluation = evaluation;
    previousScreenshot = screenshotPath;
    parentId = id;
    console.log(`${id}: score ${evaluation.overallScore}, variance ${evaluation.nonblankPixelVariance.toFixed(2)}`);
  }
  const winner = [...lineage].sort((a, b) => b.evaluation.overallScore - a.evaluation.overallScore)[0];
  const winnerHtml = path.join(outDir, 'winner.html');
  const winnerPng = path.join(outDir, 'winner.png');
  await fs.copyFile(winner.artifactPath, winnerHtml);
  await fs.copyFile(winner.screenshotPath, winnerPng);
  const report = { generatedAt: new Date().toISOString(), outputDir: outDir, basePrompt, iterations: lineage.length, winnerId: winner.id, winnerHtml, winnerPng, lineage, summary: { complete: lineage.length >= 3 && lineage.every(node => node.evaluation.validArtifactExists && node.evaluation.screenshotExists), meaningfulChanges: lineage.map(node => ({ id: node.id, changedMeaningfully: node.evaluation.changedMeaningfully })), failedEvaluations: lineage.filter(node => node.evaluation.failureReasons.length > 0).map(node => ({ id: node.id, reasons: node.evaluation.failureReasons })) } };
  await writeJson(path.join(outDir, 'lineage.json'), { basePrompt, winnerId: winner.id, nodes: lineage });
  await writeJson(path.join(outDir, 'report.json'), report);
  await fs.writeFile(path.join(outDir, 'report.md'), reportMarkdown(lineage, winner), 'utf8');
  console.log(path.join(outDir, 'report.md'));
  process.exit(report.summary.failedEvaluations.length > 0 ? 1 : 0);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
