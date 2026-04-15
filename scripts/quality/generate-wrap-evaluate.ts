#!/usr/bin/env tsx

import { runGenerationRegression, type RegressionDomain } from '../../src/quality/GenerationRegressionHarness.js';

function parseArgs() {
  const [provider, model, domain, ...rest] = process.argv.slice(2);
  if (!provider || !model || !domain) {
    console.error('Usage: tsx scripts/quality/generate-wrap-evaluate.ts <provider> <model> <domain> [--prompt "..."] [--base-url URL] [--output-root DIR]');
    process.exit(1);
  }

  let prompt: string | undefined;
  let baseUrl: string | undefined;
  let outputRoot: string | undefined;

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === '--prompt' && rest[i + 1]) {
      prompt = rest[++i];
    } else if (arg === '--base-url' && rest[i + 1]) {
      baseUrl = rest[++i];
    } else if (arg === '--output-root' && rest[i + 1]) {
      outputRoot = rest[++i];
    }
  }

  return { provider, model, domain: domain as RegressionDomain | 'remotion', prompt, baseUrl, outputRoot };
}

async function main() {
  const args = parseArgs();
  const result = await runGenerationRegression(args);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`generate-wrap-evaluate: ${message}`);
  process.exit(1);
});
