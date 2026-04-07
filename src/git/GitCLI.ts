/**
 * GitCLI — CLI handler for `liminal git <subcommand>`
 *
 * Routes subcommands to GitService:
 *   liminal git status              — Working tree status
 *   liminal git log [N]             — Last N commits
 *   liminal git diff [from] [to]    — Diff between refs
 *   liminal git branch [name]       — List or create branches
 *   liminal git commit <message>    — Manual commit
 *   liminal git init                — Initialize repo
 *   liminal git timeline [project]  — Unified git+compost timeline
 */

import { GitService } from './GitService.js';

const HELP_TEXT = `
Git integration for Liminal

USAGE:
  liminal git <subcommand> [options]

SUBCOMMANDS:
  status                  Show working tree status
  log [N]                 Show last N commits (default: 10)
  diff [from] [to]        Diff between refs (defaults to HEAD vs working)
  branch [name]           List branches, or create a new one
  commit <message>        Stage all and commit
  init                    Initialize a git repo in the gallery directory
  timeline [project]      Unified git + compost timeline

EXAMPLES:
  liminal git status
  liminal git log 5
  liminal git diff HEAD~3 HEAD
  liminal git branch liminal/experiment-1
  liminal git commit "save iteration 3"
  liminal git init
`.trim();

export async function handleGitCommand(subcmd: string | undefined, args: string[]): Promise<void> {
  const git = new GitService();

  if (!subcmd || subcmd === 'help' || subcmd === '--help') {
    console.log(HELP_TEXT);
    return;
  }

  // Ensure we're in a git repo for most commands
  if (subcmd !== 'init') {
    const isRepo = await git.isRepo();
    if (!isRepo) {
      console.error('Not a git repository. Run `liminal git init` first.');
      process.exit(1);
    }
  }

  switch (subcmd) {
    case 'init':
      await handleInit(git);
      break;
    case 'status':
      await handleStatus(git);
      break;
    case 'log':
      await handleLog(git, args);
      break;
    case 'diff':
      await handleDiff(git, args);
      break;
    case 'branch':
      await handleBranch(git, args);
      break;
    case 'commit':
      await handleCommit(git, args);
      break;
    case 'timeline':
      await handleTimeline(git, args);
      break;
    default:
      console.error(`Unknown git subcommand: ${subcmd}`);
      console.log(HELP_TEXT);
      process.exit(1);
  }
}

async function handleInit(git: GitService): Promise<void> {
  await git.init();
  console.log('Initialized git repository');
}

async function handleStatus(git: GitService): Promise<void> {
  const status = await git.status();

  const branch = status.current;
  console.log(`On branch ${branch}`);

  if (status.isClean()) {
    console.log('Working tree clean');
    return;
  }

  if (status.staged.length > 0) {
    console.log('\nStaged:');
    for (const f of status.staged) {
      console.log(`  + ${f}`);
    }
  }
  if (status.modified.length > 0) {
    console.log('\nModified:');
    for (const f of status.modified) {
      console.log(`  M ${f}`);
    }
  }
  if (status.not_added.length > 0) {
    console.log('\nUntracked:');
    for (const f of status.not_added) {
      console.log(`  ? ${f}`);
    }
  }
  if (status.deleted.length > 0) {
    console.log('\nDeleted:');
    for (const f of status.deleted) {
      console.log(`  D ${f}`);
    }
  }
}

async function handleLog(git: GitService, args: string[]): Promise<void> {
  const count = parseInt(args[0] ?? '10', 10);
  const commits = await git.log({ maxCount: count });

  if (commits.length === 0) {
    console.log('No commits yet');
    return;
  }

  for (const c of commits) {
    const short = c.hash.slice(0, 7);
    console.log(`${short} ${c.date.slice(0, 10)} ${c.message}`);
  }
}

async function handleDiff(git: GitService, args: string[]): Promise<void> {
  const from = args[0] ?? undefined;
  const to = args[1] ?? undefined;
  const diff = await git.diff(from, to);

  if (diff.filesChanged === 0) {
    console.log('No differences');
    return;
  }

  console.log(`${diff.from}..${diff.to}: ${diff.filesChanged} files, +${diff.insertions}/-${diff.deletions}`);
  console.log('');
  for (const f of diff.files) {
    const indicator = f.binary ? '(binary)' : `+${f.insertions}/-${f.deletions}`;
    console.log(`  ${f.path} ${indicator}`);
  }
}

async function handleBranch(git: GitService, args: string[]): Promise<void> {
  if (args.length === 0) {
    // List branches
    const branches = await git.listBranches();
    for (const b of branches) {
      const marker = b.current ? '* ' : '  ';
      console.log(`${marker}${b.name}`);
    }
  } else {
    // Create branch
    const name = args[0];
    const info = await git.branch(name);
    console.log(`Created and switched to branch: ${info.name}`);
  }
}

async function handleCommit(git: GitService, args: string[]): Promise<void> {
  const message = args[0];
  if (!message) {
    console.error('Commit message required: liminal git commit "your message"');
    process.exit(1);
  }

  const commit = await git.addAllAndCommit(message);
  console.log(`Committed: ${commit.hash.slice(0, 7)} ${commit.message}`);
}

async function handleTimeline(git: GitService, _args: string[]): Promise<void> {
  // Timeline requires CompostBridge which needs EventStore — optional feature
  // For now, show git log in a timeline format
  const commits = await git.log({ maxCount: 20 });

  if (commits.length === 0) {
    console.log('No history yet');
    return;
  }

  console.log('Git Timeline:');
  console.log('');
  for (const c of commits) {
    const short = c.hash.slice(0, 7);
    const date = c.date.slice(0, 19);
    console.log(`  ${date}  ${short}  ${c.message}`);
  }
  console.log('');
  console.log('(Full compost+git timeline requires compost integration — use CompostBridge)');
}
