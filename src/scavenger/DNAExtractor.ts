import type { ProjectDNA } from './types.js';
import fs from 'fs/promises';
import path from 'path';

const INDICATOR_FILES = [
  'package.json',
  'README.md',
  'CLAUDE.md',
  'CONTEXT.md',
  'PRD.md',
  'SPEC.md',
  'src/index.ts',
  'src/index.js',
  'src/main.ts',
  'src/main.py',
  'main.py',
  'app.py',
  'Makefile',
  'pyproject.toml',
  'Cargo.toml',
  'go.mod',
];

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  'generative-art': ['p5', 'canvas', 'shader', 'glsl', 'processing', 'noise', 'particle'],
  'web-app': ['react', 'vue', 'angular', 'express', 'next', 'nuxt', 'svelte'],
  'api': ['rest', 'graphql', 'endpoint', 'controller', 'router', 'middleware'],
  'ml-ai': ['model', 'training', 'neural', 'tensor', 'pytorch', 'tensorflow', 'scikit'],
  'data': ['pipeline', 'etl', 'transform', 'aggregate', 'database', 'sql'],
  'creative-coding': ['shader', 'glsl', 'webgl', 'canvas', 'generative', 'algorithm'],
  'music': ['audio', 'sound', 'oscillator', 'synth', 'midi', 'bpm', 'frequency'],
  'ceramics': ['glaze', 'ceramic', 'kiln', 'clay', 'material', 'formula'],
};

export class DNAExtractor {
  /**
   * Extract DNA from a project directory.
   */
  static async extract(projectPath: string): Promise<ProjectDNA> {
    const projectName = path.basename(projectPath);
    const domain = await this.detectDomain(projectPath);
    const coreLogic = await this.extractCoreLogic(projectPath);
    const constraints = await this.extractConstraints(projectPath);
    const patterns = await this.extractPatterns(projectPath);
    const prompts = await this.extractPrompts(projectPath);

    return {
      name: projectName,
      domain,
      coreLogic,
      constraints,
      patterns,
      prompts,
      extractedAt: new Date().toISOString(),
      sourcePath: projectPath,
    };
  }

  /**
   * Extract DNA from a spec/PRD file directly.
   */
  static async extractFromSpec(specPath: string): Promise<ProjectDNA> {
    const content = await fs.readFile(specPath, 'utf-8');
    const projectName = path.basename(specPath, path.extname(specPath));
    const domain = this.detectDomainFromContent(content);
    const lines = content.split('\n');

    // Extract core logic: look for sections about architecture, engine, core, system
    const coreLogic = this.extractSection(lines, ['architecture', 'engine', 'core logic', 'system design', 'how it works', 'technical approach']);
    const constraints = this.extractSection(lines, ['constraints', 'requirements', 'limitations', 'must', 'shall']);
    const patterns = this.extractSection(lines, ['patterns', 'conventions', 'standards', 'approach']);

    // Extract prompts: look for quoted prompt blocks
    const promptBlocks = content.match(/```[\s\S]*?```/g) ?? [];
    const prompts = promptBlocks.length > 0
      ? promptBlocks.map(b => b.replace(/```\w*\n?/g, '').trim()).filter(b => b.length > 20)
      : [];

    return {
      name: projectName,
      domain,
      coreLogic: coreLogic || 'No core logic section found in spec.',
      constraints: constraints ? constraints.split('\n').map(l => l.replace(/^[-*]\s*/, '').trim()).filter(l => l.length > 0) : [],
      patterns: patterns ? patterns.split('\n').filter(l => l.trim()) : [],
      prompts,
      extractedAt: new Date().toISOString(),
      sourcePath: specPath,
    };
  }

  /**
   * Register DNA into a registry (inject as few-shot context).
   */
  static registerDNA(dna: ProjectDNA, registry: Map<string, ProjectDNA>): void {
    registry.set(dna.domain, dna);
  }

  /**
   * Scan a root directory for potential dead projects (carcasses).
   */
  static async scanForCarcasses(rootPath: string): Promise<string[]> {
    const carcasses: string[] = [];

    try {
      const entries = await fs.readdir(rootPath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build') continue;

        const fullPath = path.join(rootPath, entry.name);
        const isProject = await this.isProjectDir(fullPath);
        if (isProject) {
          carcasses.push(fullPath);
        }
      }
    } catch (err) {
      console.warn('DNAExtractor.scanForCarcasses failed:', err);
    }

    return carcasses;
  }

  /**
   * Load DNA for a specific domain from saved DNA files.
   */
  static async loadDNAForDomain(domain: string, outputDir: string = './dna'): Promise<ProjectDNA | null> {
    try {
      const filePath = path.join(outputDir, `${domain}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as ProjectDNA;
    } catch (err) {
      console.warn('DNAExtractor.loadDNAForDomain failed:', err);
      return null;
    }
  }

  // --- Private helpers ---

  private static async detectDomain(projectPath: string): Promise<string> {
    // Check package.json first
    const pkgPath = path.join(projectPath, 'package.json');
    try {
      const pkgContent = await fs.readFile(pkgPath, 'utf-8');
      return this.detectDomainFromContent(pkgContent);
    } catch (err) {
      console.warn('DNAExtractor.detectDomain (package.json) failed:', err);
      // Fall through to scanning files
    }

    // Scan a few key files for domain keywords
    for (const file of ['README.md', 'CLAUDE.md', 'CONTEXT.md']) {
      try {
        const content = await fs.readFile(path.join(projectPath, file), 'utf-8');
        const domain = this.detectDomainFromContent(content);
        if (domain !== 'unknown') return domain;
      } catch (err) {
        console.warn(`DNAExtractor.detectDomain (${file}) failed:`, err);
        continue;
      }
    }

    return 'unknown';
  }

  private static detectDomainFromContent(content: string): string {
    const lower = content.toLowerCase();
    let bestDomain = 'unknown';
    let bestScore = 0;

    for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
      let score = 0;
      for (const keyword of keywords) {
        if (lower.includes(keyword)) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        bestDomain = domain;
      }
    }

    return bestDomain;
  }

