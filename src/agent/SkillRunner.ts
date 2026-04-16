/**
 * SkillRunner — Phase 12
 *
 * Resolves skill prompt templates and delegates execution through
 * the existing CreativeDelegate/EngineeringDelegate functions
 * already injected into the StudioAgent composition root.
 *
 * Skills are prompt templates — they don't call LLMs directly.
 * They expand {{variables}} in the template and return a prompt
 * string that the caller feeds to the appropriate delegate.
 */

import type { LoadedSkill } from '../harness/skills/SkillLoader.js';
import { SkillLoader } from '../harness/skills/SkillLoader.js';

/** Result of expanding a skill template */
export interface SkillRunResult {
  /** The skill that was run */
  skillName: string;
  /** The expanded prompt (template with variables filled in) */
  prompt: string;
  /** Which delegate to route to */
  target: 'creative' | 'engineering' | 'chat';
  /** Duration of skill resolution in ms */
  durationMs: number;
}

export class SkillRunner {
  private readonly loader: SkillLoader;

  constructor(loader?: SkillLoader) {
    this.loader = loader ?? new SkillLoader();
  }

  /**
   * Resolve a skill by name, expand its template, and return
   * a prompt + routing target.
   *
   * Template variables use {{variable}} syntax.
   * Built-in variables:
   *   {{input}} — the user's free-form input text
   *   {{date}}  — current date in ISO format
   */
  async resolve(
    skillName: string,
    userArgs: Record<string, string> = {},
  ): Promise<SkillRunResult | null> {
    const start = Date.now();

    const skill = await this.loader.loadSkill(skillName);
    if (!skill) return null;

    // Determine routing target from skill's mode/profile
    const target = this.inferTarget(skill);

    // Expand template variables
    const prompt = this.expandTemplate(skill.content, {
      input: userArgs.input ?? '',
      date: new Date().toISOString().split('T')[0],
      ...userArgs,
    });

    return {
      skillName: skill.name,
      prompt,
      target,
      durationMs: Date.now() - start,
    };
  }

  /**
   * Infer which delegate to route to based on skill metadata.
   */
  private inferTarget(skill: LoadedSkill): 'creative' | 'engineering' | 'chat' {
    if (skill.mode === 'make' || skill.mode === 'remix' || skill.profile === 'creative') {
      return 'creative';
    }
    if (skill.mode === 'improve' || skill.profile === 'engineering') {
      return 'engineering';
    }
    return 'chat';
  }

  /**
   * Expand {{variable}} placeholders in a template string.
   */
  private expandTemplate(template: string, vars: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
      return vars[key] ?? match;
    });
  }
}
