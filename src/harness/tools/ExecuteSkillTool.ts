import { Tool, type ToolResult } from './types.js';
import { SkillLoader, type LoadedSkill } from '../skills/SkillLoader.js';

export interface ExecuteSkillParams {
  name: string;
}

export interface ExecuteSkillResult {
  skill: LoadedSkill;
}

export class ExecuteSkillTool extends Tool {
  readonly name = 'executeSkill';
  readonly description = 'Load a local SKILL.md and return its instructions for harness planning';

  private readonly loader: SkillLoader;

  constructor(roots?: string[]) {
    super();
    this.loader = new SkillLoader(roots);
  }

  async execute(params: unknown): Promise<ToolResult<ExecuteSkillResult>> {
    const { name } = (params || {}) as ExecuteSkillParams;
    if (typeof name !== 'string' || name.trim() === '') {
      return {
        success: false,
        error: 'executeSkill requires params.name to be a non-empty skill name, for example {"name":"karpathy-guidelines"}. This tool loads SKILL.md instructions; it cannot run shell commands. Use gitStatus for repository state, readFile/listDir/search/searchCode for inspection, or typeCheck/runBuild/runTests for verification.',
      };
    }

    const skill = await this.loader.loadSkill(name.trim());
    if (!skill) {
      return { success: false, error: `Skill not found: ${name}` };
    }

    return {
      success: true,
      data: { skill },
    };
  }
}

export const executeSkillTool = new ExecuteSkillTool();
