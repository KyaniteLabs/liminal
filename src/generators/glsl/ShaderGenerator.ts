/**
 * ShaderGenerator - GLSL shader generation with tier-based prompts
 */

import { TierBasedGenerator, type TierBasedGeneratorOptions } from '../TierBasedGenerator.js';
import { Logger } from '../../utils/Logger.js';

export class ShaderGenerator extends TierBasedGenerator {
  constructor(llmOrConfig?: ConstructorParameters<typeof TierBasedGenerator>[1]) {
    super('shader', llmOrConfig);
  }

  async generate(prompt: string, options?: TierBasedGeneratorOptions): Promise<string> {
    const code = await super.generate(prompt, options);
    return this.sanitizeShaderCode(code);
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
    const htmlShader = code.match(/const\s+(?:fsSource|fragSrc|fs)\s*=\s*`([\s\S]*?)`/);
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

  private repairCommonLocalModelIssues(code: string): string {
    const hasPaletteVec2Call = /\bpalette\s*\(\s*p\s*\)/.test(code);
    const paletteBodyUsesP = /\bvec3\s+palette\s*\(\s*float\s+\w+\s*\)\s*\{[\s\S]*?\bp\b[\s\S]*?\}/.test(code);
    if (!hasPaletteVec2Call || !paletteBodyUsesP) return code;

    return code.replace(/\bvec3\s+palette\s*\(\s*float\s+\w+\s*\)/, 'vec3 palette(vec2 p)');
  }
}
