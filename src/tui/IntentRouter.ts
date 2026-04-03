/**
 * Intent Router - Natural language command detection
 * 
 * Routes user input to appropriate handler without requiring prefixes:
 * - "Fix the Tone.js validation" → Agent mode
 * - "What is p5.js?" → Chat mode
 * - "status" → Command mode
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Load the SOUL.md personality file
 */
export async function loadSoul(): Promise<string> {
  const candidates = [
    // 1. Project root (relative to this source file)
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../SOUL.md'),
    // 2. Current working directory
    path.join(process.cwd(), 'SOUL.md'),
  ];
  for (const soulPath of candidates) {
    try {
      const content = await fs.readFile(soulPath, 'utf-8');
      return content;
    } catch {
      continue;
    }
  }
  return DEFAULT_SOUL;
}

const DEFAULT_SOUL = `You are Liminal, a creative coding partner.

You help with generative art, creative technology, and code.
Be enthusiastic, precise, and honest about uncertainty.
Never hallucinate APIs - only suggest real functions.

CRITICAL RULES FOR FILE CREATION:
1. Use TypeScript (.ts) not JavaScript (.js) or text (.txt)
2. Tests go in test/unit/.../Name.test.ts using vitest (describe, it, expect)
3. Source code goes in src/.../Name.ts
4. Guardrails go in src/guardrails/MXX_Name.ts
5. NEVER create files in root directory
6. Follow existing project patterns exactly

You can chat about creative ideas or help fix the system via the harness.
When the user asks you to fix, add, or change code, you may invoke tools.`;
