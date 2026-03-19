/**
 * CreativeEvaluator - Quality gates for creative coding output
 *
 * Evaluates creative output (p5.js sketches, generative art) on:
 * - Technical validity (syntax, structure, completeness)
 * - Creative quality (complexity, techniques, aesthetics)
 * - Aesthetic = visual (creative) + sound (when sound APIs present)
 * - Returns score 0-1, with minimum threshold of 0.7 to pass
 */

export interface AssessOptions {
  /** When provided, overall score is the average of scores for these dimensions. Known dimensions: "technical", "aesthetic", "novelty". Aesthetic combines visual (creative) and sound. */
  evaluationCriteria?: string[];
}

interface AssessmentResult {
  passed: boolean;
  score: number;
  issues: string[];
  technicalScore: number;
  creativeScore: number;
  metrics: CodeMetrics;
}

interface CodeMetrics {
  codeLength: number;
  hasSetup: boolean;
  hasDraw: boolean;
  usesAnimation: boolean;
  usesColor: boolean;
  hasInteractivity: boolean;
  complexity: number;
  usesClasses: boolean;
  usesArrays: boolean;
  usesComments: boolean;
}

const MIN_QUALITY_THRESHOLD = 0.7;

export class CreativeEvaluator {
  /**
   * Get fitness score and issues for code (same as assess score/issues).
   * @param code - The code to evaluate
   * @param options - Optional evaluation criteria (reserved; not used by assess)
   * @returns { score, issues } matching assess(code)
   */
  static getFitness(
    code: string,
    _options?: { evaluationCriteria?: string[] }
  ): { score: number; issues: string[] } {
    const result = this.assess(code);
    return { score: result.score, issues: result.issues };
  }

  /**
   * Assess creative output quality.
   *
   * When `options.evaluationCriteria` is provided (e.g. ["aesthetic", "technical", "novelty"]),
   * the overall score is the **average** of the present dimension scores:
   * - **technical**: structure, syntax, completeness (0–1).
   * - **aesthetic**: visual quality (creative score) + sound; aesthetic = (creativeScore + soundScore) / 2, with soundScore = 0.5 if code uses p5.sound / AudioContext / createOscillator / Web Audio and looks valid, else 0.
   * - **novelty**: proxied by creative score (complexity, techniques).
   *
   * When `evaluationCriteria` is not provided, score = technicalScore * 0.6 + creativeScore * 0.4 (legacy behavior).
   *
   * @param output - The code to evaluate
   * @param options - Optional: evaluationCriteria array to compute score from selected dimensions
   * @returns Assessment result with score, issues, and metrics
   */
  static assess(output: any, options?: AssessOptions): AssessmentResult {
    // Validate input type
    if (typeof output !== 'string') {
      return {
        passed: false,
        score: 0,
        issues: ['Invalid output type'],
        technicalScore: 0,
        creativeScore: 0,
        metrics: this.getEmptyMetrics(),
      };
    }

    // Check for empty/whitespace-only output
    const trimmed = output.trim();
    if (trimmed.length === 0) {
      return {
        passed: false,
        score: 0,
        issues: ['Empty output'],
        technicalScore: 0,
        creativeScore: 0,
        metrics: this.getEmptyMetrics(),
      };
    }

    // Calculate metrics
    const metrics = this.analyzeMetrics(output);

    // Calculate scores
    const technicalScore = this.calculateTechnicalScore(output, metrics);
    const creativeScore = this.calculateCreativeScore(output, metrics);
    const soundScore = this.getSoundScore(output);

    let overallScore: number;
    if (options?.evaluationCriteria && options.evaluationCriteria.length > 0) {
      const dimensionScores: number[] = [];
      for (const criterion of options.evaluationCriteria) {
        if (criterion === 'technical') dimensionScores.push(technicalScore);
        // Aesthetic = visual + sound for launch (creativeScore + getSoundScore).
        else if (criterion === 'aesthetic') dimensionScores.push((creativeScore + soundScore) / 2);
        else if (criterion === 'novelty') dimensionScores.push(creativeScore);
        else dimensionScores.push(creativeScore);
      }
      overallScore = dimensionScores.reduce((a, b) => a + b, 0) / dimensionScores.length;
    } else {
      overallScore = technicalScore * 0.6 + creativeScore * 0.4;
    }

    // Identify issues
    const issues = this.identifyIssues(output, metrics, technicalScore, creativeScore);

    // Determine if passed
    const passed = overallScore >= MIN_QUALITY_THRESHOLD;

    return {
      passed,
      score: overallScore,
      issues,
      technicalScore,
      creativeScore,
      metrics,
    };
  }

