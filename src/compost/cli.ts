/**
 * CLI argument parser and executor for `liminal compost` subcommands.
 */

import type { Seed } from './types.js';
import type { CompostMill } from './CompostMill.js';

export type CLIAction =
  | { command: 'add'; paths: string[] }
  | { command: 'digest' }
  | { command: 'soup'; subcommand: 'start' | 'stop' | 'status' }
  | { command: 'seeds'; subcommand: 'list' | 'show'; args?: string[] }
  | { command: 'status' };

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

  return { command: 'status' };
}

/** Execute a CLI action against the CompostMill. */
export async function execute(action: CLIAction, mill: CompostMill): Promise<void> {
  switch (action.command) {
    case 'add':
      if (action.paths.length > 0) {
        await mill.add(action.paths);
        console.log('Added ' + action.paths.length + ' item(s) to heap.');
      } else {
        console.log('Usage: liminal compost add <file-or-directory>...');
      }
      break;

    case 'digest': {
      console.log('Starting digestion...');
      const result = await mill.digest();
      console.log('Digestion complete.');
      console.log('  Files processed: ' + result.stats.filesProcessed);
      console.log('  Fragments: ' + result.stats.fragmentCount);
      console.log('  Collisions: ' + result.stats.collisionCount);
      console.log('  Seeds promoted: ' + result.stats.seedsPromoted);
      if (result.digestPath) {
        console.log('  Digest saved to: ' + result.digestPath);
      }
      break;
    }

    case 'soup':
      if (action.subcommand === 'start') {
        await mill.startSoup();
        console.log('Soup started. Press Ctrl+C to stop.');
      } else if (action.subcommand === 'stop') {
        mill.stopSoup();
        console.log('Soup stopped.');
      } else if (action.subcommand === 'status') {
        const status = await mill.statusAsync();
        console.log('Soup running: ' + status.soupRunning);
        console.log('Generation: ' + status.soupGeneration);
      }
      break;

    case 'seeds':
      if (action.subcommand === 'list') {
        const seeds = await mill.listSeeds();
        if (seeds.length === 0) {
          console.log('No seeds yet. Run `liminal compost digest` first.');
        } else {
          console.log('Seeds (' + seeds.length + '):');
          for (const seed of seeds) {
            const preview = seed.content.length > 80 ? seed.content.slice(0, 77) + '...' : seed.content;
            console.log('  [' + seed.score.toFixed(1) + '] ' + seed.id + ' — ' + preview.replace(/\n/g, ' '));
          }
        }
      } else if (action.subcommand === 'show') {
        const seedId = action.args?.[0];
        if (!seedId) {
          console.log('Usage: liminal compost seeds show <seed-id>');
          console.log('Run `liminal compost seeds list` to see available seeds.');
        } else {
          const seeds = await mill.listSeeds();
          const match = seeds.find((s: Seed) => s.id === seedId || s.id.startsWith(seedId));
          if (!match) {
            console.log('Seed not found: ' + seedId);
          } else {
            console.log('# ' + match.id);
            console.log('Score: ' + match.score);
            console.log('Domains: ' + match.source.domains.join(', '));
            console.log('Collision: ' + match.source.collisionType);
            console.log('Promoted: ' + match.promotedAt);
            console.log('Used by: ' + (match.usedBy.length > 0 ? match.usedBy.join(', ') : '(none)'));
            console.log('');
            console.log(match.content);
          }
        }
      }
      break;

    case 'status': {
      const status = await mill.statusAsync();
      console.log('Compost Mill Status:');
      console.log('  Heap size: ' + status.heapSize + ' bytes');
      console.log('  Heap files: ' + status.heapFileCount);
      console.log('  Seeds: ' + status.seedCount);
      console.log('  Soup: ' + (status.soupRunning ? 'running' : 'stopped'));
      console.log('  Soup generation: ' + status.soupGeneration);
      break;
    }
  }
}
