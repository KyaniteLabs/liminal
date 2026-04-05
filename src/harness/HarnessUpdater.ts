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
    const description = 'Qwen models: keep prompts simple and direct. Avoid nested instructions. Limit thinking budget to prevent token exhaustion without code output.';
    const adaptation: HarnessAdaptation = {
      patternId: pattern.id,
      action: 'simplifiedPromptsForQwen',
      description,
      applied: true,
      appliedAt: new Date().toISOString(),
      patternName: pattern.name,
      patternSeverity: 'medium',
      fixType: 'prompt',
      success: true,
    };

    this.adaptations.push(adaptation);
    Logger.info('Meta-Harness', `Applied adaptation: ${adaptation.action}`);

    return adaptation;
  }

  private applyGLSLFunctionDefinitions(pattern: Pattern): HarnessAdaptation {
    const description = 'GLSL: include noise(), fbm(), hash() function definitions in prompt. Models frequently use these without defining them.';
    const adaptation: HarnessAdaptation = {
      patternId: pattern.id,
      action: 'addGLSLFunctionDefinitions',
      description,
      applied: true,
      appliedAt: new Date().toISOString(),
      patternName: pattern.name,
      patternSeverity: 'medium',
      fixType: 'template',
      success: true,
    };

    this.adaptations.push(adaptation);
    Logger.info('Meta-Harness', `Applied adaptation: ${adaptation.action}`);

    return adaptation;
  }

  private applyToneAPIReference(pattern: Pattern): HarnessAdaptation {
    const description = 'Tone.js: only use classes from the official API (Synth, MembraneSynth, MetalSynth, PluckSynth, AM/FM/Fat/PWM/ChebyshevSynth, PolySynth, Sampler, Noise, Player, FeedbackDelay, Reverb, Chorus, Tremolo, AutoFilter). Avoid Reverberator, ToneSynth, etc.';
    const adaptation: HarnessAdaptation = {
      patternId: pattern.id,
      action: 'addToneAPIWhitelist',
      description,
      applied: true,
      appliedAt: new Date().toISOString(),
      patternName: pattern.name,
      patternSeverity: 'medium',
      fixType: 'template',
      success: true,
    };

    this.adaptations.push(adaptation);
    Logger.info('Meta-Harness', `Applied adaptation: ${adaptation.action}`);

    return adaptation;
  }

  private applyStrudelAntiPatterns(pattern: Pattern): HarnessAdaptation {
    const description = 'Strudel: use JavaScript syntax only ($: instead of d1 $, note("c3") instead of sound "c3"). Never use Haskell/TidalCycles syntax like d1 $ or $.';
    const adaptation: HarnessAdaptation = {
      patternId: pattern.id,
      action: 'enhanceStrudelPrompt',
      description,
      applied: true,
      appliedAt: new Date().toISOString(),
      patternName: pattern.name,
      patternSeverity: 'medium',
      fixType: 'prompt',
      success: true,
    };

    this.adaptations.push(adaptation);
    Logger.info('Meta-Harness', `Applied adaptation: ${adaptation.action}`);

    return adaptation;
  }

  private applyASCIISimplification(pattern: Pattern): HarnessAdaptation {
    const description = 'ASCII art: reduce default dimensions to prevent timeout. Prefer width <= 80, height <= 40. Avoid fill operations on large areas.';
    const adaptation: HarnessAdaptation = {
      patternId: pattern.id,
      action: 'reduceASCIIDimensions',
      description,
      applied: true,
      appliedAt: new Date().toISOString(),
      patternName: pattern.name,
      patternSeverity: 'medium',
      fixType: 'config',
      success: true,
    };

    this.adaptations.push(adaptation);
    Logger.info('Meta-Harness', `Applied adaptation: ${adaptation.action}`);

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
