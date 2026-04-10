/**
 * Creative coding domains supported by Liminal
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
  REVIEWD = 'revideo', // Revideo v0.12+ active video composition framework
  /** @deprecated Use REVIEWD instead - kept as legacy alias only */
  REMOTION = 'remotion',
  EMPTY = ''
}

/**
 * Type guard for Domain enum
 */
export function isValidDomain(value: string): value is Domain {
  return Object.values(Domain).includes(value as Domain);
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
 * Domains for video composition (active: revideo, legacy alias: remotion)
 */
export const VIDEO_DOMAINS = [Domain.REVIEWD];
