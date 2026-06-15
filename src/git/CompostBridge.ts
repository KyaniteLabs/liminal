/**
 * @deprecated Audit C10 (2026-06-15): This module is orphaned — zero external
 * importers outside barrel re-exports. Marked for batch deletion in a follow-up.
 * Do not add new consumers. If you need this functionality, re-wire it first.
 */

/**
 * CompostBridge — Bridges git events into the Compost EventStore
 *
 * When git operations happen (commits, branches), this bridge records them
 * as events in the compost timeline, creating a unified view of:
 *   - Creative operations (heap_add, digest, soup_cycle)
 *   - Version control operations (git_commit, git_branch)
 *
 * Usage:
 *   const bridge = new CompostBridge(eventStore);
 *   bridge.onCommit({ hash: 'abc123', message: '...', ... });
 *   bridge.onBranch({ name: 'liminal/experiment-1', ... });
 *   const timeline = bridge.getUnifiedTimeline('my-project');
 */

import { Result, ok, err } from 'neverthrow';
import { Logger } from '../utils/Logger.js';
import { CompostError } from '../errors/CompostError.js';
import type { CommitInfo, BranchInfo, GitTimelineEntry } from './types.js';
import type { EventStore, CompostEvent } from '../compost/EventStore.js';

export class CompostBridge {
  private eventStore: EventStore;

  constructor(eventStore: EventStore) {
    this.eventStore = eventStore;
  }

  /**
   * Record a git commit as a compost event.
   * Stores the commit hash, message, and metadata in the unified timeline.
   */
  onCommit(commit: CommitInfo): Result<CompostEvent, CompostError> {
    try {
      const event = this.eventStore.append('git_commit', {
        hash: commit.hash,
        message: commit.message,
        author: commit.author,
        date: commit.date,
        files: commit.files ?? [],
      });

      Logger.debug('CompostBridge', `Recorded git commit ${commit.hash.slice(0, 7)} in compost timeline`);
      return ok(event);
    } catch (error) {
      return err(new CompostError(
        `Failed to record git commit ${commit.hash.slice(0, 7)}`,
        { cause: error instanceof Error ? error : undefined, retryable: true },
      ));
    }
  }

  /**
   * Record a git branch creation as a compost event.
   */
  onBranch(branch: BranchInfo): Result<CompostEvent, CompostError> {
    try {
      const event = this.eventStore.append('git_branch', {
        name: branch.name,
        commit: branch.commit,
        current: branch.current,
      });

      Logger.debug('CompostBridge', `Recorded git branch ${branch.name} in compost timeline`);
      return ok(event);
    } catch (error) {
      return err(new CompostError(
        `Failed to record git branch ${branch.name}`,
        { cause: error instanceof Error ? error : undefined, retryable: true },
      ));
    }
  }

  /**
   * Get a unified timeline mixing compost and git events, sorted by time.
   *
   * Reads the compost EventStore timeline and separates git events
   * from creative events, returning them interleaved chronologically.
   */
  getUnifiedTimeline(_project: string, limit = 50): Result<GitTimelineEntry[], CompostError> {
    try {
      const entries = this.eventStore.timeline({ limit });

      return ok(entries.map((entry): GitTimelineEntry => {
        const evt = entry.event;
        const isGitEvent = evt.type === 'git_commit' || evt.type === 'git_branch';
        return {
          timestamp: evt.timestamp,
          source: isGitEvent ? 'git' : 'compost',
          type: evt.type,
          data: evt.payload,
        };
      }));
    } catch (error) {
      return err(new CompostError(
        'Failed to get unified timeline',
        { cause: error instanceof Error ? error : undefined, retryable: true },
      ));
    }
  }
}
