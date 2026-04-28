import { describe, it, expect } from 'vitest';
import { HyperFramesValidator } from '../../../src/core/validators/HyperFramesValidator.js';

const VALID_COMPOSITION = `<!DOCTYPE html>
<html>
<head><style>*{margin:0;padding:0}#stage{position:relative;width:1920px;height:1080px;overflow:hidden;background:#000}.clip{position:absolute}</style>
<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script></head>
<body>
<div id="stage" data-composition-id="test" data-start="0" data-width="1920" data-height="1080">
  <h1 id="title" class="clip" data-start="0" data-duration="5" data-track-index="0"
      style="color:white;font-size:96px;">Hello</h1>
</div>
<script>
  const tl = gsap.timeline({ paused: true });
  tl.from("#title", { opacity: 0, duration: 1 }, 0);
  window.__timelines = window.__timelines || {};
  window.__timelines["test"] = tl;
</script>
</body>
</html>`;

describe('HyperFramesValidator', () => {
  it('accepts a valid composition', () => {
    const result = HyperFramesValidator.validate(VALID_COMPOSITION);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects empty code', () => {
    const result = HyperFramesValidator.validate('');
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('empty')]));
  });

  it('rejects whitespace-only code', () => {
    const result = HyperFramesValidator.validate('   \n\t  ');
    expect(result.valid).toBe(false);
  });

  it('rejects missing data-composition-id', () => {
    const code = VALID_COMPOSITION.replace('data-composition-id="test"', '');
    const result = HyperFramesValidator.validate(code);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('data-composition-id')]));
  });

  it('rejects missing GSAP', () => {
    const code = VALID_COMPOSITION.replace('gsap.timeline({ paused: true })', '{}');
    const result = HyperFramesValidator.validate(code);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('gsap')]));
  });

  it('rejects missing window.__timelines', () => {
    const code = VALID_COMPOSITION
      .replace('window.__timelines = window.__timelines || {};', '')
      .replace('window.__timelines["test"] = tl;', '');
    const result = HyperFramesValidator.validate(code);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('__timelines')]));
  });

  it('rejects missing class="clip"', () => {
    const code = VALID_COMPOSITION.replace('class="clip"', '');
    const result = HyperFramesValidator.validate(code);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('clip')]));
  });

  it('rejects video.play()', () => {
    const code = VALID_COMPOSITION + '<script>const v = document.querySelector("video"); video.play(v);</script>';
    const result = HyperFramesValidator.validate(code);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('video.play()')]));
  });

  it('rejects import React', () => {
    const code = VALID_COMPOSITION.replace('</head>', '<script>import React from "react";</script></head>');
    const result = HyperFramesValidator.validate(code);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('React')]));
  });

  it('rejects from remotion', () => {
    const code = VALID_COMPOSITION.replace('</head>', '<script>import {useCurrentFrame} from "remotion";</script></head>');
    const result = HyperFramesValidator.validate(code);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('Remotion')]));
  });

  it('rejects createCanvas / setup() / draw()', () => {
    const code = VALID_COMPOSITION.replace('</head>', '<script>function setup(){}function draw(){}</script></head>');
    const result = HyperFramesValidator.validate(code);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('p5.js')]));
  });

  it('rejects makeScene', () => {
    const code = VALID_COMPOSITION.replace('</head>', '<script>makeScene("test", function*() {})</script></head>');
    const result = HyperFramesValidator.validate(code);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('makeScene')]));
  });

  it('rejects @revideo/core', () => {
    const code = VALID_COMPOSITION.replace('</head>', '<script>import {} from "@revideo/core";</script></head>');
    const result = HyperFramesValidator.validate(code);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('@revideo/')]));
  });

  it('rejects code under minimum size', () => {
    const code = '<div data-composition-id="x"><p class="clip">Hi</p></div>';
    expect(code.length).toBeLessThan(200);
    const result = HyperFramesValidator.validate(code);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('200')]));
  });

  it('accepts gsap.from as valid GSAP usage', () => {
    const code = VALID_COMPOSITION.replace(
      'gsap.timeline({ paused: true })',
      'gsap.from("#title", { opacity: 0 })'
    ).replace('window.__timelines["test"] = tl;', '');
    const result = HyperFramesValidator.validate(code);
    expect(result.errors).not.toEqual(expect.arrayContaining([expect.stringContaining('GSAP')]));
  });
});
