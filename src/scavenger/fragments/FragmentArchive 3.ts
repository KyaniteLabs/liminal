/**
 * FragmentArchive — Loads and queries the curated fragment archive.
 *
 * The archive is a hand-curated JSON of the most valuable insights,
 * personas, prompts, and techniques mined from the liminal-archive/
 * inbox (247 files from the Token Mill and Atelier era).
 *
 * Usage:
 *   const archive = FragmentArchive.load();
 *   const personas = archive.getByCategory('personas');
 *   const randomConstraint = archive.randomConstraint();
 *   const creativeSeeds = archive.getByTag('creative-writing');
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

interface Fragment {
  id: string;
  content: string;
  source: string;
  domain?: string;
  score?: number;
  tags?: string[];
  title?: string;
  description?: string;
  category?: string;
  [key: string]: unknown;
}

interface ArchiveData {
  version: string;
  extracted: string;
  source: string;
  sourceFiles: number;
  curator: string;
  description: string;
  categories: Record<string, {
    description: string;
    fragments: Fragment[];
  }>;
}

export class FragmentArchive {
  private data: ArchiveData | null = null;
  private dataPath: string;

  constructor(dataPath?: string) {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    this.dataPath = dataPath ?? path.join(__dirname, 'fragments.json');
  }

  /**
   * Load the archive from disk.
   */
  async load(): Promise<void> {
    const raw = await fs.readFile(this.dataPath, 'utf-8');
    this.data = JSON.parse(raw) as ArchiveData;
  }

  /**
   * Ensure the archive is loaded.
   */
  private ensureLoaded(): void {
    if (!this.data) {
      throw new Error('FragmentArchive not loaded. Call load() first.');
    }
  }

  /**
   * Get all fragments from a specific category.
   */
  getByCategory(category: string): Fragment[] {
    this.ensureLoaded();
    return this.data!.categories[category]?.fragments ?? [];
  }

  /**
   * Get all category names.
   */
  getCategories(): string[] {
    this.ensureLoaded();
    return Object.keys(this.data!.categories);
  }

  /**
   * Get a specific fragment by its ID.
   */
  getById(id: string): Fragment | undefined {
    this.ensureLoaded();
    for (const cat of Object.values(this.data!.categories)) {
      const found = cat.fragments.find(f => f.id === id);
      if (found) return found;
    }
    return undefined;
  }

  /**
   * Get all fragments matching a tag.
   */
  getByTag(tag: string): Fragment[] {
    this.ensureLoaded();
    const results: Fragment[] = [];
    for (const cat of Object.values(this.data!.categories)) {
      for (const frag of cat.fragments) {
        if (frag.tags?.includes(tag)) {
          results.push(frag);
        }
      }
    }
    return results;
  }

  /**
   * Get a random refinement constraint.
   */
  randomConstraint(): string | undefined {
    const constraints = this.getByCategory('constraints');
    if (constraints.length === 0) return undefined;
    return constraints[Math.floor(Math.random() * constraints.length)].content;
  }

  /**
   * Get all persona definitions.
   */
  getPersonas(): Fragment[] {
    return this.getByCategory('personas');
  }

  /**
   * Get all prompt seeds, optionally filtered by category.
   */
  getPromptSeeds(category?: string): Fragment[] {
    const seeds = this.getByCategory('prompt_seeds');
    if (category) {
      return seeds.filter(s => s.category === category);
    }
    return seeds;
  }

  /**
   * Get a random prompt seed.
   */
  randomPromptSeed(): string | undefined {
    const seeds = this.getPromptSeeds();
    if (seeds.length === 0) return undefined;
    return seeds[Math.floor(Math.random() * seeds.length)].content;
  }

  /**
   * Get creative output fragments, sorted by score descending.
   */
  getTopCreativeOutputs(limit: number = 5): Fragment[] {
    return this.getByCategory('creative_outputs')
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, limit);
  }

  /**
   * Get all fragments across all categories.
   */
  getAllFragments(): Fragment[] {
    this.ensureLoaded();
    const results: Fragment[] = [];
    for (const cat of Object.values(this.data!.categories)) {
      for (const frag of cat.fragments) {
        results.push({ ...frag, _category: cat.description });
      }
    }
    return results;
  }

  /**
   * Search fragments by content substring.
   */
  search(query: string): Fragment[] {
    const lower = query.toLowerCase();
    return this.getAllFragments().filter(f =>
      f.content?.toLowerCase().includes(lower) ||
      f.title?.toLowerCase().includes(lower) ||
      f.description?.toLowerCase().includes(lower)
    );
  }

  /**
   * Convenience: load and return archive.
   */
  static async load(dataPath?: string): Promise<FragmentArchive> {
    const archive = new FragmentArchive(dataPath);
    await archive.load();
    return archive;
  }
}
