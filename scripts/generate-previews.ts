#!/usr/bin/env tsx
/**
 * Generate preview images for all examples
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';

const DOMAINS = ['p5', 'glsl', 'three', 'strudel', 'hydra', 'remotion', 'html', 'ascii'];
const MODELS = [
  'minimax/MiniMax-M2.7',
  'minimax/MiniMax-M2.5', 
  'lmstudio/Qwen3.5-9B',
  'lmstudio/Qwen3-Coder-40B',
  'ollama/Gemma3-4B',
  'ollama/Kimi-K2.5'
];

function wrapP5(code: string): string {
  return `<!DOCTYPE html>
<html><head><script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"></script>
<style>body{margin:0;overflow:hidden;background:#000;}</style></head>
<body><script>${code}</script></body></html>`;
}

function wrapGLSL(code: string): string {
  return `<!DOCTYPE html>
<html><head><style>body{margin:0;overflow:hidden;}</style></head>
<body><canvas id="glcanvas"></canvas>
<script>
const canvas = document.getElementById('glcanvas');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const gl = canvas.getContext('webgl');
const fsSource = \`${code.replace(/`/g, '\\`')}\`;
// Basic shader setup would go here
// This is a simplified preview
</script></body></html>`;
}

function wrapThree(code: string): string {
  return `<!DOCTYPE html>
<html><head>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<style>body{margin:0;overflow:hidden;}</style></head>
<body><script>${code}</script></body></html>`;
}

async function generatePreview(browser: any, model: string, domain: string): Promise<boolean> {
  const codePath = `examples/generated/${model}/2026-03-31--default/v1.js`;
  if (!existsSync(codePath)) return false;
  
  const code = readFileSync(codePath, 'utf-8');
  let html: string;
  
  switch (domain) {
    case 'p5': html = wrapP5(code); break;
    case 'glsl': html = wrapGLSL(code); break;
    case 'three': html = wrapThree(code); break;
    default: return false; // Skip non-visual for now
  }
  
  const previewDir = `examples/previews/${model}`;
  mkdirSync(previewDir, { recursive: true });
  
  const page = await browser.newPage();
  await page.setViewportSize({ width: 800, height: 600 });
  
  try {
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000); // Let animations settle
    await page.screenshot({ 
      path: `${previewDir}/${domain}.png`,
      type: 'png'
    });
    console.log(`✅ ${model}/${domain}`);
    return true;
  } catch (err) {
    console.log(`❌ ${model}/${domain}: ${err}`);
    return false;
  } finally {
    await page.close();
  }
}

async function main() {
  console.log('Generating preview images...\n');
  
  const browser = await chromium.launch();
  let generated = 0;
  let failed = 0;
  
  for (const model of MODELS) {
    for (const domain of ['p5', 'glsl', 'three']) {
      const success = await generatePreview(browser, model, domain);
      if (success) generated++;
      else failed++;
    }
  }
  
  await browser.close();
  
  console.log(`\nGenerated: ${generated}, Failed: ${failed}`);
}

main().catch(console.error);
