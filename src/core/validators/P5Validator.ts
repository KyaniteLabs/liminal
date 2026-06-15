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
    'ADD', 'BASELINE', 'BLEND', 'MULTIPLY', 'BOLD', 'CENTER', 'CLOSE', 'CORNER', 'DEGREES', 'DOWN_ARROW', 'HALF_PI', 'HSB', 'ITALIC', 'LEFT', 'LEFT_ARROW', 'NORMAL', 'PI', 'QUARTER_PI', 'RADIANS', 'RGB', 'RIGHT', 'RIGHT_ARROW', 'TWO_PI', 'UP_ARROW',
    'POINTS', 'LINES', 'TRIANGLES', 'TRIANGLE_FAN', 'TRIANGLE_STRIP', 'QUADS', 'QUAD_STRIP',
    'draw', 'drawingContext', 'frameCount', 'height', 'key', 'keyCode', 'keyIsPressed', 'mouseButton', 'mouseIsPressed', 'mouseX', 'mouseY', 'pixels', 'pmouseX', 'pmouseY', 'setup', 'windowHeight', 'windowWidth', 'width',
    'abs', 'acos', 'angleMode', 'asin', 'atan', 'atan2', 'background', 'beginShape', 'bezier', 'blendMode',
    'bezierVertex', 'ceil', 'circle', 'color', 'colorMode', 'constrain', 'cos', 'createCanvas', 'createGraphics', 'curveVertex', 'dist', 'ellipse', 'endShape', 'exp',
    'fill', 'floor', 'frameRate', 'image', 'lerp', 'line', 'map', 'max', 'millis', 'min', 'nf', 'noFill', 'noise', 'noLoop',
    'createVector',
    'loadPixels', 'noStroke', 'pixelDensity', 'point', 'pop', 'pow', 'push', 'radians', 'random', 'rect', 'rectMode', 'red', 'green', 'blue', 'lerpColor',
    'resizeCanvas', 'rotate', 'round', 'scale', 'sin', 'sqrt',
    'stroke', 'strokeWeight', 'text', 'textAlign', 'textFont', 'textSize', 'textStyle', 'translate', 'triangle', 'updatePixels', 'vertex',
    // p5.sound
    'loadSound', 'createAudio', 'getAudioContext', 'userStartAudio',
    // Web Audio API
    'AudioContext', 'OscillatorNode', 'AnalyserNode', 'GainNode',
    'Float32Array', 'Float64Array', 'Int32Array', 'Uint8Array', 'Uint32Array', 'ArrayBuffer',
    // Browser globals
    'navigator', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame',
    // --- Additional standard p5.js globals (the allowlist above was partial and
    //     rejected valid sketches, e.g. clear(); expand to the common surface). ---
    // Canvas / drawing
    'clear', 'arc', 'quad', 'square', 'ellipseMode', 'imageMode', 'strokeCap', 'strokeJoin',
    'smooth', 'noSmooth', 'erase', 'noErase', 'curve', 'curveTightness', 'bezierDetail',
    'beginContour', 'endContour', 'normalMaterial', 'applyMatrix', 'resetMatrix', 'shearX', 'shearY',
    // Color helpers
    'tint', 'noTint', 'hue', 'saturation', 'brightness', 'alpha', 'lightness',
    // Math / trig / conversion
    'tan', 'log', 'sq', 'fract', 'mag', 'norm', 'degrees', 'int', 'float', 'str', 'boolean', 'byte', 'char',
    'randomSeed', 'noiseSeed', 'noiseDetail', 'randomGaussian',
    // Environment / system
    'deltaTime', 'displayWidth', 'displayHeight', 'displayDensity', 'cursor', 'noCursor', 'fullscreen',
    'focused', 'windowResized', 'getTargetFrameRate', 'getURL', 'getURLPath', 'getURLParams',
    // Input events + state
    'mouseClicked', 'mousePressed', 'mouseReleased', 'mouseMoved', 'mouseDragged', 'mouseWheel',
    'doubleClicked', 'keyPressed', 'keyReleased', 'keyTyped', 'keyIsDown', 'touches', 'touchStarted',
    'touchMoved', 'touchEnded', 'movedX', 'movedY', 'winMouseX', 'winMouseY', 'requestPointerLock',
    // 3D / WEBGL
    'box', 'sphere', 'cylinder', 'cone', 'torus', 'plane', 'ellipsoid', 'rotateX', 'rotateY', 'rotateZ',
    'camera', 'perspective', 'ortho', 'frustum', 'ambientLight', 'directionalLight', 'pointLight',
    'spotLight', 'lights', 'noLights', 'ambientMaterial', 'specularMaterial', 'emissiveMaterial',
    'shininess', 'texture', 'textureMode', 'textureWrap', 'createShader', 'loadShader', 'resetShader',
    'orbitControl', 'model', 'loadModel', 'normal', 'lightFalloff',
    // Typography / DOM
    'textWidth', 'textAscent', 'textDescent', 'textLeading', 'textWrap', 'loadFont',
    'createInput', 'createButton', 'createSlider', 'createDiv', 'createP', 'createElement', 'select', 'selectAll',
    // Image / pixels
    'loadImage', 'createImage', 'get', 'set', 'copy', 'blend', 'filter', 'save', 'saveCanvas', 'saveGif',
    // Array / string utilities
    'append', 'arrayCopy', 'concat', 'reverse', 'shorten', 'shuffle', 'sort', 'splice', 'subset',
    'join', 'match', 'matchAll', 'nfc', 'nfp', 'nfs', 'split', 'splitTokens', 'trim', 'storeItem', 'getItem',
    // Constants
    'WEBGL', 'P2D', 'TAU', 'HSL', 'CORNERS', 'RADIUS', 'ROUND', 'SQUARE', 'PROJECT', 'BEVEL', 'MITER',
    'TOP', 'BOTTOM', 'CHORD', 'PIE', 'OPEN', 'ARROW', 'CROSS', 'HAND', 'MOVE', 'TEXT', 'WAIT', 'AUTO',
    'LANDSCAPE', 'PORTRAIT', 'THRESHOLD', 'GRAY', 'OPAQUE', 'INVERT', 'POSTERIZE', 'BLUR', 'ERODE', 'DILATE',
    'DARKEST', 'LIGHTEST', 'DIFFERENCE', 'SUBTRACT', 'EXCLUSION', 'SCREEN', 'REPLACE', 'OVERLAY',
    'HARD_LIGHT', 'SOFT_LIGHT', 'DODGE', 'BURN', 'LINEAR', 'CLAMP', 'MIRROR', 'REPEAT', 'IMMEDIATE',
  ]);


  private static readonly P5_CALLABLE_GLOBALS = new Set([
    'background', 'beginShape', 'bezier', 'bezierVertex', 'blendMode', 'circle', 'color', 'colorMode',
    'constrain', 'cos', 'createCanvas', 'createGraphics', 'createVector', 'curveVertex', 'dist', 'ellipse',
    'endShape', 'fill', 'image', 'lerp', 'lerpColor', 'line', 'map', 'max', 'millis', 'min', 'nf', 'noise', 'noFill',
    'noLoop', 'noStroke', 'pixelDensity', 'point', 'pop', 'push', 'radians', 'random', 'rect', 'rectMode', 'resizeCanvas', 'rotate',
    'scale', 'sin', 'stroke', 'strokeWeight', 'text', 'textAlign', 'textFont', 'textSize', 'textStyle', 'translate',
    'triangle', 'vertex',
  ]);

  /**
   * p5 functions that parse a color argument. Calling any of these with the bare
   * `arguments` object (a color helper that forwards `arguments` instead of
   * `...arguments`) throws "[object Arguments] is not a valid color representation"
   * at runtime — a guaranteed-throw the generator must regenerate away from.
   */
  private static readonly COLOR_FUNCTIONS = new Set([
    'fill', 'stroke', 'background', 'color', 'colorMode', 'tint',
    'ambientLight', 'specularColor', 'lerpColor',
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

    const sanitized = this.sanitizeNonAsciiOperators(trimmed);
    const isHTMLWrapped = this.isAlreadyWrapped(sanitized);

    if (isHTMLWrapped) {
      errors.push(...this.validateHTMLWrapped(sanitized));
    } else {
      errors.push(...this.validateRawJS(sanitized));
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
      errors.push(...this.validateColorArgs(code));
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
      errors.push(...this.validateColorArgs(scriptBody));
    }

    return errors;
  }

  /**
   * Browser p5 sketches must be parseable JavaScript before semantic checks matter.
   */
  private static validateJavaScriptSyntax(code: string): string[] {
    const sanitized = this.sanitizeNonAsciiOperators(code);
    try {
      parse(sanitized, { sourceType: 'script', allowReturnOutsideFunction: false, plugins: ['jsx'] });
      return [];
    } catch (error) {
      return [`p5.js code has invalid JavaScript syntax: ${this.formatParseError(error)}`];
    }
  }
  private static sanitizeNonAsciiOperators(code: string): string {
    const spaces = (m: string) => ' '.repeat(m.length);
    const masked = code
      .replace(/\/\*[\s\S]*?\*\//g, spaces)
      .replace(/\/\/.*$/gm, spaces)
      .replace(/(["'`])(?:\\[\s\S]|(?!\1)[\s\S])*\1/g, spaces);
    let out = '';
    for (let i = 0; i < code.length; i++) {
      const ch = code[i];
      out += (ch.codePointAt(0) ?? 0) > 0x7f && masked[i] === ch ? ' ' : ch;
    }
    return out;
  }

  /**
   * Flag a p5 color function called with the bare `arguments` object — a color
   * helper that forwards `arguments` instead of `...arguments`. p5 throws
   * "[object Arguments] is not a valid color representation" at runtime, so the
   * generator's validate->retry loop must regenerate. The valid spread form
   * `fill(...arguments)` is a SpreadElement (not an `arguments` Identifier) and is
   * correctly allowed.
   */
  private static validateColorArgs(code: string): string[] {
    let ast: ReturnType<typeof parse>;
    try {
      ast = parse(code, { sourceType: 'script', allowReturnOutsideFunction: false, plugins: ['jsx'] });
    } catch {
      return []; // invalid syntax is reported separately by validateJavaScriptSyntax
    }
    const colorFns = this.COLOR_FUNCTIONS;
    const offenders = new Set<string>();
    this.traverseAst(ast, {
      CallExpression(path) {
        const callee = path.node.callee;
        const name = callee.type === 'Identifier'
          ? callee.name
          : callee.type === 'MemberExpression' && !callee.computed && callee.property.type === 'Identifier'
            ? callee.property.name
            : null;
        if (!name || !colorFns.has(name)) return;
        const first = path.node.arguments[0];
        if (first && first.type === 'Identifier' && first.name === 'arguments') {
          offenders.add(name);
        }
      },
    });
    if (offenders.size === 0) return [];
    return [
      `p5.js color function(s) called with the \`arguments\` object (${Array.from(offenders).sort().join(', ')}) — use \`...arguments\` (spread) or explicit values; passing \`arguments\` throws "[object Arguments] is not a valid color representation" at runtime`,
    ];
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
