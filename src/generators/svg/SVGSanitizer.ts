function extractSVG(input: string): string {
  let clean = input.trim()
    .replace(/^```(?:svg|xml)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();

  const match = clean.match(/<svg\b[\s\S]*?<\/svg>/i);
  if (match) clean = match[0];
  return clean;
}

function deriveViewBox(svg: string): string | null {
  const widthMatch = svg.match(/\bwidth\s*=\s*["']?([0-9.]+)/i);
  const heightMatch = svg.match(/\bheight\s*=\s*["']?([0-9.]+)/i);
  const width = Number(widthMatch?.[1]);
  const height = Number(heightMatch?.[1]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return `0 0 ${Number(width.toFixed(3))} ${Number(height.toFixed(3))}`;
}

function ensureRootAttributes(svg: string): string {
  if (!/^<svg\b/i.test(svg)) return svg;
  return svg.replace(/^<svg\b([^>]*)>/i, (_match, attrs: string) => {
    let nextAttrs = attrs;
    if (!/\bxmlns\s*=/.test(nextAttrs)) {
      nextAttrs += ' xmlns="http://www.w3.org/2000/svg"';
    }
    if (!/\bviewBox\s*=/.test(nextAttrs)) {
      const viewBox = deriveViewBox(svg) ?? '0 0 1024 1024';
      nextAttrs += ` viewBox="${viewBox}"`;
    }
    return `<svg${nextAttrs}>`;
  });
}

export function sanitizeSVG(input: string): string {
  let clean = extractSVG(input);

  clean = clean
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<foreignObject\b[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/<(?:iframe|object|embed|canvas|audio|video)\b[\s\S]*?<\/(?:iframe|object|embed|canvas|audio|video)>/gi, '')
    .replace(/<(?:iframe|object|embed|canvas|audio|video|image)\b[^>]*\/?>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+(?:href|xlink:href)\s*=\s*["']\s*(?:javascript:|https?:|\/\/)[^"']*["']/gi, '')
    .replace(/\s+(?:href|xlink:href)\s*=\s*["']\s*data:(?!image\/svg\+xml;utf8,)[^"']*["']/gi, '')
    .replace(/\s+(?:style)\s*=\s*["'][^"']*(?:javascript:|@import|expression\s*\()[^"']*["']/gi, '');

  clean = ensureRootAttributes(clean.trim());
  return clean.replace(/>\s+</g, '><').trim();
}
