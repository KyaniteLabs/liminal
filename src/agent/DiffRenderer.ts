/**
 * DiffRenderer — Phase 12
 *
 * Produces a unified diff between two text strings.
 * Used to compare artifact candidates side-by-side in the TUI.
 *
 * Simple line-based diff — sufficient for code artifacts.
 * No dependency on external diff libraries.
 */

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
}

export interface DiffResult {
  /** The diff lines */
  lines: DiffLine[];
  /** Number of lines added */
  added: number;
  /** Number of lines removed */
  removed: number;
  /** Whether the two inputs are identical */
  identical: boolean;
}

export class DiffRenderer {
  /** Maximum number of lines per side before falling back to sequential diff */
  private static readonly MAX_LCS_LINES = 5000;

  /**
   * Compute a unified diff between two strings.
   */
  diff(oldText: string, newText: string): DiffResult {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');

    // Size guard: fall back to sequential diff for large inputs
    const useLcs = oldLines.length <= DiffRenderer.MAX_LCS_LINES
      && newLines.length <= DiffRenderer.MAX_LCS_LINES;
    const { editScript } = useLcs
      ? this.lcs(oldLines, newLines)
      : this.sequentialDiff(oldLines, newLines);

    const lines: DiffLine[] = [];
    let added = 0;
    let removed = 0;

    for (const op of editScript) {
      lines.push(op);
      if (op.type === 'added') added++;
      if (op.type === 'removed') removed++;
    }

    return {
      lines,
      added,
      removed,
      identical: added === 0 && removed === 0,
    };
  }

  /**
   * Render a DiffResult as a unified diff string.
   */
  render(result: DiffResult): string {
    if (result.identical) return '(no differences)';

    const parts: string[] = [];
    for (const line of result.lines) {
      switch (line.type) {
        case 'added':
          parts.push(`+ ${line.content}`);
          break;
        case 'removed':
          parts.push(`- ${line.content}`);
          break;
        case 'unchanged':
          parts.push(`  ${line.content}`);
          break;
      }
    }
    return parts.join('\n');
  }

  /**
   * Longest common subsequence algorithm for line-based diff.
   * Returns an edit script (sequence of add/remove/unchanged operations).
   */
  private lcs(oldLines: string[], newLines: string[]): { editScript: DiffLine[] } {
    const m = oldLines.length;
    const n = newLines.length;

    // Build LCS table
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (oldLines[i - 1] === newLines[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    // Backtrack to produce edit script
    const editScript: DiffLine[] = [];
    let i = m;
    let j = n;

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
        editScript.unshift({ type: 'unchanged', content: oldLines[i - 1] });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        editScript.unshift({ type: 'added', content: newLines[j - 1] });
        j--;
      } else if (i > 0) {
        editScript.unshift({ type: 'removed', content: oldLines[i - 1] });
        i--;
      }
    }

    return { editScript };
  }

  /**
   * O(n) sequential diff — used as fallback when inputs exceed MAX_LCS_LINES.
   * Compares lines positionally: matching indices that differ are marked
   * removed + added; trailing lines are added or removed wholesale.
   */
  private sequentialDiff(oldLines: string[], newLines: string[]): { editScript: DiffLine[] } {
    const editScript: DiffLine[] = [];
    const maxLen = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLen; i++) {
      const oldLine = oldLines[i];
      const newLine = newLines[i];

      if (oldLine !== undefined && newLine !== undefined) {
        if (oldLine === newLine) {
          editScript.push({ type: 'unchanged', content: oldLine });
        } else {
          editScript.push({ type: 'removed', content: oldLine });
          editScript.push({ type: 'added', content: newLine });
        }
      } else if (oldLine !== undefined) {
        editScript.push({ type: 'removed', content: oldLine });
      } else if (newLine !== undefined) {
        editScript.push({ type: 'added', content: newLine });
      }
    }

    return { editScript };
  }
}
