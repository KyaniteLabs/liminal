/**
 * AmbiguityDetector - Detects ambiguity in user prompts before creative generation
 *
 * Analyzes natural-language requests for vague terms, missing context,
 * contradictions, and multiple-approach signals. Returns structured issues
 * with severity ratings and suggested clarification questions.
 *
 * Ported from FlowCLI's ambiguity.py.
 */

/** Categories of ambiguity the detector can identify. */
export type AmbiguityType =
  | 'vague'
  | 'missing_context'
  | 'contradiction'
  | 'multiple_approaches';

/** How severely an ambiguity issue impacts generation quality. */
export type Severity = 'low' | 'medium' | 'high';

/** A single detected ambiguity issue with metadata. */
export interface AmbiguityIssue {
  /** The category of ambiguity detected. */
  type: AmbiguityType;
  /** Estimated impact on generation quality. */
  severity: Severity;
  /** Human-readable explanation of what is ambiguous. */
  description: string;
  /** A question the caller can present to the user for clarification. */
  suggestedQuestion: string;
}

/**
 * Detects ambiguity in user prompts before creative generation.
 *
 * Runs four independent detection strategies — vague terms, missing context,
 * contradictions, and multiple approaches — and aggregates their findings
 * into a single list of {@link AmbiguityIssue} objects.
 */
export class AmbiguityDetector {
  // ---------------------------------------------------------------------------
  // Vague-term detection
  // ---------------------------------------------------------------------------

  /** Words that signal a vague or underspecified request. */
  private static readonly VAGUE_TERMS: ReadonlyArray<{
    pattern: RegExp;
    label: string;
    suggestion: string;
  }> = [
    { pattern: /\bbetter\b/i, label: 'better', suggestion: 'Specify what "better" means — faster, more readable, more accessible?' },
    { pattern: /\bfaster\b/i, label: 'faster', suggestion: 'Specify the performance target — render time, build time, interaction response?' },
    { pattern: /\bfix it\b/i, label: 'fix it', suggestion: 'Describe what is broken and what the expected behavior should be.' },
    { pattern: /\bimprove\b/i, label: 'improve', suggestion: 'Identify the specific metric or quality attribute to improve.' },
    { pattern: /\bnicer\b/i, label: 'nicer', suggestion: 'Describe the visual or experiential quality you are aiming for.' },
    { pattern: /\bcooler\b/i, label: 'cooler', suggestion: 'Describe the specific aesthetic or interaction you find "cool".' },
    { pattern: /\bmore interesting\b/i, label: 'more interesting', suggestion: 'Explain what kind of engagement you want — narrative, visual, interactive?' },
    { pattern: /\bmake it pop\b/i, label: 'make it pop', suggestion: 'Specify color contrast, animation, typography weight, or layout emphasis.' },
    { pattern: /\bsomething\b/i, label: 'something', suggestion: 'Replace with a concrete noun or description of the desired element.' },
    { pattern: /\bstuff\b/i, label: 'stuff', suggestion: 'Replace with specific items or features you want included.' },
    { pattern: /\bthings\b/i, label: 'things', suggestion: 'Replace with the specific elements or components you are referring to.' },
  ];

  /**
   * Detect vague or imprecise terms in the request.
   *
   * @param request - The raw user prompt to analyze.
   * @returns Issues for each vague term found, all with type `vague`.
   */
  private detectVagueTerms(request: string): AmbiguityIssue[] {
    const issues: AmbiguityIssue[] = [];

    for (const { pattern, label, suggestion } of AmbiguityDetector.VAGUE_TERMS) {
      if (pattern.test(request)) {
        issues.push({
          type: 'vague',
          severity: 'medium',
          description: `Vague term "${label}" found — the intent is unclear.`,
          suggestedQuestion: suggestion,
        });
      }
    }

    return issues;
  }

  // ---------------------------------------------------------------------------
  // Missing-context detection
  // ---------------------------------------------------------------------------

