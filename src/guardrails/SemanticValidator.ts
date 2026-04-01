/**
 * M9: Semantic Alignment Guardrail
 * 
 * Validates that generated output semantically matches the user's request.
 * Not about code quality (M4) or aesthetics (M7) - about INTENT MATCHING.
 * 
 * Examples:
 * - User: "fiery sunset over mountains" → Code shows ocean waves = FAIL
 * - User: "particle system with gravity" → Code shows static circles = FAIL
 * - User: "blue theme" → Code uses red exclusively = FAIL
 */

import { LLMClient } from '../llm/LLMClient.js';

export interface SemanticValidationResult {
  aligned: boolean;
  score: number;  // 0-1, where 1 = perfect alignment
  issues: string[];
  explanation: string;
}

export interface SemanticValidatorOptions {
  threshold?: number;  // Minimum score to pass (default: 0.7)
  llm?: LLMClient;     // Optional custom LLM client
}

const DEFAULT_THRESHOLD = 0.7;

export class SemanticValidator {
  private llm: LLMClient;
  private threshold: number;

  constructor(options?: SemanticValidatorOptions) {
    this.llm = options?.llm || new LLMClient();
    this.threshold = options?.threshold ?? DEFAULT_THRESHOLD;
  }

  /**
   * Validate that code matches the user's intent
   */
  async validate(
    userPrompt: string,
    generatedCode: string,
    domain: string
  ): Promise<SemanticValidationResult> {
    const systemPrompt = `You are a semantic alignment validator. Your job is to check if generated ${domain} code matches what the user requested.

Focus on:
1. SUBJECT MATCH: Does the code create what was asked for?
2. ATTRIBUTE MATCH: Are colors, styles, behaviors as requested?
3. COMPLETENESS: Are all requested elements present?

Ignore code quality, syntax errors, or aesthetic beauty. Only check: DOES THIS MATCH THE REQUEST?

Output format (JSON only):
{
  "aligned": true/false,
  "score": 0.0-1.0,
  "issues": ["specific mismatch 1", "specific mismatch 2"],
  "explanation": "Brief explanation of alignment or misalignment"
}`;

    const userPrompt_text = `USER REQUEST: "${userPrompt}"

GENERATED ${domain.toUpperCase()} CODE:
\`\`\`
${generatedCode.slice(0, 2000)}  // Truncate if too long
\`\`\`

Does the code match the user's request? Analyze and return JSON.`;

    try {
      const response = await this.llm.generate(systemPrompt, userPrompt_text);
      
      if (!response.code) {
        return {
          aligned: false,
          score: 0,
          issues: ['LLM returned empty response'],
          explanation: 'Validation failed due to empty LLM response',
        };
      }

      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = response.code.match(/```json\s*([\s\S]*?)```/) || 
                        response.code.match(/```\s*([\s\S]*?)```/) ||
                        [null, response.code];
      
      const jsonStr = jsonMatch[1]?.trim() || response.code.trim();
      const result = JSON.parse(jsonStr);

      return {
        aligned: result.aligned === true && result.score >= this.threshold,
        score: Math.max(0, Math.min(1, result.score || 0)),
        issues: Array.isArray(result.issues) ? result.issues : [],
        explanation: result.explanation || 'No explanation provided',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        aligned: false,
        score: 0,
        issues: [`Validation error: ${message}`],
        explanation: 'Validation failed due to error',
      };
    }
  }

  /**
   * Quick check for common semantic mismatches (no LLM call)
   */
  quickCheck(userPrompt: string, generatedCode: string): { issues: string[] } {
    const issues: string[] = [];
    const promptLower = userPrompt.toLowerCase();
    const codeLower = generatedCode.toLowerCase();

    // Color checks
    const colorMatches = {
      'blue': /\bblue\b|#0000ff|rgb\(0,\s*0,\s*255/i,
      'red': /\bred\b|#ff0000|rgb\(255,\s*0,\s*0/i,
      'green': /\bgreen\b|#00ff00|rgb\(0,\s*255,\s*0/i,
      'yellow': /\byellow\b|#ffff00/i,
      'purple': /\bpurple\b|#800080/i,
      'orange': /\borange\b|#ffa500/i,
      'pink': /\bpink\b|#ffc0cb/i,
      'black': /\bblack\b|#000000/i,
      'white': /\bwhite\b|#ffffff/i,
    };

    for (const [color, regex] of Object.entries(colorMatches)) {
      if (promptLower.includes(color) && !regex.test(codeLower)) {
        // Check if any color is mentioned in code at all
        const hasAnyColor = /\b(red|blue|green|yellow|purple|orange|pink|black|white)\b|#[0-9a-f]{6}/i.test(codeLower);
        if (hasAnyColor) {
          issues.push(`Prompt asks for "${color}" but code may use different colors`);
        }
      }
    }

    // Animation checks
    const animationKeywords = ['animate', 'animation', 'moving', 'floating', 'rotating', 'bouncing'];
    const hasAnimationRequest = animationKeywords.some(kw => promptLower.includes(kw));
    const hasAnimationCode = /\bdraw\s*\(\s*\)\s*\{|requestAnimationFrame|setInterval|setTimeout/.test(codeLower);
    
    if (hasAnimationRequest && !hasAnimationCode) {
      issues.push('Prompt requests animation but code appears static');
    }

    // Interaction checks
    const interactionKeywords = ['click', 'mouse', 'interactive', 'drag', 'hover'];
    const hasInteractionRequest = interactionKeywords.some(kw => promptLower.includes(kw));
    const hasInteractionCode = /\b(mousePressed|mouseClicked|mouseMoved|mouseDragged|onclick|addEventListener.*click|addEventListener.*mouse)/.test(codeLower);
    
    if (hasInteractionRequest && !hasInteractionCode) {
      issues.push('Prompt requests interactivity but code lacks event handlers');
    }

    // Particle system check
    if (promptLower.includes('particle') && !codeLower.includes('particle') && !codeLower.includes('particles')) {
      issues.push('Prompt asks for particle system but no particles found in code');
    }

    return { issues };
  }
}
