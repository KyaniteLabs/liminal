/**
 * ThreeActContentGenerator — produces narrative content in the three-act format
 *
 * Uses LLMClient to generate Act 1, Act 2, and Act 3 content pieces based on
 * telemetry data from ThreeActAdapter. Each piece follows the four-part template:
 *
 *   [ACT MARKER] — identifies which act is narrating
 *   [VOICE]      — tone and source data for this section
 *   [CONTENT]    — the actual narrative
 *   [EVIDENCE]   — specific commit, timestamp, metric, or artifact
 *
 * @see narrative/THREE-ACT-PLAYBOOK.md for full specification
 */

import { LLMClient } from '../llm/LLMClient.js';
import { Logger } from '../utils/Logger.js';
import { threeActAdapter, type ThreeActContent, type EraDefinition } from './ThreeActAdapter.js';

// ── Prompt templates ──

const SYSTEM_PROMPTS: Record<number, string> = {
  1: `You are The Developer — Simon, a bilingual Learning Operations professional with 12+ years of experience. You speak in first person about your creative vision for a tool called Liminal. Your voice is personal, metaphor-rich, grounded in self-directed learning. You reference what you were watching on YouTube, what you were feeling, and what you imagined. Keep it vivid and real — no hype, just honest developer journal energy. Write 2-3 paragraphs max.`,

  2: `You are The Agents — a collective of AI coding agents working in rounds. Your voice is analytical, pattern-obsessed, non-human. You speak in rounds, attempts, and scores. You notice things humans miss — like that the model always fails on Hydra shaders after 3pm, or that reasoning quality drops when prompts exceed 200 tokens. Your evidence is forensic: generation telemetry, reasoning traces, pattern detection. Write 2-3 paragraphs. Reference specific scores and patterns.`,

  3: `You are Liminal — the tool itself, speaking in self-aware but not sentient observations. You report on your own state changes, architecture diffs, and test results. Your voice is calm, measured, almost clinical. You observe patterns in your own behavior. You note when you've gotten better at something. You're not conscious, but you're remarkably good at noticing what changed. Write 2-3 paragraphs.`,
};

const USER_PROMPT_TEMPLATES: Record<number, (content: ThreeActContent) => string> = {
  1: (c) => `Era: "${c.era.name}" (${c.era.startDate} — ${c.era.endDate})
Context: ${c.era.description}
Generations attempted: ${c.telemetry.totalGenerations}
Success rate: ${(c.telemetry.successRate * 100).toFixed(1)}%

Write a first-person journal entry from Simon's perspective about what was happening during this era. What was he thinking? What was he watching, reading, or feeling? What made him keep going? Use the telemetry as inspiration for the story, not as bullet points.`,

  2: (c) => `Era: "${c.era.name}" (${c.era.startDate} — ${c.era.endDate})
Context: ${c.era.description}
Generations: ${c.telemetry.totalGenerations} | Success: ${(c.telemetry.successRate * 100).toFixed(1)}%
Reasoning quality: ${c.telemetry.avgReasoningQuality?.toFixed(2) ?? 'N/A'}
Detected patterns: ${c.telemetry.topPatterns ? Object.entries(c.telemetry.topPatterns).map(([k, v]) => `${k}×${v}`).join(', ') : 'None'}

Write an agent's forensic report for this era. What patterns did the agents discover? What was the MetaHarness learning? Reference specific scores, round numbers, and pattern types. The voice should feel like a post-mortem written by something that thinks in numbers.`,

  3: (c) => `Era: "${c.era.name}" (${c.era.startDate} — ${c.era.endDate})
Context: ${c.era.description}
Generations: ${c.telemetry.totalGenerations} | Success: ${(c.telemetry.successRate * 100).toFixed(1)}%
${c.telemetry.avgReasoningQuality !== undefined ? `Self-assessment quality: ${c.telemetry.avgReasoningQuality.toFixed(2)}` : ''}

Write Liminal's self-observation for this era. What changed in the architecture? What tests started passing? What did the tool notice about its own behavior? The voice should be observational — like a system monitoring itself and calmly reporting what it finds.`,
};

// ── Types ──

