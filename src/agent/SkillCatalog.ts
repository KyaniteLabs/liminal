/**
 * SkillCatalog — Phase 12
 *
 * Wraps SkillLoader.listSkills() with product-mode filtering
 * and text search. Used by TUI `/skills` command to show
 * available skills filtered by the active mode.
 */

import { SkillLoader } from '../harness/skills/SkillLoader.js';
import type { LoadedSkill } from '../harness/skills/SkillLoader.js';
import type { ProductMode } from './ProductMode.js';

export interface CatalogEntry {
  name: string;
  description: string;
  mode?: string;
  profile?: string;
  args?: string;
  source: LoadedSkill['source'];
}

export class SkillCatalog {
  private readonly loader: SkillLoader;

  constructor(loader?: SkillLoader) {
    this.loader = loader ?? new SkillLoader();
  }

  /**
   * List all skills, optionally filtered by active product mode.
   * Skills with no mode specified are always included.
   */
  async list(filter?: { mode?: ProductMode; query?: string }): Promise<CatalogEntry[]> {
    const all = await this.loader.listSkills();
    let entries = all.map(this.toEntry);

    if (filter?.mode) {
      entries = entries.filter(e => !e.mode || e.mode === filter.mode);
    }

    if (filter?.query) {
      const q = filter.query.toLowerCase();
      entries = entries.filter(e =>
        e.name.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q),
      );
    }

    return entries;
  }

  /**
   * Get a single skill by name.
   */
  async get(name: string): Promise<CatalogEntry | null> {
    const skill = await this.loader.loadSkill(name);
    return skill ? this.toEntry(skill) : null;
  }

  private toEntry(skill: LoadedSkill): CatalogEntry {
    return {
      name: skill.name,
      description: skill.description,
      mode: skill.mode,
      profile: skill.profile,
      args: skill.args,
      source: skill.source,
    };
  }
}
