/**
 * M12: Privacy Guardrail
 *
 * Prevents PII leakage in prompts and outputs.
 * Detects and anonymizes personally identifiable information.
 */

import {
  GuardrailRule,
  GuardrailResult,
  ExecutionContext,
  GuardrailTier,
  RemediationResult,
} from '../core/types.js';

/**
 * PII detection patterns
 */
const PII_PATTERNS = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /\b(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
  ssn: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g,
  creditCard: /\b(?:\d{4}[-.\s]?){3}\d{4}\b/g,
  ipAddress: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
};

/**
 * Detect PII in text
 */
function detectPII(text: string): Array<{ type: string; match: string }> {
  const findings: Array<{ type: string; match: string }> = [];

  for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) {
        findings.push({ type, match });
      }
    }
  }

  return findings;
}

/**
 * Anonymize PII in text
 */
function anonymizePII(text: string): string {
  let anonymized = text;

  // Anonymize emails
  anonymized = anonymized.replace(
    PII_PATTERNS.email,
    '***@***.com'
  );

  // Anonymize phone numbers
  anonymized = anonymized.replace(
    PII_PATTERNS.phone,
    '***-***-****'
  );

  // Anonymize SSNs
  anonymized = anonymized.replace(
    PII_PATTERNS.ssn,
    '***-**-****'
  );

  // Anonymize credit cards
  anonymized = anonymized.replace(
    PII_PATTERNS.creditCard,
    '****-****-****-****'
  );

  return anonymized;
}

/**
 * M12 Privacy Guardrail
 * Detects and prevents PII leakage
 */
export const PrivacyGuardrail: GuardrailRule = {
  id: 'guardrail-m12-privacy',
  description: 'Prevents PII leakage in prompts and outputs',
  tier: GuardrailTier.ENFORCING,
  category: 'compliance',

  async evaluate(context: ExecutionContext): Promise<GuardrailResult> {
    const textToCheck = [
      context.prompt || '',
      typeof context.output === 'string' ? context.output : '',
    ].join(' ');

    const findings = detectPII(textToCheck);

    if (findings.length > 0) {
      return {
        passed: false,
        guardrailId: this.id,
        severity: 'error',
        message: `PII detected: ${findings.map(f => f.type).join(', ')}`,
        details: {
          findings: findings.map(f => ({ type: f.type })), // Don't include actual PII in details
          count: findings.length,
        },
        suggestion: 'Remove PII or use anonymized data',
      };
    }

    return {
      passed: true,
      guardrailId: this.id,
      message: 'No PII detected',
    };
  },

  async remediate(
    context: ExecutionContext,
    violation: GuardrailResult
  ): Promise<RemediationResult> {
    const anonymizedPrompt = context.prompt ? anonymizePII(context.prompt) : undefined;
    const anonymizedOutput = typeof context.output === 'string'
      ? anonymizePII(context.output)
      : context.output;

    return {
      success: true,
      action: 'anonymize',
      message: 'PII anonymized',
      newContext: {
        prompt: anonymizedPrompt,
        output: anonymizedOutput,
      },
    };
  },
};

// Also export class for testing
export { detectPII, anonymizePII };
