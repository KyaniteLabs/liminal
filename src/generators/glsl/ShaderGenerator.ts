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
    return super.generate(prompt, options);
  }

  protected validateOutput(code: string): { valid: boolean; error?: string } {
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
    const escapedCode = code.replace(/`/g, '\\`');

    // Detect if shader uses mainImage (Shadertoy-style) or standard main()
    const hasMainImage = /\bmainImage\s*\(/.test(code);
    const hasMain = /\bvoid\s+main\s*\(/.test(code);

    // Build the fragment shader main() wrapper based on detected entry point
    let mainWrapper: string;
    if (hasMainImage) {
      // Shadertoy-style: shader defines mainImage(out vec4, in vec2)
      mainWrapper = 'void main(){mainImage(gl_FragColor,gl_FragCoord.xy);}';
    } else if (hasMain) {
      // Standard GLSL: shader already has void main(), just call it
      // We wrap it to ensure uniforms are declared before main()
      mainWrapper = 'void main(){main();}';
    } else {
      // Fallback: assume standard main() style if neither detected
      mainWrapper = 'void main(){main();}';
    }

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
      'const fs="precision mediump float;\\n"+"' + escapedCode + '"+"\\nuniform float u_time;\\nuniform vec2 u_resolution;\\n' + mainWrapper + '";\n' +
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
}
