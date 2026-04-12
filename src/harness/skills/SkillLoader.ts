import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export interface LoadedSkill {
  name: string;
  description: string;
  content: string;
  path: string;
  directory: string;
  source: 'repo' | 'agents' | 'codex';
}

interface SkillFrontmatter {
  name?: string;
  description?: string;
}

function parseFrontmatter(raw: string): { meta: SkillFrontmatter; body: string } {
  if (!raw.startsWith('---\n')) {
    return { meta: {}, body: raw.trim() };
  }

  const end = raw.indexOf('\n---\n', 4);
  if (end === -1) {
    return { meta: {}, body: raw.trim() };
  }

  const frontmatter = raw.slice(4, end).trim();
  const body = raw.slice(end + 5).trim();
  const meta: SkillFrontmatter = {};

  for (const line of frontmatter.split('\n')) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    const [, key, value] = match;
    if (key === 'name' || key === 'description') {
      meta[key] = value.replace(/^["']|["']$/g, '').trim();
    }
  }

  return { meta, body };
}

function defaultRoots(): Array<{ root: string; source: LoadedSkill['source'] }> {
  const cwd = process.cwd();
  const home = os.homedir();
  return [
    { root: path.join(cwd, '.skills'), source: 'repo' },
    { root: path.join(home, '.agents', 'skills'), source: 'agents' },
    { root: path.join(home, '.codex', 'skills'), source: 'codex' },
  ];
}

export class SkillLoader {
  constructor(private readonly roots: string[] = defaultRoots().map(entry => entry.root)) {}

  async loadSkill(name: string): Promise<LoadedSkill | null> {
    for (const root of this.roots) {
      const skill = await this.tryLoadSkill(root, name);
      if (skill) return skill;
    }
    return null;
  }

  async listSkills(): Promise<LoadedSkill[]> {
    const skills: LoadedSkill[] = [];
    for (const root of this.roots) {
      const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const loaded = await this.tryLoadSkill(root, entry.name);
        if (loaded) skills.push(loaded);
      }
    }
    return skills;
  }

  private async tryLoadSkill(root: string, name: string): Promise<LoadedSkill | null> {
    const skillDir = path.join(root, name);
    const skillPath = path.join(skillDir, 'SKILL.md');
    const raw = await fs.readFile(skillPath, 'utf-8').catch(() => null);
    if (!raw) return null;

    const { meta, body } = parseFrontmatter(raw);
    return {
      name: meta.name || name,
      description: meta.description || '',
      content: body,
      path: skillPath,
      directory: skillDir,
      source: this.detectSource(root),
    };
  }

  private detectSource(root: string): LoadedSkill['source'] {
    const normalized = root.replace(/\\/g, '/');
    if (normalized.endsWith('/.agents/skills')) return 'agents';
    if (normalized.endsWith('/.codex/skills')) return 'codex';
    return 'repo';
  }
}
