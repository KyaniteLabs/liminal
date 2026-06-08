/**
 * ShaderGenerator - GLSL shader generation with tier-based prompts
 */

import { TierBasedGenerator, type TierBasedGeneratorOptions } from '../TierBasedGenerator.js';
import { Logger } from '../../utils/Logger.js';
import { GLSLValidator } from '../../core/validators/GLSLValidator.js';

export class ShaderGenerator extends TierBasedGenerator {
  constructor(llmOrConfig?: ConstructorParameters<typeof TierBasedGenerator>[1]) {
    super('shader', llmOrConfig);
  }

  async generate(prompt: string, options?: TierBasedGeneratorOptions): Promise<string> {
    try {
      const code = await super.generate(prompt, options);
      return this.sanitizeShaderCode(code);
    } catch (err) {
      if (!this.shouldUseProviderRecoveryShader(err, options?.signal)) throw err;
      Logger.warn('ShaderGenerator', 'Provider returned no GLSL artifact; rendering local recovery shader');
      const recovered = this.providerRecoveryShader();
      const validation = this.validateOutput(recovered);
      if (!validation.valid) throw err;
      return recovered;
    }
  }

  protected buildEmptyCodeRetrySystemPrompt(): string {
    return 'You write final GLSL fragment shader source code only. Start with GLSL code immediately; never include prose, markdown, hidden reasoning, or tool calls.';
  }

  protected buildEmptyCodeRetryPrompt(originalPrompt: string): string {
    return [
      'Write one complete GLSL fragment shader now.',
      'Output raw GLSL only. No markdown, prose, hidden reasoning, or comments about your plan.',
      'Required tokens: precision mediump float; uniform vec2 u_resolution; uniform float u_time; void main(); gl_FragColor.',
      'Use gl_FragCoord / u_resolution for uv coordinates and u_time for animation.',
      'Include either hash/noise/fbm or multiple vec3 color palettes so the shader is not a flat gradient.',
      `Creative brief: ${this.extractCreativeBrief(originalPrompt)}`,
    ].join('\n');
  }

  protected maxTokensForDirectRetry(maxTokens?: number): number | undefined {
    const configured = this.llm.getConfig().maxTokens;
    return Math.max(maxTokens ?? 0, configured ?? 0, 4096);
  }

  protected temperatureForDirectRetry(): number | undefined {
    return 0.2;
  }

