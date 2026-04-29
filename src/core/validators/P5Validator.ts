/**
 * P5Validator - P5.js-specific validation logic
 *
 * Extracted from CodeValidator.ts using Strangler Fig pattern.
 * Handles validation of p5.js code including raw JS and HTML-wrapped sketches.
 */

import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';

// Note: ValidationResult type can be imported from CodeValidator if needed for integration

export interface P5ValidationResult {
  valid: boolean;
  errors: string[];
}

export class P5Validator {
  private static readonly P5_GLOBALS = new Set([
    'Array', 'Boolean', 'Date', 'Error', 'JSON', 'Map', 'Math', 'Number', 'Object', 'Promise', 'Set', 'String',
    'console', 'document', 'p5', 'window',
    'ADD', 'BASELINE', 'BLEND', 'MULTIPLY', 'CENTER', 'CLOSE', 'CORNER', 'DEGREES', 'DOWN_ARROW', 'HALF_PI', 'HSB', 'LEFT', 'LEFT_ARROW', 'PI', 'QUARTER_PI', 'RADIANS', 'RGB', 'RIGHT', 'RIGHT_ARROW', 'TWO_PI', 'UP_ARROW',
    'POINTS', 'LINES', 'TRIANGLES', 'TRIANGLE_FAN', 'TRIANGLE_STRIP', 'QUADS', 'QUAD_STRIP',
    'draw', 'drawingContext', 'frameCount', 'height', 'key', 'keyCode', 'keyIsPressed', 'mouseButton', 'mouseIsPressed', 'mouseX', 'mouseY', 'pixels', 'pmouseX', 'pmouseY', 'setup', 'windowHeight', 'windowWidth', 'width',
    'abs', 'acos', 'angleMode', 'asin', 'atan', 'atan2', 'background', 'beginShape', 'bezier', 'blendMode',
    'bezierVertex', 'ceil', 'circle', 'color', 'colorMode', 'constrain', 'cos', 'createCanvas', 'createGraphics', 'curveVertex', 'dist', 'ellipse', 'endShape', 'exp',
    'fill', 'floor', 'frameRate', 'image', 'lerp', 'line', 'map', 'max', 'min', 'noFill', 'noise', 'noLoop',
    'createVector',
    'loadPixels', 'noStroke', 'pixelDensity', 'pop', 'pow', 'push', 'random', 'rect', 'red', 'green', 'blue', 'lerpColor',
    'resizeCanvas', 'rotate', 'round', 'scale', 'sin', 'sqrt',
    'stroke', 'strokeWeight', 'text', 'textAlign', 'textFont', 'textSize', 'translate', 'triangle', 'updatePixels', 'vertex',
    // p5.sound
    'loadSound', 'createAudio', 'getAudioContext', 'userStartAudio',
    // Web Audio API
    'AudioContext', 'OscillatorNode', 'AnalyserNode', 'GainNode',
    'Float32Array', 'Float64Array', 'Int32Array', 'Uint8Array', 'Uint32Array', 'ArrayBuffer',
    // Browser globals
    'navigator', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame',
  ]);


  private static readonly P5_CALLABLE_GLOBALS = new Set([
    'background', 'beginShape', 'bezier', 'bezierVertex', 'blendMode', 'circle', 'color', 'colorMode',
    'constrain', 'cos', 'createCanvas', 'createGraphics', 'createVector', 'curveVertex', 'dist', 'ellipse',
    'endShape', 'fill', 'image', 'lerp', 'lerpColor', 'line', 'map', 'max', 'min', 'noise', 'noFill',
    'noLoop', 'noStroke', 'pixelDensity', 'pop', 'push', 'random', 'rect', 'resizeCanvas', 'rotate',
    'scale', 'sin', 'stroke', 'strokeWeight', 'text', 'textAlign', 'textFont', 'textSize', 'translate',
    'triangle', 'vertex',
  ]);

  private static readonly traverseAst = (
    typeof traverseModule === 'function'
      ? traverseModule
      : (traverseModule as unknown as { default: typeof traverseModule }).default
  ) as typeof traverseModule;

