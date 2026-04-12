/**
 * CreativeEvaluator - Quality gates for creative coding output
 *
 * Evaluates creative output (p5.js sketches, generative art) on:
 * - Technical validity (syntax, structure, completeness)
 * - Creative quality (complexity, techniques, aesthetics)
 * - Aesthetic = visual (creative) + sound (when sound APIs present)
 * - Returns score 0-1, with minimum threshold of 0.7 to pass
 * 
 * Now with calibration support for improved correlation with human judgment.
 */

import { extractBehavior } from '../evolution/BehaviorVectors.js';
import type { NoveltyArchive } from '../evolution/NoveltyArchive.js';
import type { AestheticModel } from '../evolution/AestheticModel.js';
import { CreativeBoard } from '../collab/CreativeBoard.js';
import type { BoardDeliberation } from '../collab/CreativeBoard.js';
import type { CalibrationWeights, CalibrationResult } from '../calibration/CalibrationSuite.js';
import { CorrelationCalculator } from '../calibration/CorrelationCalculator.js';

export interface AssessOptions {
  /** When provided, overall score is the average of scores for these dimensions. Known dimensions: "technical", "aesthetic", "novelty", "emergence", "interestingness". Aesthetic combines visual (creative) and sound. */
  evaluationCriteria?: string[];
  /** Optional novelty archive for computing novelty scores */
  noveltyArchive?: NoveltyArchive;
  /** Optional aesthetic model for predicting aesthetic quality */
  aestheticModel?: AestheticModel;
  /** Behavior vector for novelty/aesthetic computation (auto-extracted if not provided) */
  behaviorVector?: number[];
  /** Domain hint for behavior extraction */
  domain?: string;
  /** Use calibrated weights if available */
  useCalibration?: boolean;
}

export interface AssessmentResult {
  passed: boolean;
  score: number;
  issues: string[];
  technicalScore: number;
  creativeScore: number;
  metrics: CodeMetrics;
  noveltyScore?: number;
  aestheticScore?: number;
  emergenceScore?: number;
  interestingnessScore?: number;
  /** Calibrated score if calibration is available */
  calibratedScore?: number;
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

// Default calibration weights
const DEFAULT_CALIBRATION_WEIGHTS: CalibrationWeights = {
  technicalWeight: 0.6,
  creativeWeight: 0.4,
  aestheticWeight: 0.5,
  noveltyWeight: 0.3,
  emergenceWeight: 0.2,
  interestingnessWeight: 0.25,
};

export class CreativeEvaluator {
  private static calibrationWeights: Map<string, CalibrationWeights> = new Map();

  /**
   * Get fitness score and issues for code (same as assess score/issues).
   * @deprecated Use assess() directly — this is an alias.
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
   * Set calibration weights for a domain
   */
  static setCalibrationWeights(domain: string, weights: Partial<CalibrationWeights>): void {
    const current = this.getCalibrationWeights(domain);
    this.calibrationWeights.set(domain, { ...current, ...weights });
  }

  /**
   * Get calibration weights for a domain
   */
  static getCalibrationWeights(domain: string): CalibrationWeights {
    return this.calibrationWeights.get(domain) ?? { ...DEFAULT_CALIBRATION_WEIGHTS };
  }

  /**
   * Check if a domain has been calibrated
   */
  static isCalibrated(domain: string): boolean {
    return this.calibrationWeights.has(domain);
  }

  /**
   * Clear calibration for a domain (or all domains if not specified)
   */
  static clearCalibration(domain?: string): void {
    if (domain) {
      this.calibrationWeights.delete(domain);
    } else {
      this.calibrationWeights.clear();
    }
  }

  /**
   * Calculate calibrated score using domain-specific weights
   */
  private static calculateCalibratedScore(
    technicalScore: number,
    creativeScore: number,
    domain: string,
    options?: AssessOptions,
  ): number {
    const weights = this.getCalibrationWeights(domain);

    if (options?.evaluationCriteria && options.evaluationCriteria.length > 0) {
      const dimensionScores: number[] = [];
      const weightValues: number[] = [];

      for (const criterion of options.evaluationCriteria) {
        if (criterion === 'technical') {
          dimensionScores.push(technicalScore);
          weightValues.push(weights.technicalWeight);
        } else if (criterion === 'aesthetic' || criterion === 'creative') {
          dimensionScores.push(creativeScore);
          weightValues.push(criterion === 'aesthetic' ? weights.aestheticWeight : weights.creativeWeight);
        }
      }

      if (dimensionScores.length > 0) {
        const totalWeight = weightValues.reduce((a: number, b: number) => a + b, 0);
        const weightedSum = dimensionScores.reduce((sum, score, i) => sum + score * weightValues[i], 0);
        return totalWeight > 0 ? weightedSum / totalWeight : technicalScore * 0.6 + creativeScore * 0.4;
      }
    }

    // Default weighted average using calibration weights
    const totalWeight = weights.technicalWeight + weights.creativeWeight;
    return (technicalScore * weights.technicalWeight + creativeScore * weights.creativeWeight) / totalWeight;
  }

  /**
   * Calibrate the evaluator based on human ratings
   */
  static calibrate(
    domain: string,
    samples: Array<{ 
      code: string; 
      humanRating: number; 
      technicalScore?: number; 
      creativeScore?: number;
    }>,
  ): CalibrationResult {
    if (samples.length < 5) {
      throw new Error('Need at least 5 samples with human ratings to calibrate');
    }

    // Use imported CorrelationCalculator

    // Calculate scores for samples that don't have them
    const evaluatedSamples = samples.map(sample => {
      if (sample.technicalScore === undefined || sample.creativeScore === undefined) {
        const result = this.assess(sample.code, { domain });
        return {
          systemScore: result.score,
          humanRating: sample.humanRating,
          technicalScore: result.technicalScore,
          creativeScore: result.creativeScore,
        };
      }
      return {
        systemScore: sample.technicalScore * 0.6 + sample.creativeScore * 0.4,
        humanRating: sample.humanRating,
        technicalScore: sample.technicalScore,
        creativeScore: sample.creativeScore,
      };
    });

    const systemScores = evaluatedSamples.map(s => s.systemScore);
    const humanRatings = evaluatedSamples.map(s => s.humanRating);

    // Calculate correlations
    const pearson = CorrelationCalculator.pearson(systemScores, humanRatings);
    const spearman = CorrelationCalculator.spearman(systemScores, humanRatings);

    // Perform regression
    const regression = CorrelationCalculator.linearRegression(systemScores, humanRatings);

    // Calculate MSE
    const mse = CorrelationCalculator.meanSquaredError(systemScores, humanRatings);

    // Find optimal weights
    const features = evaluatedSamples.map(s => [s.technicalScore, s.creativeScore]);
    const optimalRawWeights = CorrelationCalculator.findOptimalWeights(features, humanRatings);
    const totalWeight = optimalRawWeights.reduce((a: number, b: number) => a + b, 0);
    const normalizedWeights = optimalRawWeights.map((w: number) => w / totalWeight);

    const optimalWeights: CalibrationWeights = {
      technicalWeight: normalizedWeights[0] ?? DEFAULT_CALIBRATION_WEIGHTS.technicalWeight,
      creativeWeight: normalizedWeights[1] ?? DEFAULT_CALIBRATION_WEIGHTS.creativeWeight,
      aestheticWeight: DEFAULT_CALIBRATION_WEIGHTS.aestheticWeight,
      noveltyWeight: DEFAULT_CALIBRATION_WEIGHTS.noveltyWeight,
      emergenceWeight: DEFAULT_CALIBRATION_WEIGHTS.emergenceWeight,
      interestingnessWeight: DEFAULT_CALIBRATION_WEIGHTS.interestingnessWeight,
    };

    // Store the weights
    this.calibrationWeights.set(domain, optimalWeights);

    return {
      correlation: {
        pearson,
        spearman,
        sampleSize: samples.length,
      },
      regression,
      optimalWeights,
      mse,
      isCalibrated: Math.abs(pearson) > 0.7,
      sampleCount: samples.length,
      domain,
      timestamp: Date.now(),
    };
  }

