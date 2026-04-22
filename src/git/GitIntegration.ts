/**
 * GitIntegration — High-level orchestrator for Git in RalphLoop
 *
 * Manages the "branch-per-run, commit-per-iteration" pattern:
 * - Creates a named branch for each RalphLoop run
 * - Commits generated code after each iteration
 * - Generates human-readable commit messages from template
 * - Restores the original branch when the run completes
 *
 * Usage:
 *   const git = new GitIntegration(config);
 *   await git.startRun('my-project');           // creates liminal/my-project-1234
 *   await git.commitIteration(ctx);              // commits iteration 1
 *   await git.commitIteration(ctx);              // commits iteration 2
 *   await git.endRun('quality achieved');        // commits final + restores branch
 */

import { Result, ok, err } from 'neverthrow';
import { GitService } from './GitService.js';
import { Logger } from '../utils/Logger.js';
import { GitError } from '../errors/GitError.js';
import { AsyncLock } from '../utils/AsyncLock.js';
import type { GitConfig, IterationCommitContext, CommitInfo } from './types.js';
import { DEFAULT_GIT_CONFIG } from './types.js';
import type { CompostBridge } from './CompostBridge.js';

export class GitIntegration {
  private git: GitService;
  private config: GitConfig;
  private compostBridge?: CompostBridge;
  private originalBranch: string | null = null;
  private runBranch: string | null = null;
  private stashedBeforeRun = false;
  private lock = new AsyncLock();

  constructor(config: Partial<GitConfig>, compostBridge?: CompostBridge) {
    this.config = { ...DEFAULT_GIT_CONFIG, ...config };
    this.compostBridge = compostBridge;
    this.git = new GitService();
  }

  /** Check if git integration is enabled */
  get isEnabled(): boolean {
    return this.config.enabled;
  }

  /** Get the current run branch name (null if not in a run) */
  get currentRunBranch(): string | null {
    return this.runBranch;
  }

