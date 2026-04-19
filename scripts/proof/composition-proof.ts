#!/usr/bin/env tsx
/**
 * Launch-scope composition/layering proof runner.
 *
 * Deterministic and provider-free: proves that launch-scope visual/text
 * domains can be layered into visible artifacts with persisted screenshots.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer';
import sharp from 'sharp';

type ProofStatus = 'pass' | 'fail';

interface CompositionCase {
  id: string;
  title: string;
  layers: Array<{ domain: string; role: string; prompt: string }>;
  html: string;
}

interface CompositionResult {
  id: string;
  title: string;
  status: ProofStatus;
  layers: CompositionCase['layers'];
  artifactPath: string;
  screenshotPath: string;
  durationMs: number;
  pixelStdDev?: number;
  error?: string;
}

const outputRoot = process.argv.find(arg => arg.startsWith('--out='))?.slice('--out='.length)
  || path.join('.omx', 'proof', 'composition');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.join(outputRoot, timestamp);

function pageShell(title: string, body: string, extraHead = ''): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
${extraHead}
<style>
*{box-sizing:border-box}
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#05070f}
.stage{position:relative;width:960px;height:640px;overflow:hidden;background:#05070f}
.layer{position:absolute;inset:0;width:100%;height:100%}
.caption{position:absolute;left:24px;bottom:22px;z-index:20;color:#e5e7eb;font-family:monospace;font-size:13px;letter-spacing:.08em;text-transform:uppercase;background:rgba(5,7,15,.55);padding:8px 10px;border:1px solid rgba(103,232,249,.35)}
</style>
</head>
<body><div class="stage">${body}</div></body>
</html>`;
}

const cases: CompositionCase[] = [
  {
    id: 'shader-p5-overlay',
    title: 'Shader Field With p5 Orbital Overlay',
    layers: [
      { domain: 'shader', role: 'background', prompt: 'Bioluminescent liquid field with slow domain-warp movement' },
      { domain: 'p5', role: 'overlay', prompt: 'Transparent orbiting firefly energy paths' },
    ],
    html: pageShell('Shader + p5 Overlay', `<canvas id="shader" class="layer"></canvas>
<canvas id="p5" class="layer"></canvas>
<div class="caption">shader background + p5 transparent overlay</div>
<script>
const c=document.getElementById('shader'),ctx=c.getContext('2d');c.width=960;c.height=640;
const p=document.getElementById('p5'),px=p.getContext('2d');p.width=960;p.height=640;
function draw(t){const g=ctx.createRadialGradient(480,320,20,480,320,620);g.addColorStop(0,'#0ea5e9');g.addColorStop(.45,'#0f766e');g.addColorStop(1,'#020617');ctx.fillStyle=g;ctx.fillRect(0,0,960,640);for(let i=0;i<24;i++){ctx.strokeStyle='rgba(103,232,249,.18)';ctx.beginPath();ctx.ellipse(480,330,90+i*18,24+i*4,Math.sin(t/2000)*.3,0,Math.PI*2);ctx.stroke()}px.clearRect(0,0,960,640);for(let i=0;i<90;i++){const a=t*.0004+i*.41,r=90+(i%20)*9,x=480+Math.cos(a)*r,y=320+Math.sin(a*1.7)*r*.42;px.fillStyle=i%3?'#bef264':'#f0abfc';px.beginPath();px.arc(x,y,2+(i%4),0,Math.PI*2);px.fill()}requestAnimationFrame(draw)}requestAnimationFrame(draw);
</script>`),
  },
  {
    id: 'kinetic-text-overlay',
    title: 'Kinetic CSS With Concrete Text Overlay',
    layers: [
      { domain: 'kinetic', role: 'background', prompt: 'CSS-only kinetic animated shape field' },
      { domain: 'textgen', role: 'overlay', prompt: 'Concrete poem ripples laid over motion field' },
      { domain: 'ascii', role: 'texture', prompt: 'Monospace moon-water texture pattern' },
    ],
    html: pageShell('Kinetic + Text Overlay', `<div class="layer kinetic"><div class="orb one"></div><div class="orb two"></div><div class="rings"></div></div>
<pre class="ascii">        .  .  .      ~ ~ ~      .  .  .
   ~ ~      moon-water signal      ~ ~
      .        ripple glyphs        .</pre>
<div class="poem"><span>RIPPLE</span><span>after</span><span>ripple</span><span>learns</span><span>the dark</span></div>
<div class="caption">kinetic css + concrete text + ascii texture</div>`, `<style>
.orb{position:absolute;border-radius:50%;filter:blur(28px);opacity:.78;animation:drift 8s ease-in-out infinite alternate}
.one{width:360px;height:360px;background:#22d3ee;left:80px;top:80px}.two{width:430px;height:430px;background:#f472b6;right:70px;bottom:40px;animation-duration:10s}
.rings{position:absolute;inset:80px;border:1px solid rgba(255,255,255,.22);border-radius:50%;animation:pulse 4s ease-in-out infinite;box-shadow:0 0 90px rgba(103,232,249,.22)}
.ascii{position:absolute;inset:auto 0 52px 0;z-index:6;color:rgba(255,255,255,.42);font:18px monospace;text-align:center;mix-blend-mode:screen;letter-spacing:.12em}
.poem{position:absolute;inset:0;z-index:8;display:grid;place-items:center;color:#f8fafc;font-family:Georgia,serif;text-transform:uppercase;letter-spacing:.35em;text-align:center}
.poem span{display:block;font-size:62px;line-height:1.05;text-shadow:0 0 30px rgba(255,255,255,.35);animation:word 5s ease-in-out infinite}.poem span:nth-child(2n){font-size:24px;color:#bae6fd;animation-delay:.4s}
@keyframes drift{from{transform:translate(-30px,-20px) scale(.9)}to{transform:translate(48px,38px) scale(1.18)}}@keyframes pulse{0%,100%{transform:scale(.82);opacity:.2}50%{transform:scale(1.08);opacity:.8}}@keyframes word{0%,100%{filter:blur(6px);opacity:.35;transform:translateY(12px)}45%,65%{filter:blur(0);opacity:1;transform:translateY(0)}}
</style>`),
  },
];

async function renderScreenshot(htmlPath: string, screenshotPath: string): Promise<void> {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  const errors: string[] = [];
  try {
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewport({ width: 960, height: 640 });
    await page.goto(pathToFileURL(path.resolve(htmlPath)).href, { waitUntil: 'load', timeout: 30_000 });
    await new Promise(resolve => setTimeout(resolve, 1500));
    if (errors.length > 0) throw new Error(errors.slice(0, 3).join(' | '));
    await page.screenshot({ path: screenshotPath, type: 'png', fullPage: false });
  } finally {
    await page.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

async function pixelStdDev(file: string): Promise<number> {
  const stats = await sharp(file).stats();
  const channels = stats.channels.slice(0, 3);
  return channels.reduce((sum, channel) => sum + channel.stdev, 0) / channels.length;
}

async function runCase(item: CompositionCase): Promise<CompositionResult> {
  const started = Date.now();
  const artifactPath = path.join(outDir, `${item.id}.html`);
  const screenshotPath = path.join(outDir, `${item.id}.png`);
  await fs.writeFile(artifactPath, item.html, 'utf8');
  try {
    await renderScreenshot(artifactPath, screenshotPath);
    const stdDev = await pixelStdDev(screenshotPath);
    if (stdDev < 0.5) throw new Error(`Composition screenshot appears blank (avg RGB stdev ${stdDev.toFixed(2)})`);
    return { id: item.id, title: item.title, status: 'pass', layers: item.layers, artifactPath, screenshotPath, durationMs: Date.now() - started, pixelStdDev: stdDev };
  } catch (error) {
    return { id: item.id, title: item.title, status: 'fail', layers: item.layers, artifactPath, screenshotPath, durationMs: Date.now() - started, error: error instanceof Error ? error.message : String(error) };
  }
}

function markdown(results: CompositionResult[]): string {
  const passed = results.filter(result => result.status === 'pass').length;
  const failed = results.length - passed;
  return [
    '# Composition Proof Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Output dir: ${outDir}`,
    '',
    `Summary: ${passed} pass, ${failed} fail / ${results.length} total`,
    '',
    '| Case | Status | Layers | Artifact | Screenshot | Notes |',
    '| --- | --- | --- | --- | --- | --- |',
    ...results.map(result => `| ${[result.id, result.status, result.layers.map(layer => `${layer.domain}:${layer.role}`).join(', '), result.artifactPath, result.status === 'pass' ? result.screenshotPath : '', result.error || `pixel stdev ${result.pixelStdDev?.toFixed(2)}`].map(cell => String(cell).replace(/\|/g, '\\|')).join(' | ')} |`),
  ].join('\n');
}

await fs.mkdir(outDir, { recursive: true });
const results: CompositionResult[] = [];
for (const item of cases) {
  console.log(`Running ${item.id}...`);
  const result = await runCase(item);
  results.push(result);
  console.log(`${item.id}: ${result.status}`);
}

const report = {
  generatedAt: new Date().toISOString(),
  outputDir: outDir,
  summary: { total: results.length, passed: results.filter(result => result.status === 'pass').length, failed: results.filter(result => result.status === 'fail').length },
  results,
};
await fs.writeFile(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
await fs.writeFile(path.join(outDir, 'report.md'), markdown(results), 'utf8');
console.log(path.join(outDir, 'report.md'));
process.exit(report.summary.failed > 0 ? 1 : 0);
