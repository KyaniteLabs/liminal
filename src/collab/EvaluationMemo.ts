/**
 * Structured evaluation memo format for collaborative generation
 *
 * Inspired by CEO_Agents' decision memo pattern. Provides a builder for
 * constructing evaluation memos with sections, verdicts, and scores,
 * plus utilities for formatting and aggregation.
 */

/**
 * A single section within an evaluation memo
 */
export interface MemoSection {
  /** Section heading */
  title: string;
  /** Section body content */
  content: string;
  /** Importance level for triage and filtering */
  priority: 'high' | 'medium' | 'low';
}

/**
 * Verdict options for an evaluation memo
 */
export type MemoVerdict = 'approve' | 'revise' | 'reject';

/**
 * A structured evaluation memo capturing a complete assessment
 */
export interface EvaluationMemo {
  /** Unique identifier for this memo */
  id: string;
  /** ISO 8601 timestamp of when the memo was created */
  timestamp: string;
  /** Short descriptive title */
  title: string;
  /** One-paragraph executive summary */
  brief: string;
  /** Ordered sections with detailed analysis */
  sections: MemoSection[];
  /** Final decision on the evaluated artifact */
  finalVerdict: MemoVerdict;
  /** Numeric score between 0 and 1 */
  score: number;
  /** Identifier of the agent or system that generated this memo */
  generatedBy: string;
}

/**
 * Aggregate statistics computed from a collection of memos
 */
export interface MemoSummary {
  /** Total number of evaluations */
  totalEvaluations: number;
  /** Ratio of approved memos (0-1) */
  approveRate: number;
  /** Average score across all memos (0-1) */
  avgScore: number;
  /** Frequently recurring issues extracted from high-priority revise/reject sections */
  commonIssues: string[];
}

/**
 * Builder for constructing EvaluationMemo instances with fluent API
 *
 * Usage:
 * ```ts
 * const memo = new EvaluationMemoBuilder()
 *   .setTitle('Code Quality Review')
 *   .setBrief('Evaluation of generated shader code')
 *   .addSection('Correctness', 'All tests pass', 'high')
 *   .addSection('Style', 'Minor formatting issues', 'low')
 *   .setVerdict('approve', 0.85)
 *   .setGeneratedBy('aesthetic-critic')
 *   .build();
 * ```
 */
export class EvaluationMemoBuilder {
  private sections: MemoSection[] = [];
  private _title: string = '';
  private _brief: string = '';
  private _verdict: MemoVerdict | null = null;
  private _score: number | null = null;
  private _generatedBy: string = '';

  /**
   * Set the memo title
   *
   * @param title - Short descriptive title for the evaluation
   * @returns This builder for chaining
   */
  setTitle(title: string): this {
    this._title = title;
    return this;
  }

  /**
   * Set the executive brief / summary
   *
   * @param brief - One-paragraph summary of the evaluation findings
   * @returns This builder for chaining
   */
  setBrief(brief: string): this {
    this._brief = brief;
    return this;
  }

  /**
   * Add a numbered section to the memo
   *
   * @param title - Section heading
   * @param content - Section body content
   * @param priority - Importance level (defaults to 'medium')
   * @returns This builder for chaining
   */
  addSection(
    title: string,
    content: string,
    priority: 'high' | 'medium' | 'low' = 'medium',
  ): this {
    this.sections.push({ title, content, priority });
    return this;
  }

  /**
   * Set the final verdict and numeric score
   *
   * @param verdict - One of 'approve', 'revise', or 'reject'
   * @param score - Numeric score between 0 and 1 (inclusive)
   * @returns This builder for chaining
   */
  setVerdict(verdict: MemoVerdict, score: number): this {
    this._verdict = verdict;
    this._score = score;
    return this;
  }

  /**
   * Set the identifier of the generating agent or system
   *
   * @param source - Agent or system name that produced this evaluation
   * @returns This builder for chaining
   */
  setGeneratedBy(source: string): this {
    this._generatedBy = source;
    return this;
  }