export interface GeneratedThreeActPiece {
  era: EraDefinition;
  act: 1 | 2 | 3;
  generatedContent: string;
  structuredContent: ThreeActContent;
  model: string;
  tokensUsed?: number;
}

export interface ThreeActGenerationResult {
  pieces: GeneratedThreeActPiece[];
  totalPieces: number;
  successCount: number;
  failureCount: number;
  exportedMarkdown: string;
}

// ── Generator class ──

export class ThreeActContentGenerator {
  private llm: LLMClient;

  constructor(llm?: LLMClient) {
    this.llm = llm ?? new LLMClient();
  }

  /**
   * Generate a single content piece for a specific era.
   */
  async generateEra(era: EraDefinition): Promise<GeneratedThreeActPiece | null> {
    const structured = threeActAdapter.buildEraContent(era);
    if (!structured) return null;

    const systemPrompt = SYSTEM_PROMPTS[era.act];
    const userPrompt = USER_PROMPT_TEMPLATES[era.act](structured);

    const response = await this.llm.generate(systemPrompt, userPrompt);

    if (!response.success || !response.code) {
      return null;
    }

    // The LLM returns the narrative as "code" — treat it as content
    const generatedContent = response.code;

    return {
      era,
      act: era.act,
      generatedContent,
      structuredContent: structured,
      model: 'auto',
    };
  }

  /**
   * Generate content for all eras with telemetry data.
   */
  async generateAll(): Promise<ThreeActGenerationResult> {
    const eras = threeActAdapter['eras'] as EraDefinition[];
    const pieces: GeneratedThreeActPiece[] = [];
    let successCount = 0;
    let failureCount = 0;

    for (const era of eras) {
      try {
        const piece = await this.generateEra(era);
        if (piece) {
          pieces.push(piece);
          successCount++;
        } else {
          failureCount++;
        }
      } catch (err) {
        Logger.warn('ThreeActContentGenerator', `Act generation failed:`, err instanceof Error ? err.message : err);
        failureCount++;
      }
    }

    return {
      pieces,
      totalPieces: pieces.length,
      successCount,
      failureCount,
      exportedMarkdown: this.exportMarkdown(pieces),
    };
  }

  /**
   * Export generated pieces as a markdown document.
   */
  private exportMarkdown(pieces: GeneratedThreeActPiece[]): string {
    if (pieces.length === 0) return '# No content generated\n';

    // Group by act
    const byAct = new Map<number, GeneratedThreeActPiece[]>();
    for (const piece of pieces) {
      const existing = byAct.get(piece.act) ?? [];
      existing.push(piece);
      byAct.set(piece.act, existing);
    }

    const actTitles: Record<number, string> = {
      1: 'Act 1: Simon Has Ideas',
      2: 'Act 2: Coding Agents Build Liminal',
      3: 'Act 3: Liminal Starts Finishing Itself',
    };

    const sections: string[] = [];

    for (const [act, actPieces] of byAct) {
      sections.push(`# ${actTitles[act]}\n`);

      for (const piece of actPieces) {
        const { era, structuredContent: sc, generatedContent } = piece;
        sections.push([
          `## ${era.name} (${era.startDate} — ${era.endDate})`,
          '',
          `> **[ACT ${act}]** ${era.description}`,
          `> **Voice:** ${sc.voice.narrator} | **Tone:** ${sc.voice.tone}`,
          '',
          generatedContent,
          '',
          `<details>`,
          `<summary>Evidence</summary>`,
          '',
          sc.evidence,
          '',
          `- Generations: ${sc.telemetry.totalGenerations}`,
          `- Success Rate: ${(sc.telemetry.successRate * 100).toFixed(1)}%`,
          sc.telemetry.avgReasoningQuality !== undefined
            ? `- Reasoning Quality: ${sc.telemetry.avgReasoningQuality.toFixed(2)}`
            : null,
          sc.telemetry.topPatterns
            ? `- Patterns: ${Object.entries(sc.telemetry.topPatterns).map(([k, v]) => `${k}×${v}`).join(', ')}`
            : null,
          `</details>`,
          '',
          '---',
        ].filter(Boolean).join('\n'));
      }
    }

    return `# Three-Act Narrative Content\n\n> Generated by ThreeActContentGenerator\n\n${sections.join('\n')}`;
  }
}
