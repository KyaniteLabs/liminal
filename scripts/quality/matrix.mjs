// Combination matrix: compose representative background×foreground×audio triples
// via the real CompositionOrchestrator (real LLM per layer), render each composite
// to PNG so the "do domains combine in different ways" question can be judged.
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { CompositionOrchestrator } from '../../dist/composition/CompositionOrchestrator.js';

const OUT = '.quality/matrix';
fs.mkdirSync(OUT, { recursive: true });

// Curated to exercise different background / foreground / audio + blend modes.
const SPECS = [
  { title: 'Reef Pulse',     background: '#f4efe6', layers: [
    { domain: 'shader', prompt: 'warm coral-and-cream gradient caustics', blendMode: 'normal', opacity: 1 },
    { domain: 'p5',     prompt: 'slow drifting plankton motes', blendMode: 'multiply', opacity: 0.7 },
    { domain: 'tone',   prompt: 'warm evolving pad', blendMode: 'normal', opacity: 0.5 } ] },
  { title: 'Ink Garden',     background: '#10131a', layers: [
    { domain: 'three',  prompt: 'rotating low-poly crystal, well lit, jewel tones', blendMode: 'normal', opacity: 1 },
    { domain: 'hydra',  prompt: 'kaleidoscopic emerald feedback', blendMode: 'lighten', opacity: 0.6 },
    { domain: 'strudel',prompt: 'sparse glassy arpeggio', blendMode: 'normal', opacity: 0.5 } ] },
  { title: 'Paper Signal',   background: '#fbfaf7', layers: [
    { domain: 'shader', prompt: 'duotone slate-and-amber interference', blendMode: 'normal', opacity: 1 },
    { domain: 'ascii',  prompt: 'concrete-poetry constellation', blendMode: 'normal', opacity: 0.9 } ] },
  { title: 'Dusk Bloom',     background: '#1a1020', layers: [
    { domain: 'p5',     prompt: 'high-key pastel petals falling', blendMode: 'normal', opacity: 1 },
    { domain: 'shader', prompt: 'soft lavender bokeh wash', blendMode: 'overlay', opacity: 0.6 } ] },
  { title: 'Tide Glass',     background: '#0b1418', layers: [
    { domain: 'three',  prompt: 'bright glass spheres on a lit plane, teal-and-white', blendMode: 'normal', opacity: 1 },
    { domain: 'p5',     prompt: 'thin white current lines', blendMode: 'screen', opacity: 0.7 },
    { domain: 'tone',   prompt: 'bright arpeggiated bells', blendMode: 'normal', opacity: 0.5 } ] },
];

const browser = await puppeteer.launch({
  headless: 'new', protocolTimeout: 90000,
  args: ['--no-sandbox','--disable-setuid-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist'],
});

const summary = [];
for (let i = 0; i < SPECS.length; i++) {
  const spec = SPECS[i];
  const tag = `${i + 1}-${spec.title.toLowerCase().replace(/\s+/g, '-')}`;
  try {
    const result = await CompositionOrchestrator.compose(spec);
    const ok = result.successCount;
    const total = result.layers.length;
    const page = await browser.newPage();
    await page.setViewport({ width: 900, height: 600 });
    await page.setContent(result.html, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 5000));
    await page.screenshot({ path: path.join(OUT, tag + '.png') });
    await page.close();
    const sz = fs.statSync(path.join(OUT, tag + '.png')).size;
    const gate = result.renderGate;
    const gateNote = gate
      ? gate.skipped
        ? '  gate:skipped'
        : `  gate:${gate.verdict}(lum ${gate.measure.meanLuminance.toFixed(2)})${gate.remediation ? ` → ${gate.remediation.verdictAfter}${gate.remediation.applied ? ' [demoted ' + gate.remediation.demotedLayers.join(',') + ']' : ' [kept original]'}` : ''}`
      : '';
    summary.push(`✅ ${tag}: ${ok}/${total} layers [${spec.layers.map(l => l.domain + ':' + (l.blendMode||'normal')).join(' + ')}] (${sz}b)${gateNote}`);
  } catch (e) {
    summary.push(`⚠️  ${tag}: ${String(e.message).slice(0, 90)}`);
  }
}
await browser.close();
console.log(summary.join('\n'));
