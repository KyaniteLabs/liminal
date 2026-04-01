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

export type IntentType = 'chat' | 'agent' | 'command' | 'ambiguous';

export interface IntentResult {
  type: IntentType;
  confidence: number;
  extractedCommand?: string;
  extractedTask?: string;
  reason: string;
}

/**
 * Patterns that indicate AGENT intent (code changes)
 */
const AGENT_PATTERNS = [
  // Direct action words
  /^(fix|repair|correct|solve)\b/i,
  /^(add|implement|create|build)\s+(?:a|an|the|\w+)/i,
  /^(change|modify|update|refactor|rewrite)\b/i,
  /^(remove|delete|clean\s+up)\b/i,
  /^(improve|optimize|enhance|polish)\b/i,
  /^(find|locate)\s+(?:and|&)?\s*(?:fix|repair)/i,
  
  // Task descriptions
  /^(?:can\s+you|could\s+you|please)\s+(?:fix|add|change|implement|update|remove)/i,
  /^(?:we\s+need|i\s+need|it\s+needs)\s+to\s+(?:be\s+)?(fixed|added|changed|implemented)/i,
  
  // Specific contexts
  /\b(bug|issue|error|broken|failing)\b.*\b(fix|repair|solve)\b/i,
  /\b(should|must|needs?\s+to)\s+\w+\s+(?:the|a|an)\s+\w+/i,
];

/**
 * Patterns that indicate COMMAND intent
 */
const COMMAND_PATTERNS = [
  // Exact command matches
  /^(help|status|tasks|clear|exit|quit|q)$/i,
  
  // Command with args
  /^(run|preview|play|browser)\s+\S+/i,
  
  // Slash prefix (habit from other systems)
  /^\/(\w+)/,
];

/**
 * Patterns that indicate CHAT intent (questions, discussion)
 */
const CHAT_PATTERNS = [
  // Questions
  /^(what|how|why|when|where|who|which)\b/i,
  /^(is|are|can|could|would|should|will|does|do|has|have)\b/i,
  /\?\s*$/,
  
  // Discussion words
  /^(tell|explain|describe|show)\s+me\b/i,
  /^(let's|lets)\s+(?:try|see|explore|discuss)/i,
  /^(i\s+think|i\s+wonder|maybe|perhaps)\b/i,
  
  // Greetings
  /^(hi|hello|hey|greetings|howdy|yo)\b/i,
  
  // Creative exploration
  /^(generate|make|create)\s+(?:me\s+)?(?:a|an|some)\b/i,
  /^(i\s+want|i'd\s+like|i\s+would\s+like)\s+to\s+(?:make|create|build|generate)/i,
];

/**
 * Route natural language input to appropriate handler
 */
export async function detectIntent(input: string): Promise<IntentResult> {
  const trimmed = input.trim();
  // Unused: const lower = trimmed.toLowerCase();
  
  // 1. Check for explicit slash commands first
  const slashMatch = trimmed.match(/^\/(\w+)(?:\s+(.*))?$/);
  if (slashMatch) {
    return {
      type: 'command',
      confidence: 1.0,
      extractedCommand: slashMatch[1],
      reason: 'Explicit slash command',
    };
  }
  
  // 2. Check for AGENT patterns
  for (const pattern of AGENT_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      return {
        type: 'agent',
        confidence: 0.85,
        extractedTask: trimmed,
        reason: `Matched agent pattern: "${match[0]}"`,
      };
    }
  }
  
  // 3. Check for COMMAND patterns
  for (const pattern of COMMAND_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      return {
        type: 'command',
        confidence: 0.9,
        extractedCommand: match[1] || match[0],
        reason: `Matched command pattern: "${match[0]}"`,
      };
    }
  }
  
  // 4. Check for CHAT patterns
  for (const pattern of CHAT_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      return {
        type: 'chat',
        confidence: 0.8,
        reason: `Matched chat pattern: "${match[0]}"`,
      };
    }
  }
  
  // 5. Ambiguous - default to chat but with low confidence
  // The chat handler can escalate to agent if needed
  return {
    type: 'chat',
    confidence: 0.5,
    reason: 'No clear pattern matched, defaulting to chat',
  };
}

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

You can chat about creative ideas or help fix the system via the harness.
When the user asks you to fix, add, or change code, you may invoke tools.`;

/**
 * Check if input is likely a task for the agent (for chat escalation)
 * Synchronous version for quick checks
 */
export function isLikelyAgentTask(input: string): boolean {
  // Quick check against agent patterns without full routing
  return AGENT_PATTERNS.some(pattern => pattern.test(input));
}
