import path from 'node:path';

const EXPECTED_EXTENSIONS = {
  p5: '.js',
  svg: '.svg',
  glsl: '.frag',
  three: '.js',
  hydra: '.js',
  strudel: '.js',
  tone: '.html',
  revideo: '.tsx',
  hyperframes: '.html',
  ascii: '.txt',
  kinetic: '.html',
  textgen: '.txt',
};

export function validateCreativeDomainArtifact(domain, artifactPath, content) {
  const normalizedDomain = String(domain || '').toLowerCase();
  const source = String(content || '');
  const checks = [];

  addCheck(checks, 'expected-extension', path.extname(String(artifactPath || '')).toLowerCase() === EXPECTED_EXTENSIONS[normalizedDomain], `expected ${EXPECTED_EXTENSIONS[normalizedDomain] || 'known extension'}`);
  addCheck(checks, 'non-empty', Buffer.byteLength(source.trim(), 'utf8') > 0, 'artifact is empty');

  for (const check of domainChecks(normalizedDomain, source)) checks.push(check);

  const errors = checks.filter((check) => !check.passed).map((check) => `${check.name}: ${check.message}`);
  return {
    status: errors.length === 0 ? 'pass' : 'fail',
    checks,
    errors,
  };
}

function domainChecks(domain, source) {
  const checks = [];
  const trimmed = source.trim();

  switch (domain) {
    case 'p5':
      addCheck(checks, 'p5-setup', /\bfunction\s+setup\s*\(|\bsetup\s*=\s*\(/.test(source), 'missing setup()');
      addCheck(checks, 'p5-canvas', /\bcreateCanvas\s*\(/.test(source), 'missing createCanvas()');
      addCheck(checks, 'p5-draw', /\bfunction\s+draw\s*\(|\bdraw\s*=\s*\(/.test(source), 'missing draw()');
      break;
    case 'svg':
      addCheck(checks, 'svg-root', /^<svg[\s>]/i.test(trimmed), 'missing root <svg>');
      addCheck(checks, 'svg-close', /<\/svg>\s*$/i.test(trimmed), 'missing closing </svg>');
      addCheck(checks, 'svg-visible-shape', /<(path|circle|rect|line|polyline|polygon|ellipse|text)\b/i.test(source), 'missing visible SVG shape');
      break;
    case 'glsl':
      addCheck(checks, 'glsl-main', /\bvoid\s+main\s*\(/.test(source), 'missing void main()');
      addCheck(checks, 'glsl-output', /\b(gl_FragColor|fragColor)\b/.test(source), 'missing fragment output');
      addCheck(checks, 'glsl-coordinate', /\b(gl_FragCoord|u_resolution|resolution)\b/.test(source), 'missing fragment coordinate/resolution reference');
      break;
    case 'three':
      addCheck(checks, 'three-scene', /\bTHREE\.Scene\s*\(/.test(source), 'missing THREE.Scene');
      addCheck(checks, 'three-renderer', /\bTHREE\.WebGLRenderer\s*\(/.test(source), 'missing THREE.WebGLRenderer');
      addCheck(checks, 'three-render-call', /\brenderer\.render\s*\(/.test(source), 'missing renderer.render()');
      addCheck(checks, 'three-camera', /\b(PerspectiveCamera|OrthographicCamera)\b/.test(source), 'missing camera');
      break;
    case 'hydra':
      addCheck(checks, 'hydra-source', /\b(osc|shape|noise|voronoi|gradient|solid)\s*\(/.test(source), 'missing Hydra visual source');
      addCheck(checks, 'hydra-output', /\.out\s*\(|\brender\s*\(/.test(source), 'missing Hydra out()/render()');
      break;
    case 'strudel':
      addCheck(checks, 'strudel-pattern', /\b(s|note|stack|sound)\s*\(/.test(source), 'missing Strudel pattern function');
      addCheck(checks, 'strudel-rhythm', /["'`][^"'`]*(bd|sn|hh|kick|hat|808|909|c1|g1)[^"'`]*["'`]/i.test(source), 'missing audible rhythm/note tokens');
      break;
    case 'tone':
      addCheck(checks, 'tone-html', /<html[\s>]/i.test(source), 'missing HTML shell');
      addCheck(checks, 'tone-library', /\bTone(\.js|\.|@)|tone\/14/i.test(source), 'missing Tone.js reference');
      addCheck(checks, 'tone-control', /<button\b|role=["']button["']|Tone\.start\s*\(/i.test(source), 'missing browser playback control');
      break;
    case 'revideo':
      addCheck(checks, 'revideo-scene', /\bmakeScene2D\s*\(/.test(source), 'missing makeScene2D scene');
      addCheck(checks, 'revideo-visual', /\b(Txt|Rect|Img|Video|Circle)\b/.test(source), 'missing Revideo visual primitive');
      addCheck(checks, 'revideo-timing', /\byield\*\s*|waitFor\s*\(/.test(source), 'missing Revideo timing');
      break;
    case 'hyperframes':
      addCheck(checks, 'hyperframes-html', /<!doctype html>|<html[\s>]/i.test(source), 'missing HTML shell');
      addCheck(checks, 'hyperframes-stage', /\bdata-composition-id\b/.test(source), 'missing composition id');
      addCheck(checks, 'hyperframes-clips', (source.match(/\bclass=["'][^"']*\bclip\b/g) || []).length >= 3, 'missing at least three clips');
      addCheck(checks, 'hyperframes-timeline', /\bgsap\.timeline\s*\(|window\.__timelines\b/.test(source), 'missing GSAP timeline registration');
      break;
    case 'ascii':
      addCheck(checks, 'ascii-lines', trimmed.split(/\r?\n/).filter(Boolean).length >= 5, 'ASCII art needs at least five non-empty lines');
      addCheck(checks, 'ascii-art-glyphs', /[\/\\|_\-+=*#@.<>()[\]{}]/.test(source), 'missing ASCII art glyphs');
      addCheck(checks, 'ascii-not-html', !/<html[\s>]|<!doctype/i.test(source), 'ASCII artifact must not be HTML');
      break;
    case 'kinetic':
      addCheck(checks, 'kinetic-html', /<html[\s>]/i.test(source), 'missing HTML shell');
      addCheck(checks, 'kinetic-animation', /@keyframes\b|animation\s*:/.test(source), 'missing CSS animation');
      addCheck(checks, 'kinetic-text', />[^<]{3,}</.test(source), 'missing visible text');
      break;
    case 'textgen':
      addCheck(checks, 'textgen-lines', trimmed.split(/\r?\n/).filter(Boolean).length >= 5, 'text art needs at least five non-empty lines');
      addCheck(checks, 'textgen-length', Buffer.byteLength(trimmed, 'utf8') >= 80, 'text art is too small');
      addCheck(checks, 'textgen-not-html', !/<html[\s>]|<!doctype/i.test(source), 'textgen artifact must not be HTML');
      break;
    default:
      addCheck(checks, 'known-domain', false, `unknown creative domain ${domain}`);
  }

  return checks;
}

function addCheck(checks, name, passed, message) {
  checks.push({
    name,
    passed: Boolean(passed),
    ...(passed ? {} : { message }),
  });
}
