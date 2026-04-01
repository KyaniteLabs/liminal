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
import { 
  detectModelTier, 
  getModelProfile, 
  _trimContext,
  selectPromptStyle,
  type ModelTier 
} from './ModelTier.js';
import type { LLMConfig } from './LLMClient.js';

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
  private style: ReturnType<typeof selectPromptStyle>;

  constructor(config: LLMConfig) {
    this.tier = detectModelTier(config);
    this.profile = getModelProfile(this.tier);
    this.style = selectPromptStyle(this.tier);
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
      'RULES:',
      '1. ' + (ctx.rules || 'Output valid code only.'),
      '2. No explanations outside code comments.',
      '3. Include all necessary imports/setup.',
      '',
      ctx.domainDocs ? `DOMAIN KNOWLEDGE (${ctx.domain}):\n${ctx.domainDocs}` : '',
    ].filter(Boolean).join('\n');

    const user = [
      'REQUEST:',
      ctx.userRequest,
      '',
      'OUTPUT: Valid ' + ctx.domain + ' code.',
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
      'RULES:',
      '- Output ONLY code',
      '- No explanations',
      '- Valid ' + ctx.domain + ' code',
      '',
      ctx.domainDocs ? `ABOUT ${ctx.domain.toUpperCase()}:\n${this.summarizeDocs(ctx.domainDocs, 500)}` : '',
    ].filter(Boolean).join('\n');

    const user = [
      'EXAMPLE:',
      example,
      '',
      'NOW GENERATE:',
      ctx.userRequest,
    ].join('\n');

    return { system, user };
  }

  /**
   * TINY: Minimal context, get to the point
   */
  private buildTinyPrompt(ctx: PromptContext): BuiltPrompt {
    // No system prompt for tiny models - combine everything
    const combined = [
      `Generate ${ctx.domain} code for:`,
      '',
      ctx.userRequest,
      '',
      'RULES: code only, no explanations.',
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
      ctx.soul = await readFile(join(process.cwd(), 'SOUL.md'), 'utf-8');
    } catch {
      ctx.soul = 'You are Liminal, a creative coding assistant.';
    }

    // Try to load PROJECT_RULES.md
    try {
      ctx.rules = await readFile(join(process.cwd(), 'PROJECT_RULES.md'), 'utf-8');
    } catch {
      ctx.rules = 'Output valid, working code only.';
    }

    // Try to load domain docs
    try {
      ctx.domainDocs = await readFile(
        join(process.cwd(), 'docs', 'domains', `${domain}.md`),
        'utf-8'
      );
    } catch {
      // Domain docs are optional
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
