import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';

function resolveCommonGitDir(): string | null {
  try {
    const output = execFileSync('git', ['rev-parse', '--git-common-dir'], {
      cwd: process.cwd(),
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return path.resolve(process.cwd(), output);
  } catch {
    return null;
  }
}

export function resolveSharedRepoRoot(): string {
  const commonGitDir = resolveCommonGitDir();
  if (!commonGitDir) return process.cwd();
  return path.dirname(commonGitDir);
}

export function defaultJCodeRepo(): string {
  const root = resolveSharedRepoRoot();
  const digest = createHash('sha1').update(root).digest('hex').slice(0, 8);
  return `local/${path.basename(root)}-${digest}`;
}

export function defaultJDocRepo(): string {
  return `local/${path.basename(resolveSharedRepoRoot())}`;
}