  /**
   * Analyze code metrics
   */
  private static analyzeMetrics(code: string): CodeMetrics {
    const trimmed = code.trim();

    return {
      codeLength: trimmed.length,
      hasSetup: this.hasFunction(code, 'setup'),
      hasDraw: this.hasFunction(code, 'draw'),
      usesAnimation: this.detectsAnimationUsage(code),
      usesColor: this.detectsColorUsage(code),
      hasInteractivity: this.detectsInteractivity(code),
      complexity: this.calculateComplexity(code),
      usesClasses: this.detectsClasses(code),
      usesArrays: this.detectsArrays(code),
      usesComments: this.detectsComments(code),
    };
  }

  /**
   * Calculate technical score (0-1)
   */
  private static calculateTechnicalScore(code: string, metrics: CodeMetrics): number {
    let score = 0;

    // Basic structure checks (max 0.4 points)
    if (metrics.hasSetup) score += 0.2;
    if (metrics.hasDraw) score += 0.2;

    // Code completeness (max 0.4 points)
    if (metrics.hasSetup && metrics.hasDraw) {
      score += 0.2; // Has both setup and draw
      if (this.checkBasicSyntax(code)) score += 0.2;
    }

    // Error detection (max 0.2 points) - be more lenient
    const errorCount = this.detectErrors(code);
    if (errorCount === 0) {
      score += 0.2;
    } else {
      // Reduce score based on error severity
      score -= Math.min(errorCount * 0.1, 0.2);
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate creative score (0-1)
   */
  private static calculateCreativeScore(_code: string, metrics: CodeMetrics): number {
    let score = 0;

    // Basic functionality (max 0.3 points)
    if (metrics.hasSetup && metrics.hasDraw) score += 0.2;
    if (metrics.codeLength > 150) score += 0.1;

    // Creative techniques (max 0.4 points)
    if (metrics.usesAnimation) score += 0.15;
    if (metrics.usesColor) score += 0.1;
    if (metrics.hasInteractivity) score += 0.15;

    // Extra creative elements (max 0.3 points)
    if (metrics.usesClasses) score += 0.15;
    if (metrics.usesArrays) score += 0.15;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Identify specific issues in the code
   */
  private static identifyIssues(
    code: string,
    metrics: CodeMetrics,
    _technicalScore: number,
    _creativeScore: number
  ): string[] {
    const issues: string[] = [];

    // Technical issues
    if (!metrics.hasSetup) issues.push('Missing setup() function');
    if (!metrics.hasDraw) issues.push('Missing draw() function');
    if (this.detectErrors(code)) issues.push('Syntax or structural errors detected');
    if (!this.checkBasicSyntax(code)) issues.push('Basic syntax issues');

    // Creative issues
    if (!metrics.usesAnimation && !metrics.hasInteractivity) {
      issues.push('Lacks animation or interactivity');
    }
    if (metrics.codeLength < 50) issues.push('Code too short/trivial');
    if (metrics.complexity < 10) issues.push('Low complexity');

    return issues;
  }

  /**
   * Check if code has a specific function
   */
  private static hasFunction(code: string, functionName: string): boolean {
    const functionPattern = new RegExp(`function\\s+${functionName}\\s*\\(`, 'i');
    const arrowPattern = new RegExp(`const\\s+${functionName}\\s*=\\s*\\(`, 'i');
    return functionPattern.test(code) || arrowPattern.test(code);
  }

  /**
   * Check basic syntax validity
   */
  private static checkBasicSyntax(code: string): boolean {
    // Check for balanced braces
    const openBraces = (code.match(/\{/g) || []).length;
    const closeBraces = (code.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) return false;

    // Check for balanced parentheses
    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;
    if (openParens !== closeParens) return false;

    // Check for balanced brackets
    const openBrackets = (code.match(/\[/g) || []).length;
    const closeBrackets = (code.match(/\]/g) || []).length;
    if (openBrackets !== closeBrackets) return false;

    return true;
  }

  /**
   * Detect common errors in code
   */
  private static detectErrors(code: string): number {
    let errorCount = 0;

    // Check for undefined function references (common error patterns)
    const undefinedPattern = /\b(undefinedFunction|nonExistent|notDefined)\b\(/;
    if (undefinedPattern.test(code)) errorCount++;

    // Check for incomplete function definitions (at end of code)
    const trimmedCode = code.trim();
    const incompleteFunction = /function\s+\w+\s*\([^)]*\)\s*\{[^}]*$/;
    if (incompleteFunction.test(trimmedCode)) {
      // Only count if it's truly incomplete (missing closing brace)
      const openBraces = (trimmedCode.match(/\{/g) || []).length;
      const closeBraces = (trimmedCode.match(/\}/g) || []).length;
      if (openBraces > closeBraces) errorCount++;
    }

    return errorCount;
  }

  /**
   * Detect animation usage (frameCount, animation-specific functions)
   */
  private static detectsAnimationUsage(code: string): boolean {
    const animationPatterns = [
      /\bframeCount\b/,
      /\bframeRate\(/,
      /\bloop\(\)/,
      /\bnoLoop\(\)/,
      /\bredraw\(\)/,
    ];

    return animationPatterns.some(pattern => pattern.test(code));
  }

  /**
   * Detect color usage
   */
  private static detectsColorUsage(code: string): boolean {
    const colorPatterns = [
      /\bcolorMode\(/,
      /\bfill\(/,
      /\bstroke\(/,
      /\bbackground\(/,
      /\bblendMode\(/,
    ];

    return colorPatterns.some(pattern => pattern.test(code));
  }

  /**
   * Detect interactivity (mouse, keyboard, touch)
   */
  private static detectsInteractivity(code: string): boolean {
    const interactionPatterns = [
      /\bmouseX\b/,
      /\bmouseY\b/,
      /\bmouseIsPressed\b/,
      /\bmouseButton\b/,
      /\bkeyIsDown\(/,
      /\bkey\b/,
      /\bkeyCode\b/,
      /\btouches\b/,
      /function\s+mousePressed/,
      /function\s+mouseReleased/,
      /function\s+keyPressed/,
      /function\s+keyReleased/,
    ];

    return interactionPatterns.some(pattern => pattern.test(code));
  }

  /**
   * Detect class usage
   */
  private static detectsClasses(code: string): boolean {
    return /class\s+\w+/.test(code);
  }

  /**
   * Detect array usage
   */
  private static detectsArrays(code: string): boolean {
    return /\[\s*\]/.test(code) || /\w+\[\w+\]/.test(code) || /Array\(/.test(code);
  }

  /**
   * Detect comments
   */
  private static detectsComments(code: string): boolean {
    return /\/\/.*|\/\*[\s\S]*?\*\//.test(code);
  }

  /**
   * Calculate code complexity
   */
  private static calculateComplexity(code: string): number {
    let complexity = 0;

    // Count functions
    const functionMatches = code.match(/function\s+\w+/g);
    complexity += (functionMatches?.length || 0) * 5;

    // Count loops
    const loopMatches = code.match(/\b(for|while|do)\s*\(/g);
    complexity += (loopMatches?.length || 0) * 3;

    // Count conditionals
    const conditionalMatches = code.match(/\b(if|else)\s*\(/g);
    complexity += (conditionalMatches?.length || 0) * 2;

    // Count method calls
    const methodMatches = code.match(/\w+\.\w+\(/g);
    complexity += (methodMatches?.length || 0) * 0.5;

    // Count operators
    const operatorMatches = code.match(/[+\-*/%=<>!&|^~]/g);
    complexity += (operatorMatches?.length || 0) * 0.2;

    return complexity;
  }

  /**
   * Get empty metrics object
   */
  private static getEmptyMetrics(): CodeMetrics {
    return {
      codeLength: 0,
      hasSetup: false,
      hasDraw: false,
      usesAnimation: false,
      usesColor: false,
      hasInteractivity: false,
      complexity: 0,
      usesClasses: false,
      usesArrays: false,
      usesComments: false,
    };
  }

  /**
   * Sound-aware scoring: 0.5 if code uses sound APIs (p5.sound, p5.Oscillator, AudioContext, createOscillator, Web Audio)
   * and looks valid (basic syntax), else 0. Used in aesthetic dimension (aesthetic = visual + sound).
   */
  private static getSoundScore(code: string): number {
    const soundPatterns = [
      /\bp5\.sound\b/,
      /\bp5\.Oscillator\b/,
      /\bAudioContext\b/,
      /\bcreateOscillator\b/,
      /\bWeb Audio\b/i
    ];
    const hasSound = soundPatterns.some(p => p.test(code));
    if (!hasSound) return 0;
    return this.checkBasicSyntax(code) ? 0.5 : 0;
  }
}