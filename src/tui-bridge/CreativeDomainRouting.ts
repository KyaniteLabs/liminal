import { CodeValidator } from '../core/CodeValidator.js';
import { Domain } from '../types/domains.js';
import type { Domain as PreviewDomain } from '../utils/htmlWrapper.js';

const VISUAL_FALLBACKS: Domain[] = [Domain.THREE, Domain.P5, Domain.HYDRA, Domain.GLSL];

export function inferCreativeDomain(prompt: string): Domain {
  const lower = prompt.toLowerCase();
  const hasExplicitFrameworkCue = /\bhyperframes?\b|\bthree\.js\b|\bthreejs\b|\b3d\b|\bwebgl\b|\bscene\b|\bcamera\b|\bmesh\b|\bgeometry\b|\bshader\b|\bglsl\b|\bstrudel\b|\bhydra\b|\btone\.?js\b|\btonejs\b|\bweb\s*audio\b/.test(lower);

  if (/\bp5\.?js\b|\bp5js\b|\bp5\s+sketch\b|\bp5\s+code\b/.test(lower)) return Domain.P5;
  if (!hasExplicitFrameworkCue && /\bkinetic\s+(typography|type|text|css)\b|\bcss\s+kinetic\b|\b(animated|moving|orbiting|spinning|pulsing)\s+(words?|letters?|typography|text|type)\b|\b(typography|text|type)\b.*\b(animated|moving|kinetic|orbiting|spinning|pulsing)\b/.test(lower)) {
    return Domain.KINETIC;
  }
  if (/\bhyperframes?\b|\b(promo|trailer|slideshow|title\s*card|subtitle|caption|social\s*media)\b|\b(composite|assemble|overlay|watermark|intro|outro)\b/.test(lower)) {
    return Domain.HYPERFRAMES;
  }
  if (/\bthree\.js\b|\bthreejs\b|\bthree\b|\b3d\b|\bwebgl\b|\bscene\b|\bcamera\b|\bmesh\b|\bgeometry\b|\borbit(?:ing)?\b/.test(lower)) {
    return Domain.THREE;
  }
  if (/\bshader\b|\bglsl\b|\bfragment\b|\bray\s*march\b|\bsdf\b/.test(lower)) return Domain.GLSL;
  if (/\bstrudel\b|\btidal\b|\blive\s*coding\s*music\b/.test(lower)) return Domain.STRUDEL;
  if (/\bhydra\b|\bvideo\s*synth\b|\bkaleid\b/.test(lower)) return Domain.HYDRA;
  if (/\btone\.?js\b|\btonejs\b|\bweb\s*audio\b|\bsynth\b|\bdrone\b|\bsequencer\b/.test(lower)) return Domain.TONE;
  if (/\boscillator\b/.test(lower)) return Domain.HYDRA;
  if (/\bascii\b|\btext\s*art\b/.test(lower)) return Domain.ASCII;
  if (/\bsvg\b|\bvector\b|\blogo\b|\bicon\b|\bdiagram\b|\bcutfile\b|\bcnc\b|\bsticker\b/.test(lower)) return Domain.GENERIC;
  return Domain.P5;
}

export function buildCreativeDomainPlan(prompt: string): Domain[] {
  const primary = inferCreativeDomain(prompt);
  const primaryPlan = primary === Domain.GENERIC ? VISUAL_FALLBACKS : [primary, ...VISUAL_FALLBACKS];
  return primaryPlan.filter((domain, index, all) => all.indexOf(domain) === index);
}

export function previewDomainForCode(code: string, requestedDomain: Domain): PreviewDomain {
  if (/\bTHREE\.|import\s+.*\bthree\b|new\s+THREE\./.test(code)) return 'three';
  const detected = CodeValidator.detectDomain(code);
  if (detected === 'shader' || detected === 'three' || detected === 'hydra' || detected === 'tone' || detected === 'strudel' || detected === 'ascii' || detected === 'html' || detected === 'revideo' || detected === 'hyperframes') {
    return detected;
  }
  if (requestedDomain === Domain.THREE) return 'three';
  if (requestedDomain === Domain.GLSL || requestedDomain === Domain.SHADER || requestedDomain === Domain.WEBGL) return 'shader';
  if (requestedDomain === Domain.HYDRA) return 'hydra';
  if (requestedDomain === Domain.TONE) return 'tone';
  if (requestedDomain === Domain.HYPERFRAMES) return 'hyperframes';
  if (requestedDomain === Domain.KINETIC) return 'html';
  if (requestedDomain === Domain.STRUDEL || requestedDomain === Domain.MUSIC) return 'strudel';
  if (requestedDomain === Domain.ASCII) return 'ascii';
  return 'p5';
}
