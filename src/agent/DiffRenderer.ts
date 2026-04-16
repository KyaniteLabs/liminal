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
  /**
   * Compute a unified diff between two strings.
   */
  diff(oldText: string, newText: string): DiffResult {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');

    const { editScript } = this.lcs(oldLines, newLines);

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
}
