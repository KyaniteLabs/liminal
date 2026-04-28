import { describe, it, expect, beforeEach, afterEach } from 'vitest';
/**
 * DNAExtractor tests
 */

import { DNAExtractor } from '../../src/scavenger/DNAExtractor.js';
import type { ProjectDNA } from '../../src/scavenger/types.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('DNAExtractor', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dna-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('extract', () => {
    it('should extract DNA from a project with CLAUDE.md', async () => {
      await fs.writeFile(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-project' }));
      await fs.writeFile(path.join(tmpDir, 'CLAUDE.md'), `
# Test Project

## Core Logic

This project uses a generative pipeline with noise-based rendering.

## Constraints

- Must use p5.js
- No external dependencies beyond core
`);

      const dna = await DNAExtractor.extract(tmpDir);

      expect(dna.name).toBe(path.basename(tmpDir));
      expect(dna.coreLogic).toContain('generative pipeline');
      expect(dna.constraints.length).toBeGreaterThan(0);
    });

    it('should return unknown domain for empty project', async () => {
      await fs.writeFile(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'empty' }));
      await fs.writeFile(path.join(tmpDir, 'README.md'), 'No domain-specific content here.');

      const dna = await DNAExtractor.extract(tmpDir);

      expect(dna.domain).toBe('unknown');
    });

    it('should detect creative-coding domain', async () => {
      await fs.writeFile(path.join(tmpDir, 'package.json'), JSON.stringify({
        name: 'shader-art',
        dependencies: { p5: '1.0.0' },
      }));

      const dna = await DNAExtractor.extract(tmpDir);
      expect(dna.domain).toBe('generative-art');
    });
  });

  describe('extractFromSpec', () => {
    it('should extract DNA from a spec file', async () => {
      const specPath = path.join(tmpDir, 'SPEC.md');
      await fs.writeFile(specPath, `
# Project Spec

## Core Logic

A particle system with flocking behavior and noise-based movement.

## Constraints

- Particles must respond to mouse position
- Maximum 500 particles
- Use Perlin noise for movement

## Patterns

- Entity-component pattern
- Double-buffered rendering
`);

      const dna = await DNAExtractor.extractFromSpec(specPath);

      expect(dna.name).toBe('SPEC');
      expect(dna.coreLogic).toContain('particle system');
      expect(dna.constraints).toContain('Particles must respond to mouse position');
      expect(dna.patterns).not.toBeNull();
    });

    it('should extract prompt blocks from spec', async () => {
      const specPath = path.join(tmpDir, 'SPEC.md');
      await fs.writeFile(specPath, `
# Spec

## Core Logic

Test logic.

## System Prompt

\`\`\`
You are a creative coding assistant that generates p5.js sketches.
Focus on emergence and visual complexity.
\`\`\`

## Domain Prompt

\`\`\`
Generate generative art with particle systems and noise fields.
\`\`\`
`);

      const dna = await DNAExtractor.extractFromSpec(specPath);
      expect(dna.prompts.length).toBe(2);
      expect(dna.prompts[0]).toContain('creative coding assistant');
    });
  });

  describe('registerDNA', () => {
    it('should register DNA in a registry map', () => {
      const registry = new Map<string, ProjectDNA>();
      const dna: ProjectDNA = {
        name: 'test',
        domain: 'generative-art',
        coreLogic: 'Particle system',
        constraints: [],
        patterns: [],
        prompts: [],
        extractedAt: new Date().toISOString(),
        sourcePath: '/test',
      };

      DNAExtractor.registerDNA(dna, registry);

      expect(registry.get('generative-art')).toBe(dna);
      expect(registry.size).toBe(1);
    });

    it('should overwrite existing domain DNA', () => {
      const registry = new Map<string, ProjectDNA>();
      const dna1: ProjectDNA = {
        name: 'old',
        domain: 'generative-art',
        coreLogic: 'Old logic',
        constraints: [],
        patterns: [],
        prompts: [],
        extractedAt: '2026-01-01T00:00:00.000Z',
        sourcePath: '/old',
      };
      const dna2: ProjectDNA = {
        name: 'new',
        domain: 'generative-art',
        coreLogic: 'New logic',
        constraints: [],
        patterns: [],
        prompts: [],
        extractedAt: '2026-03-19T00:00:00.000Z',
        sourcePath: '/new',
      };

      DNAExtractor.registerDNA(dna1, registry);
      DNAExtractor.registerDNA(dna2, registry);

      expect(registry.size).toBe(1);
      expect(registry.get('generative-art')!.name).toBe('new');
    });
  });

  describe('scanForCarcasses', () => {
    it('should find project directories', async () => {
      // Create a project dir with package.json
      const projectDir = path.join(tmpDir, 'dead-project');
      await fs.mkdir(projectDir);
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify({ name: 'dead' }));

      // Create a non-project dir
      const emptyDir = path.join(tmpDir, 'not-a-project');
      await fs.mkdir(emptyDir);

      const carcasses = await DNAExtractor.scanForCarcasses(tmpDir);

      expect(carcasses.length).toBe(1);
      expect(carcasses[0]).toContain('dead-project');
    });

    it('should skip hidden directories and node_modules', async () => {
      const projectDir = path.join(tmpDir, 'real-project');
      await fs.mkdir(projectDir);
      await fs.writeFile(path.join(projectDir, 'package.json'), '{}');

      await fs.mkdir(path.join(tmpDir, '.git'));
      await fs.mkdir(path.join(tmpDir, 'node_modules'));

      const carcasses = await DNAExtractor.scanForCarcasses(tmpDir);
      expect(carcasses.length).toBe(1);
      expect(carcasses[0]).toContain('real-project');
    });

    it('should return empty for non-existent directory', async () => {
      const carcasses = await DNAExtractor.scanForCarcasses('/nonexistent/path/12345');
      expect(carcasses).toHaveLength(0);
    });
  });

  describe('loadDNAForDomain', () => {
    it('should load saved DNA for a domain', async () => {
      const dnaDir = path.join(tmpDir, 'dna');
      await fs.mkdir(dnaDir);

      const dna: ProjectDNA = {
        name: 'test',
        domain: 'generative-art',
        coreLogic: 'Test logic',
        constraints: ['constraint1'],
        patterns: ['pattern1'],
        prompts: [],
        extractedAt: new Date().toISOString(),
        sourcePath: '/test',
      };

      await fs.writeFile(
        path.join(dnaDir, 'generative-art.json'),
        JSON.stringify(dna)
      );

      const loaded = await DNAExtractor.loadDNAForDomain('generative-art', dnaDir);
      expect(loaded).not.toBeNull();
      expect(loaded!.coreLogic).toBe('Test logic');
    });

    it('should return null for non-existent DNA', async () => {
      const loaded = await DNAExtractor.loadDNAForDomain('nonexistent', '/nonexistent');
      expect(loaded).toBeNull();
    });
  });
});
