/**
 * GitService — Core git operations wrapper using simple-git
 *
 * Provides a clean API over git operations:
 * - Repo init and status
 * - Add, commit, log, diff
 * - Branch create/list/delete/checkout
 * - Stash push/pop/list
 *
 * All operations are async and return Liminal-native types
 * (CommitInfo, BranchInfo, DiffResult) rather than raw simple-git responses.
 */

import simpleGit, { type SimpleGit, type StatusResult as GitStatusResult } from 'simple-git';
import { Logger } from '../utils/Logger.js';
import type { CommitInfo, BranchInfo, DiffResult, DiffFile, LogOptions } from './types.js';

export class GitService {
  private git: SimpleGit;
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? process.cwd();
    this.git = simpleGit(this.baseDir);
  }

  // ── Repo operations ────────────────────────────────

  /** Initialize a new git repo */
  async init(): Promise<void> {
    const isRepo = await this.isRepo();
    if (isRepo) {
      Logger.debug('GitService', 'Already a git repo, skipping init');
      return;
    }
    await this.git.init();
    Logger.info('GitService', `Initialized git repo in ${this.baseDir}`);
  }

  /** Check if current directory is a git repo */
  async isRepo(): Promise<boolean> {
    try {
      return await this.git.checkIsRepo();
    } catch {
      return false;
    }
  }

  /** Get working tree status */
  async status(): Promise<GitStatusResult> {
    return this.git.status();
  }

  // ── Commit operations ──────────────────────────────

  /** Stage files for commit */
  async add(files: string[]): Promise<void> {
    await this.git.add(files);
  }

  /** Stage all changes */
  async addAll(): Promise<void> {
    await this.git.add('-A');
  }

  /** Create a commit */
  async commit(message: string): Promise<CommitInfo> {
    const result = await this.git.commit(message);
    return {
      hash: result.commit,
      date: new Date().toISOString(),
      message,
      author: (result as any).author ?? 'liminal',
    };
  }

  /** Stage all and commit in one step */
  async addAllAndCommit(message: string): Promise<CommitInfo> {
    await this.addAll();
    return this.commit(message);
  }

  // ── Log operations ─────────────────────────────────

  /** Get commit log */
  async log(options?: LogOptions): Promise<CommitInfo[]> {
    const logArgs: string[] = [];
    if (options?.maxCount) {
      logArgs.push(`--max-count=${options.maxCount}`);
    }
    if (options?.branch) {
      logArgs.push(options.branch);
    }
    if (options?.file) {
      logArgs.push('--', options.file);
    }

    const result = await this.git.log(logArgs);
    return result.all.map((entry) => ({
      hash: entry.hash,
      date: entry.date,
      message: entry.message,
      author: entry.author_name ?? 'unknown',
    }));
  }

  /** Get the most recent commit */
  async getLastCommit(): Promise<CommitInfo | null> {
    const commits = await this.log({ maxCount: 1 });
    return commits[0] ?? null;
  }

  /** Get total commit count */
  async getCommitCount(): Promise<number> {
    const result = await this.git.log();
    return result.total;
  }

  // ── Branch operations ──────────────────────────────

  /** Create a new branch */
  async branch(name: string): Promise<BranchInfo> {
    await this.git.checkoutBranch(name, 'HEAD');
    Logger.info('GitService', `Created and checked out branch: ${name}`);
    return {
      name,
      current: true,
      commit: (await this.getLastCommit())?.hash ?? '',
    };
  }

  /** Checkout an existing branch */
  async checkout(branch: string): Promise<void> {
    await this.git.checkout(branch);
    Logger.info('GitService', `Checked out branch: ${branch}`);
  }

  /** Get the current branch name */
  async currentBranch(): Promise<string> {
    const status = await this.status();
    return status.current ?? 'main';
  }

  /** List all branches */
  async listBranches(): Promise<BranchInfo[]> {
    const result = await this.git.branch();
    return result.all.map((name) => ({
      name,
      current: name === result.current,
      commit: '', // Filled on demand via log
    }));
  }

  /** Delete a branch */
  async deleteBranch(name: string, force = false): Promise<void> {
    const flag = force ? '-D' : '-d';
    await this.git.branch([flag, name]);
    Logger.info('GitService', `Deleted branch: ${name}`);
  }

  // ── Diff operations ────────────────────────────────

  /** Get diff between two refs (defaults to working tree vs HEAD) */
  async diff(from?: string, to?: string): Promise<DiffResult> {
    const args: string[] = ['--stat'];
    if (from && to) {
      args.push(`${from}..${to}`);
    } else if (from) {
      args.push(from);
    }

    const result = await this.git.diff(args);
    return this.parseDiffOutput(result, from ?? 'HEAD', to ?? 'working');
  }

  // ── Stash operations ───────────────────────────────

  /** Stash current changes */
  async stash(message?: string): Promise<void> {
    const args = message ? ['push', '-m', message] : ['push'];
    await this.git.stash(args);
    Logger.info('GitService', 'Stashed changes');
  }

  /** Pop the most recent stash */
  async stashPop(): Promise<void> {
    await this.git.stash(['pop']);
    Logger.info('GitService', 'Popped stash');
  }

  /** List all stashes */
  async stashList(): Promise<string[]> {
    const result = await this.git.stashList();
    return result.all.map((entry) => entry.message ?? entry.hash);
  }

  // ── Push/Pull ──────────────────────────────────────

  /** Push current branch to remote */
  async push(remote = 'origin', branch?: string): Promise<void> {
    const branchName = branch ?? await this.currentBranch();
    await this.git.push(remote, branchName);
    Logger.info('GitService', `Pushed to ${remote}/${branchName}`);
  }

  // ── Internal helpers ───────────────────────────────

  /** Parse git diff --stat output into a DiffResult */
  private parseDiffOutput(raw: string, from: string, to: string): DiffResult {
    const files: DiffFile[] = [];
    let insertions = 0;
    let deletions = 0;

    // Parse stat lines like: " src/foo.js | 5 +++--"
    const lines = raw.split('\n');
    for (const line of lines) {
      const match = line.match(/^\s+(.+?)\s+\|\s+(\d+)\s+([+-]+)/);
      if (match) {
        const path = match[1].trim();
        const plusCount = (match[3].match(/\+/g) || []).length;
        const minusCount = (match[3].match(/-/g) || []).length;
        files.push({
          path,
          insertions: plusCount,
          deletions: minusCount,
          binary: false,
        });
        insertions += plusCount;
        deletions += minusCount;
      }
      // Binary file line: " src/binary.dat | Bin 0 -> 1234 bytes"
      const binMatch = line.match(/^\s+(.+?)\s+\|\s+Bin/);
      if (binMatch) {
        files.push({
          path: binMatch[1].trim(),
          insertions: 0,
          deletions: 0,
          binary: true,
        });
      }
    }

    return {
      from,
      to,
      filesChanged: files.length,
      insertions,
      deletions,
      files,
    };
  }
}
