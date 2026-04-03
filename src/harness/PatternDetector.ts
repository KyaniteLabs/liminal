/**
 * PatternDetector - Analyzes failures to detect recurring patterns
 * 
 * Meta-Harness uses this to learn from failures and update itself
 */

import { Domain } from '../types/domains.js';
import { FailureRecord, failureLogger } from './FailureLogger.js';

export interface Pattern {
  id: string;
  name: string;
  description: string;
  detector: (failure: FailureRecord) => boolean;
  occurrences: number;
  firstSeen: string;
  lastSeen: string;
  affectedModels: string[];
  affectedDomains: string[];
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

// Known patterns from dogfooding
export const KNOWN_PATTERNS: Omit<Pattern, 'occurrences' | 'firstSeen' | 'lastSeen' | 'affectedModels' | 'affectedDomains'>[] = [
  {
    id: 'qwen-thinking-trap',
    name: 'Qwen Thinking Mode Trap',
    description: 'Qwen models get stuck in thinking mode with complex prompts, consuming all tokens without outputting code',
    detector: (f) => {
      const thinking = f.thinking || '';
      const code = f.code || '';
      return f.model.toLowerCase().includes('qwen') && 
             f.errorType === 'timeout' &&
             thinking.length > 1000 &&
             code.length === 0;
    }
  },
  {
    id: 'glsl-undefined-function',
    name: 'GLSL Undefined Function',
    description: 'GLSL code uses functions like noise() or fbm() without defining them',
    detector: (f) => {
      const errors = f.validationErrors || [];
      return f.domain === Domain.GLSL &&
             f.errorType === 'validation' &&
             errors.some(e => e.includes('not defined'));
    }
  },
  {
    id: 'tone-hallucinated-api',
    name: 'Tone.js API Hallucination',
    description: 'Tone.js code uses classes that do not exist (e.g., Tone.Reverberator)',
    detector: (f) => {
      const errors = f.validationErrors || [];
      return f.domain === Domain.TONE &&
             f.errorType === 'validation' &&
             errors.some(e => e.includes('is not a valid class') || e.includes('does not exist'));
    }
  },
  {
    id: 'strudel-tidal-confusion',
    name: 'Strudel/TidalCycles Syntax Confusion',
    description: 'Models use TidalCycles Haskell syntax instead of Strudel JavaScript',
    detector: (f) => {
      const code = f.code || '';
      return f.domain === Domain.STRUDEL &&
             (code.includes('d1 $') || code.includes('sound "')) &&
             !code.includes('$:');
    }
  },
  {
    id: 'ascii-timeout',
    name: 'ASCII Art Timeout',
    description: 'ASCII art generation times out due to complex dimensions',
    detector: (f) => {
      const error = f.error || '';
      return f.domain === 'ascii' &&
             (f.errorType === 'timeout' || error.includes('timeout'));
    }
  },
  {
    id: 'html-404-error',
    name: 'HTML Generator 404',
    description: 'HTML generator endpoint returns 404 for certain models',
    detector: (f) => {
      const error = f.error || '';
      return f.domain === 'html' &&
             error.includes('404');
    }
  }
];

export class PatternDetector {
  private patterns: Map<string, Pattern> = new Map();

  constructor() {
    // Initialize with known patterns
    for (const pattern of KNOWN_PATTERNS) {
      this.patterns.set(pattern.id, {
        ...pattern,
        occurrences: 0,
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        affectedModels: [],
        affectedDomains: []
      });
    }
  }

  analyze(failure: FailureRecord): Pattern[] {
    const detected: Pattern[] = [];

    for (const [, pattern] of this.patterns) {
      if (pattern.detector(failure)) {
        // Update pattern stats
        pattern.occurrences++;
        pattern.lastSeen = new Date().toISOString();
        
        if (!pattern.affectedModels.includes(failure.model)) {
          pattern.affectedModels.push(failure.model);
        }
        if (!pattern.affectedDomains.includes(failure.domain)) {
          pattern.affectedDomains.push(failure.domain);
        }

        detected.push(pattern);
        console.log(`[Meta-Harness] Pattern detected: ${pattern.name} (${pattern.occurrences} occurrences)`);
      }
    }

    return detected;
  }

  async analyzeRecentFailures(count: number = 100): Promise<Map<string, Pattern>> {
    const failures = failureLogger.getRecentFailures(count);
    
    for (const failure of failures) {
      this.analyze(failure);
    }

    return this.patterns;
  }

  getPattern(id: string): Pattern | undefined {
    return this.patterns.get(id);
  }

  getAllPatterns(): Pattern[] {
    return Array.from(this.patterns.values());
  }

  getHighImpactPatterns(threshold: number = 3): Pattern[] {
    return this.getAllPatterns()
      .filter(p => p.occurrences >= threshold)
      .sort((a, b) => b.occurrences - a.occurrences);
  }
}

// Singleton instance
export const patternDetector = new PatternDetector();
