/**
 * HyperFramesValidator - HTML + GSAP compositing validation logic
 *
 * Validates that generated code follows the HyperFrames contract:
 * a single HTML file with GSAP timelines, data-* attributes on clips,
 * and window.__timelines registration. Blocks React, p5, and
 * Revideo APIs.
 */

export interface HyperFramesValidationResult {
  valid: boolean;
  errors: string[];
}

export class HyperFramesValidator {
  private static readonly BLOCKED_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
    { pattern: /video\.play\s*\(/, message: 'HyperFrames must not call video.play() — use GSAP to control playback' },
    { pattern: /audio\.currentTime/, message: 'HyperFrames must not set audio.currentTime directly' },
    { pattern: /\bReact\b/, message: 'HyperFrames must not use React' },
    { pattern: /from\s+['"]remotion['"]/, message: 'HyperFrames must not import from Remotion' },
    { pattern: /\bcreateCanvas\b/, message: 'HyperFrames must not use createCanvas (p5.js)' },
    { pattern: /function\s+setup\s*\(/, message: 'HyperFrames must not use p5.js setup()' },
    { pattern: /function\s+draw\s*\(/, message: 'HyperFrames must not use p5.js draw()' },
    { pattern: /\bmakeScene\b/, message: 'HyperFrames must not use Revideo makeScene' },
    { pattern: /@revideo\//, message: 'HyperFrames must not use @revideo/* packages' },
  ];

  static validate(code: string): HyperFramesValidationResult {
    const errors: string[] = [];
    const trimmed = code.trim();

    if (!trimmed) {
      errors.push('Code is empty');
      return { valid: false, errors };
    }

    if (trimmed.length < 200) {
      errors.push(`Code is too short (${trimmed.length} chars, minimum 200)`);
    }

    if (!/<div[^>]+data-composition-id/i.test(trimmed)) {
      errors.push('HyperFrames HTML must have a <div> with data-composition-id attribute');
    }

    const hasGsapTimeline = /gsap\.timeline\s*\(/.test(trimmed);
    const hasGsapFrom = /gsap\.from\s*\(/.test(trimmed);
    const hasGsapTo = /gsap\.to\s*\(/.test(trimmed);
    if (!hasGsapTimeline && !hasGsapFrom && !hasGsapTo) {
      errors.push('HyperFrames HTML must contain gsap.timeline(), gsap.from(), or gsap.to()');
    }

    if (!/window\.__timelines/.test(trimmed)) {
      errors.push('HyperFrames HTML must assign timeline to window.__timelines');
    }

    if (!/class\s*=\s*["'][^"']*clip[^"']*["']/i.test(trimmed)) {
      errors.push('HyperFrames HTML must have at least one element with class="clip"');
    }

    for (const { pattern, message } of this.BLOCKED_PATTERNS) {
      if (pattern.test(trimmed)) {
        errors.push(message);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  static getMinSize(): number {
    return 200;
  }
}