  private static async extractCoreLogic(projectPath: string): Promise<string> {
    // Try to read CLAUDE.md, README.md, or CONTEXT.md
    for (const file of ['CLAUDE.md', 'CONTEXT.md', 'README.md']) {
      try {
        const content = await fs.readFile(path.join(projectPath, file), 'utf-8');
        const lines = content.split('\n');
        const section = this.extractSection(lines, ['architecture', 'engine', 'core logic', 'system', 'how it works', 'pipeline', 'methodology']);
        if (section) return section;
      } catch (err) {
        console.warn(`DNAExtractor.extractCoreLogic (${file}) failed:`, err);
        continue;
      }
    }
    return 'Core logic not found. Scan the project manually.';
  }

  private static async extractConstraints(projectPath: string): Promise<string[]> {
    for (const file of ['CLAUDE.md', 'CONTEXT.md', 'README.md', 'PRD.md', 'SPEC.md']) {
      try {
        const content = await fs.readFile(path.join(projectPath, file), 'utf-8');
        const lines = content.split('\n');
        const section = this.extractSection(lines, ['constraints', 'requirements', 'limitations', 'rules']);
        if (section) {
          return section.split('\n')
            .map(l => l.replace(/^[-*]\s*/, '').trim())
            .filter(l => l.length > 5);
        }
      } catch (err) {
        console.warn(`DNAExtractor.extractConstraints (${file}) failed:`, err);
        continue;
      }
    }
    return [];
  }

  private static async extractPatterns(projectPath: string): Promise<string[]> {
    const patterns: string[] = [];

    // Check for test files
    try {
      const testDir = path.join(projectPath, 'test');
      const entries = await fs.readdir(testDir).catch(() => []);
      if (entries.length > 0) patterns.push('has-test-suite');
    } catch (err) {
      console.warn('DNAExtractor.extractPatterns (test directory) failed:', err);
      // No test directory
    }

    // Check for config files
    const configFiles = ['tsconfig.json', '.eslintrc', '.prettierrc', 'jest.config.js'];
    for (const cf of configFiles) {
      try {
        await fs.access(path.join(projectPath, cf));
        patterns.push(`uses-${cf.replace(/^\./, '').replace(/\..*/, '')}`);
      } catch (err) {
        console.warn(`DNAExtractor.extractPatterns (${cf}) failed:`, err);
        continue;
      }
    }

    // Check source structure
    try {
      const srcFiles: string[] = await fs.readdir(path.join(projectPath, 'src')).catch((): string[] => []);
      if (srcFiles.includes('core')) patterns.push('has-core-module');
      if (srcFiles.includes('utils')) patterns.push('has-utils-module');
    } catch (err) {
      console.warn('DNAExtractor.extractPatterns (src directory) failed:', err);
      // No src directory
    }

    return patterns;
  }

  private static async extractPrompts(projectPath: string): Promise<string[]> {
    const prompts: string[] = [];

    // Look for prompt-related files
    const promptPatterns = ['prompt', 'PROMPT', 'template'];
    for (const entry of await fs.readdir(projectPath).catch(() => [])) {
      if (promptPatterns.some(p => entry.toLowerCase().includes(p.toLowerCase())) && entry.endsWith('.md')) {
        try {
          const content = await fs.readFile(path.join(projectPath, entry), 'utf-8');
          if (content.length > 50 && content.length < 5000) {
            prompts.push(content);
          }
        } catch (err) {
          console.warn(`DNAExtractor.extractPrompts (${entry}) failed:`, err);
          continue;
        }
      }
    }

    return prompts;
  }

  private static extractSection(lines: string[], headings: string[]): string | null {
    let capturing = false;
    const sectionLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim().toLowerCase();
      if (headings.some(h => trimmed.includes(h) && (trimmed.startsWith('#') || trimmed === h))) {
        if (capturing && sectionLines.length > 0) break; // Hit next section
        capturing = true;
        continue;
      }
      if (capturing) {
        if (trimmed.startsWith('#') && sectionLines.length > 0) break;
        if (trimmed === '') {
          if (sectionLines.length > 3) break; // End of section after content
          continue;
        }
        sectionLines.push(line.trim());
      }
    }

    return sectionLines.length > 0 ? sectionLines.join('\n') : null;
  }

  private static async isProjectDir(dirPath: string): Promise<boolean> {
    try {
      const entries = await fs.readdir(dirPath);
      return entries.some(e => INDICATOR_FILES.includes(e));
    } catch (err) {
      console.warn('DNAExtractor.isProjectDir failed:', err);
      return false;
    }
  }
}
