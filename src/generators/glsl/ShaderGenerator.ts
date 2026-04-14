/**
 * ShaderGenerator - GLSL shader generation with tier-based prompts
 */

import { TierBasedGenerator, type TierBasedGeneratorOptions } from '../TierBasedGenerator.js';
import type { LLMResponse } from '../../llm/LLMClient.js';
import { CodeValidator } from '../../core/CodeValidator.js';
import { Logger } from '../../utils/Logger.js';

export class ShaderGenerator extends TierBasedGenerator {
  constructor(llmOrConfig?: ConstructorParameters<typeof TierBasedGenerator>[1]) {
    super('shader', llmOrConfig);
  }

  async generate(prompt: string, options?: TierBasedGeneratorOptions): Promise<string> {
    return super.generate(this.withShaderContract(prompt), options);
  }

  async generateFull(prompt: string, options?: TierBasedGeneratorOptions): Promise<LLMResponse> {
    return super.generateFull(this.withShaderContract(prompt), options);
  }

  protected validateOutput(code: string): { valid: boolean; error?: string } {
    const validation = CodeValidator.validate(code, 'glsl');
    if (!validation.valid) {
      return { valid: false, error: validation.errors.join('; ') };
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

  private withShaderContract(prompt: string): string {
    return [
      prompt,
      '',
      'Output contract:',
      '- Return only GLSL fragment shader code, not Markdown.',
      '- Do not return HTML, JavaScript, WebGL setup code, Three.js, imports, canvas code, or CSS.',
      '- Include `precision mediump float;`.',
      '- Include uniforms `uniform float u_time;` and `uniform vec2 u_resolution;`.',
      '- Use either `void main()` with `gl_FragColor` or `void mainImage(out vec4 fragColor, in vec2 fragCoord)`.',
      '- Fragment output must be vec4: use `gl_FragColor = vec4(color, 1.0);`, never `gl_FragColor = color;` when color is vec3.',
      '- If an expression returns vec2, reduce it with `length(...)`, `.x`, or `.y` before assigning to float.',
      '- Use GLSL types only: float, vec2, vec3, vec4, mat2, mat3, mat4.',
      '- Do not use JavaScript APIs such as Date, window, document, requestAnimationFrame, THREE, Scene, or WebGLRenderer.',
      '',
      'Minimal valid shape:',
      'precision mediump float;',
      'uniform float u_time;',
      'uniform vec2 u_resolution;',
      'float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
      'void mainImage(out vec4 fragColor, in vec2 fragCoord) {',
      '  vec2 uv = fragCoord / u_resolution.xy;',
      '  float n = hash(floor(uv * 12.0 + u_time));',
      '  vec3 color = mix(vec3(0.02, 0.05, 0.2), vec3(0.9, 0.2, 0.7), n);',
      '  fragColor = vec4(color, 1.0);',
      '}',
    ].join('\n');
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
    const hasMain = /void\s+main\s*\(/.test(code) || /void\s+mainImage\s*\(/.test(code);
    const hasFragmentOutput = /gl_FragColor|fragColor/.test(code);
    if (!hasMain || !hasFragmentOutput) return true;
    return false;
  }

  wrapForGallery(code: string): string {
    const shader = this.normalizeShaderForPreview(code);
    const escapedCode = shader.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
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
      'const vs="attribute vec2 a_pos;void main(){gl_Position=vec4(a_pos,0,1);}";\n' +
      'const fs="' + escapedCode + '";\n' +
      'function createShader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))console.error(gl.getShaderInfoLog(s));return s;}\n' +
      'const v=createShader(gl.VERTEX_SHADER,vs);\n' +
      'const f=createShader(gl.FRAGMENT_SHADER,fs);\n' +
      'const prog=gl.createProgram();gl.attachShader(prog,v);gl.attachShader(prog,f);gl.linkProgram(prog);gl.useProgram(prog);\n' +
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

  private normalizeShaderForPreview(code: string): string {
    const lines: string[] = [];
    if (!/precision\s+\w+\s+float\s*;/.test(code)) {
      lines.push('precision mediump float;');
    }
    if (!/uniform\s+float\s+u_time\s*;/.test(code)) {
      lines.push('uniform float u_time;');
    }
    if (!/uniform\s+vec2\s+u_resolution\s*;/.test(code)) {
      lines.push('uniform vec2 u_resolution;');
    }
    lines.push(code.trim());
    if (/void\s+mainImage\s*\(/.test(code) && !/void\s+main\s*\(/.test(code)) {
      lines.push('void main(){mainImage(gl_FragColor,gl_FragCoord.xy);}');
    }
    return lines.join('\n');
  }
}