  /**
   * Validate p5.js code structure
   */
  static validate(code: string): P5ValidationResult {
    const errors: string[] = [];
    const trimmed = code.trim();

    if (!trimmed) {
      errors.push('Code is empty');
      return { valid: false, errors };
    }

    const isHTMLWrapped = this.isAlreadyWrapped(trimmed);

    if (isHTMLWrapped) {
      // HTML-wrapped p5 validation
      errors.push(...this.validateHTMLWrapped(trimmed));
    } else {
      // Raw JS p5 validation
      errors.push(...this.validateRawJS(trimmed));
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if code is HTML-wrapped
   */
  private static isAlreadyWrapped(code: string): boolean {
    const trimmed = code.trim();
    return trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html');
  }

  /**
   * Validate raw JS p5 code
   */
  private static validateRawJS(code: string): string[] {
    const errors: string[] = [];

    errors.push(...this.validateJavaScriptSyntax(code));
    if (errors.length === 0) {
      errors.push(...this.validateReferencedIdentifiers(code));
    }

    // Raw p5.js must have setup/draw/createCanvas (traditional or arrow functions)
    const hasSetup = /function\s+setup\s*\(/.test(code);
    const hasArrowSetup = /(?:const|let|var)\s+setup\s*=\s*(?:\([^)]*\)|\w+)\s*=>/.test(code);
    const hasDraw = /function\s+draw\s*\(/.test(code);
    const hasArrowDraw = /(?:const|let|var)\s+draw\s*=\s*(?:\([^)]*\)|\w+)\s*=>/.test(code);
    const hasCreateCanvas = /createCanvas\s*\(/.test(code);

    if (!hasSetup && !hasArrowSetup && !hasDraw && !hasArrowDraw && !hasCreateCanvas) {
      errors.push('p5.js code must contain at least one of: function setup(), const setup = () =>..., function draw(), const draw = () =>..., or createCanvas()');
    }

    // Raw JS should not start with <!DOCTYPE
    if (code.startsWith('<!DOCTYPE')) {
      errors.push('p5.js code looks like HTML but was detected as raw JS — unexpected');
    }

    return errors;
  }

  /**
   * Validate HTML-wrapped p5 code
   */
  private static validateHTMLWrapped(code: string): string[] {
    const errors: string[] = [];

    // HTML-wrapped p5 must include p5 CDN
    if (!/p5\.js|p5\.min\.js/.test(code)) {
      errors.push('HTML-wrapped p5.js must include p5.js CDN');
    }

    // Should have script tag with p5 code
    if (!/<script[^>]*>.*[\s\S]*?<\/script>/i.test(code)) {
      errors.push('HTML-wrapped p5.js should contain a <script> tag with the sketch code');
    }

    for (const scriptBody of this.extractInlineScriptBodies(code)) {
      errors.push(...this.validateJavaScriptSyntax(scriptBody));
      errors.push(...this.validateReferencedIdentifiers(scriptBody));
    }

    return errors;
  }

  /**
   * Browser p5 sketches must be parseable JavaScript before semantic checks matter.
   */
  private static validateJavaScriptSyntax(code: string): string[] {
    try {
      parse(code, {
        sourceType: 'script',
        allowReturnOutsideFunction: false,
        plugins: ['jsx'],
      });
      return [];
    } catch (error) {
      return [`p5.js code has invalid JavaScript syntax: ${this.formatParseError(error)}`];
    }
  }

  private static validateReferencedIdentifiers(code: string): string[] {
    const ast = parse(code, {
      sourceType: 'script',
      allowReturnOutsideFunction: false,
      plugins: ['jsx'],
    });
    const missing = new Set<string>();
    const assignedGlobals = new Set<string>();
    const shadowedCalls = new Set<string>();

    this.traverseAst(ast, {
      AssignmentExpression(path) {
        const left = path.node.left;
        if (left.type === 'Identifier' && !path.scope.hasBinding(left.name)) {
          assignedGlobals.add(left.name);
        }
      },
      CallExpression(path) {
        const callee = path.node.callee;
        if (callee.type !== 'Identifier' || !P5Validator.P5_CALLABLE_GLOBALS.has(callee.name)) return;

        const binding = path.scope.getBinding(callee.name);
        if (binding) {
          shadowedCalls.add(callee.name);
        }
      },
      ReferencedIdentifier(path) {
        const name = path.node.name;
        if (!path.scope.hasBinding(name) && !P5Validator.P5_GLOBALS.has(name) && !assignedGlobals.has(name)) {
          missing.add(name);
        }
      },
    });

    return [
      ...Array.from(missing)
        .sort()
        .map((name) => `p5.js code references undeclared identifier: ${name}`),
      ...Array.from(shadowedCalls)
        .sort()
        .map((name) => `p5.js code declares local ${name} and then calls ${name}(), shadowing the p5.js function`),
    ];
  }

  private static extractInlineScriptBodies(html: string): string[] {
    const scripts: string[] = [];
    const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
    let match: RegExpExecArray | null;

    while ((match = scriptPattern.exec(html)) !== null) {
      const attributes = match[1] ?? '';
      const body = match[2]?.trim() ?? '';
      if (!/\bsrc\s*=/.test(attributes) && body) {
        scripts.push(body);
      }
    }

    return scripts;
  }

  private static formatParseError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  /**
   * Get minimum size requirement for p5 code
   */
  static getMinSize(): number {
    return 120; // p5 simple sketch: setup + draw + canvas (min valid sketch)
  }
}
