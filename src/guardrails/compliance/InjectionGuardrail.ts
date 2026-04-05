/**
 * M13: Prompt Injection Defense Guardrail
 *
 * Detects jailbreak attempts and prompt leakage attacks.
 */

import {
  GuardrailRule,
  GuardrailResult,
  ExecutionContext,
  GuardrailTier,
} from '../core/types.js';

/**
 * Known jailbreak patterns
 */
const JAILBREAK_PATTERNS = [
  // Instruction override
  /ignore\s+(?:previous|all|the)\s+(?:instruction|prompt|command)/i,
  /ignore\s+the\s+above/i,
  
  // Roleplay attacks
  /you\s+are\s+now\s+(?:DAN|do\s+anything\s+now)/i,
  /pretend\s+you\s+are/i,
  /let's\s+play\s+a\s+game/i,
  /developer\s+mode/i,
  /sudo\s+mode/i,
  
  // System prompt extraction
  /system\s*prompt/i,
  /what\s+are\s+your\s+instructions/i,
  /repeat\s+(?:the\s+)?(?:words|text|prompt)\s+above/i,
  /repeat\s+after\s+me/i,
  
  // Delimiter confusion
  /---\s*system\s*---/i,
  /<\|system\|>/i,
  /\[system\s*prompt\]/i,
  /\{\{system\}\}/i,
  
  // Authority impersonation
  /as\s+(?:an?\s+)?administrator/i,
  /as\s+the\s+developer/i,
  /this\s+is\s+(?:the\s+)?system/i,
  
  // Hypothetical framing
  /hypothetically\s+speaking/i,
  /in\s+a\s+fictional\s+scenario/i,
  /imagine\s+you\s+are/i,
];

/**
 * Detect jailbreak attempts in text
 */
function detectInjection(text: string): Array<{ pattern: string; match: string }> {
  const findings: Array<{ pattern: string; match: string }> = [];

  for (const pattern of JAILBREAK_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      findings.push({
        pattern: pattern.source.substring(0, 50) + '...',
        match: matches[0].substring(0, 50),
      });
    }
  }

  return findings;
}

/**
 * M13 Prompt Injection Defense Guardrail
 */
export const InjectionGuardrail: GuardrailRule = {
  id: 'guardrail-m13-injection',
  description: 'Detects jailbreaks and prompt leak attacks',
  tier: GuardrailTier.AUTONOMOUS,
  category: 'compliance',

  // eslint-disable-next-line @typescript-eslint/require-await
  async evaluate(context: ExecutionContext): Promise<GuardrailResult> {
    const textToCheck = context.prompt || '';
    const findings = detectInjection(textToCheck);

    if (findings.length > 0) {
      return {
        passed: false,
        guardrailId: this.id,
        severity: 'critical',
        message: `Prompt injection detected: ${findings.length} suspicious patterns`,
        details: {
          patterns: findings.map(f => f.pattern),
          matches: findings.map(f => f.match),
        },
        suggestion: 'Reject prompt and log for review',
      };
    }

    return {
      passed: true,
      guardrailId: this.id,
      message: 'No injection patterns detected',
    };
  },
};

export { detectInjection };
