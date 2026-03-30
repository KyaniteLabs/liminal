// ---------------------------------------------------------------------------
// CreativeBoard – Multi-agent deliberation panel for creative critique
//
// Inspired by CEO_Agents' orchestrator pattern. Each board agent represents
// a distinct creative philosophy and produces a heuristic stance on submitted
// code. The board deliberates synchronously (no LLM calls) and returns a
// structured verdict with tensions, consensus points, and recommendations.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

/**
 * A deliberating agent on the creative board.
 *
 * Each agent embodies a creative philosophy and analyses code through the
 * lens of that philosophy. The `systemPrompt` field is kept for future LLM
 * integration but is not used in the current heuristic path.
 */
export interface BoardAgent {
  /** Human-readable agent name, e.g. "The Minimalist" */
  name: string;
  /** Short role description, e.g. "Simplicity advocate" */
  role: string;
  /** Areas of expertise, e.g. ['clarity', 'negative-space'] */
  expertise: string[];
  /** System prompt for future LLM-based deliberation */
  systemPrompt: string;
  /** Sampling temperature this agent would use (0.0 – 1.0) */
  temperature: number;
}

/**
 * An individual agent's position on a piece of creative code.
 */
export interface BoardStance {
  /** Name of the agent that produced this stance */
  agentName: string;
  /** Overall position on the code */
  position: 'for' | 'against' | 'neutral';
  /** Confidence in the stance (0.0 – 1.0) */
  confidence: number;
  /** Free-text reasoning behind the stance */
  reasoning: string;
  /** Bullet-point arguments supporting the stance */
  keyPoints: string[];
}

/**
 * The full deliberation result produced by the board.
 */
export interface BoardDeliberation {
  /** Individual stances from each board agent */
  stances: BoardStance[];
  /** Areas where agents disagree */
  tensions: string[];
  /** Areas where agents agree */
  consensusPoints: string[];
  /** Identified risks in the code */
  risks: string[];
  /** Actionable recommendations */
  recommendedActions: string[];
  /** Overall board verdict */
  overallVerdict: 'approve' | 'revise' | 'reject';
  /** Weighted aggregate score (0.0 – 1.0) with consensus bonus */
  aggregateScore: number;
}

// ---------------------------------------------------------------------------
// CreativeBoard
// ---------------------------------------------------------------------------

/**
 * Multi-agent deliberation panel for creative critique.
 *
 * Three built-in agents — The Minimalist, The Expressionist, and The
 * Technician — analyse code through their respective creative philosophies.
 * The board operates entirely on heuristics (no LLM calls) so it can be
 * used synchronously in hot paths.
 */
export class CreativeBoard {
  /** Registered board agents */
  private agents: BoardAgent[];

