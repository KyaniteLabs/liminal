#!/usr/bin/env tsx
/**
 * Single test runner for Agent A dogfood tests
 * Usage: npx tsx scripts/run-single-test.ts <domain> <model>
 */

import { run } from '../src/index.js';
import fs from 'fs';
import path from 'path';

// Domain definitions
const DOMAINS: Record<string, { prompt: string; complexity: string }> = {
  p5: { prompt: 'Create a calming blue particle system with flowing movement', complexity: 'medium' },
  glsl: { prompt: 'Create an abstract plasma shader with animated colors', complexity: 'high' },
  three: { prompt: 'Create a rotating 3D cube with interesting lighting', complexity: 'high' },
  strudel: { prompt: 'Create a simple techno beat pattern with drums', complexity: 'medium' },
  hydra: { prompt: 'Create a geometric video synth pattern with kaleidoscope effect', complexity: 'medium' },
  tone: { prompt: 'Create an ambient drone synthesizer with reverb', complexity: 'medium' },
  html: { prompt: 'Create a landing page with hero section and call to action', complexity: 'low' },
  ascii: { prompt: 'Create ASCII art of a mountain landscape', complexity: 'low' },
  revideo: { prompt: 'Create a Revideo scene that animates text typing with a cursor blink, then fades in a subtitle', complexity: 'medium' },
};

function normalizeDomain(domainName: string): string {
  return domainName === 'remotion' ? 'revideo' : domainName;
}

// Model configurations
const MODELS: Record<string, { baseUrl?: string; timeout: number; type: string; fullName: string }> = {
  'minimax-m27': { timeout: 180000, type: 'cloud', fullName: 'minimax-m2.7' },
  'minimax-m25': { timeout: 180000, type: 'cloud', fullName: 'minimax-m2.5' },
  'lm-coder-40b': { baseUrl: 'http://localhost:1234/v1', timeout: 300000, type: 'local', fullName: 'lm-coder-40b' },
  'lm-qwen-9b': { baseUrl: 'http://localhost:1234/v1', timeout: 180000, type: 'local', fullName: 'lm-qwen-9b' },
};

function log(line: string) {
  console.log(line);
  fs.appendFileSync('./dogfood-telemetry-agent-a.log', line + '\n');
}

function timestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

async function runSingleTest(domainName: string, modelTag: string) {
  const normalizedDomainName = normalizeDomain(domainName);
  const domain = DOMAINS[normalizedDomainName];
  const model = MODELS[modelTag];
  
  if (!domain || !model) {
    console.error(`Invalid domain or model: ${domainName}, ${modelTag}`);
    process.exit(1);
  }
  
  const startTime = Date.now();
  const outputDir = `./landing-live/${normalizedDomainName}-${modelTag}`;
  const finalOutputPath = `./landing-live/${normalizedDomainName}-${modelTag}.html`;
  
  // Clean up any existing directory to avoid conflicts
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true });
  }
  
  // Set env for this test
  if (model.baseUrl) {
    process.env.LIMINAL_LLM_BASE_URL = model.baseUrl;
  } else {
    delete process.env.LIMINAL_LLM_BASE_URL;
  }
  process.env.LIMINAL_LLM_MODEL = model.fullName;
  
  console.log(`\n🧪 Test: ${normalizedDomainName} × ${modelTag}`);
  console.log(`   Output Dir: ${outputDir}`);
  console.log(`   Final Path: ${finalOutputPath}`);
  console.log(`   Model: ${process.env.LIMINAL_LLM_MODEL}`);
  console.log(`   Base URL: ${model.baseUrl || 'default'}`);
  
  try {
    const result = await run(domain.prompt, {
      maxIterations: 3,
      output: outputDir,
      project: `dogfood-${normalizedDomainName}-${modelTag}`,
    });
    
    const duration = Date.now() - startTime;
    const score = result?.finalScore || 0;
    
    // The run function creates files inside the output directory
    // Copy the final HTML file to the expected location
    const generatedHtmlPath = path.join(outputDir, `dogfood-${normalizedDomainName}-${modelTag}-final.html`);
    
    let size = 0;
    if (fs.existsSync(generatedHtmlPath)) {
      // Copy to final destination
      fs.copyFileSync(generatedHtmlPath, finalOutputPath);
      size = fs.statSync(finalOutputPath).size;
    } else {
      // Try to find any HTML file in the output directory
      const files = fs.readdirSync(outputDir);
      const htmlFiles = files.filter(f => f.endsWith('.html'));
      if (htmlFiles.length > 0) {
        fs.copyFileSync(path.join(outputDir, htmlFiles[0]), finalOutputPath);
        size = fs.statSync(finalOutputPath).size;
      }
    }
    
    // Check if output is valid (not a template fallback)
    const content = fs.readFileSync(finalOutputPath, 'utf-8');
    const isTemplateFallback = content.includes('Template Fallback') || 
                               content.includes('template-fallback') ||
                               content.includes('<!-- Template -->');
    
    if (isTemplateFallback) {
      log(`[${timestamp()}] Domain: ${domainName} | Model: ${modelTag} | Status: ❌ | Duration: ${duration}ms | Score: ${score.toFixed(2)} | Size: ${size}b | Error: Template fallback detected`);
      console.log(`   ❌ FAILED (Template Fallback) | Duration: ${duration}ms | Score: ${score.toFixed(2)} | Size: ${size}b`);
      return { status: '❌', duration, score, size, error: 'Template fallback' };
    }
    
    log(`[${timestamp()}] Domain: ${domainName} | Model: ${modelTag} | Status: ✅ | Duration: ${duration}ms | Score: ${score.toFixed(2)} | Size: ${size}b`);
    console.log(`   ✅ SUCCESS | Duration: ${duration}ms | Score: ${score.toFixed(2)} | Size: ${size}b`);
    
    return { status: '✅', duration, score, size };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    log(`[${timestamp()}] Domain: ${domainName} | Model: ${modelTag} | Status: ❌ | Duration: ${duration}ms | Score: 0.00 | Error: ${errorMsg}`);
    console.log(`   ❌ FAILED | Duration: ${duration}ms | Error: ${errorMsg}`);
    
    return { status: '❌', duration, score: 0, size: 0, error: errorMsg };
  }
}

// Main
const domain = process.argv[2];
const model = process.argv[3];

if (!domain || !model) {
  console.log('Usage: npx tsx scripts/run-single-test.ts <domain> <model>');
  console.log('');
  console.log('Domains: p5, glsl, three, strudel, hydra, tone, html, ascii, remotion');
  console.log('Models: minimax-m27, minimax-m25, lm-coder-40b, lm-qwen-9b');
  process.exit(1);
}

runSingleTest(domain, model).then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
