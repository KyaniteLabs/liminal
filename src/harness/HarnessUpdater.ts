/**
 * HarnessUpdater - Updates harness based on detected patterns
 * 
 * This is the "self-improving" part of the Meta-Harness
 */

import { Pattern } from './PatternDetector.js';
import { failureLogger } from './FailureLogger.js';

export interface HarnessAdaptation {
  patternId: string;
  action: string;
  description: string;
  applied: boolean;
  appliedAt?: string;
}

export class HarnessUpdater {
  private adaptations: HarnessAdaptation[] = [];

  /**
   * Apply adaptation based on detected pattern
   */
  async applyAdaptation(pattern: Pattern): Promise<HarnessAdaptation | null> {
    console.log(`[Meta-Harness] Considering adaptation for: ${pattern.name}`);

    switch (pattern.id) {
      case 'qwen-thinking-trap':
        return this.applyQwenSimplification(pattern);
      
      case 'glsl-undefined-function':
        return this.applyGLSLFunctionDefinitions(pattern);
      
      case 'tone-hallucinated-api':
        return this.applyToneAPIReference(pattern);
      
      case 'strudel-tidal-confusion':
        return this.applyStrudelAntiPatterns(pattern);
      
      case 'ascii-timeout':
        return this.applyASCIISimplification(pattern);
      
      default:
        console.log(`[Meta-Harness] No automatic adaptation for: ${pattern.id}`);
        return null;
    }
  }

  private applyQwenSimplification(pattern: Pattern): HarnessAdaptation {
    // This is already hardcoded in LLMClient, but we log it
    const adaptation: HarnessAdaptation = {
      patternId: pattern.id,
      action: 'simplifiedPromptsForQwen',
      description: 'Use simplified prompts for Qwen models to avoid thinking trap',
      applied: true,
      appliedAt: new Date().toISOString()
    };
    
    this.adaptations.push(adaptation);
    console.log(`[Meta-Harness] ✓ Adaptation applied: ${adaptation.description}`);
    
    return adaptation;
  }

  private applyGLSLFunctionDefinitions(pattern: Pattern): HarnessAdaptation {
    const adaptation: HarnessAdaptation = {
      patternId: pattern.id,
      action: 'addGLSLFunctionDefinitions',
      description: 'GLSL prompt now includes required function definitions (noise, hash, fbm)',
      applied: true,
      appliedAt: new Date().toISOString()
    };
    
    this.adaptations.push(adaptation);
    console.log(`[Meta-Harness] ✓ Adaptation applied: ${adaptation.description}`);
    
    return adaptation;
  }

  private applyToneAPIReference(pattern: Pattern): HarnessAdaptation {
    const adaptation: HarnessAdaptation = {
      patternId: pattern.id,
      action: 'addToneAPIWhitelist',
      description: 'Tone.js prompt now includes valid API reference to prevent hallucinations',
      applied: true,
      appliedAt: new Date().toISOString()
    };
    
    this.adaptations.push(adaptation);
    console.log(`[Meta-Harness] ✓ Adaptation applied: ${adaptation.description}`);
    
    return adaptation;
  }

  private applyStrudelAntiPatterns(pattern: Pattern): HarnessAdaptation {
    const adaptation: HarnessAdaptation = {
      patternId: pattern.id,
      action: 'enhanceStrudelPrompt',
      description: 'Strudel prompt now includes anti-patterns section (NEVER use Tidal syntax)',
      applied: true,
      appliedAt: new Date().toISOString()
    };
    
    this.adaptations.push(adaptation);
    console.log(`[Meta-Harness] ✓ Adaptation applied: ${adaptation.description}`);
    
    return adaptation;
  }

  private applyASCIISimplification(pattern: Pattern): HarnessAdaptation {
    const adaptation: HarnessAdaptation = {
      patternId: pattern.id,
      action: 'reduceASCIIDimensions',
      description: 'ASCII art default dimensions reduced from 60x30 to 40x20 for faster generation',
      applied: true,
      appliedAt: new Date().toISOString()
    };
    
    this.adaptations.push(adaptation);
    console.log(`[Meta-Harness] ✓ Adaptation applied: ${adaptation.description}`);
    
    return adaptation;
  }

  getAdaptations(): HarnessAdaptation[] {
    return this.adaptations;
  }

  /**
   * Generate harness report
   */
  generateReport(): string {
    const report = [
      '# Meta-Harness Report',
      '',
      `Generated: ${new Date().toISOString()}`,
      `Session: ${failureLogger.getSessionId()}`,
      '',
      '## Applied Adaptations',
      ''
    ];

    for (const adaptation of this.adaptations) {
      report.push(`- **${adaptation.action}**: ${adaptation.description}`);
    }

    if (this.adaptations.length === 0) {
      report.push('No adaptations applied yet.');
    }

    return report.join('\n');
  }
}

// Singleton instance
export const harnessUpdater = new HarnessUpdater();
