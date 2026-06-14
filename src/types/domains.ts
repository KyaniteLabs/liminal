/**
 * Creative coding domains supported by Sinter
 * Use these instead of magic strings
 */
export enum Domain {
  P5 = 'p5',
  GLSL = 'glsl',
  THREE = 'three',
  TONE = 'tone',
  HYDRA = 'hydra',
  UNKNOWN = 'unknown',
  GENERIC = 'generic',
  WEBGL = 'webgl',
  SHADER = 'shader',
  STRUDEL = 'strudel',
  ASCII = 'ascii',
  MUSIC = 'music',
  CODE = 'code',
  REVIDEO = 'revideo', // Revideo v0.12+ active video composition framework
  HYPERFRAMES = 'hyperframes', // HTML+GSAP asset compositing via @hyperframes/producer
  KINETIC = 'kinetic',
  SVG = 'svg',
  HTML = 'html',
  TEXTGEN = 'textgen',
  EMPTY = ''
}

/**
 * The canonical Domain values as a string union — for modules that need a string
 * type instead of the enum. Derived from the enum so the two can never drift; this
 * is the single source other modules should import instead of re-declaring their own
 * `type Domain = '...'` unions (the audit found 9 incompatible copies).
 */
export type DomainString = `${Domain}`;

/**
 * Type guard for Domain enum
 */
export function isValidDomain(value: string): value is Domain {
  return Object.values(Domain).includes(value as Domain);
}

/**
 * Synonyms some generators/labels use for the same underlying domain. Intentionally
 * narrow — only true aliases, NOT distinct generators (`tone` and `strudel` are both
 * music but are different generators and must stay distinct).
 */
const DOMAIN_SYNONYMS: Record<string, Domain> = {
  webgl: Domain.WEBGL,
  fragment: Domain.GLSL,
};

/**
 * Map an arbitrary domain label to a canonical Domain: validate membership and
 * resolve known synonyms, returning Domain.UNKNOWN for anything unrecognized instead
 * of lying via `as Domain`. Use this in place of unchecked `someString as Domain` casts.
 */
export function normalizeDomain(value: string | undefined | null): Domain {
  if (!value) return Domain.UNKNOWN;
  const lower = value.toLowerCase().trim();
  if (lower in DOMAIN_SYNONYMS) return DOMAIN_SYNONYMS[lower];
  return isValidDomain(lower) ? (lower as Domain) : Domain.UNKNOWN;
}

/**
 * Get default domain for fallback scenarios
 */
export function getDefaultDomain(): Domain {
  return Domain.UNKNOWN;
}

/**
 * Domains that require HTML wrapper
 */
export const WRAPPED_DOMAINS = [Domain.P5, Domain.THREE, Domain.TONE, Domain.HYDRA];

/**
 * Domains that are shader-based
 */
export const SHADER_DOMAINS = [Domain.GLSL, Domain.SHADER, Domain.WEBGL];

/**
 * Domains for music generation
 */
export const MUSIC_DOMAINS = [Domain.TONE, Domain.STRUDEL, Domain.HYDRA];

/**
 * Domains for video composition
 */
export const VIDEO_DOMAINS = [Domain.REVIDEO, Domain.HYPERFRAMES];
