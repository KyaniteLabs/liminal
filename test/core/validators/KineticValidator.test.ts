import { describe, it, expect } from 'vitest';
import { KineticValidator } from '../../../src/core/validators/KineticValidator.js';

const VALID_KINETIC_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Orbiting Threshold Typography</title>
  <style>
    html, body {
      margin: 0;
      min-height: 100%;
      overflow: hidden;
      background: #08101c;
      color: #e6f7ff;
      font-family: system-ui, sans-serif;
    }
    body { display: grid; place-items: center; }
    .scene {
      position: relative;
      width: min(92vw, 900px);
      height: min(72vh, 620px);
      display: grid;
      place-items: center;
      isolation: isolate;
    }
    .word {
      position: absolute;
      font-size: clamp(28px, 8vw, 92px);
      font-weight: 900;
      text-transform: uppercase;
      animation: orbit 8s linear infinite, pulse 3s ease-in-out infinite;
    }
    .word:nth-child(2) { animation-delay: -2s; color: #7dd3fc; }
    .word:nth-child(3) { animation-delay: -4s; color: #fde68a; }
    .threshold {
      position: absolute;
      inset: 20%;
      border: 2px solid currentColor;
      border-radius: 999px;
      animation: breathe 4s ease-in-out infinite;
    }
    @keyframes orbit {
      from { transform: rotate(0deg) translateX(26vmin) rotate(0deg); }
      to { transform: rotate(360deg) translateX(26vmin) rotate(-360deg); }
    }
    @keyframes pulse {
      0%, 100% { opacity: 0.65; scale: 0.92; }
      50% { opacity: 1; scale: 1.1; }
    }
    @keyframes breathe {
      0%, 100% { transform: scale(0.86); opacity: 0.45; }
      50% { transform: scale(1.08); opacity: 1; }
    }
  </style>
</head>
<body>
  <main class="scene" aria-label="Animated kinetic words orbiting a threshold">
    <div class="threshold"></div>
    <div class="word">threshold</div>
    <div class="word">motion</div>
    <div class="word">signal</div>
  </main>
</body>
</html>`;

describe('KineticValidator', () => {
  it('validates complete kinetic HTML with visible animated typography', () => {
    const result = KineticValidator.validate(VALID_KINETIC_HTML);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects tiny CSS/HTML scaffolds', () => {
    const result = KineticValidator.validate(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Tiny</title><style>@keyframes spin{to{transform:rotate(1turn)}}.word{animation:spin 1s infinite}</style></head><body><div class="word">X</div></body></html>`);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Kinetic HTML is too small to be a substantive kinetic artwork');
  });

  it('rejects visible HTML that does not animate', () => {
    const staticHtml = VALID_KINETIC_HTML
      .replace(/animation:[^;]+;/g, '')
      .replace(/@keyframes[\s\S]*?<\/style>/, '</style>');

    const result = KineticValidator.validate(staticHtml);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Kinetic artwork must define animation or time-based motion');
  });

  it('rejects animation code with no visible DOM, SVG, or canvas surface', () => {
    const result = KineticValidator.validate(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invisible Motion</title>
  <style>
    @keyframes pulse {
      from { opacity: 0.4; transform: scale(0.8); }
      to { opacity: 1; transform: scale(1.1); }
    }
    body { animation: pulse 2s infinite; }
  </style>
</head>
<body>
  <!-- no visible kinetic surface -->
</body>
</html>`);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Kinetic artwork must include a visible DOM, SVG, or canvas surface');
  });

  it('rejects invalid HTML, CSS, and JavaScript syntax', () => {
    const invalid = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Broken Kinetic</title>
  <style>
    @keyframes orbit {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    .word { animation: orbit 5s infinite; }
  </style>
</head>
<body>
  <main class="scene"><div class="word">broken</div></main>
  <script>
    function animate( {
      requestAnimationFrame(animate);
    }
  </script>
</body>`;

    const result = KineticValidator.validate(invalid);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('HTML document must have closing </html> tag');
    expect(result.errors.some((error) => error.startsWith('Kinetic CSS has invalid block syntax'))).toBe(true);
    expect(result.errors.some((error) => error.startsWith('Kinetic JavaScript has invalid syntax'))).toBe(true);
  });
});
