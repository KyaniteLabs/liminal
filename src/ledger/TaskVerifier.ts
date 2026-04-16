/**
 * TaskVerifier — Combines ScoringEngine + execSync for task verification.
 *
 * Scores the generated code semantically via ScoringEngine and runs
 * the task's verify command (e.g. pnpm test) to determine pass/fail.
 * Records the resulting candidate in the TaskLedger.
 */

import { ScoringEngine } from '../core/ScoringEngine.js';
import type { TaskManifest, TaskCandidate, TaskAttempt } from './types.js';
import type { TaskLedger } from './TaskLedger.js';
import { execFileSync } from 'node:child_process';

const ALLOWED_COMMAND_PREFIXES = ['pnpm test', 'pnpm build', 'pnpm vitest', 'npx vitest'];

// Shell metacharacters that enable chaining, substitution, or redirection
const SHELL_METACHAR_RE = /[&|;$`<>\n\\]/;

function assertAllowedCommand(cmd: string): void {
  if (SHELL_METACHAR_RE.test(cmd)) {
    throw new Error(
      `Blocked: verifyCommand "${cmd}" contains shell metacharacters (${cmd.match(SHELL_METACHAR_RE)![0]})`,
    );
  }
  const allowed = ALLOWED_COMMAND_PREFIXES.some(prefix => cmd.startsWith(prefix));
  if (!allowed) {
    throw new Error(
      `Blocked: verifyCommand "${cmd}" does not match allowed prefixes: ${ALLOWED_COMMAND_PREFIXES.join(', ')}`,
    );
  }
}

export class TaskVerifier {
  private scoringEngine: ScoringEngine;

  constructor(private ledger: TaskLedger) {
    this.scoringEngine = new ScoringEngine();
  }

  async verify(task: TaskManifest, attempt: TaskAttempt, code: string): Promise<TaskCandidate> {
    const scoringResult = await this.scoringEngine.score({
      output: code,
      prompt: attempt.prompt,
      criteria: task.scoringCriteria,
    });

    assertAllowedCommand(task.verifyCommand);

    const [cmd, ...cmdArgs] = task.verifyCommand.split(' ');

    let testPassed = false;
    try {
      execFileSync(cmd, cmdArgs, {
        timeout: 120000,
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      testPassed = true;
    } catch (_err: unknown) {
      testPassed = false;
    }

    const candidate: TaskCandidate = {
      id: `cand-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      taskId: task.id,
      attemptId: attempt.id,
      code,
      semanticScore: scoringResult.score,
      testPassed,
      evaluatedAt: new Date().toISOString(),
    };

    this.ledger.recordCandidate(candidate);
    return candidate;
  }
}
