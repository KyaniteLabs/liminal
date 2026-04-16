/**
 * Unit tests for src/ledger/cli.ts — parseArgs function
 *
 * Tests the pure parseArgs function with all subcommand variants.
 * Does NOT mock LiminalFS or TaskLedger — only tests argument parsing.
 */

import { describe, it, expect } from 'vitest';
import { parseArgs } from '../../../src/ledger/cli.js';

describe('ledger parseArgs', () => {
  it('parses "list" with no options', () => {
    const result = parseArgs(['list']);
    expect(result).toEqual({ command: 'list' });
  });

  it('parses "list --lane 2"', () => {
    const result = parseArgs(['list', '--lane', '2']);
    expect(result).toEqual({ command: 'list', lane: 2 });
  });

  it('parses "list --lane" with missing value as undefined lane', () => {
    const result = parseArgs(['list', '--lane']);
    expect(result).toEqual({ command: 'list' });
  });

  it('parses "show L001"', () => {
    const result = parseArgs(['show', 'L001']);
    expect(result).toEqual({ command: 'show', taskId: 'L001' });
  });

  it('parses "show" with no taskId as empty string', () => {
    const result = parseArgs(['show']);
    expect(result).toEqual({ command: 'show', taskId: '' });
  });

  it('parses "run L001"', () => {
    const result = parseArgs(['run', 'L001']);
    expect(result).toEqual({ command: 'run', taskId: 'L001', dryRun: false });
  });

  it('parses "run L001 --dry-run"', () => {
    const result = parseArgs(['run', 'L001', '--dry-run']);
    expect(result).toEqual({ command: 'run', taskId: 'L001', dryRun: true });
  });

  it('parses "verify L001"', () => {
    const result = parseArgs(['verify', 'L001']);
    expect(result).toEqual({ command: 'verify', taskId: 'L001' });
  });

  it('parses "accept L001 cand-001"', () => {
    const result = parseArgs(['accept', 'L001', 'cand-001']);
    expect(result).toEqual({ command: 'accept', taskId: 'L001', candidateId: 'cand-001' });
  });

  it('parses "reject L001 cand-001"', () => {
    const result = parseArgs(['reject', 'L001', 'cand-001']);
    expect(result).toEqual({ command: 'reject', taskId: 'L001', candidateId: 'cand-001', reason: undefined });
  });

  it('parses "reject L001 cand-001 --reason bad"', () => {
    const result = parseArgs(['reject', 'L001', 'cand-001', '--reason', 'bad']);
    expect(result).toEqual({ command: 'reject', taskId: 'L001', candidateId: 'cand-001', reason: 'bad' });
  });

  it('parses "load ./tasks.json"', () => {
    const result = parseArgs(['load', './tasks.json']);
    expect(result).toEqual({ command: 'load', path: './tasks.json' });
  });

  it('returns "status" for empty args', () => {
    const result = parseArgs([]);
    expect(result).toEqual({ command: 'status', verbose: false });
  });

  it('strips leading "ledger" prefix', () => {
    const result = parseArgs(['ledger', 'list']);
    expect(result).toEqual({ command: 'list' });
  });

  it('strips "ledger" prefix and parses --lane', () => {
    const result = parseArgs(['ledger', 'list', '--lane', '3']);
    expect(result).toEqual({ command: 'list', lane: 3 });
  });

  it('returns "status" for unknown subcommand', () => {
    const result = parseArgs(['unknown']);
    expect(result).toEqual({ command: 'status', verbose: false });
  });

  it('returns "status" with verbose flag', () => {
    const result = parseArgs(['status', '--verbose']);
    expect(result).toEqual({ command: 'status', verbose: true });
  });

  // Phase 10 commands
  it('parses "intake" with no options', () => {
    const result = parseArgs(['intake']);
    expect(result).toEqual({ command: 'intake', coveragePath: undefined, outputPath: undefined, minTasks: undefined });
  });

  it('parses "intake --coverage cov.json --output out.json --min 10"', () => {
    const result = parseArgs(['intake', '--coverage', 'cov.json', '--output', 'out.json', '--min', '10']);
    expect(result).toEqual({ command: 'intake', coveragePath: 'cov.json', outputPath: 'out.json', minTasks: 10 });
  });

  it('parses "batch" with no options', () => {
    const result = parseArgs(['batch']);
    expect(result).toEqual({ command: 'batch', maxTasks: undefined, dryRun: false });
  });

  it('parses "batch --dry-run"', () => {
    const result = parseArgs(['batch', '--dry-run']);
    expect(result).toEqual({ command: 'batch', maxTasks: undefined, dryRun: true });
  });

  it('parses "batch --max-tasks 5"', () => {
    const result = parseArgs(['batch', '--max-tasks', '5']);
    expect(result).toEqual({ command: 'batch', maxTasks: 5, dryRun: false });
  });

  it('parses "batch --max-tasks 10 --dry-run"', () => {
    const result = parseArgs(['batch', '--max-tasks', '10', '--dry-run']);
    expect(result).toEqual({ command: 'batch', maxTasks: 10, dryRun: true });
  });

  it('parses "dashboard" with no options', () => {
    const result = parseArgs(['dashboard']);
    expect(result).toEqual({ command: 'dashboard', format: undefined });
  });

  it('parses "dashboard --format json"', () => {
    const result = parseArgs(['dashboard', '--format', 'json']);
    expect(result).toEqual({ command: 'dashboard', format: 'json' });
  });
});