  /**
   * Start a RalphLoop run:
   * 1. Stash any uncommitted changes (namespaced to session)
   * 2. Reuse existing session branch or create a new one
   * 3. Record branch creation via CompostBridge
   */
  async startRun(name: string, sessionId?: string): Promise<Result<string, GitError>> {
    if (!this.config.enabled) return ok('');
    if (!this.config.branchPerRun) return ok('');
    return this.lock.acquire(async () => {

    // Ensure we're in a git repo
    const isRepo = await this.git.isRepo();
    if (!isRepo) {
      return err(new GitError('Not a git repo', { retryable: false }));
    }

    // Save current branch to restore later
    this.originalBranch = await this.git.currentBranch();

    // Stash dirty working tree if needed (namespaced by session)
    const statusResult = await this.git.status();
    if (statusResult.isErr()) {
      return err(new GitError('Failed to get status before stash', { cause: statusResult.error, retryable: true }));
    }
    const status = statusResult.value;
    if (!status.isClean()) {
      const stashMsg = sessionId
        ? `agent:${sessionId}:stash before run ${name}`
        : `liminal: auto-stash before run ${name}`;
      await this.git.stash(stashMsg);
      this.stashedBeforeRun = true;
      Logger.info('GitIntegration', 'Stashed uncommitted changes before run');
    }

    // Create or reuse session branch
    // Branch name format: liminal/<sessionId> (session-scoped, no timestamp-per-iteration)
    let branchName: string;
    if (sessionId) {
      branchName = `${this.config.branchPrefix}${sessionId}`;
      // Check if branch already exists — reuse it
      const existingBranches = await this.git.branchList();
      if (existingBranches.includes(branchName)) {
        await this.git.checkout(branchName);
        Logger.info('GitIntegration', `Reused existing session branch: ${branchName}`);
      } else {
        try {
          await this.git.branch(branchName);
          Logger.info('GitIntegration', `Created session branch: ${branchName}`);
        } catch (e) {
          return err(new GitError(`Failed to create branch: ${branchName}`, { cause: e instanceof Error ? e : undefined, retryable: false }));
        }
      }
    } else {
      // Legacy fallback: timestamp-based branch name (for non-session calls)
      const timestamp = Date.now();
      const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 40);
      branchName = `${this.config.branchPrefix}${safeName}-${timestamp}`;
      try {
        await this.git.branch(branchName);
      } catch (e) {
        return err(new GitError(`Failed to create branch: ${branchName}`, { cause: e instanceof Error ? e : undefined, retryable: false }));
      }
    }
    this.runBranch = branchName;

    Logger.info('GitIntegration', `Started run on branch: ${branchName}`);

    // Bridge to compost
    if (this.config.bridgeToCompost && this.compostBridge) {
      const bridgeResult = await this.compostBridge.onBranch({
        name: branchName,
        current: true,
        commit: (await this.git.getLastCommit())?.hash ?? '',
      });
      if (bridgeResult.isErr()) {
        Logger.warn('GitIntegration', `Compost bridge failed to record branch: ${bridgeResult.error.message}`);
      }
    }

    return ok(branchName);
    });
  }

  /**
   * Commit a single RalphLoop iteration.
   * Writes the code to filePath, stages it, and commits.
   */
  async commitIteration(ctx: IterationCommitContext): Promise<Result<CommitInfo, GitError>> {
    if (!this.config.enabled || !this.config.autoCommit) {
      return err(new GitError('Git integration disabled', { retryable: false }));
    }
    return this.lock.acquire(async () => {

    const isRepo = await this.git.isRepo();
    if (!isRepo) {
      return err(new GitError('Not a git repo', { retryable: false }));
    }

    // Write code to file
    try {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const dir = path.dirname(ctx.filePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(ctx.filePath, ctx.code, 'utf-8');
    } catch (e) {
      return err(new GitError(`Failed to write file: ${ctx.filePath}`, { cause: e instanceof Error ? e : undefined, retryable: true }));
    }

    // Stage and commit
    let commit: CommitInfo;
    try {
      await this.git.add([ctx.filePath]);
      const message = this.formatCommitMessage(ctx);
      commit = await this.git.commit(message);
    } catch (e) {
      return err(new GitError(`Failed to commit iteration ${ctx.iteration}`, { cause: e instanceof Error ? e : undefined, retryable: false }));
    }

    Logger.info('GitIntegration', `Committed iteration ${ctx.iteration} (${commit.hash.slice(0, 7)})`);

    // Bridge to compost
    if (this.config.bridgeToCompost && this.compostBridge) {
      const bridgeResult = await this.compostBridge.onCommit(commit);
      if (bridgeResult.isErr()) {
        Logger.warn('GitIntegration', `Compost bridge failed to record commit: ${bridgeResult.error.message}`);
      }
    }

    // Auto-push if configured — failure is an error, not a warning
    // (unpushed commits on a cleaned-up worktree = lost work per CLAUDE.md)
    if (this.config.autoPush) {
      try {
        await this.git.push();
      } catch (pushErr) {
        Logger.error('GitIntegration', `Auto-push failed for commit ${commit.hash.slice(0, 7)}: ${pushErr instanceof Error ? pushErr.message : pushErr}`);
        return err(new GitError(
          `Auto-push failed (commit ${commit.hash.slice(0, 7)} saved locally but NOT pushed)`,
          { cause: pushErr instanceof Error ? pushErr : undefined, retryable: true },
        ));
      }
    }

    return ok(commit);
    });
  }

  /**
   * End a RalphLoop run:
   * 1. Commit final state only if dirty
   * 2. Clean up session-scoped stashes
   * 3. Restore the original branch
   * 4. Pop stash if we stashed earlier
   */
  async endRun(reason: string, sessionId?: string): Promise<void> {
    if (!this.config.enabled || !this.runBranch) return;

    return this.lock.acquire(async () => {
    try {
      // Commit any remaining changes only if dirty
      const statusResult = await this.git.status();
      if (statusResult.isErr()) {
        Logger.warn('GitIntegration', `Failed to get status at end of run: ${statusResult.error.message}`);
      } else if (!statusResult.value.isClean()) {
        await this.git.addAllAndCommit(`liminal: run complete — ${reason}`);
        Logger.info('GitIntegration', 'Committed final changes before restoring branch');
      }

      // Restore original branch
      if (this.originalBranch) {
        await this.git.checkout(this.originalBranch);
        Logger.info('GitIntegration', `Restored branch: ${this.originalBranch}`);
      }

      // Restore only the stash this run created. Never pop arbitrary existing
      // stashes; old unrelated stashes can contain conflicts from other lanes.
      if (this.stashedBeforeRun) {
        try {
          await this.git.stashPop();
          Logger.info('GitIntegration', 'Restored stashed changes');
        } catch (stashPopError) {
          Logger.warn(
            'GitIntegration',
            `Failed to restore run stash: ${stashPopError instanceof Error ? stashPopError.message : String(stashPopError)}`,
          );
        }
      }

      // Clean up leftover session-scoped stashes for this agent session
      if (sessionId) {
        try {
          const allStashes = await this.git.stashListFull();
          for (const stash of allStashes) {
            if (stash.message?.includes(`agent:${sessionId}:`)) {
              await this.git.stashDrop(stash.hash);
              Logger.info('GitIntegration', `Cleaned up session stash: ${stash.hash}`);
            }
          }
        } catch {
          // Stash cleanup failures are non-fatal
        }
      }

      Logger.info('GitIntegration', `Run ended: ${reason}`);
    } catch (error) {
      Logger.error('GitIntegration', `Failed to end run: ${error instanceof Error ? error.message : error}`);
    } finally {
      this.runBranch = null;
      this.originalBranch = null;
      this.stashedBeforeRun = false;
    }
    });
  }

  /** Format a commit message from the template and iteration context */
  private formatCommitMessage(ctx: IterationCommitContext): string {
    const truncatedPrompt = ctx.prompt.length > 60
      ? ctx.prompt.slice(0, 57) + '...'
      : ctx.prompt;

    return this.config.commitMessageTemplate
      .replace('{prompt}', truncatedPrompt)
      .replace('{n}', String(ctx.iteration))
      .replace('{score}', ctx.score.toFixed(2))
      .replace('{model}', ctx.model ?? 'unknown');
  }
}
