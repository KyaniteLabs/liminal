import { CodeValidator } from '../core/CodeValidator.js';
import { Domain } from '../types/domains.js';
import type { Domain as PreviewDomain } from '../utils/htmlWrapper.js';

const VISUAL_FALLBACKS: Domain[] = [Domain.THREE, Domain.P5, Domain.HYDRA, Domain.GLSL];

export function hasExplicitCreativeDomainCue(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  const hasRevideoHandle = lower.includes('@revideo');
  return /\bp5\.?js\b|\bp5js\b|\bp5\s+(sketch|code)\b|\bprocessing\b/.test(lower)
    || /\bthree\.js\b|\bthreejs\b|\bthree\s*js\b/.test(lower)
    || /\bshader\b|\bglsl\b|\bfragment\s+shader\b/.test(lower)
    || /\bstrudel\b|\btidal\b|\blive\s+coding\s+music\b/.test(lower)
    || /\bhydra\b|\bvideo\s+synth\b/.test(lower)
    || hasRevideoHandle || /\brevideo\b/.test(lower)
    || /\btone\.?js\b|\btonejs\b|\bweb\s*audio\b/.test(lower)
    || /\bhyperframes?\b/.test(lower)
    || /\bkinetic\s+(typography|type|text|css)\b|\bcss\s+kinetic\b/.test(lower)
    || /\bascii\b|\btext\s*art\b/.test(lower);
}

export interface CreativeDomainRouteTruth {
  requestedDomain: Domain;
  selectedDomain: Domain;
  domains: Domain[];
  promptDomainLocked: boolean;
  source: 'prompt' | 'inferred';
}

