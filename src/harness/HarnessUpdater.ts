/**
 * HarnessUpdater - Updates harness based on detected patterns
 * 
 * This is the "self-improving" part of the Meta-Harness
 */

import { Pattern } from './PatternDetector.js';
import { failureLogger } from './FailureLogger.js';
import { Logger } from '../utils/Logger.js';

export interface HarnessAdaptation {
  patternId: string;
  action: string;
  description: string;
  applied: boolean;
  appliedAt?: string;
  // Extended properties for detailed tracking
  patternName?: string;
  patternSeverity?: 'low' | 'medium' | 'high' | 'critical';
  fixType?: 'prompt' | 'template' | 'guardrail' | 'config' | 'code';
  targetFile?: string;
  success?: boolean;
  error?: string;
  diff?: string;
}

export class HarnessUpdater {
  private adaptations: HarnessAdaptation[] = [];

  /**
   * Apply adaptation based on detected pattern
   */
  applyAdaptation(pattern: Pattern): HarnessAdaptation | null {
    Logger.info('Meta-Harness', `Considering adaptation for: ${pattern.name}`);

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
        Logger.info('Meta-Harness', `No automatic adaptation for: ${pattern.id}`);
        return null;
    }
  }

  private applyQwenSimplification(pattern: Pattern): HarnessAdaptation {
    const adaptation: HarnessAdaptation = {
      patternId: pattern.id,
      action: 'simplifiedPromptsForQwen',
      description: 'Detected Qwen thinking trap pattern',
      applied: false,
      appliedAt: new Date().toISOString(),
      patternName: pattern.name,
      patternSeverity: 'medium',
      fixType: 'prompt'
    };

    this.adaptations.push(adaptation);
    Logger.info('Meta-Harness', `📋 Pattern recorded: ${adaptation.description}`);

    return adaptation;
  }

  private applyGLSLFunctionDefinitions(pattern: Pattern): HarnessAdaptation {
    const adaptation: HarnessAdaptation = {
      patternId: pattern.id,
      action: 'addGLSLFunctionDefinitions',
      description: 'Detected GLSL undefined function pattern',
      applied: false,
      appliedAt: new Date().toISOString(),
      patternName: pattern.name,
      patternSeverity: 'medium',
      fixType: 'template'
    };

    this.adaptations.push(adaptation);
    Logger.info('Meta-Harness', `📋 Pattern recorded: ${adaptation.description}`);

    return adaptation;
  }

  private applyToneAPIReference(pattern: Pattern): HarnessAdaptation {
    const adaptation: HarnessAdaptation = {
      patternId: pattern.id,
      action: 'addToneAPIWhitelist',
      description: 'Detected Tone.js hallucinated API pattern',
      applied: false,
      appliedAt: new Date().toISOString(),
      patternName: pattern.name,
      patternSeverity: 'medium',
      fixType: 'template'
    };

    this.adaptations.push(adaptation);
    Logger.info('Meta-Harness', `📋 Pattern recorded: ${adaptation.description}`);

    return adaptation;
  }

  private applyStrudelAntiPatterns(pattern: Pattern): HarnessAdaptation {
    const adaptation: HarnessAdaptation = {
      patternId: pattern.id,
      action: 'enhanceStrudelPrompt',
      description: 'Detected Strudel/Tidal confusion pattern',
      applied: false,
      appliedAt: new Date().toISOString(),
      patternName: pattern.name,
      patternSeverity: 'medium',
      fixType: 'prompt'
    };

    this.adaptations.push(adaptation);
    Logger.info('Meta-Harness', `📋 Pattern recorded: ${adaptation.description}`);

    return adaptation;
  }

  private applyASCIISimplification(pattern: Pattern): HarnessAdaptation {
    const adaptation: HarnessAdaptation = {
      patternId: pattern.id,
      action: 'reduceASCIIDimensions',
      description: 'Detected ASCII art timeout pattern',
      applied: false,
      appliedAt: new Date().toISOString(),
      patternName: pattern.name,
      patternSeverity: 'medium',
      fixType: 'config'
    };

    this.adaptations.push(adaptation);
    Logger.info('Meta-Harness', `📋 Pattern recorded: ${adaptation.description}`);

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
      '## Detected Patterns',
      ''
    ];

    for (const adaptation of this.adaptations) {
      report.push(`- **${adaptation.action}**: ${adaptation.description}`);
    }

    if (this.adaptations.length === 0) {
      report.push('No patterns detected yet.');
    }

    return report.join('\n');
  }
}

// Singleton instance
export const harnessUpdater = new HarnessUpdater();