  protected validateOutput(code: string): { valid: boolean; error?: string } {
    code = this.sanitizeShaderCode(code);
    const preprocessorError = this.validatePreprocessorDirectives(code);
    if (preprocessorError) {
      return { valid: false, error: preprocessorError };
    }

    if (/\.\.\./.test(code) || /\/\/\s*\.\.\./.test(code)) {
      return { valid: false, error: 'Generated shader contains placeholder ellipses; return complete executable GLSL' };
    }

    if (/\bvec4\s*\(\s*color\b/.test(code) && !/\b(?:vec[234]|float)\s+color\b/.test(code)) {
      return { valid: false, error: 'Generated shader references color without declaring it' };
    }

    if (this.isTruncated(code)) {
      if (!code.includes('void main') && !code.includes('gl_FragColor')) {
        return {
          valid: false,
          error: 'Generated code is critically incomplete (missing main or gl_FragColor)',
        };
      }
      Logger.warn('ShaderGenerator', 'Code may be truncated, attempting to use anyway');
    }
    const validation = GLSLValidator.validate(code);
    if (!validation.valid) {
      return { valid: false, error: validation.errors.join('; ') };
    }
    return { valid: true };
  }

  private validatePreprocessorDirectives(code: string): string | null {
    let depth = 0;
    for (const line of code.split('\n')) {
      const trimmed = line.trim();
      if (/^#\s*(if|ifdef|ifndef)\b/.test(trimmed)) {
        depth++;
      } else if (/^#\s*(else|elif)\b/.test(trimmed)) {
        if (depth === 0) return `Orphan GLSL preprocessor directive: ${trimmed}`;
      } else if (/^#\s*endif\b/.test(trimmed)) {
        if (depth === 0) return `Orphan GLSL preprocessor directive: ${trimmed}`;
        depth--;
      }
    }
    return depth > 0 ? 'Unclosed GLSL preprocessor conditional' : null;
  }

  private isTruncated(code: string): boolean {
    const trimmed = code.trim();
    const lastChar = trimmed.slice(-1);
    const lastLine = trimmed.split('\n').pop() || '';
    if (!['}', ';', '\n'].includes(lastChar) && lastLine.length > 0) {
      if (!lastLine.trim().startsWith('//') && !lastLine.trim().startsWith('/*')) {
        return true;
      }
    }
    const openBraces = (code.match(/\{/g) || []).length;
    const closeBraces = (code.match(/\}/g) || []).length;
    if (openBraces > closeBraces) return true;
    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;
    if (openParens > closeParens) return true;
    if (!code.includes('void main') || !code.includes('gl_FragColor')) return true;
    return false;
  }

  wrapForGallery(code: string): string {
    code = this.sanitizeShaderCode(code);
    const hasPrecision = /\bprecision\s+(lowp|mediump|highp)\s+float\s*;/.test(code);
    const hasTime = /\buniform\s+float\s+(u_time|iTime)\s*;/.test(code);
    const hasResolution = /\buniform\s+vec2\s+(u_resolution|iResolution)\s*;/.test(code);
    const hasMain = /\bvoid\s+main\s*\(/.test(code);
    const hasMainImage = /\bvoid\s+mainImage\s*\(/.test(code);
    const shaderSource = [
      hasPrecision ? '' : 'precision mediump float;',
      hasTime ? '' : 'uniform float u_time;',
      hasResolution ? '' : 'uniform vec2 u_resolution;',
      code,
      hasMainImage && !hasMain ? 'void main(){mainImage(gl_FragColor,gl_FragCoord.xy);}' : '',
    ].filter(Boolean).join('\n');
    const usesGlsl300 = /^\s*#version\s+300\s+es/m.test(shaderSource);
    const encodedShader = JSON.stringify(shaderSource);
    const vertexShader = usesGlsl300
      ? '#version 300 es\nin vec2 a_pos;out vec2 v_uv;void main(){v_uv=a_pos*0.5+0.5;gl_Position=vec4(a_pos,0,1);}'
      : 'attribute vec2 a_pos;void main(){gl_Position=vec4(a_pos,0,1);}';
    const harness = '<!DOCTYPE html>\n' +
      '<html>\n' +
      '<head>\n' +
      '<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
      '<title>GLSL Shader</title>\n' +
      '<style>\n' +
      '*{margin:0;padding:0;overflow:hidden}\n' +
      'body{background:#000}\n' +
      'canvas{display:block;width:100vw;height:100vh}\n' +
      '</style>\n' +
      '</head>\n' +
      '<body>\n' +
      '<canvas id="c"></canvas>\n' +
      '<script>\n' +
      'const canvas=document.getElementById("c");\n' +
      'const gl=canvas.getContext("webgl2")||canvas.getContext("webgl");\n' +
      'function resize(){canvas.width=innerWidth;canvas.height=innerHeight;gl&&gl.viewport(0,0,canvas.width,canvas.height)}\n' +
      'addEventListener("resize",resize);resize();\n' +
      'const vs=' + JSON.stringify(vertexShader) + ';\n' +
      'const fs=' + encodedShader + ';\n' +
      'function createShader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){throw new Error(gl.getShaderInfoLog(s)||"shader compile failed")}return s;}\n' +
      'const v=createShader(gl.VERTEX_SHADER,vs);\n' +
      'const f=createShader(gl.FRAGMENT_SHADER,fs);\n' +
      'const prog=gl.createProgram();gl.attachShader(prog,v);gl.attachShader(prog,f);gl.linkProgram(prog);if(!gl.getProgramParameter(prog,gl.LINK_STATUS)){throw new Error(gl.getProgramInfoLog(prog)||"shader link failed")}gl.useProgram(prog);\n' +
      'const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);\n' +
      'const loc=gl.getAttribLocation(prog,"a_pos");gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);\n' +
      'const uTime=gl.getUniformLocation(prog,"u_time");\n' +
      'const uRes=gl.getUniformLocation(prog,"u_resolution");\n' +
      'let t=0;\n' +
      'function render(){t+=0.016;gl.uniform1f(uTime,t);gl.uniform2f(uRes,canvas.width,canvas.height);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);requestAnimationFrame(render);}\n' +
      'render();\n' +
      '</script>\n' +
      '</body>\n' +
      '</html>';
    return harness;
  }

  private sanitizeShaderCode(code: string): string {
    // Try fenced extraction first — handles both normal and backslash-escaped fences
    const fencedShader = code.match(/\\?`{3}(?:glsl|frag|fragment|shader)?\s*\n?([\s\S]*?)\\?`{3}/i);
    if (fencedShader?.[1]) {
      let extracted = fencedShader[1].trim();
      // Unescape any backslash-newline sequences left in the extracted GLSL
      extracted = extracted.replace(/\\n/g, '\n');
      return this.injectCommonHelpers(extracted);
    }
    const htmlShader = code.match(/\b(?:const|let|var)\s+(?:fsSource|fragSrc|fs|fragmentShaderSource|fragmentSource|fragmentShader|shaderSource)\s*=\s*`([\s\S]*?)`/);
    if (htmlShader?.[1]) {
      return this.injectCommonHelpers(htmlShader[1].trim());
    }
    // Fallback: strip fences and unescape
    const cleaned = code
      .replace(/^\\?`{3}(?:glsl|frag|fragment|shader)?\s*\n?/i, '')
      .replace(/\\?`{3}\s*$/i, '')
      .replace(/\\n/g, '\n')
      .trim();
    return this.injectCommonHelpers(cleaned);
  }

  private injectCommonHelpers(code: string): string {
    code = this.repairCommonLocalModelIssues(code);
    code = this.ensureMainEntrypoint(code);
    const usesFbm = /\bfbm\s*\(/.test(code);
    const definesFbm = /\b(?:float|vec[234])\s+fbm\s*\(/.test(code);
    if (!usesFbm || definesFbm) return code;

    const helper = [
      'float hash(vec2 p) {',
      '  p = fract(p * vec2(123.34, 345.45));',
      '  p += dot(p, p + 34.345);',
      '  return fract(p.x * p.y);',
      '}',
      'float noise(vec2 p) {',
      '  vec2 i = floor(p);',
      '  vec2 f = fract(p);',
      '  vec2 u = f * f * (3.0 - 2.0 * f);',
      '  return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),',
      '             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);',
      '}',
      'float fbm(vec2 p) {',
      '  float value = 0.0;',
      '  float amplitude = 0.5;',
      '  for (int i = 0; i < 5; i++) {',
      '    value += amplitude * noise(p);',
      '    p *= 2.0;',
      '    amplitude *= 0.5;',
      '  }',
      '  return value;',
      '}',
      '',
    ].join('\n');

    const precisionMatch = code.match(/^\s*precision\s+(?:lowp|mediump|highp)\s+float\s*;\s*/m);
    if (precisionMatch?.index !== undefined) {
      const insertAt = precisionMatch.index + precisionMatch[0].length;
      return `${code.slice(0, insertAt)}\n${helper}${code.slice(insertAt)}`;
    }
    return `${helper}${code}`;
  }

  private ensureMainEntrypoint(code: string): string {
    if (/\bvoid\s+main\s*\(/.test(code)) return code;
    if (/\bvoid\s+mainImage\s*\(/.test(code)) {
      if (this.isGlsl300(code)) {
        const declaredOutput = this.findDeclaredFragmentOutput(code);
        const outputVariable = declaredOutput ?? 'liminalFragColor';
        const shader = declaredOutput ? code.trim() : this.insertGlsl300FragmentOutput(code, outputVariable);
        return `${shader}\nvoid main(){mainImage(${outputVariable},gl_FragCoord.xy);}`;
      }
      return `${code.trim()}\nvoid main(){mainImage(gl_FragColor,gl_FragCoord.xy);}`;
    }
    return code;
  }

  private isGlsl300(code: string): boolean {
    return /^\s*#version\s+300\s+es\b/m.test(code);
  }

  private findDeclaredFragmentOutput(code: string): string | null {
    const match = code.match(/^\s*(?:layout\s*\([^)]*\)\s*)?out\s+(?:(?:lowp|mediump|highp)\s+)?vec4\s+([A-Za-z_]\w*)\s*;/m);
    return match?.[1] ?? null;
  }

  private insertGlsl300FragmentOutput(code: string, outputVariable: string): string {
    const declaration = `out vec4 ${outputVariable};`;
    const trimmed = code.trim();
    const precisionMatch = trimmed.match(/^\s*precision\s+(?:lowp|mediump|highp)\s+float\s*;\s*/m);
    if (precisionMatch?.index !== undefined) {
      const insertAt = precisionMatch.index + precisionMatch[0].length;
      return `${trimmed.slice(0, insertAt)}\n${declaration}\n${trimmed.slice(insertAt)}`;
    }
    const versionMatch = trimmed.match(/^\s*#version\s+300\s+es[^\n]*\n?/m);
    if (versionMatch?.index !== undefined) {
      const insertAt = versionMatch.index + versionMatch[0].length;
      return `${trimmed.slice(0, insertAt)}${declaration}\n${trimmed.slice(insertAt)}`;
    }
    return `${declaration}\n${trimmed}`;
  }

  private repairCommonLocalModelIssues(code: string): string {
    // The WebGL1 fragment-shader render harness embeds the shader source directly
    // and mishandles `#ifdef GL_ES ... #endif` precision guards: it strips the
    // opener and leaves the `#endif`, producing "unexpected #endif without a
    // matching #if" at compile. GLSL ES 1.00 only needs a bare precision
    // declaration, so collapse any GL_ES guard to the precision line it wraps
    // (or its inner content) before it can be orphaned downstream.
    code = code.replace(
      /#\s*if(?:def\s+GL_ES|\s+defined\s*\(\s*GL_ES\s*\))\b[^\n]*\n([\s\S]*?)\n?[^\S\n]*#\s*endif\b[^\n]*/gi,
      (_match, inner: string) => {
        const precision = inner.match(/precision\s+(?:low|medium|high)p\s+float\s*;/i);
        return precision ? precision[0] : inner.trim();
      },
    );

    const hasPaletteVec2Call = /\bpalette\s*\(\s*p\s*\)/.test(code);
    const paletteBodyUsesP = /\bvec3\s+palette\s*\(\s*float\s+\w+\s*\)\s*\{[\s\S]*?\bp\b[\s\S]*?\}/.test(code);
    if (!hasPaletteVec2Call || !paletteBodyUsesP) return code;

    return code.replace(/\bvec3\s+palette\s*\(\s*float\s+\w+\s*\)/, 'vec3 palette(vec2 p)');
  }

  private shouldUseProviderRecoveryShader(err: unknown, signal?: AbortSignal): boolean {
    if (signal?.aborted) return false;
    const message = err instanceof Error ? err.message : String(err);
    return /(?:no usable content|LLM returned empty code|Generated code is too short \(0 chars\)|Code is empty after stripping)/i.test(message);
  }

  private extractCreativeBrief(prompt: string): string {
    const match = prompt.match(/(?:Primary request:|User request:|Original request:)\s*([^\n]+)/i);
    const brief = (match?.[1] ?? prompt).replace(/\s+/g, ' ').trim();
    return brief.slice(0, 500);
  }

  private providerRecoveryShader(): string {
    return [
      '/* Sinter provider recovery: local GLSL safety shader rendered after the model returned no artifact. */',
      'precision mediump float;',
      'uniform vec2 u_resolution;',
      'uniform float u_time;',
      '',
      'float hash(vec2 p) {',
      '  p = fract(p * vec2(127.1, 311.7));',
      '  p += dot(p, p + 34.17);',
      '  return fract(p.x * p.y);',
      '}',
      '',
      'float noise(vec2 p) {',
      '  vec2 i = floor(p);',
      '  vec2 f = fract(p);',
      '  vec2 u = f * f * (3.0 - 2.0 * f);',
      '  return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),',
      '             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);',
      '}',
      '',
      'float fbm(vec2 p) {',
      '  float value = 0.0;',
      '  float amplitude = 0.5;',
      '  for (int i = 0; i < 5; i++) {',
      '    value += amplitude * noise(p);',
      '    p *= 2.05;',
      '    amplitude *= 0.52;',
      '  }',
      '  return value;',
      '}',
      '',
      'void main() {',
      '  vec2 safeResolution = max(u_resolution, vec2(1.0));',
      '  vec2 uv = gl_FragCoord.xy / safeResolution;',
      '  vec2 p = (uv - 0.5) * vec2(safeResolution.x / safeResolution.y, 1.0);',
      '  float t = u_time * 0.18;',
      '  float field = fbm(p * 3.0 + vec2(t, -t));',
      '  float cloud = fbm(p * 6.0 - vec2(t * 0.7, t * 0.4));',
      '  float radial = length(p);',
      '  float pulse = 0.5 + 0.5 * sin(radial * 18.0 - u_time * 2.0);',
      '  vec3 shadow = vec3(0.035, 0.015, 0.085);',
      '  vec3 violet = vec3(0.44, 0.12, 0.84);',
      '  vec3 orchid = vec3(0.80, 0.35, 1.00);',
      '  vec3 cyan = vec3(0.16, 0.70, 0.95);',
      '  vec3 color = mix(shadow, violet, smoothstep(0.18, 0.86, field));',
      '  color = mix(color, orchid, smoothstep(0.45, 0.95, cloud) * 0.55);',
      '  color += cyan * pow(pulse, 3.0) * smoothstep(0.65, 0.05, radial) * 0.35;',
      '  color += vec3(0.95, 0.82, 1.0) * smoothstep(0.82, 1.0, field) * 0.22;',
      '  gl_FragColor = vec4(color, 1.0);',
      '}',
    ].join('\n');
  }
}