  /**
   * Build and validate the EvaluationMemo
   *
   * @returns A fully populated EvaluationMemo
   * @throws {Error} If required fields are missing or score is out of range
   */
  build(): EvaluationMemo {
    if (!this._title) {
      throw new Error('EvaluationMemo requires a title');
    }
    if (!this._brief) {
      throw new Error('EvaluationMemo requires a brief');
    }
    if (this._verdict === null) {
      throw new Error('EvaluationMemo requires a verdict');
    }
    if (this._score === null) {
      throw new Error('EvaluationMemo requires a score');
    }
    if (this._score < 0 || this._score > 1) {
      throw new Error(`EvaluationMemo score must be between 0 and 1, got ${this._score}`);
    }
    if (!this._generatedBy) {
      throw new Error('EvaluationMemo requires a generatedBy source');
    }

    return {
      id: generateMemoId(),
      timestamp: new Date().toISOString(),
      title: this._title,
      brief: this._brief,
      sections: [...this.sections],
      finalVerdict: this._verdict,
      score: this._score,
      generatedBy: this._generatedBy,
    };
  }
}

/**
 * Generate a unique memo ID using timestamp and random suffix
 *
 * @returns A string ID in the format `memo-<timestamp>-<random>`
 */
function generateMemoId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `memo-${ts}-${rand}`;
}

/**
 * Format an EvaluationMemo as human-readable markdown
 *
 * Produces a structured markdown document with headers, priority badges,
 * and a final verdict block suitable for display or persistence.
 *
 * @param memo - The evaluation memo to format
 * @returns A markdown string representation
 */
export function formatMemo(memo: EvaluationMemo): string {
  const priorityBadge: Record<string, string> = {
    high: '**[HIGH]**',
    medium: '**[MED]**',
    low: '**[LOW]**',
  };

  const verdictEmoji: Record<string, string> = {
    approve: 'APPROVE',
    revise: 'REVISE',
    reject: 'REJECT',
  };

  const lines: string[] = [
    `# ${memo.title}`,
    '',
    `> **${verdictEmoji[memo.finalVerdict]}** — Score: ${memo.score.toFixed(2)} — by ${memo.generatedBy}`,
    `> ${memo.timestamp}`,
    '',
    '## Brief',
    '',
    memo.brief,
    '',
  ];

  if (memo.sections.length > 0) {
    lines.push('## Sections', '');
    for (const section of memo.sections) {
      const badge = priorityBadge[section.priority] ?? '';
      lines.push(`### ${badge} ${section.title}`, '');
      lines.push(section.content, '');
    }
  }

  lines.push('---');
  lines.push(`*memo id: ${memo.id}*`);

  return lines.join('\n');
}

/**
 * Compute aggregate statistics across a collection of evaluation memos
 *
 * Extracts approval rate, average score, and common issues from high-priority
 * sections of non-approved memos. Issues are deduplicated by title.
 *
 * @param memos - Array of evaluation memos to summarize
 * @returns Aggregate statistics including common issues
 */
export function summarizeMemos(memos: EvaluationMemo[]): MemoSummary {
  const total = memos.length;

  if (total === 0) {
    return {
      totalEvaluations: 0,
      approveRate: 0,
      avgScore: 0,
      commonIssues: [],
    };
  }

  const approved = memos.filter((m) => m.finalVerdict === 'approve').length;
  const approveRate = approved / total;

  const totalScore = memos.reduce((sum, m) => sum + m.score, 0);
  const avgScore = totalScore / total;

  // Collect issue titles from high-priority sections of non-approved memos
  const issueCounts = new Map<string, number>();
  for (const memo of memos) {
    if (memo.finalVerdict === 'approve') continue;
    for (const section of memo.sections) {
      if (section.priority === 'high') {
        const count = issueCounts.get(section.title) ?? 0;
        issueCounts.set(section.title, count + 1);
      }
    }
  }

  // Sort by frequency, take top issues appearing more than once if possible
  const sorted = Array.from(issueCounts.entries())
    .sort((a, b) => b[1] - a[1]);

  const commonIssues: string[] = [];
  for (const [title, count] of sorted) {
    if (count >= 2 || sorted.length <= 5) {
      commonIssues.push(count > 1 ? `${title} (x${count})` : title);
    }
  }

  return {
    totalEvaluations: total,
    approveRate,
    avgScore,
    commonIssues,
  };
}
