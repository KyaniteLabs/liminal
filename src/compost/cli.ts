/**
 * CLI argument parser and executor for `liminal compost` subcommands.
 *
 * Extended with event-sourced history commands:
 *   - log       — Show recent events on the timeline
 *   - undo      — Undo the most recent creative operation
 *   - branch    — Create, list, switch, delete branches
 *   - history   — Show a formatted project history summary
 */

import type { Seed } from './types.js';
import type { CompostMill } from './CompostMill.js';
import type { ProjectStore } from './ProjectStore.js';
import { formatSeedForDisplay } from '../core/lir/LIRPromptFormatter.js';
import { Logger } from '../utils/Logger.js';
import { ArchiveLearning } from '../learning/ArchiveLearning.js';

export type CLIAction =
  | { command: 'add'; paths: string[] }
  | { command: 'digest' }
  | { command: 'soup'; subcommand: 'start' | 'stop' | 'status' }
  | { command: 'seeds'; subcommand: 'list' | 'show'; args?: string[] }
  | { command: 'status' }
  | { command: 'log'; limit?: number }
  | { command: 'undo' }
  | { command: 'branch'; subcommand: 'create' | 'list' | 'switch' | 'delete'; args?: string[]; description?: string }
  | { command: 'history' }
  | { command: 'export-finetuning'; domain?: string; minQuality?: number; outputPath?: string };

/** Parse CLI arguments into a typed action. */
export function parseArgs(args: string[]): CLIAction {
  const argv = args[0] === 'compost' ? args.slice(1) : args;

  if (argv[0] === 'add') {
    return { command: 'add', paths: argv.slice(1) };
  }
  if (argv[0] === 'digest') {
    return { command: 'digest' };
  }
  if (argv[0] === 'soup') {
    const sub = argv[1] as 'start' | 'stop' | 'status';
    return { command: 'soup', subcommand: sub };
  }
  if (argv[0] === 'seeds') {
    const sub = argv[1] as 'list' | 'show';
    return { command: 'seeds', subcommand: sub, args: argv.slice(2) };
  }
  if (argv[0] === 'status') {
    return { command: 'status' };
  }

  // ─── Event-sourced history commands ────────────────────────────────────

  if (argv[0] === 'log') {
    const limit = argv[1] ? parseInt(argv[1], 10) : 20;
    return { command: 'log', limit: isNaN(limit) ? 20 : limit };
  }

  if (argv[0] === 'undo') {
    return { command: 'undo' };
  }

  if (argv[0] === 'branch') {
    const sub = argv[1] as 'create' | 'list' | 'switch' | 'delete';
    if (!sub || !['create', 'list', 'switch', 'delete'].includes(sub)) {
      return { command: 'branch', subcommand: 'list' };
    }
    // Parse --description flag for create
    let description: string | undefined;
    const descIdx = argv.indexOf('--description');
    if (descIdx !== -1 && argv[descIdx + 1]) {
      description = argv[descIdx + 1];
    }
    return { command: 'branch', subcommand: sub, args: argv.slice(2), description };
  }

  if (argv[0] === 'history') {
    return { command: 'history' };
  }

  if (argv[0] === 'export-finetuning') {
    let domain: string | undefined;
    let minQuality: number | undefined;
    let outputPath: string | undefined;
    for (let i = 1; i < argv.length; i++) {
      if (argv[i] === '--domain' && argv[i + 1] && !argv[i + 1]?.startsWith('--')) {
        domain = argv[++i];
      } else if (argv[i] === '--min-quality' && argv[i + 1]) {
        const parsed = parseFloat(argv[++i]);
        if (!isNaN(parsed)) minQuality = parsed;
      } else if (argv[i] === '--output' && argv[i + 1] && !argv[i + 1]?.startsWith('--')) {
        outputPath = argv[++i];
      } else if (!argv[i].startsWith('--')) {
        domain = argv[i];
      }
    }
    return { command: 'export-finetuning', domain, minQuality, outputPath };
  }

  return { command: 'status' };
}

