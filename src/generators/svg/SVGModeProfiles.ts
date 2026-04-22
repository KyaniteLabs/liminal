export type SVGMode =
  | 'logo'
  | 'icon'
  | 'diagram'
  | 'cutfile'
  | 'cnc'
  | 'generative-art'
  | 'sticker'
  | 'print';

export interface SVGModeProfile {
  mode: SVGMode;
  label: string;
  promptGuidance: string[];
  allowText: boolean;
  allowGradients: boolean;
  allowFilters: boolean;
  requireSquareViewBox?: boolean;
  requireText?: boolean;
  requireConnector?: boolean;
  requireClosedPaths?: boolean;
  maxColorCount?: number;
}

export const SVG_MODE_PROFILES: Record<SVGMode, SVGModeProfile> = {
  logo: {
    mode: 'logo',
    label: 'brand/logo vector',
    promptGuidance: [
      'Use clean memorable vector geometry with limited colors.',
      'Keep details bold enough for small sizes and print.',
      'Avoid raster images, scripts, and decorative clutter.',
    ],
    allowText: true,
    allowGradients: true,
    allowFilters: false,
    maxColorCount: 6,
  },
  icon: {
    mode: 'icon',
    label: 'app/UI icon vector',
    promptGuidance: [
      'Use a square viewBox such as 0 0 24 24 or 0 0 64 64.',
      'Prefer simple silhouette geometry and few paths.',
      'Avoid text and tiny detail.',
    ],
    allowText: false,
    allowGradients: false,
    allowFilters: false,
    requireSquareViewBox: true,
    maxColorCount: 4,
  },
  diagram: {
    mode: 'diagram',
    label: 'labeled diagram vector',
    promptGuidance: [
      'Use readable labels, arrows, connector lines, and grouped structure.',
      'Keep text inside the viewBox and use font sizes large enough to read.',
      'Prioritize clarity over decoration.',
    ],
    allowText: true,
    allowGradients: false,
    allowFilters: false,
    requireText: true,
    requireConnector: true,
  },
  cutfile: {
    mode: 'cutfile',
    label: 'laser cutting vector',
    promptGuidance: [
      'Use closed paths and simple shapes suitable for laser cutting.',
      'Separate operations by stroke/fill attributes rather than visual effects.',
      'Do not use text, gradients, filters, masks, raster images, or external resources.',
    ],
    allowText: false,
    allowGradients: false,
    allowFilters: false,
    requireClosedPaths: true,
    maxColorCount: 4,
  },
  cnc: {
    mode: 'cnc',
    label: 'CNC/toolpath vector',
    promptGuidance: [
      'Use simple toolpath-like geometry with clear strokes and units-independent coordinates.',
      'Avoid visual-only fills, filters, gradients, masks, raster images, and tiny islands.',
      'Keep geometry mechanically plausible and inside the viewBox.',
    ],
    allowText: false,
    allowGradients: false,
    allowFilters: false,
    maxColorCount: 4,
  },
  'generative-art': {
    mode: 'generative-art',
    label: 'generative art SVG',
    promptGuidance: [
      'Use rich vector geometry, gradients, patterns, masks, or filters when helpful.',
      'Keep everything self-contained and deterministic.',
      'Do not use scripts or external resources.',
    ],
    allowText: true,
    allowGradients: true,
    allowFilters: true,
  },
  sticker: {
    mode: 'sticker',
    label: 'sticker vector',
    promptGuidance: [
      'Use bold shapes, high contrast, and a clear silhouette.',
      'Include a visible contour/cutline when relevant.',
      'Avoid hairlines and tiny unreadable text.',
    ],
    allowText: true,
    allowGradients: true,
    allowFilters: false,
    maxColorCount: 8,
  },
  print: {
    mode: 'print',
    label: 'print-ready SVG',
    promptGuidance: [
      'Use clear vector shapes and print-safe contrast.',
      'Avoid scripts, external resources, and fragile hairline detail.',
      'Keep color count intentional and geometry within the viewBox.',
    ],
    allowText: true,
    allowGradients: true,
    allowFilters: false,
    maxColorCount: 10,
  },
};

export function inferSVGMode(prompt: string): SVGMode {
  const lower = prompt.toLowerCase();
  if (/\b(laser|cut\s*file|cutfile|cricut|silhouette|vinyl\s*cut)\b/.test(lower)) return 'cutfile';
  if (/\b(cnc|router|toolpath|engrave|machining)\b/.test(lower)) return 'cnc';
  if (/\b(icon|favicon|app\s*icon|toolbar)\b/.test(lower)) return 'icon';
  if (/\b(diagram|flowchart|schema|schematic|arrow|labeled|labelled)\b/.test(lower)) return 'diagram';
  if (/\b(generative|procedural|algorithmic|op\s*art|pattern)\b/.test(lower)) return 'generative-art';
  if (/\b(sticker|decal)\b/.test(lower)) return 'sticker';
  if (/\b(print|poster|screenprint|merch)\b/.test(lower)) return 'print';
  if (/\b(logo|brand|mark|logotype)\b/.test(lower)) return 'logo';
  return 'generative-art';
}
