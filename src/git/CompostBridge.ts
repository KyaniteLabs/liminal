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

import { Logger } from '../utils/Logger.js';
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
  async onCommit(commit: CommitInfo): Promise<CompostEvent | null> {
    try {
      const event = this.eventStore.append('git_commit', {
        hash: commit.hash,
        message: commit.message,
        author: commit.author,
        date: commit.date,
        files: commit.files ?? [],
      });

      Logger.debug('CompostBridge', `Recorded git commit ${commit.hash.slice(0, 7)} in compost timeline`);
      return event;
    } catch (error) {
      Logger.warn('CompostBridge', `Failed to record git commit: ${error instanceof Error ? error.message : error}`);
      return null;
    }
  }

  /**
   * Record a git branch creation as a compost event.
   */
  async onBranch(branch: BranchInfo): Promise<CompostEvent | null> {
    try {
      const event = this.eventStore.append('git_branch', {
        name: branch.name,
        commit: branch.commit,
        current: branch.current,
      });

      Logger.debug('CompostBridge', `Recorded git branch ${branch.name} in compost timeline`);
      return event;
    } catch (error) {
      Logger.warn('CompostBridge', `Failed to record git branch: ${error instanceof Error ? error.message : error}`);
      return null;
    }
  }

  /**
   * Get a unified timeline mixing compost and git events, sorted by time.
   *
   * Reads the compost EventStore timeline and separates git events
   * from creative events, returning them interleaved chronologically.
   */
  getUnifiedTimeline(_project: string, limit = 50): GitTimelineEntry[] {
    try {
      const entries = this.eventStore.timeline({ limit });

      return entries.map((entry): GitTimelineEntry => {
        const evt = entry.event;
        const isGitEvent = evt.type === 'git_commit' || evt.type === 'git_branch';
        return {
          timestamp: evt.timestamp,
          source: isGitEvent ? 'git' : 'compost',
          type: evt.type,
          data: evt.payload,
        };
      });
    } catch (error) {
      Logger.warn('CompostBridge', `Failed to get unified timeline: ${error instanceof Error ? error.message : error}`);
      return [];
    }
  }
}