  /**
   * Detect pronouns that lack a clear referent.
   *
   * If the request contains pronouns like "it", "this", "that", or "they"
   * without an obvious noun nearby, the context is likely missing.
   *
   * @param request - The raw user prompt to analyze.
   * @returns Issues for each unresolved pronoun, all with type `missing_context`.
   */
  private detectMissingContext(request: string): AmbiguityIssue[] {
    const issues: AmbiguityIssue[] = [];

    const pronouns: ReadonlyArray<{ pattern: RegExp; label: string }> = [
      { pattern: /\bit\b/i, label: 'it' },
      { pattern: /\bthis\b/i, label: 'this' },
      { pattern: /\bthat\b/i, label: 'that' },
      { pattern: /\bthey\b/i, label: 'they' },
    ];

    // Simple heuristic: if the request is short (< 20 words) and contains
    // a pronoun, it likely lacks sufficient context.
    const wordCount = request.split(/\s+/).filter(Boolean).length;
    const isShortRequest = wordCount < 20;

    for (const { pattern, label } of pronouns) {
      if (!pattern.test(request)) {
        continue;
      }

      // For short requests, always flag the pronoun.
      if (isShortRequest) {
        issues.push({
          type: 'missing_context',
          severity: 'high',
          description: `Pronoun "${label}" used without a clear referent in a short request.`,
          suggestedQuestion: `What does "${label}" refer to? Please name the specific element or component.`,
        });
        continue;
      }

      // For longer requests, check whether a noun precedes the pronoun
      // within a sliding window of 6 words.
      const tokens = request.split(/\s+/);
      let hasReferent = false;

      for (let i = 0; i < tokens.length; i++) {
        if (pattern.test(tokens[i])) {
          // Look at the preceding 6 tokens for a capitalized word or a
          // noun-like word (heuristic: longer than 3 chars, not a stop word).
          const start = Math.max(0, i - 6);
          const preceding = tokens.slice(start, i);
          const stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at',
            'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was',
            'were', 'be', 'been', 'being', 'have', 'has', 'had',
            'do', 'does', 'did', 'will', 'would', 'could', 'should',
            'may', 'might', 'can', 'shall', 'not', 'so', 'if',
          ]);

          for (const token of preceding) {
            const cleaned = token.replace(/[^a-zA-Z]/g, '').toLowerCase();
            if (cleaned.length > 3 && !stopWords.has(cleaned)) {
              hasReferent = true;
              break;
            }
          }

          if (!hasReferent) {
            issues.push({
              type: 'missing_context',
              severity: 'high',
              description: `Pronoun "${label}" appears without a clear referent nearby.`,
              suggestedQuestion: `What does "${label}" refer to? Please provide the specific element name.`,
            });
          }

          // Only report the first unresolved occurrence of each pronoun.
          break;
        }
      }
    }

    return issues;
  }

  // ---------------------------------------------------------------------------
  // Contradiction detection
  // ---------------------------------------------------------------------------

  /** Pairs of terms that indicate potentially contradictory goals. */
  private static readonly CONTRADICTION_PAIRS: ReadonlyArray<{
    left: RegExp;
    right: RegExp;
    labelLeft: string;
    labelRight: string;
  }> = [
    { left: /\bsimple\b/i, right: /\bcomplex\b/i, labelLeft: 'simple', labelRight: 'complex' },
    { left: /\bminimal\b/i, right: /\bdetailed\b/i, labelLeft: 'minimal', labelRight: 'detailed' },
    { left: /\bfast\b/i, right: /\bthorough\b/i, labelLeft: 'fast', labelRight: 'thorough' },
    { left: /\bbright\b/i, right: /\bdark\b/i, labelLeft: 'bright', labelRight: 'dark' },
    { left: /\bcalm\b/i, right: /\benergetic\b/i, labelLeft: 'calm', labelRight: 'energetic' },
  ];

  /**
   * Detect potentially contradictory goals in the request.
   *
   * Flags cases where opposing terms appear in the same prompt, indicating
   * the user may want conflicting outcomes.
   *
   * @param request - The raw user prompt to analyze.
   * @returns Issues for each contradictory pair found, all with type `contradiction`.
   */
  private detectContradictions(request: string): AmbiguityIssue[] {
    const issues: AmbiguityIssue[] = [];

    for (const { left, right, labelLeft, labelRight } of AmbiguityDetector.CONTRADICTION_PAIRS) {
      if (left.test(request) && right.test(request)) {
        issues.push({
          type: 'contradiction',
          severity: 'high',
          description: `Potentially contradictory goals: "${labelLeft}" and "${labelRight}" both appear.`,
          suggestedQuestion: `You mentioned both "${labelLeft}" and "${labelRight}" — which direction should take priority, or do you need a balance between them?`,
        });
      }
    }

    return issues;
  }

  // ---------------------------------------------------------------------------
  // Multiple-approaches detection
  // ---------------------------------------------------------------------------

  /** Term pairs that suggest divergent implementation approaches. */
  private static readonly APPROACH_PAIRS: ReadonlyArray<{
    left: RegExp;
    right: RegExp;
    labelLeft: string;
    labelRight: string;
    description: string;
  }> = [
    {
      left: /\bauth\b/i,
      right: /\blogin\b/i,
      labelLeft: 'auth',
      labelRight: 'login',
      description: 'Authentication approach',
    },
    {
      left: /\bdatabase\b/i,
      right: /\bstorage\b/i,
      labelLeft: 'database',
      labelRight: 'storage',
      description: 'Data persistence approach',
    },
    {
      left: /\banimation\b/i,
      right: /\binteractive\b/i,
      labelLeft: 'animation',
      labelRight: 'interactive',
      description: 'Interaction model',
    },
    {
      left: /\b2d\b/i,
      right: /\b3d\b/i,
      labelLeft: '2D',
      labelRight: '3D',
      description: 'Rendering dimension',
    },
    {
      left: /\bmusic\b/i,
      right: /\bvisual\b/i,
      labelLeft: 'music',
      labelRight: 'visual',
      description: 'Media focus',
    },
  ];

  /**
   * Detect requests that mention divergent implementation approaches.
   *
   * When a prompt references two approaches that would lead to very different
   * outputs, the detector flags it so the user can choose a direction.
   *
   * @param request - The raw user prompt to analyze.
   * @returns Issues for each divergent pair found, all with type `multiple_approaches`.
   */
  private detectMultipleApproaches(request: string): AmbiguityIssue[] {
    const issues: AmbiguityIssue[] = [];

    for (const { left, right, labelLeft, labelRight, description }
      of AmbiguityDetector.APPROACH_PAIRS) {
      if (left.test(request) && right.test(request)) {
        issues.push({
          type: 'multiple_approaches',
          severity: 'medium',
          description: `${description}: "${labelLeft}" and "${labelRight}" suggest different directions.`,
          suggestedQuestion: `You mentioned "${labelLeft}" and "${labelRight}" — which should be the primary focus?`,
        });
      }
    }

    return issues;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Run all four detection strategies against the given request.
   *
   * @param request - The raw user prompt to analyze.
   * @returns All detected ambiguity issues, in strategy order.
   */
  detect(request: string): AmbiguityIssue[] {
    return [
      ...this.detectVagueTerms(request),
      ...this.detectMissingContext(request),
      ...this.detectContradictions(request),
      ...this.detectMultipleApproaches(request),
    ];
  }

  /**
   * Quick check for whether the request contains any ambiguity.
   *
   * @param request - The raw user prompt to analyze.
   * @returns `true` if at least one ambiguity issue was detected.
   */
  isAmbiguous(request: string): boolean {
    return this.detect(request).length > 0;
  }

  /**
   * Return only the high-severity issues for the given request.
   *
   * Useful when the caller wants to gate generation on critical ambiguities
   * while allowing low-severity ones to pass through.
   *
   * @param request - The raw user prompt to analyze.
   * @returns High-severity issues only.
   */
  getHighPriorityIssues(request: string): AmbiguityIssue[] {
    return this.detect(request).filter((issue) => issue.severity === 'high');
  }
}
