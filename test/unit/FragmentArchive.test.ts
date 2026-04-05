import { describe, it, expect, vi } from 'vitest';
import { FragmentArchive } from '../../src/scavenger/fragments/FragmentArchive.js';

vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(() => JSON.stringify({
      version: '1.0', extracted: '2026-01-01', source: 'test',
      sourceFiles: 0, curator: 'test', description: 'test archive',
      categories: {
        personas: { description: 'Personas', fragments: [
          { id: 'p1', content: 'a persona', source: 'test', tags: ['creative'] },
        ]},
        constraints: { description: 'Constraints', fragments: [
          { id: 'c1', content: 'be creative', source: 'test', tags: ['creative'] },
        ]},
      },
    })),
  },
}));

describe('FragmentArchive', () => {
  it('load + getByCategory returns fragments', async () => {
    const archive = await FragmentArchive.load('/fake/path.json');
    const personas = archive.getByCategory('personas');
    expect(personas).toHaveLength(1);
    expect(personas[0].id).toBe('p1');
  });

  it('getCategories returns category names', async () => {
    const archive = await FragmentArchive.load('/fake/path.json');
    const cats = archive.getCategories();
    expect(cats).toContain('personas');
    expect(cats).toContain('constraints');
  });

  it('getByTag filters across categories', async () => {
    const archive = await FragmentArchive.load('/fake/path.json');
    const tagged = archive.getByTag('creative');
    expect(tagged.length).toBeGreaterThanOrEqual(2);
  });
});