  /**
   * Create a new CreativeBoard.
   *
   * @param agents - Optional custom agents. When omitted the board uses the
   *   three built-in default agents (Minimalist, Expressionist, Technician).
   */
  constructor(agents?: BoardAgent[]) {
    this.agents = agents ?? CreativeBoard.getDefaultAgents();
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Return the three built-in default board agents.
   *
   * @returns An array containing The Minimalist, The Expressionist, and
   *   The Technician.
   */
  static getDefaultAgents(): BoardAgent[] {
    return [
      {
        name: 'The Minimalist',
        role: 'Simplicity advocate',
        expertise: ['simplicity', 'clarity', 'negative-space', 'restraint'],
        systemPrompt:
          'You are The Minimalist. Judge creative code through the lens of simplicity and restraint. ' +
          'Reward clean structure, clear naming, and the disciplined use of negative space. ' +
          'Penalise unnecessary complexity, redundant logic, and visual clutter.',
        temperature: 0.3,
      },
      {
        name: 'The Expressionist',
        role: 'Emotional impact champion',
        expertise: ['emotional-impact', 'bold-choices', 'surprise', 'convention-breaking'],
        systemPrompt:
          'You are The Expressionist. Celebrate code that surprises, delights, and breaks conventions. ' +
          'Reward variety, emotional resonance, and bold creative choices. ' +
          'Penalise boring, formulaic, or overly safe patterns.',
        temperature: 0.8,
      },
      {
        name: 'The Technician',
        role: 'Technical correctness auditor',
        expertise: ['performance', 'code-quality', 'standards-compliance', 'correctness'],
        systemPrompt:
          'You are The Technician. Evaluate code for technical correctness, performance, and standards ' +
          'compliance. Reward proper lifecycle management, error handling, and idiomatic patterns. ' +
          'Penalise bugs, infinite loops, missing handlers, and fragile constructs.',
        temperature: 0.2,
      },
    ];
  }

  /**
   * Run a full board deliberation on a piece of creative code.
   *
   * Each agent produces a heuristic stance, then the board extracts tensions,
   * consensus points, risks, and recommended actions before computing a final
   * aggregate score and verdict.
   *
   * @param code - The creative code to evaluate.
   * @param domain - The creative domain (e.g. 'p5', 'glsl', 'three', 'code').
   * @param evaluationScores - Optional pre-computed evaluation scores that may
   *   influence individual agent stances.
   * @returns A complete {@link BoardDeliberation} result.
   */
  deliberate(
    code: string,
    domain: string,
    evaluationScores?: Record<string, number>,
  ): BoardDeliberation {
    // 1. Collect individual stances
    const stances = this.agents.map(agent =>
      this.analyzeCode(code, agent, domain, evaluationScores),
    );

    // 2. Extract tensions (where agents disagree)
    const tensions = this.extractTensions(stances);

    // 3. Find consensus points (where agents agree)
    const consensusPoints = this.extractConsensus(stances);

    // 4. Identify risks
    const risks = this.extractRisks(stances, code);

    // 5. Generate recommended actions
    const recommendedActions = this.generateRecommendations(stances, tensions, risks);

    // 6. Compute aggregate score with consensus bonus
    const aggregateScore = this.computeAggregateScore(stances, consensusPoints);

    // 7. Determine overall verdict
    const overallVerdict = this.determineVerdict(aggregateScore, stances);

    return {
      stances,
      tensions,
      consensusPoints,
      risks,
      recommendedActions,
      overallVerdict,
      aggregateScore,
    };
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Produce a heuristic {@link BoardStance} for a single agent.
   *
   * Each agent personality is encoded as a set of code-analysis heuristics.
   * No LLM call is made — analysis is purely pattern-based.
   *
   * @param code - The code under evaluation.
   * @param agent - The agent whose perspective to adopt.
   * @param domain - The creative domain identifier.
   * @param evaluationScores - Optional external scores to bias the stance.
   * @returns A stance reflecting the agent's creative philosophy.
   */
  private analyzeCode(
    code: string,
    agent: BoardAgent,
    domain: string,
    evaluationScores?: Record<string, number>,
  ): BoardStance {
    if (agent.name === 'The Minimalist') {
      return this.analyzeAsMinimalist(code, domain, evaluationScores);
    }
    if (agent.name === 'The Expressionist') {
      return this.analyzeAsExpressionist(code, domain, evaluationScores);
    }
    if (agent.name === 'The Technician') {
      return this.analyzeAsTechnician(code, domain, evaluationScores);
    }

    // Generic fallback for custom agents — neutral stance based on code length
    return this.analyzeAsGeneric(code, agent, evaluationScores);
  }

  /**
   * The Minimalist penalises complexity, rewards clean structure.
   */
  private analyzeAsMinimalist(
    code: string,
    domain: string,
    evaluationScores?: Record<string, number>,
  ): BoardStance {
    const lines = code.split('\n');
    const lineCount = lines.filter(l => l.trim().length > 0).length;
    const keyPoints: string[] = [];
    let confidence = 0.6;
    let scoreAdjustment = 0;

    // Penalise excessive line count (> 50 non-empty lines)
    if (lineCount > 50) {
      keyPoints.push(`Code is ${lineCount} non-empty lines — exceeds minimalism threshold of 50`);
      scoreAdjustment -= 0.2;
      confidence += 0.1;
    } else if (lineCount <= 20) {
      keyPoints.push('Concise codebase under 20 lines — good restraint');
      scoreAdjustment += 0.2;
      confidence += 0.05;
    } else {
      keyPoints.push(`Reasonable length at ${lineCount} non-empty lines`);
      scoreAdjustment += 0.05;
    }

    // Reward clean structure — consistent indentation
    const indentLevels = new Set(
      lines.filter(l => l.trim().length > 0).map(l => l.match(/^(\s*)/)?.[1]?.length ?? 0),
    );
    if (indentLevels.size <= 4) {
      keyPoints.push('Consistent indentation — clean visual structure');
      scoreAdjustment += 0.15;
    } else {
      keyPoints.push(`${indentLevels.size} distinct indentation levels — visual clutter`);
      scoreAdjustment -= 0.1;
    }

    // Reward short function-like blocks
    const functionCount = (code.match(/function\s|=>\s|def\s/g) || []).length;
    if (functionCount > 0 && lineCount / functionCount < 15) {
      keyPoints.push('Functions are short and focused');
      scoreAdjustment += 0.1;
    }

    // Penalise deeply nested blocks (4+ levels)
    const maxNesting = this.maxNestingDepth(code);
    if (maxNesting > 4) {
      keyPoints.push(`Maximum nesting depth of ${maxNesting} — consider flattening`);
      scoreAdjustment -= 0.15;
    }

    // External score bias
    if (evaluationScores?.clarity != null) {
      scoreAdjustment += (evaluationScores.clarity - 0.5) * 0.2;
    }

    const finalScore = Math.max(0, Math.min(1, 0.5 + scoreAdjustment));
    const position = this.scoreToPosition(finalScore);

    return {
      agentName: 'The Minimalist',
      position,
      confidence: Math.max(0, Math.min(1, confidence)),
      reasoning: this.buildMinimalistReasoning(finalScore, keyPoints, domain),
      keyPoints,
    };
  }

  /**
   * The Expressionist rewards variety and bold choices, penalises boring code.
   */
  private analyzeAsExpressionist(
    code: string,
    domain: string,
    evaluationScores?: Record<string, number>,
  ): BoardStance {
    const keyPoints: string[] = [];
    let confidence = 0.55;
    let scoreAdjustment = 0;

    // Count distinct API calls / identifiers
    const identifierPattern = /\b([a-zA-Z_]\w*)\s*\(/g;
    const identifiers = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = identifierPattern.exec(code)) !== null) {
      identifiers.add(match[1]);
    }

    // Reward variety of API usage
    if (identifiers.size >= 8) {
      keyPoints.push(`Rich API surface with ${identifiers.size} distinct calls — creative variety`);
      scoreAdjustment += 0.25;
    } else if (identifiers.size >= 4) {
      keyPoints.push(`Moderate variety with ${identifiers.size} distinct calls`);
      scoreAdjustment += 0.1;
    } else {
      keyPoints.push(`Only ${identifiers.size} distinct calls — conservative palette`);
      scoreAdjustment -= 0.15;
    }

    // Penalise boring / boilerplate patterns
    const boringPatterns = [
      /console\.log\s*\(/g,
      /Math\.random\s*\(\)/g,
      /Math\.floor\s*\(/g,
    ];
    const boringCount = boringPatterns.reduce(
      (sum, pat) => sum + (code.match(pat) || []).length,
      0,
    );
    if (boringCount > 5) {
      keyPoints.push(`${boringCount} boilerplate calls — lacks creative ambition`);
      scoreAdjustment -= 0.2;
    }

    // Reward creative domain-specific APIs
    const creativeAPIs = [
      'fill', 'stroke', 'ellipse', 'rect', 'line', 'arc', 'curve',
      'bezier', 'vertex', 'beginShape', 'endShape', 'push', 'pop',
      'rotate', 'translate', 'scale', 'noise', 'sin', 'cos', 'map',
      'lerp', 'createShader', 'uniform', 'fragment', 'color', 'background',
      'frameCount', 'mouseX', 'mouseY', 'smoothstep', 'mix', 'clamp',
    ];
    const creativeHits = creativeAPIs.filter(api => code.includes(api));
    if (creativeHits.length >= 5) {
      keyPoints.push(`Uses ${creativeHits.length} creative APIs — expressive palette`);
      scoreAdjustment += 0.2;
    } else if (creativeHits.length === 0) {
      keyPoints.push('No creative/visual APIs detected — may lack expressiveness');
      scoreAdjustment -= 0.1;
    }

    // Reward surprise: unusual patterns (bitwise ops, ternary chains, etc.)
    const surprisePatterns = [
      /&/, /\|/, /\^/, /\?\.|!\?|\?\?/, /\.\.\./, /[{}]\s*[{}]/,
    ];
    const surpriseHits = surprisePatterns.filter(p => p.test(code)).length;
    if (surpriseHits >= 3) {
      keyPoints.push('Contains unconventional patterns — surprise factor');
      scoreAdjustment += 0.1;
    }

    // External score bias
    if (evaluationScores?.originality != null) {
      scoreAdjustment += (evaluationScores.originality - 0.5) * 0.2;
    }

    const finalScore = Math.max(0, Math.min(1, 0.5 + scoreAdjustment));
    const position = this.scoreToPosition(finalScore);

    return {
      agentName: 'The Expressionist',
      position,
      confidence: Math.max(0, Math.min(1, confidence)),
      reasoning: this.buildExpressionistReasoning(finalScore, keyPoints, domain),
      keyPoints,
    };
  }

  /**
   * The Technician checks for correctness, performance, and standards.
   */
  private analyzeAsTechnician(
    code: string,
    domain: string,
    evaluationScores?: Record<string, number>,
  ): BoardStance {
    const keyPoints: string[] = [];
    let confidence = 0.65;
    let scoreAdjustment = 0;

    // Check for proper setup/draw lifecycle (p5-like domains)
    const isCreativeDomain = ['p5', 'three', 'glsl', 'remotion'].includes(domain);
    if (isCreativeDomain) {
      const hasSetup = /\bsetup\s*\(|function\s+setup\b/.test(code);
      const hasDraw = /\bdraw\s*\(|function\s+draw\b/.test(code);
      if (hasSetup) {
        keyPoints.push('Setup function present — correct lifecycle');
        scoreAdjustment += 0.1;
      } else {
        keyPoints.push('Missing setup function — incomplete lifecycle');
        scoreAdjustment -= 0.15;
      }
      if (hasDraw) {
        keyPoints.push('Draw loop present — correct lifecycle');
        scoreAdjustment += 0.1;
      }
    }

    // Check for resize handler (visual domains)
    if (['p5', 'three'].includes(domain)) {
      const hasResize = /windowResized|resize|onResize/i.test(code);
      if (hasResize) {
        keyPoints.push('Resize handler present — responsive');
        scoreAdjustment += 0.1;
      } else {
        keyPoints.push('No resize handler — may not adapt to viewport changes');
        scoreAdjustment -= 0.05;
      }
    }

    // Infinite loop detection — while(true) or for(;;) without break
    const infiniteLoopPatterns = [
      /while\s*\(\s*true\s*\)/,
      /for\s*\(\s*;\s*;\s*\)/,
      /while\s*\(\s*1\s*\)/,
    ];
    const hasInfiniteLoop = infiniteLoopPatterns.some(p => p.test(code));
    if (hasInfiniteLoop) {
      const hasBreak = /\bbreak\s*;/.test(code);
      if (!hasBreak) {
        keyPoints.push('Potential infinite loop without break — critical risk');
        scoreAdjustment -= 0.3;
        confidence += 0.15;
      } else {
        keyPoints.push('Loop with break — acceptable pattern');
        scoreAdjustment += 0.05;
      }
    }

    // Check for error-prone patterns
    const riskyPatterns = [
      { pattern: /eval\s*\(/, label: 'eval() usage — security risk' },
      { pattern: /document\.write\s*\(/, label: 'document.write() — fragile pattern' },
      { pattern: /innerHTML\s*=/, label: 'innerHTML assignment — XSS risk' },
    ];
    for (const { pattern, label } of riskyPatterns) {
      if (pattern.test(code)) {
        keyPoints.push(label);
        scoreAdjustment -= 0.2;
      }
    }

    // Reward error handling
    if (/try\s*\{|catch\s*\(|\.catch\s*\(|finally\s*\{/.test(code)) {
      keyPoints.push('Error handling present — robust');
      scoreAdjustment += 0.1;
    }

    // Reward type safety signals (TS patterns)
    if (/:\s*(number|string|boolean|void)\b/.test(code)) {
      keyPoints.push('Type annotations present — type-safe');
      scoreAdjustment += 0.05;
    }

    // External score bias
    if (evaluationScores?.correctness != null) {
      scoreAdjustment += (evaluationScores.correctness - 0.5) * 0.25;
    }

    const finalScore = Math.max(0, Math.min(1, 0.5 + scoreAdjustment));
    const position = this.scoreToPosition(finalScore);

    return {
      agentName: 'The Technician',
      position,
      confidence: Math.max(0, Math.min(1, confidence)),
      reasoning: this.buildTechnicianReasoning(finalScore, keyPoints, domain),
      keyPoints,
    };
  }

  /**
   * Generic fallback for custom agents not matching built-in names.
   */
  private analyzeAsGeneric(
    code: string,
    agent: BoardAgent,
    evaluationScores?: Record<string, number>,
  ): BoardStance {
    const lines = code.split('\n').filter(l => l.trim().length > 0).length;
    const keyPoints: string[] = [
      `Evaluated ${lines} non-empty lines in domain context`,
      `Applied ${agent.expertise.length} expertise areas: ${agent.expertise.slice(0, 3).join(', ')}`,
    ];

    let score = 0.5;
    if (lines >= 10 && lines <= 100) score += 0.1;
    if (evaluationScores) {
      const vals = Object.values(evaluationScores);
      if (vals.length > 0) {
        score += (vals.reduce((a, b) => a + b, 0) / vals.length - 0.5) * 0.2;
      }
    }

    const finalScore = Math.max(0, Math.min(1, score));

    return {
      agentName: agent.name,
      position: this.scoreToPosition(finalScore),
      confidence: 0.5,
      reasoning: `${agent.name} evaluated the code as ${this.scoreToPosition(finalScore)} based on general heuristics.`,
      keyPoints,
    };
  }

  // -----------------------------------------------------------------------
  // Deliberation synthesis
  // -----------------------------------------------------------------------

  /**
   * Extract tensions — areas where agents disagree on position.
   *
   * @param stances - All agent stances.
   * @returns Array of tension descriptions.
   */
  private extractTensions(stances: BoardStance[]): string[] {
    const tensions: string[] = [];
    const positions = stances.map(s => s.position);

    // Any mix of 'for' and 'against' creates tension
    const hasFor = positions.includes('for');
    const hasAgainst = positions.includes('against');

    if (hasFor && hasAgainst) {
      const forAgents = stances.filter(s => s.position === 'for').map(s => s.agentName);
      const againstAgents = stances.filter(s => s.position === 'against').map(s => s.agentName);
      tensions.push(
        `Strong disagreement: ${forAgents.join(', ')} approve while ${againstAgents.join(', ')} reject`,
      );
    }

    // Find opposing key points between specific agents
    const minimalist = stances.find(s => s.agentName === 'The Minimalist');
    const expressionist = stances.find(s => s.agentName === 'The Expressionist');

    if (minimalist && expressionist) {
      if (
        minimalist.position !== expressionist.position &&
        minimalist.position !== 'neutral' &&
        expressionist.position !== 'neutral'
      ) {
        tensions.push(
          'Classic simplicity vs. expressiveness trade-off: Minimalist and Expressionist disagree',
        );
      }
    }

    // High confidence disagreement is especially notable
    const highConfStances = stances.filter(s => s.confidence >= 0.7);
    if (highConfStances.length >= 2) {
      const uniquePositions = new Set(highConfStances.map(s => s.position));
      if (uniquePositions.size >= 2) {
        tensions.push(
          'High-confidence disagreement among agents — core philosophical tension',
        );
      }
    }

    return tensions;
  }

  /**
   * Extract consensus points — areas where agents agree.
   *
   * @param stances - All agent stances.
   * @returns Array of consensus descriptions.
   */
  private extractConsensus(stances: BoardStance[]): string[] {
    const consensus: string[] = [];
    const positions = stances.map(s => s.position);

    // All same position is strong consensus
    const uniquePositions = new Set(positions);
    if (uniquePositions.size === 1) {
      consensus.push(`Unanimous ${positions[0]} — all agents agree on the verdict`);
      return consensus;
    }

    // Majority consensus
    const positionCounts = new Map<string, number>();
    for (const p of positions) {
      positionCounts.set(p, (positionCounts.get(p) ?? 0) + 1);
    }
    const majority = [...positionCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (majority && majority[1] >= Math.ceil(stances.length / 2)) {
      consensus.push(
        `Majority consensus: ${majority[1]}/${stances.length} agents are ${majority[0]}`,
      );
    }

    // Shared key-point themes
    const allPoints = stances.flatMap(s => s.keyPoints);
    const themes = [
      { keywords: ['short', 'concise', 'length', 'lines'], label: 'Code length is appropriate' },
      { keywords: ['variety', 'API', 'creative', 'palette'], label: 'Good use of creative APIs' },
      { keywords: ['clean', 'structure', 'indentation'], label: 'Clean code structure' },
      { keywords: ['error', 'handling', 'robust', 'correct'], label: 'Proper error handling' },
    ];
    for (const theme of themes) {
      const matching = allPoints.filter(p =>
        theme.keywords.some(kw => p.toLowerCase().includes(kw.toLowerCase())),
      );
      if (matching.length >= 2) {
        consensus.push(theme.label);
      }
    }

    return consensus;
  }

  /**
   * Extract risk descriptions from agent stances and code analysis.
   *
   * @param stances - All agent stances.
   * @param code - The original code.
   * @returns Array of risk descriptions.
   */
  private extractRisks(stances: BoardStance[], code: string): string[] {
    const risks: string[] = [];

    // Pull risks from agent key points
    const riskKeywords = ['risk', 'missing', 'infinite', 'fragile', 'security', 'critical', 'lack'];
    for (const stance of stances) {
      for (const point of stance.keyPoints) {
        if (riskKeywords.some(kw => point.toLowerCase().includes(kw))) {
          risks.push(`[${stance.agentName}] ${point}`);
        }
      }
    }

    // Global code-level risks
    if (code.length > 5000) {
      risks.push('Code exceeds 5000 characters — maintenance and readability risk');
    }

    const commentRatio = (code.match(/\/\*[\s\S]*?\*\/|\/\/.*/g) || []).length
      / Math.max(code.split('\n').length, 1);
    if (commentRatio < 0.05 && code.split('\n').length > 30) {
      risks.push('Very low comment ratio — intent may be hard to communicate');
    }

    return [...new Set(risks)];
  }

  /**
   * Generate recommended actions from stances, tensions, and risks.
   *
   * @param stances - Agent stances.
   * @param tensions - Identified tensions.
   * @param risks - Identified risks.
   * @returns Array of actionable recommendations.
   */
  private generateRecommendations(
    stances: BoardStance[],
    tensions: string[],
    risks: string[],
  ): string[] {
    const actions: string[] = [];

    // Based on majority position
    const forCount = stances.filter(s => s.position === 'for').length;
    const againstCount = stances.filter(s => s.position === 'against').length;

    if (forCount > againstCount) {
      actions.push('Proceed with code — majority approval from the board');
    } else if (againstCount > forCount) {
      actions.push('Revise before proceeding — majority concerns raised');
    } else {
      actions.push('Further evaluation recommended — board is split');
    }

    // Tension-driven recommendations
    if (tensions.some(t => t.includes('simplicity vs. expressiveness'))) {
      actions.push('Resolve simplicity/expressiveness trade-off by clarifying creative intent');
    }
    if (tensions.some(t => t.includes('High-confidence'))) {
      actions.push('Seek external review to break high-confidence disagreement');
    }

    // Risk-driven recommendations
    if (risks.some(r => r.includes('infinite loop'))) {
      actions.push('Add explicit loop termination guards');
    }
    if (risks.some(r => r.includes('security'))) {
      actions.push('Remove or sandbox security-risk patterns before production use');
    }
    if (risks.some(r => r.includes('missing'))) {
      actions.push('Complete missing lifecycle handlers identified by the Technician');
    }

    return actions;
  }

  /**
   * Compute a weighted aggregate score across all agents.
   *
   * The base score is a confidence-weighted average of individual stance
   * scores. A consensus bonus is applied when agents agree, increasing the
   * final score by up to 0.1.
   *
   * @param stances - Agent stances.
   * @param consensusPoints - Extracted consensus points.
   * @returns Aggregate score between 0.0 and 1.0.
   */
  private computeAggregateScore(
    stances: BoardStance[],
    consensusPoints: string[],
  ): number {
    if (stances.length === 0) return 0.5;

    // Convert positions to numeric scores
    const positionScores: Record<string, number> = {
      for: 1.0,
      neutral: 0.5,
      against: 0.0,
    };

    // Weighted average: confidence * position score
    let totalWeight = 0;
    let weightedSum = 0;
    for (const stance of stances) {
      const weight = stance.confidence;
      weightedSum += weight * positionScores[stance.position];
      totalWeight += weight;
    }

    const baseScore = totalWeight > 0 ? weightedSum / totalWeight : 0.5;

    // Consensus bonus: up to 0.1 for strong agreement
    const consensusBonus = Math.min(consensusPoints.length * 0.03, 0.1);

    return Math.round(Math.max(0, Math.min(1, baseScore + consensusBonus)) * 100) / 100;
  }

  /**
   * Determine the overall verdict from the aggregate score and stances.
   *
   * @param aggregateScore - The computed aggregate score.
   * @param stances - Agent stances (used for veto check).
   * @returns One of 'approve', 'revise', or 'reject'.
   */
  private determineVerdict(
    aggregateScore: number,
    stances: BoardStance[],
  ): 'approve' | 'revise' | 'reject' {
    // Unanimous against = hard reject regardless of score
    if (stances.every(s => s.position === 'against')) {
      return 'reject';
    }

    if (aggregateScore >= 0.65) return 'approve';
    if (aggregateScore >= 0.35) return 'revise';
    return 'reject';
  }

  // -----------------------------------------------------------------------
  // Utility helpers
  // -----------------------------------------------------------------------

  /**
   * Convert a 0-1 score to a for/neutral/against position.
   */
  private scoreToPosition(score: number): 'for' | 'against' | 'neutral' {
    if (score >= 0.6) return 'for';
    if (score <= 0.4) return 'against';
    return 'neutral';
  }

  /**
   * Estimate maximum nesting depth via brace counting.
   */
  private maxNestingDepth(code: string): number {
    let depth = 0;
    let maxDepth = 0;
    let inString = false;
    let escape = false;

    for (const ch of code) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        inString = !inString;
        continue;
      }
      if (inString) continue;

      if (ch === '{') {
        depth++;
        if (depth > maxDepth) maxDepth = depth;
      } else if (ch === '}') {
        depth = Math.max(0, depth - 1);
      }
    }

    return maxDepth;
  }

  /**
   * Build a human-readable reasoning string for The Minimalist.
   */
  private buildMinimalistReasoning(
    score: number,
    keyPoints: string[],
    domain: string,
  ): string {
    const verdict = this.scoreToPosition(score);
    const summary = verdict === 'for'
      ? 'The code demonstrates admirable restraint.'
      : verdict === 'against'
        ? 'The code is unnecessarily complex.'
        : 'The code is acceptable but could be simpler.';
    return `${summary} In the ${domain} domain, ${keyPoints.length} factors were weighed. ${keyPoints[0] ?? 'No specific factors identified.'}`;
  }

  /**
   * Build a human-readable reasoning string for The Expressionist.
   */
  private buildExpressionistReasoning(
    score: number,
    keyPoints: string[],
    domain: string,
  ): string {
    const verdict = this.scoreToPosition(score);
    const summary = verdict === 'for'
      ? 'The code is delightfully expressive!'
      : verdict === 'against'
        ? 'The code is disappointingly formulaic.'
        : 'The code shows some creative spark but plays it safe.';
    return `${summary} For ${domain} creative work, ${keyPoints.length} signals were evaluated. ${keyPoints[0] ?? 'No specific signals detected.'}`;
  }

  /**
   * Build a human-readable reasoning string for The Technician.
   */
  private buildTechnicianReasoning(
    score: number,
    keyPoints: string[],
    domain: string,
  ): string {
    const verdict = this.scoreToPosition(score);
    const summary = verdict === 'for'
      ? 'The code meets technical standards.'
      : verdict === 'against'
        ? 'The code has technical deficiencies that must be addressed.'
        : 'The code is technically adequate with room for improvement.';
    return `${summary} In the ${domain} domain, ${keyPoints.length} checks were performed. ${keyPoints[0] ?? 'No specific checks performed.'}`;
  }
}