/** Execute a CLI action against the CompostMill. */
export async function execute(action: CLIAction, mill: CompostMill): Promise<void> {
  switch (action.command) {
    case 'add':
      if (action.paths.length > 0) {
        await mill.add(action.paths);
        Logger.info('CompostCLI', 'Added ' + action.paths.length + ' item(s) to heap.');
      } else {
        Logger.info('CompostCLI', 'Usage: liminal compost add <file-or-directory>...');
      }
      break;

    case 'digest': {
      Logger.info('CompostCLI', 'Starting digestion...');
      const result = await mill.digest();
      Logger.info('CompostCLI', 'Digestion complete.');
      Logger.info('CompostCLI', '  Files processed: ' + result.stats.filesProcessed);
      Logger.info('CompostCLI', '  Fragments: ' + result.stats.fragmentCount);
      Logger.info('CompostCLI', '  Collisions: ' + result.stats.collisionCount);
      Logger.info('CompostCLI', '  Seeds promoted: ' + result.stats.seedsPromoted);
      if (result.digestPath) {
        Logger.info('CompostCLI', '  Digest saved to: ' + result.digestPath);
      }
      break;
    }

    case 'soup':
      if (action.subcommand === 'start') {
        await mill.startSoup();
        Logger.info('CompostCLI', 'Soup started. Press Ctrl+C to stop.');
      } else if (action.subcommand === 'stop') {
        mill.stopSoup();
        Logger.info('CompostCLI', 'Soup stopped.');
      } else if (action.subcommand === 'status') {
        const status = await mill.statusAsync();
        Logger.info('CompostCLI', 'Soup running: ' + status.soupRunning);
        Logger.info('CompostCLI', 'Generation: ' + status.soupGeneration);
      }
      break;

    case 'seeds':
      if (action.subcommand === 'list') {
        const seeds = await mill.listSeeds();
        if (seeds.length === 0) {
          Logger.info('CompostCLI', 'No seeds yet. Run `liminal compost digest` first.');
        } else {
          Logger.info('CompostCLI', 'Seeds (' + seeds.length + '):');
          for (const seed of seeds) {
            const badge = seed.lir ? '[' + seed.lir.type + '] ' : '';
            let preview: string;
            if (seed.lir?.type === 'code') {
              const t = seed.lir;
              // Use the full signature directly — it already includes name + params
              preview = `${t.kind} ${t.signature}`;
              preview = preview.length > 60 ? preview.slice(0, 57) + '...' : preview;
            } else if (seed.lir?.type === 'doc') {
              const t = seed.lir;
              preview = `# ${t.heading} | words: ${t.metrics.wordCount}`;
            } else if (seed.lir?.type === 'text') {
              const t = seed.lir;
              const headings = t.structure.headings.map(h => h.text).join(', ') || 'text';
              preview = `${headings} | words: ${t.metrics.wordCount}`;
            } else {
              preview = seed.content.length > 60 ? seed.content.slice(0, 57) + '...' : seed.content;
            }
            Logger.info('CompostCLI', '  [' + seed.score.toFixed(1) + '] ' + badge + seed.id + ' — ' + preview.replace(/\n/g, ' '));
          }
        }
      } else if (action.subcommand === 'show') {
        const seedId = action.args?.[0];
        if (!seedId) {
          Logger.info('CompostCLI', 'Usage: liminal compost seeds show <seed-id>');
          Logger.info('CompostCLI', 'Run `liminal compost seeds list` to see available seeds.');
        } else {
          const seeds = await mill.listSeeds();
          const match = seeds.find((s: Seed) => s.id === seedId || s.id.startsWith(seedId));
          if (!match) {
            Logger.info('CompostCLI', 'Seed not found: ' + seedId);
          } else {
            Logger.info('CompostCLI', '# ' + match.id);
            Logger.info('CompostCLI', 'Score: ' + match.score);
            Logger.info('CompostCLI', 'Domains: ' + match.source.domains.join(', '));
            Logger.info('CompostCLI', 'Collision: ' + match.source.collisionType);
            Logger.info('CompostCLI', 'Promoted: ' + match.promotedAt);
            Logger.info('CompostCLI', 'Used by: ' + (match.usedBy.length > 0 ? match.usedBy.join(', ') : '(none)'));
            if (match.lir) {
              Logger.info('CompostCLI', '');
              Logger.info('CompostCLI', formatSeedForDisplay(match));
            } else {
              Logger.info('CompostCLI', '');
              Logger.info('CompostCLI', match.content);
            }
          }
        }
      }
      break;

    case 'status': {
      const status = await mill.statusAsync();
      Logger.info('CompostCLI', 'Compost Mill Status:');
      Logger.info('CompostCLI', '  Heap size: ' + status.heapSize + ' bytes');
      Logger.info('CompostCLI', '  Heap files: ' + status.heapFileCount);
      Logger.info('CompostCLI', '  Seeds: ' + status.seedCount);
      Logger.info('CompostCLI', '  Soup: ' + (status.soupRunning ? 'running' : 'stopped'));
      Logger.info('CompostCLI', '  Soup generation: ' + status.soupGeneration);

      // Show project store summary if available
      const store = mill.getProjectStore();
      if (store) {
        Logger.info('CompostCLI', '');
        Logger.info('CompostCLI', 'Project History:');
        Logger.info('CompostCLI', store.getStatusSummary().split('\n').map(l => '  ' + l).join('\n'));
      }
      break;
    }

    // ─── Event-sourced history commands ──────────────────────────────────

    case 'log': {
      const store = requireProjectStore(mill);
      if (!store) break;

      const timeline = store.getTimeline({ limit: action.limit ?? 20 });
      if (timeline.entries.length === 0) {
        Logger.info('CompostCLI', 'No events recorded yet. Run some compost operations first.');
        break;
      }

      Logger.info('CompostCLI', `Timeline (${timeline.branchName}, ${timeline.entries.length}/${timeline.totalCount}):`);
      Logger.info('CompostCLI', '─'.repeat(60));
      for (const entry of timeline.entries) {
        const time = formatTimestamp(entry.event.timestamp);
        const delta = entry.deltaMs !== null ? ` (+${formatDelta(entry.deltaMs)})` : '';
        Logger.info('CompostCLI', `  #${entry.event.id}  ${time}${delta}`);
        Logger.info('CompostCLI', `       ${entry.description}`);
      }
      Logger.info('CompostCLI', '─'.repeat(60));
      break;
    }

    case 'undo': {
      const store = requireProjectStore(mill);
      if (!store) break;

      try {
        const result = store.undo();
        Logger.info('CompostCLI', 'Undone: ' + describeEventType(result.undoneEvent.type));
        Logger.info('CompostCLI', '  Event #' + result.undoneEvent.id + ' at ' + result.undoneEvent.timestamp);
        Logger.info('CompostCLI', '  Remaining events on branch: ' + result.remainingEvents);
      } catch (err) {
        Logger.warn('CompostCLI', err instanceof Error ? err.message : 'Undo failed');
      }
      break;
    }

    case 'branch': {
      const store = requireProjectStore(mill);
      if (!store) break;

      if (action.subcommand === 'list') {
        const branches = store.listBranches();
        if (branches.length === 0) {
          Logger.info('CompostCLI', 'No branches. The main branch is always present.');
        } else {
          Logger.info('CompostCLI', 'Branches:');
          for (const branch of branches) {
            const active = branch.isActive ? ' *' : '  ';
            const desc = branch.description ? ` — ${branch.description}` : '';
            Logger.info('CompostCLI', `${active} ${branch.name} (event #${branch.eventId}, ${branch.createdAt})${desc}`);
          }
        }
      } else if (action.subcommand === 'create') {
        const name = action.args?.[0];
        if (!name) {
          Logger.info('CompostCLI', 'Usage: liminal compost branch create <name> [--description "desc"]');
          break;
        }
        try {
          const branch = store.createBranch(name, action.description);
          Logger.info('CompostCLI', `Created branch "${branch.name}" at event #${branch.eventId}`);
        } catch (err) {
          Logger.warn('CompostCLI', err instanceof Error ? err.message : 'Branch creation failed');
        }
      } else if (action.subcommand === 'switch') {
        const name = action.args?.[0];
        if (!name) {
          Logger.info('CompostCLI', 'Usage: liminal compost branch switch <name>');
          break;
        }
        try {
          store.switchBranch(name);
          Logger.info('CompostCLI', `Switched to branch "${name}"`);
        } catch (err) {
          Logger.warn('CompostCLI', err instanceof Error ? err.message : 'Branch switch failed');
        }
      } else if (action.subcommand === 'delete') {
        const name = action.args?.[0];
        if (!name) {
          Logger.info('CompostCLI', 'Usage: liminal compost branch delete <name>');
          break;
        }
        try {
          store.deleteBranch(name);
          Logger.info('CompostCLI', `Deleted branch "${name}"`);
        } catch (err) {
          Logger.warn('CompostCLI', err instanceof Error ? err.message : 'Branch delete failed');
        }
      }
      break;
    }

    case 'history': {
      const store = requireProjectStore(mill);
      if (!store) break;

      Logger.info('CompostCLI', store.getStatusSummary());
      break;
    }

    case 'export-finetuning': {
      const archive = new ArchiveLearning();
      const examples = archive.exportForFinetuning(
        action.domain,
        action.minQuality ?? 0.75,
      );

      if (examples.length === 0) {
        Logger.info('CompostCLI', 'No fine-tuning examples found matching the criteria.');
        break;
      }

      const jsonl = examples.map(e => JSON.stringify(e)).join('\n');

      if (action.outputPath) {
        const fs = await import('node:fs/promises');
        await fs.writeFile(action.outputPath, jsonl + '\n', 'utf-8');
        Logger.info('CompostCLI', `Exported ${examples.length} example(s) to ${action.outputPath}`);
      } else {
        process.stdout.write(jsonl + '\n');
      }
      break;
    }
  }
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/** Get the ProjectStore from the mill, or print an error and return undefined. */
function requireProjectStore(mill: CompostMill): ProjectStore | undefined {
  const store = mill.getProjectStore();
  if (!store) {
    Logger.warn('CompostCLI', 'Project history is not enabled. Initialize a ProjectStore to enable timeline features.');
    Logger.info('CompostCLI', 'Hint: const store = new ProjectStore({ projectRoot: cwd }); store.init();');
  }
  return store;
}

/** Format an ISO timestamp for display: "Apr 4, 14:32". */
function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()] ?? '???';
  const day = d.getDate();
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${month} ${day}, ${h}:${m}`;
}

/** Format a millisecond delta for display. */
function formatDelta(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(0)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(0)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

/** Human-readable event type name. */
function describeEventType(type: string): string {
  const names: Record<string, string> = {
    heap_add: 'Heap file addition',
    digest_start: 'Digestion start',
    digest_end: 'Digestion complete',
    seed_promote: 'Seed promotion',
    seed_prune: 'Seed pruning',
    soup_start: 'Soup start',
    soup_stop: 'Soup stop',
    soup_cycle: 'Soup cycle',
    seed_use: 'Seed usage',
  };
  return names[type] ?? type;
}
