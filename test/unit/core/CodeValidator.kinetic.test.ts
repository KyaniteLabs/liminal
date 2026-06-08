import { describe, it, expect } from 'vitest';
import { CodeValidator } from '../../../src/core/CodeValidator.js';

const KINETIC_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kinetic Route Smoke</title>
  <style>
    html, body { margin: 0; min-height: 100%; background: #0c1018; color: white; }
    body { display: grid; place-items: center; overflow: hidden; font-family: system-ui, sans-serif; }
    .stage { position: relative; width: 80vw; height: 60vh; display: grid; place-items: center; }
    .word { position: absolute; font-size: clamp(24px, 7vw, 84px); font-weight: 900; animation: drift 7s linear infinite; }
    .word:nth-child(2) { animation-delay: -2.3s; color: #8fd3ff; }
    .word:nth-child(3) { animation-delay: -4.6s; color: #ffe08a; }
    .ring { position: absolute; inset: 18%; border: 2px solid currentColor; border-radius: 999px; animation: breathe 3s ease-in-out infinite; }
    @keyframes drift {
      from { transform: rotate(0deg) translateX(24vmin) rotate(0deg); }
      to { transform: rotate(360deg) translateX(24vmin) rotate(-360deg); }
    }
    @keyframes breathe {
      0%, 100% { transform: scale(0.85); opacity: 0.5; }
      50% { transform: scale(1.1); opacity: 1; }
    }
  </style>
</head>
<body>
  <main class="stage" aria-label="Kinetic typography smoke">
    <div class="ring"></div>
    <div class="word">sinter</div>
    <div class="word">motion</div>
    <div class="word">core</div>
  </main>
</body>
</html>`;

describe('CodeValidator kinetic integration', () => {
  it('validates kinetic through the dedicated domain branch', () => {
    const result = CodeValidator.validate(KINETIC_HTML, 'kinetic');

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects kinetic HTML that is only static scaffolding', () => {
    const staticHtml = KINETIC_HTML
      .replace(/animation:[^;]+;/g, '')
      .replace(/@keyframes[\s\S]*?<\/style>/, '</style>');

    const result = CodeValidator.validate(staticHtml, 'kinetic');

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Kinetic artwork must define animation or time-based motion');
  });

  it('keeps generic HTML detection separate from explicit kinetic validation', () => {
    expect(CodeValidator.detectDomain(KINETIC_HTML)).toBe('html');
    expect(CodeValidator.validate(KINETIC_HTML, 'kinetic').valid).toBe(true);
  });
});
