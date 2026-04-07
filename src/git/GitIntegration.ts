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

import { GitService } from './GitService.js';
import { Logger } from '../utils/Logger.js';
import type { GitConfig, IterationCommitContext, CommitInfo } from './types.js';
import { DEFAULT_GIT_CONFIG } from './types.js';
import type { CompostBridge } from './CompostBridge.js';

export class GitIntegration {
  private git: GitService;
  private config: GitConfig;
  private compostBridge?: CompostBridge;
  private originalBranch: string | null = null;
  private runBranch: string | null = null;

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
   * 1. Stash any uncommitted changes
   * 2. Create a branch named `{prefix}{name}-{timestamp}`
   * 3. Record branch creation via CompostBridge
   */
  async startRun(name: string): Promise<string | null> {
    if (!this.config.enabled) return null;
    if (!this.config.branchPerRun) return null;

    try {
      // Ensure we're in a git repo
      const isRepo = await this.git.isRepo();
      if (!isRepo) {
        Logger.warn('GitIntegration', 'Not a git repo — skipping branch creation');
        return null;
      }

      // Save current branch to restore later
      this.originalBranch = await this.git.currentBranch();


      // Stash dirty working tree if needed
      const status = await this.git.status();
      if (!status.isClean()) {
        await this.git.stash(`liminal: auto-stash before run ${name}`);
        Logger.info('GitIntegration', 'Stashed uncommitted changes before run');
      }

      // Create run branch
      const timestamp = Date.now();
      const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 40);
      const branchName = `${this.config.branchPrefix}${safeName}-${timestamp}`;
      await this.git.branch(branchName);
      this.runBranch = branchName;

      Logger.info('GitIntegration', `Started run on branch: ${branchName}`);

      // Bridge to compost
      if (this.config.bridgeToCompost && this.compostBridge) {
        await this.compostBridge.onBranch({
          name: branchName,
          current: true,
          commit: (await this.git.getLastCommit())?.hash ?? '',
        });
      }

      return branchName;
    } catch (error) {
      Logger.error('GitIntegration', `Failed to start run: ${error instanceof Error ? error.message : error}`);
      return null;
    }
  }

  /**
   * Commit a single RalphLoop iteration.
   * Writes the code to filePath, stages it, and commits.
   */
  async commitIteration(ctx: IterationCommitContext): Promise<CommitInfo | null> {
    if (!this.config.enabled || !this.config.autoCommit) return null;

    try {
      const isRepo = await this.git.isRepo();
      if (!isRepo) return null;

      // Write code to file
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const dir = path.dirname(ctx.filePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(ctx.filePath, ctx.code, 'utf-8');

      // Stage and commit
      await this.git.add([ctx.filePath]);
      const message = this.formatCommitMessage(ctx);
      const commit = await this.git.commit(message);

      Logger.info('GitIntegration', `Committed iteration ${ctx.iteration} (${commit.hash.slice(0, 7)})`);

      // Bridge to compost
      if (this.config.bridgeToCompost && this.compostBridge) {
        await this.compostBridge.onCommit(commit);
      }

      // Auto-push if configured
      if (this.config.autoPush) {
        await this.git.push().catch((err) => {
          Logger.warn('GitIntegration', `Auto-push failed: ${err instanceof Error ? err.message : err}`);
        });
      }

      return commit;
    } catch (error) {
      Logger.error('GitIntegration', `Failed to commit iteration: ${error instanceof Error ? error.message : error}`);
      return null;
    }
  }

  /**
   * End a RalphLoop run:
   * 1. Optionally commit final state
   * 2. Restore the original branch
   * 3. Pop stash if we stashed earlier
   */
  async endRun(reason: string): Promise<void> {
    if (!this.config.enabled || !this.runBranch) return;

    try {
      // Commit any remaining changes
      const status = await this.git.status();
      if (!status.isClean()) {
        await this.git.addAllAndCommit(`liminal: run complete — ${reason}`);
        Logger.info('GitIntegration', 'Committed final changes before restoring branch');
      }

      // Restore original branch
      if (this.originalBranch) {
        await this.git.checkout(this.originalBranch);
        Logger.info('GitIntegration', `Restored branch: ${this.originalBranch}`);
      }

      // Pop stash if we had one
      try {
        const stashes = await this.git.stashList();
        if (stashes.length > 0) {
          await this.git.stashPop();
          Logger.info('GitIntegration', 'Restored stashed changes');
        }
      } catch {
        // Stash pop can fail if stash is empty — safe to ignore
      }

      Logger.info('GitIntegration', `Run ended: ${reason}`);
    } catch (error) {
      Logger.error('GitIntegration', `Failed to end run: ${error instanceof Error ? error.message : error}`);
    } finally {
      this.runBranch = null;

    }
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