  /**
   * Assess creative output quality.
   *
   * When `options.evaluationCriteria` is provided (e.g. ["aesthetic", "technical", "novelty", "emergence", "interestingness"]),
   * the overall score is the **average** of the present dimension scores:
   * - **technical**: structure, syntax, completeness (0–1).
   * - **aesthetic**: visual quality (creative score) + sound; aesthetic = (creativeScore + soundScore) / 2, with soundScore = 0.5 if code uses p5.sound / AudioContext / createOscillator / Web Audio and looks valid, else 0.
   * - **novelty**: proxied by creative score (complexity, techniques).
   * - **emergence**: simple rules producing complex behavior (particle systems, cellular automata, noise-based generation, feedback loops, flocking, reaction-diffusion).
   * - **interestingness**: variance, visual richness, dynamic rendering (noise/randomness usage, high complexity, conditional rendering, color variation).
   *
   * When `evaluationCriteria` is not provided, score = technicalScore * 0.6 + creativeScore * 0.4 (legacy behavior).
   *
   * @param output - The code to evaluate
   * @param options - Optional: evaluationCriteria array to compute score from selected dimensions
   * @returns Assessment result with score, issues, and metrics
   */
  static assess(output: string, options?: AssessOptions): AssessmentResult {
    // Validate input type
    if (typeof output !== 'string') {
      return {
        passed: false,
        score: 0,
        issues: ['Invalid output type'],
        technicalScore: 0,
        creativeScore: 0,
        metrics: this.getEmptyMetrics(),
        emergenceScore: 0,
        interestingnessScore: 0,
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
        emergenceScore: 0,
        interestingnessScore: 0,
      };
    }

    // Gate: detect non-code output early to prevent conversational text from
    // scoring 0.3-1.0 through the creative/technical heuristics.
    const codeIndicators = /(?:function\s|const\s|let\s|var\s|class\s|import\s|=>|setup\(|draw\(|createElement|\.push\(|\.map\(|\.log\(|console\.|return\s|if\s*\(|for\s*\(|void\s+main|uniform\s|varying\s|attribute\s|gl_Position|gl_FragColor|gl_FragCoord|precision\s|vec[234]\s|mat[234]\s|sampler2D|float\s|ivec[234]|uvec[234]|#define|#ifdef|#endif|#version|out\s+vec|in\s+vec|layout\s*\()/;
    const hasCodeStructure = codeIndicators.test(output);
    if (!hasCodeStructure && output.length < 500) {
      // Short non-code text — likely conversational response, not a creative artifact
      return {
        passed: false,
        score: 0.1,
        issues: ['No code detected in output'],
        technicalScore: 0,
        creativeScore: 0,
        metrics: this.getEmptyMetrics(),
        emergenceScore: 0,
        interestingnessScore: 0,
      };
    }

    // Shader-specific evaluation
    if (this.detectsShaderUsage(output)) {
      return this.assessShader(output, options);
    }

    // Three.js-specific evaluation
    if (this.detectsThreeUsage(output)) {
      return this.assessThree(output, options);
    }

    // Video component / scene evaluation (Revideo + legacy Remotion)
    if (this.detectsVideoComponentUsage(output)) {
      return this.assessVideoComponent(output, options);
    }

    // Hydra visual synth evaluation
    if (this.detectsHydraUsage(output)) {
      return this.assessHydra(output, options);
    }

    // Strudel music evaluation
    if (this.detectsStrudelUsage(output)) {
      return this.assessStrudel(output, options);
    }

    // HTML/CSS evaluation
    if (this.detectsHTMLUsage(output)) {
      return this.assessHTML(output);
    }

    // ASCII art evaluation
    if (this.detectsASCIIUsage(output)) {
      return this.assessASCII(output);
    }

    // Calculate metrics
    const metrics = this.analyzeMetrics(output);

    // Calculate scores
    const technicalScore = this.calculateTechnicalScore(output, metrics);
    const creativeScore = this.calculateCreativeScore(output, metrics);
    const soundScore = this.getSoundScore(output);

    // Novelty and aesthetic scoring (when archives/models provided)
    let noveltyScore: number | undefined;
    let aestheticScore: number | undefined;
    if (options?.noveltyArchive || options?.aestheticModel) {
      const behavior = options?.behaviorVector ?? extractBehavior(output, (options?.domain as 'p5' | 'glsl' | 'three' | 'music') || undefined);
      if (options?.noveltyArchive) {
        noveltyScore = options.noveltyArchive.noveltyScore(behavior);
      }
      if (options?.aestheticModel) {
        aestheticScore = options.aestheticModel.predict(behavior, { domain: options?.domain || 'p5' });
      }
    }

    // Calculate new dimensions
    const emergenceScore = this.calculateEmergenceScore(output, metrics);
    const interestingnessScore = this.calculateInterestingnessScore(output, metrics);

    // Calculate overall score (with calibration if requested and available)
    let overallScore: number;
    let calibratedScore: number | undefined;

    if (options?.useCalibration && options?.domain && this.isCalibrated(options.domain)) {
      overallScore = this.calculateCalibratedScore(technicalScore, creativeScore, options.domain, options);
      calibratedScore = overallScore;
    } else if (options?.evaluationCriteria && options.evaluationCriteria.length > 0) {
      const dimensionScores: number[] = [];
      for (const criterion of options.evaluationCriteria) {
        if (criterion === 'technical') dimensionScores.push(technicalScore);
        // Aesthetic = visual + sound for launch (creativeScore + getSoundScore).
        else if (criterion === 'aesthetic') dimensionScores.push(aestheticScore ?? (creativeScore + soundScore) / 2);
        else if (criterion === 'novelty') dimensionScores.push(noveltyScore ?? creativeScore);
        else if (criterion === 'emergence') dimensionScores.push(emergenceScore);
        else if (criterion === 'interestingness') dimensionScores.push(interestingnessScore);
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
      noveltyScore,
      aestheticScore,
      emergenceScore,
      interestingnessScore,
      calibratedScore,
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

    // Basic structure checks (max 0.3 points)
    if (metrics.hasSetup) score += 0.15;
    if (metrics.hasDraw) score += 0.15;

    // Code completeness (max 0.3 points)
    if (metrics.hasSetup && metrics.hasDraw) {
      if (this.checkBasicSyntax(code)) score += 0.2;
      // Bonus for non-trivial draw() body
      if (this.hasNonTrivialDrawBody(code)) score += 0.1;
    }

    // Error detection (max 0.2 points) - be more lenient
    const errorCount = this.detectErrors(code);
    if (errorCount === 0) {
      score += 0.2;
    } else {
      // Reduce score based on error severity
      score -= Math.min(errorCount * 0.1, 0.2);
    }

    // Code length bonus (max 0.2 points) - reward substantive code
    if (metrics.codeLength > 100) score += 0.1;
    if (metrics.codeLength > 300) score += 0.1;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Check if draw() function has non-trivial body (not just background + single shape)
   */
  private static hasNonTrivialDrawBody(code: string): boolean {
    // Extract draw function body
    const drawMatch = code.match(/function\s+draw\s*\([^)]*\)\s*\{/s);
    if (!drawMatch) return false;

    const startIdx = drawMatch.index! + drawMatch[0].length;
    let braceCount = 1;
    let endIdx = startIdx;
    for (let i = startIdx; i < code.length; i++) {
      if (code[i] === '{') braceCount++;
      else if (code[i] === '}') {
        braceCount--;
        if (braceCount === 0) { endIdx = i; break; }
      }
    }

    const drawBody = code.substring(startIdx, endIdx).trim();

    // Count distinct p5 API calls in draw body
    const apiCalls = drawBody.match(/\b(background|fill|stroke|noFill|noStroke|ellipse|rect|line|triangle|quad|arc|circle|square|point|beginShape|endShape|vertex|curveVertex|text|textSize|textAlign|image|push|pop|translate|rotate|scale|shearX|shearY|noise|random|map|constrain|lerp|dist|color|lerpColor|colorMode|blendMode|filter|tint|clear|cursor)\b/g);
    const distinctCalls = new Set(apiCalls || []);

    // Require at least 1 distinct API call or a loop/conditional
    const hasLoop = /\b(for|while)\b/.test(drawBody);
    const hasConditional = /\bif\s*\(/.test(drawBody);

    return distinctCalls.size >= 1 || hasLoop || hasConditional;
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
    // Strip strings and comments before counting brackets
    const stripped = code
      .replace(/\/\/.*$/gm, '')           // Remove single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, '')    // Remove multi-line comments
      .replace(/'(?:[^'\\]|\\.)*'/g, '""') // Replace single-quoted strings
      .replace(/"(?:[^"\\]|\\.)*"/g, '""') // Replace double-quoted strings
      .replace(/`(?:[^`\\]|\\.)*`/g, '""'); // Replace template literals

    // Check for balanced braces
    const openBraces = (stripped.match(/\{/g) || []).length;
    const closeBraces = (stripped.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) return false;

    // Check for balanced parentheses
    const openParens = (stripped.match(/\(/g) || []).length;
    const closeParens = (stripped.match(/\)/g) || []).length;
    if (openParens !== closeParens) return false;

    // Check for balanced brackets
    const openBrackets = (stripped.match(/\[/g) || []).length;
    const closeBrackets = (stripped.match(/\]/g) || []).length;
    if (openBrackets !== closeBrackets) return false;

    return true;
  }

  /**
   * Detect common errors in code
   */
  private static detectErrors(code: string): number {
    let errorCount = 0;

    // Check for incomplete function definitions (unclosed brace at end)
    const trimmedCode = code.trim();
    const openBraces = (trimmedCode.match(/\{/g) || []).length;
    const closeBraces = (trimmedCode.match(/\}/g) || []).length;
    if (openBraces > closeBraces) {
      const incompleteFunction = /function\s+\w+\s*\([^)]*\)\s*\{[^}]*$/;
      if (incompleteFunction.test(trimmedCode)) errorCount++;
    }

    // Check for common p5.js API misspellings
    const commonMisspellings = [
      /\bcreatCanvas\s*\(/,
      /\bbackgound\s*\(/,
      /\bfil\s*\(/,
      /\bstrok\s*\(/,
    ];
    for (const pattern of commonMisspellings) {
      if (pattern.test(code)) errorCount++;
    }

    // Check for obviously-named undefined function calls
    const undefinedCallPatterns = [
      /\bundefinedFunction\s*\(/,
      /\bnonExistent\s*\(/,
      /\bnotDefined\s*\(/,
    ];
    for (const pattern of undefinedCallPatterns) {
      if (pattern.test(code)) errorCount++;
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

  /**
   * Calculate emergence score (0-1).
   * Rewards systems where simple rules produce complex behavior:
   * - Particle systems
   * - Cellular automata
   * - Noise-based generation (Perlin, Simplex)
   * - Feedback loops
   * - Flocking / boid-like behavior
   * - Reaction-diffusion
   */
  private static calculateEmergenceScore(code: string, _metrics: CodeMetrics): number {
    let score = 0;

    // Particle systems
    if (/\bparticles?\b/i.test(code) && /\b(velocity|acceleration|force|vx|vy)\b/.test(code)) score += 0.2;

    // Many objects in arrays (particles, cells, agents)
    const arrayPushMatches = code.match(/\.(push|splice|pop)\(/g);
    if ((arrayPushMatches?.length ?? 0) >= 2) score += 0.15;

    // Noise-based generation
    if (/\bnoise\b/i.test(code) && (/\b(perlin|simplex|randomSeed|noiseSeed)\b/i.test(code) || /\bnoise2D|noise3D|noiseDetail\b/.test(code))) score += 0.2;
    else if (/\bnoise\b/i.test(code)) score += 0.1;

    // Cellular automata (grid-based with neighbor checking)
    if (/\bgrid\b/i.test(code) && /\bneighbors?\b/i.test(code)) score += 0.2;
    if (/\bcell|automaton|conway|game\s+of\s+life/i.test(code)) score += 0.15;

    // Feedback loops (using previous state to compute next)
    if (/\bprev|previous|last[A-Z]|prevState/.test(code) && /\b(frameCount|delta|time|t)\b/.test(code)) score += 0.15;

    // Flocking / boid-like behavior
    if (/\b(separate|cohesion|alignment|flock|boid|steer)\b/i.test(code)) score += 0.2;

    // Dynamic object creation/destruction (emergent lifecycle)
    if (/\bnew\s+\w+/.test(code) && /\b(splice|filter|length\s*[><])/.test(code)) score += 0.1;

    // Sin/cos oscillation (common in emergent visuals)
    if (/\b(sin|cos)\s*\(/.test(code) && /\bframeCount|time|t\b/.test(code)) score += 0.1;

    // Randomness with structure (emergence requires controlled randomness)
    if (/\brandom\s*\(/.test(code) && (/\bnoise\b/i.test(code) || /\bmap|constrain|lerp\b/.test(code))) score += 0.1;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate interestingness score (0-1).
   * Rewards variance, visual richness, and dynamic rendering:
   * - Variance in visual elements
   * - Noise/randomness usage
   * - High complexity
   * - Conditional/dynamic rendering
   * - Color variation
   */
  private static calculateInterestingnessScore(code: string, metrics: CodeMetrics): number {
    let score = 0;

    // Noise/randomness usage (unpredictable = interesting)
    if (/\bnoise\b/i.test(code)) score += 0.15;
    if (/\brandom\s*\(/.test(code)) score += 0.1;

    // High complexity (more going on = more interesting)
    if (metrics.complexity > 30) score += 0.15;
    else if (metrics.complexity > 15) score += 0.1;

    // Color variation (using colorMode, HSB, or multiple fill/stroke calls)
    const fillCount = (code.match(/\bfill\s*\(/g) || []).length;
    const strokeCount = (code.match(/\bstroke\s*\(/g) || []).length;
    if (fillCount + strokeCount >= 4) score += 0.15;
    if (/\bcolorMode\s*\(\s*HSB/i.test(code)) score += 0.1;

    // Conditional/dynamic rendering (output changes based on conditions)
    if (/\bif\s*\(.*frameCount/.test(code) || /\bif\s*\(.*time/.test(code) || /\bif\s*\(.*mouse/.test(code)) score += 0.15;
    if (/\bswitch\s*\(/.test(code) || /\bmap\s*\(/.test(code)) score += 0.1;

    // Visual variety (multiple shape types)
    const shapeTypes = new Set();
    if (/\bellipse\b/.test(code)) shapeTypes.add('ellipse');
    if (/\brect\b/.test(code)) shapeTypes.add('rect');
    if (/\btriangle\b/.test(code)) shapeTypes.add('triangle');
    if (/\bline\b/.test(code)) shapeTypes.add('line');
    if (/\b(beginShape|vertex|curveVertex)\b/.test(code)) shapeTypes.add('custom');
    if (/\btext\b/.test(code)) shapeTypes.add('text');
    if (/\bpoint\b/.test(code)) shapeTypes.add('point');
    if (shapeTypes.size >= 3) score += 0.15;
    else if (shapeTypes.size >= 2) score += 0.08;

    // Transform usage (rotation, translation create visual interest)
    if (/\b(translate|rotate|scale|shearX|shearY)\b/.test(code)) score += 0.1;

    // Iterative/generative patterns
    if (/\b(for|while)\s*\(/.test(code) && /\b(random|noise)\b/.test(code)) score += 0.1;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Detect GLSL shader code
   */
  static detectsShaderUsage(code: string): boolean {
    return /void\s+main\s*\(/.test(code) && /gl_FragColor|out\s+vec4/.test(code);
  }

  /**
   * Detect Three.js code
   */
  static detectsThreeUsage(code: string): boolean {
    return /import.*from\s+['"]three['"]/.test(code) || /\bTHREE\.(Scene|PerspectiveCamera|WebGLRenderer|Mesh|BoxGeometry|MeshStandardMaterial)\b/.test(code);
  }

  /**
   * Detect Revideo or legacy Remotion video-component code
   */
  static detectsVideoComponentUsage(code: string): boolean {
    return /@revideo\/(core|2d)|\bmakeScene2D?\b|\bcreateSignal\b|\byield\*/.test(code) ||
      /from\s+['"]remotion['"]|\buseCurrentFrame\b|\bAbsoluteFill\b|\bSequence\b|\bComposition\b/.test(code);
  }

  /**
   * Detect Hydra visual synth code
   */
  static detectsHydraUsage(code: string): boolean {
    return /\b(osc|src|shape|solid|gradient|noise|voronoi)\s*\([^)]*\)\s*\.\s*(out|modulate|rotate|scale|color|blend|mult|add|diff)\b/.test(code);
  }

  /**
   * Detect Strudel music code
   */
  static detectsStrudelUsage(code: string): boolean {
    return /\b(n|s|note|sound)\s*\(\s*["']/.test(code) && /\bstack|\$:|#|\.\s\(|\.n\(/.test(code);
  }

  /**
   * Detect HTML/CSS code (standalone HTML pages, not p5.js)
   */
  static detectsHTMLUsage(code: string): boolean {
    // Must have HTML structure but NOT be a p5.js wrapped sketch
    const hasHTML = /<!DOCTYPE\s+html/i.test(code) || /<html/i.test(code);
    const hasCSS = /<style/i.test(code) || /<link[^>]*stylesheet/i.test(code);
    const hasJS = /<script/i.test(code);
    const isP5Wrapped = /function\s+setup\s*\(\s*\)/.test(code) && /createCanvas/.test(code);
    
    // It's HTML if it has HTML structure and isn't just a p5.js sketch wrapper
    return hasHTML && (hasCSS || hasJS) && !isP5Wrapped;
  }

  /**
   * Detect ASCII art code
   */
  static detectsASCIIUsage(code: string): boolean {
    // ASCII art uses box-drawing characters or density characters
    const hasASCIIChars = /[\u2580-\u259F█▓▒░@#%*+=-]/.test(code);
    const isP5 = /function\s+setup\s*\(\s*\)/.test(code) && /createCanvas/.test(code);
    const isHTML = /<html/i.test(code) || /<!DOCTYPE/i.test(code);
    
    // It's ASCII if it uses ASCII art characters and isn't p5 or HTML
    return hasASCIIChars && !isP5 && !isHTML;
  }

  /**
   * Assess GLSL shader code quality
   */
  private static assessShader(output: string, options?: AssessOptions): AssessmentResult {
    const issues: string[] = [];
    let technicalScore = 0;
    let creativeScore = 0;

    // Technical checks
    if (/precision\s+highp\s+float/.test(output)) technicalScore += 0.15;
    if (/uniform\s+vec2\s+u_resolution/.test(output)) technicalScore += 0.1;
    if (/uniform\s+float\s+u_time/.test(output)) technicalScore += 0.1;
    if (/gl_FragColor|out\s+vec4/.test(output)) technicalScore += 0.15;
    if (this.checkBasicSyntax(output)) technicalScore += 0.2;
    if (output.length > 200) technicalScore += 0.1;
    if (output.length > 500) technicalScore += 0.1;

    // Creative checks — reward GLSL-specific visual techniques
    // Trig/math functions (animation, wave patterns, plasma effects)
    if (/sin|cos|atan/.test(output)) creativeScore += 0.12;
    // Procedural noise, randomness, pattern tiling
    if (/noise|random|fract/.test(output)) creativeScore += 0.1;
    // SDF / ray marching (advanced 3D techniques)
    if (/ray\s*march|sdf|sdSphere|sdBox|length\(/.test(output)) creativeScore += 0.12;
    // Color blending and smooth transitions
    if (/vec3.*col|mix|smoothstep/.test(output)) creativeScore += 0.1;
    // Iteration / loops (complex pattern generation)
    if (/for\s*\(/.test(output)) creativeScore += 0.1;
    // Time-based animation
    if (/u_time/.test(output)) creativeScore += 0.08;
    // UV/coordinate manipulation (normalized coords, aspect correction)
    if (/gl_FragCoord\.xy/.test(output)) creativeScore += 0.1;
    // Math functions (sqrt, pow, abs, mod, clamp, normalize, dot, reflect)
    if (/sqrt|pow\(|abs\(|mod\(|clamp|normalize|dot\(|reflect/.test(output)) creativeScore += 0.1;
    // Component-wise color construction (col.r, col.g, col.b — hand-crafted palettes)
    if (/col\.[rgb]|\.r\s*=|\.g\s*=|\.b\s*=/.test(output)) creativeScore += 0.08;
    // Multiple uniforms (indicates richer shader interface)
    const uniformCount = (output.match(/\buniform\s+/g) || []).length;
    if (uniformCount >= 3) creativeScore += 0.1;

    if (output.length < 100) issues.push('Shader code too short');
    if (!/uniform\s+float\s+u_time/.test(output)) issues.push('Missing u_time uniform');

    let overallScore = technicalScore * 0.5 + creativeScore * 0.5;
    let calibratedScore: number | undefined;

    // Apply calibration if requested
    if (options?.useCalibration && options?.domain && this.isCalibrated(options.domain)) {
      calibratedScore = this.calculateCalibratedScore(technicalScore, creativeScore, options.domain, options);
      overallScore = calibratedScore;
    }

    return {
      passed: overallScore >= MIN_QUALITY_THRESHOLD,
      score: Math.max(0, Math.min(1, overallScore)),
      issues,
      technicalScore: Math.max(0, Math.min(1, technicalScore)),
      creativeScore: Math.max(0, Math.min(1, creativeScore)),
      metrics: this.getEmptyMetrics(),
      emergenceScore: 0,
      interestingnessScore: 0,
      calibratedScore,
    };
  }

  /**
   * Assess Three.js code quality
   */
  private static assessThree(output: string, options?: AssessOptions): AssessmentResult {
    const issues: string[] = [];
    let technicalScore = 0;
    let creativeScore = 0;

    // Technical checks
    if (/Scene|scene/.test(output)) technicalScore += 0.15;
    if (/Camera|camera/.test(output)) technicalScore += 0.15;
    if (/WebGLRenderer|renderer/.test(output)) technicalScore += 0.15;
    if (/Mesh|mesh/.test(output)) technicalScore += 0.1;
    if (/Geometry|geometry|BufferGeometry/.test(output)) technicalScore += 0.1;
    if (/Material|material/.test(output)) technicalScore += 0.1;
    if (this.checkBasicSyntax(output)) technicalScore += 0.15;
    if (output.length > 500) technicalScore += 0.1;

    // Creative checks
    if (/Light|AmbientLight|DirectionalLight|PointLight/.test(output)) creativeScore += 0.15;
    if (/animate|requestAnimationFrame/.test(output)) creativeScore += 0.2;
    if (/Color|color\(/.test(output)) creativeScore += 0.15;
    if (/rotation|position\.|scale/.test(output)) creativeScore += 0.15;
    if (/for\s*\(/.test(output)) creativeScore += 0.15;
    if (/import/.test(output)) creativeScore += 0.1;

    if (output.length < 200) issues.push('Three.js code too short');

    let overallScore = technicalScore * 0.5 + creativeScore * 0.5;
    let calibratedScore: number | undefined;

    // Apply calibration if requested
    if (options?.useCalibration && options?.domain && this.isCalibrated(options.domain)) {
      calibratedScore = this.calculateCalibratedScore(technicalScore, creativeScore, options.domain, options);
      overallScore = calibratedScore;
    }

    return {
      passed: overallScore >= MIN_QUALITY_THRESHOLD,
      score: Math.max(0, Math.min(1, overallScore)),
      issues,
      technicalScore: Math.max(0, Math.min(1, technicalScore)),
      creativeScore: Math.max(0, Math.min(1, creativeScore)),
      metrics: this.getEmptyMetrics(),
      emergenceScore: 0,
      interestingnessScore: 0,
      calibratedScore,
    };
  }

  /**
   * Assess Revideo / Remotion video-component quality
   */
  private static assessVideoComponent(output: string, options?: AssessOptions): AssessmentResult {
    const issues: string[] = [];
    let technicalScore = 0;
    let creativeScore = 0;

    const codeOnly = output.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    const isRevideo = /@revideo\/(core|2d)|\bmakeScene2D?\b|\bcreateSignal\b|\byield\*/.test(codeOnly);
    const isRemotion = /from\s+['"]remotion['"]|\buseCurrentFrame\b|\bAbsoluteFill\b|\bSequence\b|\bComposition\b/.test(codeOnly);

    // Technical checks
    if (isRevideo || isRemotion) technicalScore += 0.15;
    if (this.checkBasicSyntax(codeOnly)) technicalScore += 0.15;
    if (isRevideo && /@revideo\/2d|Txt|Rect|Circle|Node/.test(codeOnly)) technicalScore += 0.15;
    if (isRevideo && /\bmakeScene2D?\b|\bview\.add\b/.test(codeOnly)) technicalScore += 0.1;
    if (isRemotion && /AbsoluteFill|Sequence|Composition/.test(codeOnly)) technicalScore += 0.15;
    if (/export\s+(default\s+)?(const|function|class)|React\.FC|=>\s*\{/.test(codeOnly)) technicalScore += 0.1;
    if (/useCurrentFrame|useVideoConfig|useTime|createSignal|interpolate|spring/.test(codeOnly)) technicalScore += 0.1;
    if (codeOnly.length > 200) technicalScore += 0.1;
    if (codeOnly.length > 500) technicalScore += 0.1;

    // Creative checks
    if (/interpolate|spring|ease|opacity|fade|scale|rotate|translate|position/.test(codeOnly)) creativeScore += 0.2;
    if (isRevideo && /\byield\*|\.\s*opacity\s*\(|\.\s*scale\s*\(|\.\s*position\s*\(/.test(codeOnly)) creativeScore += 0.15;
    if (/frame|fps|durationInFrames|useCurrentFrame|useTime/.test(codeOnly)) creativeScore += 0.15;
    if (/style=\{\{|background|gradient|color|fontSize|textShadow/.test(codeOnly)) creativeScore += 0.15;
    if (/Txt|Rect|Circle|AbsoluteFill|div|span|h1|h2/.test(codeOnly)) creativeScore += 0.1;
    if (/typing|cursor|subtitle|title|word|text/i.test(codeOnly)) creativeScore += 0.1;
    if (/createRef|createSignal|yield\*|map\(|for\s*\(/.test(codeOnly)) creativeScore += 0.1;
    if (codeOnly.split('\n').length > 10) creativeScore += 0.1;

    // Penalties for patterns that commonly indicate broken video output
    if (/frame\.value\b/.test(codeOnly)) technicalScore -= 0.15;
    if (/AbsoluteFill[^>]*duration=/.test(codeOnly)) technicalScore -= 0.1;
    if (/\b<Video\b/.test(codeOnly) && !/from\s+['"][^'"]*Video[^'"]*['"]/.test(codeOnly)) technicalScore -= 0.1;
    if (!isRevideo && !isRemotion) issues.push('Missing video-component imports or APIs');
    if (!/interpolate|spring|useCurrentFrame|useTime|yield\*/.test(codeOnly)) issues.push('Missing animation timing logic');
    if (codeOnly.length < 120) issues.push('Video component code too short');

    let overallScore = technicalScore * 0.5 + creativeScore * 0.5;
    let calibratedScore: number | undefined;

    if (options?.useCalibration && options?.domain && this.isCalibrated(options.domain)) {
      calibratedScore = this.calculateCalibratedScore(technicalScore, creativeScore, options.domain, options);
      overallScore = calibratedScore;
    }

    return {
      passed: overallScore >= MIN_QUALITY_THRESHOLD,
      score: Math.max(0, Math.min(1, overallScore)),
      issues,
      technicalScore: Math.max(0, Math.min(1, technicalScore)),
      creativeScore: Math.max(0, Math.min(1, creativeScore)),
      metrics: this.getEmptyMetrics(),
      emergenceScore: 0,
      interestingnessScore: 0,
      calibratedScore,
    };
  }

  /**
   * Assess Hydra visual synth code quality
   */
  private static assessHydra(output: string, options?: AssessOptions): AssessmentResult {
    const issues: string[] = [];
    let technicalScore = 0;
    let creativeScore = 0;

    // Remove <think> tags for evaluation
    const codeOnly = output.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    // Technical checks
    if (/\bosc\s*\(/.test(codeOnly)) technicalScore += 0.15;
    if (/\bsrc\s*\(/.test(codeOnly)) technicalScore += 0.15;
    if (/\bshape\s*\(/.test(codeOnly)) technicalScore += 0.15;
    if (/\.out\s*\(/.test(codeOnly)) technicalScore += 0.15;
    if (/\.modulate|\.blend|\.mult|\.add|\.diff/.test(codeOnly)) technicalScore += 0.1;
    if (/render\s*\(/.test(codeOnly)) technicalScore += 0.1;
    if (this.checkBasicSyntax(codeOnly)) technicalScore += 0.1;

    // Creative checks
    if (/\.modulate\s*\(/.test(codeOnly)) creativeScore += 0.2;
    if (/\.rotate\s*\(/.test(codeOnly)) creativeScore += 0.15;
    if (/\.scale\s*\(/.test(codeOnly)) creativeScore += 0.15;
    if (/\.color\s*\(/.test(codeOnly)) creativeScore += 0.15;
    if (/noise|voronoi/.test(codeOnly)) creativeScore += 0.2;
    if (/feedback|src\(o0\)/.test(codeOnly)) creativeScore += 0.15;

    if (codeOnly.length < 50) issues.push('Hydra code too short');
    if (!/\.out\s*\(/.test(codeOnly)) issues.push('Missing .out() call');

    let overallScore = technicalScore * 0.5 + creativeScore * 0.5;
    let calibratedScore: number | undefined;

    // Apply calibration if requested
    if (options?.useCalibration && options?.domain && this.isCalibrated(options.domain)) {
      calibratedScore = this.calculateCalibratedScore(technicalScore, creativeScore, options.domain, options);
      overallScore = calibratedScore;
    }

    return {
      passed: overallScore >= MIN_QUALITY_THRESHOLD,
      score: Math.max(0, Math.min(1, overallScore)),
      issues,
      technicalScore: Math.max(0, Math.min(1, technicalScore)),
      creativeScore: Math.max(0, Math.min(1, creativeScore)),
      metrics: this.getEmptyMetrics(),
      emergenceScore: 0,
      interestingnessScore: 0,
      calibratedScore,
    };
  }

  /**
   * Assess Strudel music code quality
   */
  private static assessStrudel(output: string, options?: AssessOptions): AssessmentResult {
    const issues: string[] = [];
    let technicalScore = 0;
    let creativeScore = 0;

    // Remove <think> tags for evaluation
    const codeOnly = output.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    // Technical checks
    if (/\bsetc\s*\(/.test(codeOnly) || /\bbpm\s*:/.test(codeOnly)) technicalScore += 0.15;
    if (/\bn\s*\(/.test(codeOnly)) technicalScore += 0.15;
    if (/\bs\s*\(/.test(codeOnly)) technicalScore += 0.15;
    if (/\bstack\s*\(/.test(codeOnly)) technicalScore += 0.15;
    if (/\.s\(|\.n\(|\.cut\(|\.resonance\(/.test(codeOnly)) technicalScore += 0.15;
    if (this.checkBasicSyntax(codeOnly)) technicalScore += 0.1;

    // Creative checks
    if (/["'][^"']+["'].*\.s\(/.test(codeOnly)) creativeScore += 0.2; // Pattern mini-notation
    if (/~|\*|\?|!|#/.test(codeOnly)) creativeScore += 0.2; // Rhythm modifiers
    if (/\.delay|\.room|\.distort|\.cutoff/.test(codeOnly)) creativeScore += 0.2;
    if (/\.add|\.sub|\.mul/.test(codeOnly)) creativeScore += 0.15;
    if (codeOnly.split('\n').length > 5) creativeScore += 0.15;
    if (/\$:/.test(codeOnly)) creativeScore += 0.1; // Pattern sequencing

    if (codeOnly.length < 50) issues.push('Strudel code too short');
    if (!/\bs\s*\(/.test(codeOnly) && !/\.s\(/.test(codeOnly)) issues.push('Missing sound() call');

    let overallScore = technicalScore * 0.5 + creativeScore * 0.5;
    let calibratedScore: number | undefined;

    // Apply calibration if requested
    if (options?.useCalibration && options?.domain && this.isCalibrated(options.domain)) {
      calibratedScore = this.calculateCalibratedScore(technicalScore, creativeScore, options.domain, options);
      overallScore = calibratedScore;
    }

    return {
      passed: overallScore >= MIN_QUALITY_THRESHOLD,
      score: Math.max(0, Math.min(1, overallScore)),
      issues,
      technicalScore: Math.max(0, Math.min(1, technicalScore)),
      creativeScore: Math.max(0, Math.min(1, creativeScore)),
      metrics: this.getEmptyMetrics(),
      emergenceScore: 0,
      interestingnessScore: 0,
      calibratedScore,
    };
  }

  /**
   * Assess HTML/CSS code quality
   */
  private static assessHTML(output: string): AssessmentResult {
    const issues: string[] = [];
    let technicalScore = 0;
    let creativeScore = 0;

    // Remove <think> tags for evaluation
    const codeOnly = output.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    // Technical checks for HTML structure
    if (/<!DOCTYPE\s+html/i.test(codeOnly)) technicalScore += 0.1;
    if (/<html[^>]*>/i.test(codeOnly)) technicalScore += 0.1;
    if (/<head[^>]*>/i.test(codeOnly) && /<\/head>/i.test(codeOnly)) technicalScore += 0.1;
    if (/<body[^>]*>/i.test(codeOnly) && /<\/body>/i.test(codeOnly)) technicalScore += 0.1;
    
    // CSS presence
    if (/<style[^>]*>/i.test(codeOnly)) technicalScore += 0.15;
    if (/<link[^>]*stylesheet/i.test(codeOnly)) technicalScore += 0.1;
    
    // JavaScript presence
    if (/<script[^>]*>/i.test(codeOnly)) technicalScore += 0.15;
    
    // Basic syntax check
    if (this.checkBasicSyntax(codeOnly)) technicalScore += 0.1;
    
    // Code length (substantial HTML pages)
    if (codeOnly.length > 500) technicalScore += 0.05;
    if (codeOnly.length > 1000) technicalScore += 0.05;

    // Creative checks
    // Animation via CSS
    if (/@keyframes|animation:|transition:/i.test(codeOnly)) creativeScore += 0.2;
    // Canvas usage
    if (/<canvas/i.test(codeOnly) || /getContext\s*\(\s*['"]2d['"]/i.test(codeOnly)) creativeScore += 0.2;
    // SVG usage
    if (/<svg/i.test(codeOnly)) creativeScore += 0.15;
    // WebGL/Three.js usage in HTML
    if (/getContext\s*\(\s*['"]webgl['"]/i.test(codeOnly) || /WebGL/i.test(codeOnly)) creativeScore += 0.2;
    // Rich CSS (gradients, transforms, filters)
    if (/gradient|transform|filter/i.test(codeOnly)) creativeScore += 0.15;
    // Interactivity
    if (/addEventListener|onclick|onmousemove/i.test(codeOnly)) creativeScore += 0.1;
    // Typography/Fonts
    if (/@font-face|font-family/i.test(codeOnly)) creativeScore += 0.1;

    // Issues
    if (!/<html/i.test(codeOnly)) issues.push('Missing <html> tag');
    if (!/<body/i.test(codeOnly)) issues.push('Missing <body> tag');
    if (codeOnly.length < 200) issues.push('HTML page too short');

    const overallScore = technicalScore * 0.5 + creativeScore * 0.5;
    return {
      passed: overallScore >= MIN_QUALITY_THRESHOLD,
      score: Math.max(0, Math.min(1, overallScore)),
      issues,
      technicalScore: Math.max(0, Math.min(1, technicalScore)),
      creativeScore: Math.max(0, Math.min(1, creativeScore)),
      metrics: this.getEmptyMetrics(),
      emergenceScore: 0,
      interestingnessScore: 0,
    };
  }

  /**
   * Assess ASCII art code quality
   */
  private static assessASCII(output: string): AssessmentResult {
    const issues: string[] = [];
    let technicalScore = 0;
    let creativeScore = 0;

    // Remove <think> tags for evaluation
    const codeOnly = output.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    // Technical checks
    // Has function structure
    if (/function\s+\w+\s*\(/.test(codeOnly)) technicalScore += 0.2;
    if (/console\.log|print|process\.stdout\.write/.test(codeOnly)) technicalScore += 0.15;
    
    // Has loops for generating patterns
    if (/\b(for|while)\s*\(/.test(codeOnly)) technicalScore += 0.15;
    
    // Has string/array manipulation
    if (/\.repeat\(|\.join\(|\.map\(/.test(codeOnly)) technicalScore += 0.15;
    
    // Basic syntax
    if (this.checkBasicSyntax(codeOnly)) technicalScore += 0.15;
    
    // Code length
    if (codeOnly.length > 100) technicalScore += 0.1;
    if (codeOnly.length > 300) technicalScore += 0.1;

    // Creative checks
    // Box-drawing characters
    if (/[\u2580-\u259F]/.test(codeOnly)) creativeScore += 0.2;
    // Density characters
    if (/[█▓▒░@#%*+=-]/.test(codeOnly)) creativeScore += 0.15;
    // Unicode blocks
    if (/[▀▄█]/.test(codeOnly)) creativeScore += 0.15;
    // Animation/frame logic
    if (/frame|animate|setInterval|setTimeout/.test(codeOnly)) creativeScore += 0.2;
    // Randomness/pattern variation
    if (/Math\.random|random|noise/.test(codeOnly)) creativeScore += 0.15;
    // Complex patterns (nested loops, recursion)
    if ((codeOnly.match(/\b(for|while)\s*\(/g) || []).length >= 2) creativeScore += 0.15;

    // Issues
    if (codeOnly.length < 50) issues.push('ASCII code too short');
    if (!/[\u2580-\u259F█▓▒░@#%*+=-]/.test(codeOnly)) issues.push('Missing ASCII art characters');

    const overallScore = technicalScore * 0.5 + creativeScore * 0.5;
    return {
      passed: overallScore >= MIN_QUALITY_THRESHOLD,
      score: Math.max(0, Math.min(1, overallScore)),
      issues,
      technicalScore: Math.max(0, Math.min(1, technicalScore)),
      creativeScore: Math.max(0, Math.min(1, creativeScore)),
      metrics: this.getEmptyMetrics(),
      emergenceScore: 0,
      interestingnessScore: 0,
    };
  }

  // -----------------------------------------------------------------------
  // LIR-aware assessment — overlays structured token metrics on regex baseline
  // -----------------------------------------------------------------------

  /**
   * Assess creative output using LIR tokens for more precise evaluation.
   *
   * Runs the existing regex-based `assess()` as baseline, then overlays
   * LIR-derived metrics when tokens are available:
   * - technicalScore: uses metrics.loc, cyclomaticComplexity, nestingDepth
   * - creativeScore: uses relationships.calls for distinct API usage
   * - emergenceScore: uses relationships.calls for pattern detection
   * - interestingnessScore: uses importCount + callCount as richness proxy
   */
  static assessWithLIR(
    output: string,
    lirTokens: import('../core/lir/types.js').LIRCodeToken[],
    options?: AssessOptions,
  ): AssessmentResult {
    // Start with the regex baseline
    const baseline = this.assess(output, options);

    // If no LIR tokens, return baseline unchanged
    if (!lirTokens || lirTokens.length === 0) {
      return baseline;
    }

    // Overlay LIR-derived metrics
    const totalLoc = lirTokens.reduce((s, t) => s + t.metrics.loc, 0);
    const maxComplexity = Math.max(...lirTokens.map(t => t.metrics.cyclomaticComplexity));
    const avgNesting = lirTokens.reduce((s, t) => s + t.metrics.nestingDepth, 0) / lirTokens.length;
    const allCalls = new Set(lirTokens.flatMap(t => t.relationships.calls));
    const totalImportCount = lirTokens.reduce((s, t) => s + t.metrics.importCount, 0);
    const totalCallCount = lirTokens.reduce((s, t) => s + t.metrics.callCount, 0);

    // Technical score boost from LIR: code with reasonable complexity is better
    let technicalScore = baseline.technicalScore;
    if (totalLoc >= 10 && totalLoc <= 500) technicalScore = Math.min(1, technicalScore + 0.05);
    if (maxComplexity <= 15) technicalScore = Math.min(1, technicalScore + 0.05);
    if (avgNesting <= 4) technicalScore = Math.min(1, technicalScore + 0.03);

    // Creative score boost: more distinct API calls = richer creative output
    let creativeScore = baseline.creativeScore;
    const apiRichness = Math.min(allCalls.size / 8, 1); // 8+ distinct calls = full score
    creativeScore = Math.min(1, creativeScore * 0.7 + apiRichness * 0.3);

    // Emergence score: detect emergent patterns by call names
    let emergenceScore = baseline.emergenceScore ?? 0;
    const emergentPatterns = ['particle', 'noise', 'flock', 'boid', 'cellular', 'automata', 'reaction', 'diffusion', 'feedback'];
    const hasEmergence = allCalls.size > 0 && [...allCalls].some(c =>
      emergentPatterns.some(p => c.toLowerCase().includes(p)),
    );
    if (hasEmergence) emergenceScore = Math.min(1, emergenceScore + 0.2);

    // Interestingness: richness from imports + calls
    let interestingnessScore = baseline.interestingnessScore ?? 0;
    const richness = Math.min((totalImportCount + totalCallCount) / 15, 1);
    interestingnessScore = Math.min(1, interestingnessScore * 0.6 + richness * 0.4);

    // Recalculate overall score with optional calibration
    let overallScore: number;
    let calibratedScore: number | undefined;

    if (options?.useCalibration && options?.domain && this.isCalibrated(options.domain)) {
      overallScore = this.calculateCalibratedScore(technicalScore, creativeScore, options.domain, options);
      calibratedScore = overallScore;
    } else if (options?.evaluationCriteria && options.evaluationCriteria.length > 0) {
      const dimensionScores: number[] = [];
      for (const criterion of options.evaluationCriteria) {
        if (criterion === 'technical') dimensionScores.push(technicalScore);
        else if (criterion === 'aesthetic') dimensionScores.push(baseline.aestheticScore ?? (creativeScore + 0.5) / 2);
        else if (criterion === 'novelty') dimensionScores.push(baseline.noveltyScore ?? creativeScore);
        else if (criterion === 'emergence') dimensionScores.push(emergenceScore);
        else if (criterion === 'interestingness') dimensionScores.push(interestingnessScore);
        else dimensionScores.push(creativeScore);
      }
      overallScore = dimensionScores.reduce((a, b) => a + b, 0) / dimensionScores.length;
    } else {
      overallScore = technicalScore * 0.6 + creativeScore * 0.4;
    }

    return {
      passed: overallScore >= MIN_QUALITY_THRESHOLD,
      score: Math.max(0, Math.min(1, overallScore)),
      issues: baseline.issues,
      technicalScore,
      creativeScore,
      metrics: baseline.metrics,
      noveltyScore: baseline.noveltyScore,
      aestheticScore: baseline.aestheticScore,
      emergenceScore,
      interestingnessScore,
      calibratedScore,
    };
  }

  /**
   * Evaluate creative output using the multi-agent CreativeBoard.
   *
   * The board runs 3 critics (Minimalist, Expressionist, Technician) in a
   * deliberation that produces stances, tensions, consensus, and a verdict.
   * The aggregate board score is blended with the baseline heuristic score.
   *
   * @param code - The creative code to evaluate
   * @param domain - Domain hint (e.g. 'p5', 'three', 'shader')
   * @param options - Standard assess options (criteria, novelty archive, etc.)
   * @returns Board deliberation result plus the baseline assessment
   */
  static assessWithBoard(
    code: string,
    domain: string,
    options?: AssessOptions,
  ): AssessmentResult & { boardDeliberation: BoardDeliberation } {
    const baseline = this.assess(code, options);
    const board = new CreativeBoard();
    const deliberation = board.deliberate(code, domain, {
      technical: baseline.technicalScore,
      creative: baseline.creativeScore,
    });

    // Blend: 60% baseline score, 40% board aggregate
    const blendedScore = baseline.score * 0.6 + deliberation.aggregateScore * 0.4;

    return {
      ...baseline,
      score: Math.max(0, Math.min(1, blendedScore)),
      passed: blendedScore >= MIN_QUALITY_THRESHOLD,
      boardDeliberation: deliberation,
    };
  }
}
