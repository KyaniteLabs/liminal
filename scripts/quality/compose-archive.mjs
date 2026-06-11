// First archive-composed showpiece: "Tide Pool" — curated A-grade archive
// entries assembled as layers (zero new generations).
import fs from 'fs'; import os from 'os'; import path from 'path';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { CompositionOrchestrator } = await import(path.join(ROOT,'dist/composition/CompositionOrchestrator.js'));
const archive=JSON.parse(fs.readFileSync(path.join(os.homedir(),'.sinter/archive/quality_archive.json'),'utf-8'));
const pick=(dom,idPrefix)=>archive.archives[dom].find(e=>e.id.startsWith(idPrefix));
const layers=[
  { spec:{ domain:'three', prompt:'bioluminescent anemone tide pool scene', blendMode:'normal', opacity:1.0 }, code:pick('three','thr_f18b242d').output, generated:true },
  { spec:{ domain:'glsl', prompt:'breathing topographic texture', blendMode:'overlay', opacity:0.3 }, code:pick('glsl','gls_d946cb5b').output, generated:true },
  { spec:{ domain:'p5', prompt:'bioluminescent spark accents', blendMode:'screen', opacity:0.75 }, code:pick('p5','p5_94485ccd').output, generated:true },
  { spec:{ domain:'tone', prompt:'audio bed', blendMode:'normal', opacity:1.0 }, code:pick('tone','ton_23d7dfef').output, generated:true },
];
const title='Tide Pool (archive-composed)';
const bg='#06121a';
const html=CompositionOrchestrator.assemble(title,bg,layers,layers.map(l=>l.code));
const gated=await CompositionOrchestrator.runRenderGate(title,bg,layers,html);
console.log('gate:',JSON.stringify(gated.report??{},null,0).slice(0,300));
fs.mkdirSync('.quality/showcase',{recursive:true});
fs.writeFileSync('.quality/showcase/tide-pool-archive.html',gated.html);
const browser=await puppeteer.launch({headless:'new',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl']});
const page=await browser.newPage();
await page.setViewport({width:1200,height:800});
await page.setContent(gated.html,{waitUntil:'load',timeout:30000});
await page.mouse.click(600,400); // dismiss the audio start gate
await new Promise(r=>setTimeout(r,5000));
await page.screenshot({path:'.quality/showcase/tide-pool-archive.png'});
await browser.close();
console.log('showpiece written: .quality/showcase/tide-pool-archive.{html,png}');
