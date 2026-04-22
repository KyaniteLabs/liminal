import { sanitizeSVG } from './SVGSanitizer.js';
import { SVG_MODE_PROFILES, type SVGMode } from './SVGModeProfiles.js';

export interface SVGValidationOptions {
  mode?: SVGMode;
}

export interface SVGValidationResult {
  valid: boolean;
  error?: string;
  sanitized?: string;
}

const VISIBLE_ELEMENT_RE = /<(path|rect|circle|ellipse|line|polyline|polygon|text)\b/i;
const CONNECTOR_RE = /<(line|polyline)\b|<path\b[^>]*\bmarker-end\s*=|<path\b[^>]*\bd\s*=\s*["'][^"']*[ML][^"']*/i;

function parseViewBox(svg: string): [number, number, number, number] | null {
  const match = svg.match(/\bviewBox\s*=\s*["']\s*([+-]?\d*\.?\d+)\s+([+-]?\d*\.?\d+)\s+([+-]?\d*\.?\d+)\s+([+-]?\d*\.?\d+)\s*["']/i);
  if (!match) return null;
  const values = match.slice(1).map(Number);
  return values.every(value => Number.isFinite(value)) ? values as [number, number, number, number] : null;
}

function pathDataValues(svg: string): string[] {
  return [...svg.matchAll(/<path\b[^>]*\bd\s*=\s*["']([^"']+)["'][^>]*>/gi)].map(match => match[1]);
}

function countColors(svg: string): number {
  const colors = new Set<string>();
  for (const match of svg.matchAll(/\b(?:fill|stroke|stop-color)\s*=\s*["']([^"']+)["']/gi)) {
    const color = match[1].trim().toLowerCase();
    if (!color || color === 'none' || color === 'transparent' || color === 'currentcolor' || color.startsWith('url(')) continue;
    colors.add(color);
  }
  return colors.size;
}

function hasUnsafeRawContent(raw: string): boolean {
  return /<script\b|<foreignObject\b|<iframe\b|<object\b|<embed\b|<image\b|\son[a-z]+\s*=|\s(?:href|xlink:href|src)\s*=\s*["']?\s*(?:javascript:|https?:|\/\/|data:)|\sstyle\s*=\s*["'][^"']*(?:javascript:|@import|expression\s*\()/i.test(raw);
}

export function validateSVG(input: string, options: SVGValidationOptions = {}): SVGValidationResult {
  const raw = input.trim();
  if (hasUnsafeRawContent(raw)) {
    return { valid: false, error: 'SVG contains unsafe content that must not be accepted silently' };
  }

  const sanitized = sanitizeSVG(input);
  if (!/^<svg\b/i.test(sanitized) || !/<\/svg>$/i.test(sanitized)) {
    return { valid: false, error: 'SVG output must be a raw <svg> document', sanitized };
  }
  if (/\b(?:NaN|Infinity|undefined|null)\b/i.test(sanitized)) {
    return { valid: false, error: 'SVG contains invalid numeric tokens', sanitized };
  }
  if (!VISIBLE_ELEMENT_RE.test(sanitized)) {
    return { valid: false, error: 'SVG must contain visible vector geometry', sanitized };
  }

  const viewBox = parseViewBox(sanitized);
  if (!viewBox) return { valid: false, error: 'SVG must include a valid viewBox', sanitized };
  if (viewBox[2] <= 0 || viewBox[3] <= 0) {
    return { valid: false, error: 'SVG viewBox dimensions must be positive', sanitized };
  }

  const mode = options.mode;
  if (!mode) return { valid: true, sanitized };

  const profile = SVG_MODE_PROFILES[mode];
  if (profile.requireSquareViewBox && Math.abs(viewBox[2] - viewBox[3]) > 0.001) {
    return { valid: false, error: `${mode} SVG must use a square viewBox`, sanitized };
  }
  if (!profile.allowText && /<text\b/i.test(sanitized)) {
    return { valid: false, error: `${mode} SVG must not use text elements`, sanitized };
  }
  if (!profile.allowGradients && /<(linearGradient|radialGradient|pattern|mask)\b|url\(#/i.test(sanitized)) {
    return { valid: false, error: `${mode} SVG must not use gradients, patterns, masks, or paint servers`, sanitized };
  }
  if (!profile.allowFilters && /<filter\b|\bfilter\s*=\s*["']url\(/i.test(sanitized)) {
    return { valid: false, error: `${mode} SVG must not use filters`, sanitized };
  }
  if (profile.requireText && !/<text\b/i.test(sanitized)) {
    return { valid: false, error: `${mode} SVG must include readable text labels`, sanitized };
  }
  if (profile.requireConnector && !CONNECTOR_RE.test(sanitized)) {
    return { valid: false, error: `${mode} SVG must include connector lines or arrows`, sanitized };
  }
  if (profile.requireClosedPaths) {
    for (const d of pathDataValues(sanitized)) {
      if (!/[zZ]\s*$/.test(d.trim())) {
        return { valid: false, error: `${mode} SVG cutfile paths must be closed paths`, sanitized };
      }
    }
  }
  if (profile.maxColorCount !== undefined && countColors(sanitized) > profile.maxColorCount) {
    return { valid: false, error: `${mode} SVG uses too many distinct colors`, sanitized };
  }

  return { valid: true, sanitized };
}
