/**
 * StructureTemplates - Song structure templates ported from lyrics-engine (Python).
 *
 * Provides named templates for common song forms (pop, rap, ballad, punk,
 * singer-songwriter). Each template is a sequence of typed sections that can
 * be used to drive lyric generation, arrangement, or structural analysis.
 *
 * Pure TypeScript, no external dependencies.
 *
 * @module music/StructureTemplates
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The set of section types recognised across all templates.
 */
export type SectionType =
  | 'intro'
  | 'verse'
  | 'chorus'
  | 'bridge'
  | 'outro'
  | 'pre-chorus';

/**
 * A single section within a song structure.
 */
export interface SongSection {
  /** The kind of section (verse, chorus, etc.). */
  type: SectionType;
  /** Zero-based positional index within the template. */
  index: number;
  /** Human-readable label, e.g. "Verse 1", "Chorus 2". */
  label: string;
}

/**
 * A named song-structure template consisting of an ordered list of sections.
 */
export interface StructureTemplate {
  /** Template name (e.g. "pop", "ballad"). */
  name: string;
  /** Ordered sections that make up the song structure. */
  sections: SongSection[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build a `SongSection[]` from an array of raw section type strings.
 *
 * Duplicate section types receive incrementing numbers in their labels
 * (e.g. "Verse 1", "Verse 2").
 */
function buildSections(raw: SectionType[]): SongSection[] {
  const counters: Partial<Record<SectionType, number>> = {};

  return raw.map((type, index) => {
    const count = (counters[type] ?? 0) + 1;
    counters[type] = count;

    // Only number section types that typically repeat.
    const needsNumber =
      type === 'verse' ||
      type === 'chorus' ||
      type === 'bridge' ||
      type === 'pre-chorus';

    const label = needsNumber
      ? `${capitalize(type)} ${count}`
      : capitalize(type);

    return { type, index, label };
  });
}

/** Capitalise the first letter of a string. */
function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// ---------------------------------------------------------------------------
// Template definitions
// ---------------------------------------------------------------------------

/**
 * Canonical song-structure templates.
 *
 * Keys are the template names used for lookup via {@link getTemplate}.
 */
const templates: Record<string, StructureTemplate> = {
  pop: {
    name: 'pop',
    sections: buildSections([
      'verse',
      'chorus',
      'verse',
      'chorus',
    ]),
  },

  rap: {
    name: 'rap',
    sections: buildSections([
      'intro',
      'verse',
      'chorus',
      'verse',
      'chorus',
      'outro',
    ]),
  },

  ballad: {
    name: 'ballad',
    sections: buildSections([
      'verse',
      'verse',
      'verse',
      'verse',
    ]),
  },

  punk: {
    name: 'punk',
    sections: buildSections([
      'verse',
      'chorus',
      'verse',
      'chorus',
    ]),
  },

  'singer-songwriter': {
    name: 'singer-songwriter',
    sections: buildSections([
      'verse',
      'verse',
      'chorus',
      'verse',
      'chorus',
    ]),
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Retrieve a structure template by name.
 *
 * @param name - Case-insensitive template name (e.g. "pop", "Ballad").
 * @returns The matching {@link StructureTemplate}.
 * @throws {Error} If no template with the given name exists.
 *
 * @example
 * ```ts
 * const pop = getTemplate('pop');
 * console.log(pop.sections[0].label); // "Verse 1"
 * ```
 */
export function getTemplate(name: string): StructureTemplate {
  const key = name.toLowerCase();
  const template = templates[key];

  if (!template) {
    const available = Object.keys(templates).join(', ');
    throw new Error(
      `Unknown structure template "${name}". Available: ${available}`,
    );
  }

  return template;
}

/**
 * List all available template names.
 *
 * @returns An array of template name strings.
 *
 * @example
 * ```ts
 * console.log(listTemplates()); // ["pop", "rap", "ballad", "punk", "singer-songwriter"]
 * ```
 */
export function listTemplates(): string[] {
  return Object.keys(templates);
}

/**
 * Build a full song structure from a named template, optionally attaching
 * a title and returning metadata.
 *
 * @param name   - Case-insensitive template name.
 * @param title  - Optional song title. Defaults to "Untitled".
 * @returns An object containing the resolved sections and metadata.
 * @throws {Error} If the template name is not recognised.
 *
 * @example
 * ```ts
 * const result = buildStructureFromTemplate('pop', 'Electric Dreams');
 * console.log(result.metadata);
 * // { title: "Electric Dreams", template: "pop", sectionCount: 4 }
 * ```
 */
export function buildStructureFromTemplate(
  name: string,
  title?: string,
): {
  sections: SongSection[];
  metadata: { title: string; template: string; sectionCount: number };
} {
  const template = getTemplate(name);

  return {
    sections: template.sections,
    metadata: {
      title: title ?? 'Untitled',
      template: template.name,
      sectionCount: template.sections.length,
    },
  };
}
