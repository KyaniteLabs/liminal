import { describe, it, expect } from 'vitest';
import { stripReasoningText } from '../../../src/core/validators/types.js';

/**
 * D9 — stripReasoningText is a CODE-oriented stripper: it treats leading prose,
 * "Here is a…" lines, and "- " bullets as LLM reasoning and removes them. For
 * ascii/textgen domains the prose IS the artifact, so stripping must be
 * domain-aware and pass that content through intact.
 */
describe('stripReasoningText — domain-aware text preservation (D9)', () => {
  const proseLikeArt = `Here lies a quiet field
- the moon hangs low -
  *  .  *  .  *
The stars drift slowly`;

  it('truncates prose-like content when no domain is given (code-stripper default)', () => {
    // Baseline: the un-domained stripper nukes this legitimate text art.
    const stripped = stripReasoningText(proseLikeArt);
    expect(stripped).toBe('');
  });

  it('preserves the same content INTACT for the ascii domain', () => {
    const stripped = stripReasoningText(proseLikeArt, 'ascii');
    expect(stripped).toBe(proseLikeArt);
  });

  it('preserves the same content INTACT for the textgen domain', () => {
    const stripped = stripReasoningText(proseLikeArt, 'textgen');
    expect(stripped).toBe(proseLikeArt);
  });

  it('trims only a leading blank line / trailing whitespace for text domains, keeping body lines', () => {
    const padded = `\n${proseLikeArt}   `;
    const stripped = stripReasoningText(padded, 'textgen');
    expect(stripped).toBe(proseLikeArt);
    // Every original body line survives.
    for (const line of proseLikeArt.split('\n')) {
      expect(stripped).toContain(line);
    }
  });

  it('still strips reasoning for code domains (ascii-awareness does not weaken code paths)', () => {
    const codeWithPreamble = `I'll create a flowing sketch.
function setup() { createCanvas(400, 400); }
function draw() { background(0); circle(200, 200, 50); }`;
    const stripped = stripReasoningText(codeWithPreamble, 'p5');
    expect(stripped).not.toContain("I'll create");
    expect(stripped).toContain('function setup()');
    expect(stripped).toContain('function draw()');
  });

  it('handles empty input for a text domain without throwing', () => {
    expect(stripReasoningText('', 'ascii')).toBe('');
  });
});
