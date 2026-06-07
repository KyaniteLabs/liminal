/**
 * Simple Prompt Builder - Tier-based, not provider-specific
 * 
 * Builds prompts based on model capability tier:
 * - FLAGSHIP: Concise, can handle complex instructions
 * - MEDIUM: Detailed instructions
 * - LOCAL: Very explicit, few-shot examples
 * - TINY: Minimal, get straight to the point
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { 
  detectModelTier, 
  getModelProfile,
  type ModelTier 
} from './ModelTier.js';
import type { LLMConfig } from './LLMClient.js';
import { Logger } from '../utils/Logger.js';

const PROMPT_BUILDER_ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '../..');

export interface PromptContext {
  // Core identity
  soul?: string;           // From SOUL.md
  
  // Constraints and rules
  rules?: string;          // From PROJECT_RULES.md
  
  // Domain knowledge (variable size based on tier)
  domainDocs?: string;     // From docs/domains/*.md
  
  // Memory (recent only)
  recentAdaptations?: string[];
  userPreferences?: string;
  
  // Generation specific
  userRequest: string;
  domain: string;
}

export interface BuiltPrompt {
  system: string;
  user: string;
  // For models that don't support system prompts
  combined?: string;
}

export class PromptBuilder {
  private tier: ModelTier;
  private profile: ReturnType<typeof getModelProfile>;

  constructor(config: LLMConfig) {
    this.tier = detectModelTier(config);
    this.profile = getModelProfile(this.tier);
  }

  /**
   * Curated palette/style families. The generator was defaulting to a
   * dark-background + neon-glow monoculture; offering a deliberate, varied
   * palette (chosen stably per-request) breaks that and lifts contrast.
   */
  private static readonly PALETTE_FAMILIES = [
    'warm sunset — amber, coral and rose on a soft cream ground',
    'cool mint and teal on near-white, airy and high-key',
    'monochrome ink — a single hue from light to dark, restrained and elegant',
    'earthy terracotta, ochre and sage — natural and grounded',
    'bold primaries (red/blue/yellow) with generous negative space, Bauhaus-clean',
    'muted editorial — slate and bone with one saturated accent',
    'duotone — only two contrasting hues, posterized and graphic',
    'iridescent pastel — peach, lavender and sky, dreamy but legible',
    'high-contrast black-and-white with a single electric accent',
    'deep jewel tones — emerald, sapphire and garnet, richly lit',
  ];
  private static readonly AUDIO_TEXTURES = [
    'sparse and percussive, with space between events',
    'warm pad-driven and slowly evolving',
    'bright, arpeggiated and rhythmic',
    'lo-fi, detuned and intimate',
    'glassy, bell-like tones with long decay',
  ];

  /** Stable string hash so the same prompt yields the same suggestion (cache-safe). */
  private static stableHash(s: string): number {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0);
  }

  /**
   * Aesthetic directive injected into every creative generation. Pushes palette
   * diversity, strong figure/ground contrast, and deliberate composition —
   * tailored to visual / audio / text domains.
   */
  private aestheticDirective(ctx: PromptContext): string {
    const d = (ctx.domain || '').toLowerCase();
    const seed = PromptBuilder.stableHash(ctx.userRequest || ctx.domain || '');
    const pick = <T>(arr: readonly T[]): T => arr[seed % arr.length];
    const visual = ['p5', 'shader', 'three', 'hydra', 'svg', 'kinetic', 'hyperframes', 'html', 'revideo'].includes(d);
    const audio = ['tone', 'strudel', 'music'].includes(d);
    if (audio) {
      return [
        '<aesthetics>',
        `Unless the request specifies a mood, lean toward: ${pick(PromptBuilder.AUDIO_TEXTURES)}.`,
        'Vary dynamics, timbre and rhythm over time — never a single flat repeating loop.',
        '</aesthetics>',
      ].join('\n');
    }
    if (visual) {
      return [
        '<aesthetics>',
        '- Composition: deliberate focal point, intentional negative space, balanced (do not just center everything).',
        `- Palette: unless the request names colors/mood, commit to ONE specific palette — e.g. ${pick(PromptBuilder.PALETTE_FAMILIES)}. Do NOT default to a dark background with neon glow unless the concept truly calls for it.`,
        '- Contrast is MANDATORY and bidirectional: place the background and the subject at OPPOSITE ends of the lightness scale. A LIGHT background requires dark/deeply-saturated subjects; a DARK background requires bright/luminous subjects. Aim for a large lightness gap. NEVER light-on-light, dark-on-dark, or low-saturation tones on a similar-value ground — if a viewer might struggle to see the subject, raise the contrast.',
        '- Aim for work a senior designer would be proud of: refined and intentional, not generic.',
        '</aesthetics>',
      ].join('\n');
    }
    return [
      '<aesthetics>',
      'Favor strong structure, rhythm and legibility; high-contrast text against its ground; let the form itself be expressive.',
      '</aesthetics>',
    ].join('\n');
  }

  /**
   * Build a prompt for the detected tier
   */
  build(context: PromptContext): BuiltPrompt {
    switch (this.tier) {
      case 'flagship':
        return this.buildFlagshipPrompt(context);
      case 'medium':
        return this.buildMediumPrompt(context);
      case 'local':
        return this.buildLocalPrompt(context);
      case 'tiny':
        return this.buildTinyPrompt(context);
    }
  }

  /**
   * FLAGSHIP: Concise, structured, can handle complexity
   */
  private buildFlagshipPrompt(ctx: PromptContext): BuiltPrompt {
    const system = [
      ctx.soul || 'You are a creative coding assistant.',
      '',
      '<rules>',
      ctx.rules || 'Output valid code only.',
      '</rules>',
      '',
      ctx.domainDocs ? `<${ctx.domain}_docs>\n${ctx.domainDocs}\n</${ctx.domain}_docs>` : '',
      '',
      ctx.userPreferences ? `<user_prefs>\n${ctx.userPreferences}\n</user_prefs>` : '',
    ].filter(Boolean).join('\n');

    const user = [
      '<request>',
      ctx.userRequest,
      '</request>',
      '',
      this.aestheticDirective(ctx),
      '',
      '<instruction>',
      `Generate ${ctx.domain} code. Output ONLY code, no explanations.`,
      '</instruction>',
    ].join('\n');

    return { system, user };
  }

  /**
   * MEDIUM: More detailed instructions
   */
  private buildMediumPrompt(ctx: PromptContext): BuiltPrompt {
    const system = [
      ctx.soul || 'You are a creative coding assistant.',
      '',
      '<rules>',
      '1. ' + (ctx.rules || 'Output valid code only.'),
      '2. Output code only unless the caller explicitly asks for explanation.',
      '3. Include necessary imports and setup.',
      '</rules>',
      '',
      ctx.domainDocs ? `<domain_knowledge name="${ctx.domain}">\n${ctx.domainDocs}\n</domain_knowledge>` : '',
    ].filter(Boolean).join('\n');

    const user = [
      '<request>',
      ctx.userRequest,
      '</request>',
      '',
      this.aestheticDirective(ctx),
      '',
      '<instruction>',
      'Generate valid ' + ctx.domain + ' code.',
      'Return code only.',
      '</instruction>',
    ].join('\n');

    return { system, user };
  }

  /**
   * LOCAL: Very explicit, few-shot examples
   */
  private buildLocalPrompt(ctx: PromptContext): BuiltPrompt {
    // Include a simple example for few-shot learning
    const example = this.getExample(ctx.domain);

    const system = [
      'You generate code.',
      '',
      '<rules>',
      '- Output ONLY code',
      '- No explanations',
      '- Valid ' + ctx.domain + ' code',
      '</rules>',
      '',
      ctx.domainDocs ? `<domain_summary name="${ctx.domain}">\n${this.summarizeDocs(ctx.domainDocs, 500)}\n</domain_summary>` : '',
    ].filter(Boolean).join('\n');

    const user = [
      '<example>',
      example,
      '</example>',
      '',
      '<request>',
      ctx.userRequest,
      '</request>',
      '',
      this.aestheticDirective(ctx),
      '',
      '<instruction>',
      'Return executable code only.',
      '</instruction>',
    ].join('\n');

    return { system, user };
  }

  /**
   * TINY: Minimal context, get to the point
   */
  private buildTinyPrompt(ctx: PromptContext): BuiltPrompt {
    // No system prompt for tiny models - combine everything
    const combined = [
      `<task domain="${ctx.domain}">`,
      ctx.userRequest,
      '</task>',
      '<rules>code only; no explanations</rules>',
    ].join('\n');

    return {
      system: '',
      user: combined,
      combined,
    };
  }

  /**
   * Load and assemble context from markdown files
   */
  static async loadContext(
    domain: string,
    userRequest: string,
    memoryOptions?: {
      recentAdaptations?: string[];
      userPreferences?: string;
    }
  ): Promise<PromptContext> {
    const ctx: PromptContext = {
      userRequest,
      domain,
    };

    // Try to load SOUL.md
    try {
      ctx.soul = await readFile(join(PROMPT_BUILDER_ROOT, 'SOUL.md'), 'utf-8');
    } catch (err) {
      Logger.debug('PromptBuilder', 'SOUL.md not found, using default soul:', err);
      ctx.soul = 'You are Sinter, a creative coding assistant.';
    }

    // Try to load PROJECT_RULES.md
    try {
      ctx.rules = await readFile(join(PROMPT_BUILDER_ROOT, 'PROJECT_RULES.md'), 'utf-8');
    } catch (err) {
      Logger.debug('PromptBuilder', 'PROJECT_RULES.md not found, using default rules:', err);
      ctx.rules = 'Output valid, working code only.';
    }

    // Try to load domain docs
    try {
      ctx.domainDocs = await readFile(
        join(PROMPT_BUILDER_ROOT, 'docs', 'domains', `${domain}.md`),
        'utf-8'
      );
    } catch (err) {
      Logger.debug('PromptBuilder', `Domain docs for '${domain}' not found:`, err);
    }

    // Add memory if provided
    if (memoryOptions) {
      ctx.recentAdaptations = memoryOptions.recentAdaptations;
      ctx.userPreferences = memoryOptions.userPreferences;
    }

    return ctx;
  }

  /**
   * Get a simple example for few-shot prompting
   */
  private getExample(domain: string): string {
    const examples: Record<string, string> = {
      p5: `function setup() {
  createCanvas(400, 400);
}
function draw() {
  background(220);
  circle(200, 200, 50);
}`,
      shader: `void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  gl_FragColor = vec4(uv, 0.5, 1.0);
}`,
      three: `const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, width / height);
const renderer = new THREE.WebGLRenderer();
renderer.render(scene, camera);`,
    };
    return examples[domain] || '// Code here';
  }

  /**
   * Summarize long docs to fit token budget
   */
  private summarizeDocs(docs: string, maxChars: number): string {
    if (docs.length <= maxChars) return docs;
    
    // Take first N characters (usually has the most important info)
    return docs.slice(0, maxChars) + '\n\n[... docs truncated ...]';
  }

  /**
   * Get info about the detected tier
   */
  getTierInfo(): { tier: ModelTier; contextWindow: number } {
    return {
      tier: this.tier,
      contextWindow: this.profile.contextWindow,
    };
  }
}
