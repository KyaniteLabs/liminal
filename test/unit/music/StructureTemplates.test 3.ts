import { describe, it, expect } from 'vitest';
import {
  getTemplate,
  listTemplates,
  buildStructureFromTemplate,
  type StructureTemplate,
} from '../../../src/music/StructureTemplates.js';

describe('getTemplate', () => {
  it('returns the pop template with 4 sections', () => {
    const tmpl = getTemplate('pop');
    expect(tmpl.name).toBe('pop');
    expect(tmpl.sections).toHaveLength(4);
    expect(tmpl.sections.map((s) => s.type)).toEqual([
      'verse',
      'chorus',
      'verse',
      'chorus',
    ]);
  });

  it('returns the rap template with 6 sections', () => {
    const tmpl = getTemplate('rap');
    expect(tmpl.name).toBe('rap');
    expect(tmpl.sections).toHaveLength(6);
    expect(tmpl.sections.map((s) => s.type)).toEqual([
      'intro',
      'verse',
      'chorus',
      'verse',
      'chorus',
      'outro',
    ]);
  });

  it('returns the ballad template with 4 verses', () => {
    const tmpl = getTemplate('ballad');
    expect(tmpl.name).toBe('ballad');
    expect(tmpl.sections).toHaveLength(4);
    expect(tmpl.sections.every((s) => s.type === 'verse')).toBe(true);
  });

  it('performs case-insensitive lookup (POP)', () => {
    const tmpl = getTemplate('POP');
    expect(tmpl.name).toBe('pop');
  });

  it('performs case-insensitive lookup (Pop)', () => {
    const tmpl = getTemplate('Pop');
    expect(tmpl.name).toBe('pop');
  });

  it('throws Error for unknown template name', () => {
    expect(() => getTemplate('nonexistent')).toThrow(
      'Unknown structure template "nonexistent"',
    );
  });
});

describe('listTemplates', () => {
  it('returns all five template names', () => {
    const names = listTemplates();
    expect(names).toEqual([
      'pop',
      'rap',
      'ballad',
      'punk',
      'singer-songwriter',
    ]);
  });
});

describe('buildStructureFromTemplate', () => {
  it('returns metadata with correct template name and section count', () => {
    const result = buildStructureFromTemplate('pop', 'Electric Dreams');
    expect(result.metadata).toEqual({
      title: 'Electric Dreams',
      template: 'pop',
      sectionCount: 4,
    });
  });

  it('returns sections matching the template', () => {
    const result = buildStructureFromTemplate('rap');
    expect(result.sections).toHaveLength(6);
    expect(result.sections).toBe(getTemplate('rap').sections);
  });

  it('uses "Untitled" as default title when none provided', () => {
    const result = buildStructureFromTemplate('pop');
    expect(result.metadata.title).toBe('Untitled');
  });

  it('uses explicit title when provided', () => {
    const result = buildStructureFromTemplate('ballad', 'Yesterday');
    expect(result.metadata.title).toBe('Yesterday');
  });

  it('throws Error for unknown template', () => {
    expect(() => buildStructureFromTemplate('nonexistent')).toThrow(
      'Unknown structure template "nonexistent"',
    );
  });
});

describe('section labels', () => {
  it('numbers verse sections incrementally', () => {
    const tmpl = getTemplate('pop');
    // pop: verse, chorus, verse, chorus
    const verseSections = tmpl.sections.filter((s) => s.type === 'verse');
    expect(verseSections[0].label).toBe('Verse 1');
    expect(verseSections[1].label).toBe('Verse 2');
  });

  it('numbers chorus sections incrementally', () => {
    const tmpl = getTemplate('pop');
    const chorusSections = tmpl.sections.filter((s) => s.type === 'chorus');
    expect(chorusSections[0].label).toBe('Chorus 1');
    expect(chorusSections[1].label).toBe('Chorus 2');
  });

  it('does NOT number intro sections', () => {
    const tmpl = getTemplate('rap');
    const introSection = tmpl.sections.find((s) => s.type === 'intro');
    expect(introSection?.label).toBe('Intro');
  });

  it('does NOT number outro sections', () => {
    const tmpl = getTemplate('rap');
    const outroSection = tmpl.sections.find((s) => s.type === 'outro');
    expect(outroSection?.label).toBe('Outro');
  });

  it('assigns correct zero-based index to each section', () => {
    const tmpl = getTemplate('rap');
    const indices = tmpl.sections.map((s) => s.index);
    expect(indices).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('numbers verses in ballad template sequentially', () => {
    const tmpl = getTemplate('ballad');
    const labels = tmpl.sections.map((s) => s.label);
    expect(labels).toEqual(['Verse 1', 'Verse 2', 'Verse 3', 'Verse 4']);
  });
});
