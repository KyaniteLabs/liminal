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

  /**
   * GLSL-specific validation
   */
  protected validateOutput(code: string): { valid: boolean; error?: string } {
    // Check for truncated/incomplete code
    if (this.isTruncated(code)) {
      // Only fail if critically incomplete
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

  /**
   * Wrap GLSL shader for gallery iframe display.
   * Creates a WebGL2 harness with full-screen quad and standard uniforms.
   */
  wrapForGallery(code: string): string {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GLSL Shader</title>
<style>
*{margin:0;padding:0;overflow:hidden}
body{background:#000}
canvas{display:block;width:100vw;height:100vh}
</style>
</head>
<body>
<canvas id="c"></canvas>
<script>
const canvas=document.getElementById('c');
const gl=canvas.getContext('webgl2')||canvas.getContext('webgl');
function resize(){canvas.width=innerWidth;canvas.height=innerHeight;gl&&gl.viewport(0,0,canvas.width,canvas.height)}
addEventListener('resize',resize);resize();
const vs='attribute vec2 a_pos;void main(){gl_Position=vec4(a_pos,0,1);}';
const fs=`precision mediump float;
${code}
uniform float u_time;
uniform vec2 u_resolution;
void main(){mainImage(gl_FragColor,gl_FragCoord.xy);}`;
function createShader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))console.error(gl.getShaderInfoLog(s));return s;}
const v=createShader(gl.VERTEX_SHADER,vs);
const f=createShader(gl.FRAGMENT_SHADER,fs);
const p=gl.createProgram();gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);gl.useProgram(p);
const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
const loc=gl.getAttribLocation(p,'a_pos');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
const uTime=gl.getUniformLocation(p,'u_time');
const uRes=gl.getUniformLocation(p,'u_resolution');
let t=0;
function render(){t+=0.016;gl.uniform1f(uTime,t);gl.uniform2f(uRes,canvas.width,canvas.height);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);requestAnimationFrame(render);}
render();
</script>
</body>
</html>`;
  }
}