export function inferCreativeDomain(prompt: string): Domain {
  const lower = prompt.toLowerCase();
  const hasRevideoHandle = lower.includes('@revideo');
  const hasExplicitFrameworkCue = hasRevideoHandle || /\bhyperframes?\b|\brevideo\b|\bthree\.js\b|\bthreejs\b|\b3d\b|\bwebgl\b|\bscene\b|\bcamera\b|\bmesh\b|\bgeometry\b|\bshader\b|\bglsl\b|\bstrudel\b|\bhydra\b|\btone\.?js\b|\btonejs\b|\bweb\s*audio\b/.test(lower);

  if (/\bp5\.?js\b|\bp5js\b|\bp5\s+sketch\b|\bp5\s+code\b/.test(lower)) return Domain.P5;
  if (!hasExplicitFrameworkCue && /\bkinetic\s+(typography|type|text|css)\b|\bcss\s+kinetic\b|\b(animated|moving|orbiting|spinning|pulsing)\s+(words?|letters?|typography|text|type)\b|\b(typography|text|type)\b.*\b(animated|moving|kinetic|orbiting|spinning|pulsing)\b/.test(lower)) {
    return Domain.KINETIC;
  }
  const forbidsRevideo = /\b(do not|don't|dont|never|avoid)\b[^.\n]*(?:@?revideo)/.test(lower);
  const explicitlyHyperframes = /\bhyperframes?\b/.test(lower);
  const explicitlyRevideo = hasRevideoHandle || /\brevideo\b/.test(lower);
  if (explicitlyHyperframes) return Domain.HYPERFRAMES;
  if (!forbidsRevideo && explicitlyRevideo) return Domain.REVIEWD;
  if (/\b(promo|trailer|slideshow|title\s*card|subtitle|caption|social\s*media)\b|\b(composite|assemble|overlay|watermark|intro|outro)\b/.test(lower)) {
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
  if (primary !== Domain.GENERIC && hasExplicitCreativeDomainCue(prompt)) {
    return [primary];
  }

  const primaryPlan = primary === Domain.GENERIC ? VISUAL_FALLBACKS : [primary, ...VISUAL_FALLBACKS];
  return primaryPlan.filter((domain, index, all) => all.indexOf(domain) === index);
}

export function buildCreativeDomainRouteTruth(prompt: string): CreativeDomainRouteTruth {
  const requestedDomain = inferCreativeDomain(prompt);
  const domains = buildCreativeDomainPlan(prompt);
  const promptDomainLocked = requestedDomain !== Domain.GENERIC && hasExplicitCreativeDomainCue(prompt);
  return {
    requestedDomain,
    selectedDomain: domains[0] ?? requestedDomain,
    domains,
    promptDomainLocked,
    source: promptDomainLocked ? 'prompt' : 'inferred',
  };
}

export function detectPreviewDomainForCode(code: string): PreviewDomain | undefined {
  if (/\bTone\.|tone(?:\.js|@|\.min\.js)|Tone\.Transport/i.test(code)) return 'tone';
  if (/\bstrudel\b|\bsound\(|\bnote\(/i.test(code)) return 'strudel';
  if (/\bosc\(|\bsrc\(|\bout\(/i.test(code)) return 'hydra';
  if (/\bTHREE\.|import\s+.*\bthree\b|new\s+THREE\./.test(code)) return 'three';
  if (/\b(?:createCanvas|function\s+setup\s*\(|function\s+draw\s*\(|new\s+p5\s*\()/i.test(code)) return 'p5';
  const detected = CodeValidator.detectDomain(code);
  if (detected === 'shader' || detected === 'three' || detected === 'hydra' || detected === 'tone' || detected === 'strudel' || detected === 'ascii' || detected === 'html' || detected === 'revideo' || detected === 'hyperframes') {
    return detected;
  }
  return undefined;
}

export function previewDomainForCode(code: string, requestedDomain: Domain): PreviewDomain {
  const detected = detectPreviewDomainForCode(code);
  if (detected) return detected;
  if (requestedDomain === Domain.THREE) return 'three';
  if (requestedDomain === Domain.GLSL || requestedDomain === Domain.SHADER || requestedDomain === Domain.WEBGL) return 'shader';
  if (requestedDomain === Domain.HYDRA) return 'hydra';
  if (requestedDomain === Domain.TONE) return 'tone';
  if (requestedDomain === Domain.REVIEWD) return 'revideo';
  if (requestedDomain === Domain.HYPERFRAMES) return 'hyperframes';
  if (requestedDomain === Domain.KINETIC) return 'html';
  if (requestedDomain === Domain.STRUDEL || requestedDomain === Domain.MUSIC) return 'strudel';
  if (requestedDomain === Domain.ASCII) return 'ascii';
  return 'p5';
}

export interface GeneratedDomainValidation {
  ok: boolean;
  requested: Domain;
  detected: PreviewDomain;
  expected: PreviewDomain[];
  message?: string;
}

export function expectedPreviewDomainsForCreativeDomain(domain: Domain): PreviewDomain[] {
  if (domain === Domain.THREE) return ['three'];
  if (domain === Domain.GLSL || domain === Domain.SHADER || domain === Domain.WEBGL) return ['shader'];
  if (domain === Domain.HYDRA) return ['hydra'];
  if (domain === Domain.TONE) return ['tone'];
  if (domain === Domain.STRUDEL || domain === Domain.MUSIC) return ['strudel'];
  if (domain === Domain.REVIEWD) return ['revideo'];
  if (domain === Domain.HYPERFRAMES) return ['hyperframes'];
  if (domain === Domain.KINETIC) return ['html'];
  if (domain === Domain.ASCII) return ['ascii'];
  if (domain === Domain.P5) return ['p5'];
  return ['p5', 'three', 'shader', 'hydra', 'tone', 'strudel', 'ascii', 'html', 'revideo', 'hyperframes'];
}

export function validateGeneratedDomainForRequest(code: string, requestedDomain: Domain): GeneratedDomainValidation {
  const detected = previewDomainForCode(code, requestedDomain);
  const expected = expectedPreviewDomainsForCreativeDomain(requestedDomain);
  const ok = expected.includes(detected);
  return {
    ok,
    requested: requestedDomain,
    detected,
    expected,
    message: ok
      ? undefined
      : `Domain mismatch: requested ${requestedDomain}, generated ${detected}; expected ${expected.join(' or ')}`,
  };
}
