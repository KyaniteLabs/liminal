/**
 * PreviewRouter - Route content to terminal or browser
 * 
 * Decision engine: Where should this content be previewed?
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import { Logger } from '../../utils/Logger.js';

export type PreviewTarget = 'terminal' | 'browser' | 'both' | 'none';

export interface PreviewDecision {
  target: PreviewTarget;
  reason: string;
  terminalType?: 'code' | 'ascii' | 'waveform';
  browserType?: 'p5' | 'glsl' | 'three' | 'hydra' | 'strudel' | 'tone' | 'html' | 'video';
}

export class PreviewRouter {
  /**
   * Determine preview target based on file/content
   */
  async route(filePath: string): Promise<PreviewDecision> {
    const ext = path.extname(filePath).toLowerCase();
    const content = await this.peekContent(filePath);
    
    // Audio files
    if (this.isAudio(ext)) {
      return {
        target: 'both',
        reason: 'Audio plays in terminal, visualizer in browser',
        terminalType: 'waveform',
        browserType: 'tone', // Or strudel depending on content
      };
    }
    
    // Code files - show in terminal
    if (this.isCode(ext)) {
      return {
        target: 'terminal',
        reason: 'Code files render well in terminal',
        terminalType: 'code',
      };
    }
    
    // ASCII art
    if (ext === '.txt' || ext === '.ascii') {
      return {
        target: 'terminal',
        reason: 'Text/ASCII displays natively',
        terminalType: 'ascii',
      };
    }
    
    // Images - could go either way
    if (this.isImage(ext)) {
      return {
        target: 'browser',
        reason: 'Images render better in browser',
      };
    }
    
    // Detect content type from code
    const detectedType = this.detectCodeType(content);
    
    if (detectedType) {
      return {
        target: 'browser',
        reason: `${detectedType} requires browser for rendering`,
        browserType: detectedType,
      };
    }
    
    // Unknown
    return {
      target: 'none',
      reason: `Unknown content type: ${ext}`,
    };
  }

  /**
   * Peek at file content (first few lines)
   */
  private async peekContent(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content.slice(0, 2000); // First 2KB
    } catch (err) {
      Logger.debug('PreviewRouter', `Failed to peek at ${filePath}:`, err);
      return '';
    }
  }

  /**
   * Detect code type from content
   */
  private detectCodeType(content: string): PreviewDecision['browserType'] | null {
    // p5.js
    if (content.includes('createCanvas') || content.includes('function setup()')) {
      return 'p5';
    }
    
    // GLSL
    if (content.includes('gl_FragColor') || content.includes('precision mediump')) {
      return 'glsl';
    }
    
    // Three.js
    if (content.includes('THREE.') || content.includes('new THREE.Scene')) {
      return 'three';
    }
    
    // Hydra
    if (content.includes('osc()') || content.includes('src()') || content.includes('render()')) {
      return 'hydra';
    }
    
    // Strudel
    if (content.includes('$:') || content.includes('stack(') || content.includes('sound(')) {
      return 'strudel';
    }
    
    // Tone.js
    if (content.includes('Tone.') || content.includes('new Tone.Synth')) {
      return 'tone';
    }
    
    // HTML
    if (content.includes('<!DOCTYPE') || content.includes('<html')) {
      return 'html';
    }
    
    return null;
  }

  private isAudio(ext: string): boolean {
    return ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a'].includes(ext);
  }

  private isCode(ext: string): boolean {
    return [
      '.js', '.ts', '.jsx', '.tsx',
      '.py', '.rb', '.go', '.rs',
      '.java', '.cpp', '.c', '.h',
      '.json', '.yaml', '.yml', '.toml',
      '.md', '.sh', '.bash', '.zsh',
    ].includes(ext);
  }

  private isImage(ext: string): boolean {
    return ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg'].includes(ext);
  }

  /**
   * Get quick summary of what will happen
   */
  getSummary(decision: PreviewDecision): string {
    switch (decision.target) {
      case 'terminal':
        return `📺 Terminal: ${decision.terminalType}`;
      case 'browser':
        return `🌐 Browser: ${decision.browserType || 'web content'}`;
      case 'both':
        return `🔊 Terminal (audio) + 🌐 Browser (visual)`;
      case 'none':
        return `❌ Cannot preview: ${decision.reason}`;
    }
  }
}

export const previewRouter = new PreviewRouter();
