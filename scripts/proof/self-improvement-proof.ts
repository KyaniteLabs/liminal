#!/usr/bin/env tsx
/**
 * Self-improvement proof runner.
 *
 * Proves the bounded self-improvement runtime prepares deterministic task
 * packets with localized files, verification targets, and completion policy.
 * This does not mutate source code or execute an LLM agent.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { LLMModeSelfImprovementRuntime } from '../../src/runtime-core/SelfImprovementRuntime.js';

const outputRoot = process.argv.find(arg => arg.startsWith('--out='))?.slice('--out='.length)
  || path.join('.omx', 'proof', 'self-improvement');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.join(outputRoot, timestamp);

const descriptions = [
  'Tighten the bounded runtime-core self-improvement facade',
  'Add a checkpoint resume proof for workspace fingerprint drift',
  'Tighten RepoIndexLite task packet shaping and expansion budget determinism',
];

const runtime = new LLMModeSelfImprovementRuntime();
const llm = {
  getConfig: () => ({ model: 'proof-local-model' }),
} as any;

const prepared = descriptions.map(description => {
  const run = runtime.prepare({ llm, description });
  return {
    description,
    taskId: run.taskId,
    modelName: run.modelName,
    maxSteps: run.maxSteps,
    task: {
      title: run.task.title,
      fileHint: run.task.fileHint,
      workingSet: run.task.workingSet,
      primaryFiles: run.task.primaryFiles,
      secondaryFiles: run.task.secondaryFiles,
      deferredSecondaryFiles: run.task.deferredSecondaryFiles,
      expansionBudget: run.task.expansionBudget,
      expansionStatus: run.task.expansionStatus,
      localizationConfidence: run.task.localizationConfidence,
      verificationTargets: run.task.verificationTargets,
      domain: run.task.domain,
      approved: run.task.approved,
      completionPolicy: run.task.completionPolicy,
      descriptionIncludesPacket: run.task.description.includes('## Deterministic Task Packet'),
    },
  };
});

const report = {
  generatedAt: new Date().toISOString(),
  outputDir: outDir,
  summary: {
    passed: prepared.every(item =>
      item.task.descriptionIncludesPacket
      && item.task.approved === true
      && item.task.completionPolicy === 'stop_after_verification'
      && item.task.workingSet.length > 0
      && item.task.verificationTargets.length > 0
      && item.task.workingSet[0] === item.task.fileHint,
    ),
    preparedRuns: prepared.length,
  },
  prepared,
};

function markdown(): string {
  return [
    '# Self-Improvement Proof Report',
    '',
    `Generated: ${report.generatedAt}`,
    `Output dir: ${outDir}`,
    '',
    `Summary: ${report.summary.passed ? 'pass' : 'fail'}`,
    '',
    '| Description | Domain | File hint | Working set | Verification targets | Policy |',
    '| --- | --- | --- | --- | --- | --- |',
    ...prepared.map(item => `| ${item.description} | ${item.task.domain} | ${item.task.fileHint} | ${item.task.workingSet.join(', ')} | ${item.task.verificationTargets.map((target: any) => `${target.tool}${target.pattern ? `:${target.pattern}` : ''}`).join(', ')} | ${item.task.completionPolicy} |`),
    '',
    '## Notes',
    '',
    '- This proof validates deterministic self-improvement task preparation without mutating source code.',
    '- It does not claim a live LLM self-improvement edit was performed.',
  ].join('\n');
}

await fs.mkdir(outDir, { recursive: true });
await fs.writeFile(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
await fs.writeFile(path.join(outDir, 'report.md'), markdown(), 'utf8');
console.log(path.join(outDir, 'report.md'));
process.exit(report.summary.passed ? 0 : 1);
