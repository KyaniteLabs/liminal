import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

export const DEFAULT_RECEIPT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const DEFAULT_SOURCE_FINGERPRINT_EXCLUDES = ['.omx/proof/'];

export interface ProofReceiptValidationOptions {
  requiredMode?: string;
  requireProviderModel?: boolean;
  requireArtifactPaths?: boolean;
  requireCaseCoverage?: boolean;
  maxAgeMs?: number;
}

export interface ProofReceiptValidationResult {
  ok: boolean;
  failures: string[];
  gitCommit: string | null;
  sourceFingerprint: string | null;
}

interface ReceiptLike {
  status?: unknown;
  ready?: unknown;
  mode?: unknown;
  generatedAt?: unknown;
  gitCommit?: unknown;
  sourceFingerprint?: unknown;
  provider?: unknown;
  model?: unknown;
  artifactPath?: unknown;
  artifactPaths?: unknown;
  domains?: unknown;
  results?: unknown;
  caseCoverage?: unknown;
}

export function readCurrentGitCommit(repoRoot: string): string | null {
  const gitDir = resolveGitDir(repoRoot);
  if (!gitDir) return null;

  const headPath = path.join(gitDir, 'HEAD');
  const head = readText(headPath)?.trim();
  if (!head) return null;
  if (/^[0-9a-f]{40}$/i.test(head)) return head;

  const refPrefix = 'ref: ';
  if (!head.startsWith(refPrefix)) return null;
  const refName = head.slice(refPrefix.length).trim();
  const directRef = readText(path.join(gitDir, refName))?.trim();
  if (directRef && /^[0-9a-f]{40}$/i.test(directRef)) return directRef;

  const commonDir = resolveCommonGitDir(gitDir);
  const commonRef = commonDir ? readText(path.join(commonDir, refName))?.trim() : null;
  if (commonRef && /^[0-9a-f]{40}$/i.test(commonRef)) return commonRef;

  const packedRefs = commonDir ? readText(path.join(commonDir, 'packed-refs')) : readText(path.join(gitDir, 'packed-refs'));
  const packed = packedRefs
    ?.split('\n')
    .map(line => line.trim())
    .find(line => line.endsWith(` ${refName}`))
    ?.split(' ')[0];
  return packed && /^[0-9a-f]{40}$/i.test(packed) ? packed : null;
}

export function computeProofSourceFingerprint(
  repoRoot: string,
  excludedPathPrefixes: string[] = DEFAULT_SOURCE_FINGERPRINT_EXCLUDES,
): string | null {
  const files = listGitSourceFiles(repoRoot)
    ?.map(normalizeRepoPath)
    .filter(file => file.length > 0 && !isExcludedProofPath(file, excludedPathPrefixes))
    .sort();
  if (!files) return null;

  const hash = createHash('sha256');
  for (const file of files) {
    const fullPath = path.join(repoRoot, file);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(fullPath);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;
    hash.update('path\0');
    hash.update(file);
    hash.update('\0content\0');
    hash.update(fs.readFileSync(fullPath));
    hash.update('\0');
  }
  return `sha256:${hash.digest('hex')}`;
}

export function readProofSubjectGitCommit(
  repoRoot: string,
  excludedPathPrefixes: string[] = DEFAULT_SOURCE_FINGERPRINT_EXCLUDES,
): string | null {
  const head = readCurrentGitCommit(repoRoot);
  if (!head) return null;

  let commit = head;
  for (let depth = 0; depth < 200; depth += 1) {
    const parents = gitOutput(repoRoot, ['show', '-s', '--format=%P', commit])?.trim().split(/\s+/).filter(Boolean) ?? [];
    const firstParent = parents[0];
    if (!firstParent) return commit;

    const changedPaths = gitOutput(repoRoot, ['diff', '--name-only', firstParent, commit])
      ?.split('\n')
      .map(normalizeRepoPath)
      .filter(Boolean);
    if (!changedPaths) return head;
    if (changedPaths.some(file => !isExcludedProofPath(file, excludedPathPrefixes))) return commit;
    commit = firstParent;
  }

  return head;
}

export function validateProofReceipt(
  repoRoot: string,
  receipt: ReceiptLike,
  options: ProofReceiptValidationOptions = {},
): ProofReceiptValidationResult {
  const failures: string[] = [];
  const gitCommit = readCurrentGitCommit(repoRoot);
  const proofSubjectCommit = readProofSubjectGitCommit(repoRoot);
  const sourceFingerprint = computeProofSourceFingerprint(repoRoot);
  const maxAgeMs = options.maxAgeMs ?? DEFAULT_RECEIPT_MAX_AGE_MS;

  if (!(receipt.status === 'pass' || receipt.ready === true)) {
    failures.push(`receipt status ${String(receipt.status ?? receipt.ready ?? 'unknown')} is not pass`);
  }

  if (options.requiredMode && receipt.mode !== options.requiredMode) {
    failures.push(`mode ${String(receipt.mode ?? 'missing')} does not match ${options.requiredMode}`);
  }

  if (typeof receipt.generatedAt !== 'string') {
    failures.push('missing generatedAt');
  } else {
    const generatedAt = Date.parse(receipt.generatedAt);
    if (Number.isNaN(generatedAt)) {
      failures.push('generatedAt is unreadable');
    } else if (Date.now() - generatedAt > maxAgeMs) {
      failures.push(`receipt is stale (${receipt.generatedAt})`);
    } else if (generatedAt - Date.now() > 5 * 60 * 1000) {
      failures.push(`receipt generatedAt is in the future (${receipt.generatedAt})`);
    }
  }

  if (typeof receipt.sourceFingerprint === 'string' && receipt.sourceFingerprint.length > 0) {
    if (!sourceFingerprint) {
      failures.push('current source fingerprint unavailable');
    } else if (receipt.sourceFingerprint !== sourceFingerprint) {
      failures.push(`sourceFingerprint ${receipt.sourceFingerprint} does not match current ${sourceFingerprint}`);
    }
  } else if (!proofSubjectCommit) {
    failures.push('current proof subject git commit unavailable');
  } else if (typeof receipt.gitCommit !== 'string' || receipt.gitCommit.length === 0) {
    failures.push('missing gitCommit');
  } else if (receipt.gitCommit !== proofSubjectCommit) {
    failures.push(`gitCommit ${receipt.gitCommit} does not match current proof subject ${proofSubjectCommit}`);
  }

  if (options.requireProviderModel) {
    if (typeof receipt.provider !== 'string' || receipt.provider.trim().length === 0) failures.push('missing provider');
    if (typeof receipt.model !== 'string' || receipt.model.trim().length === 0) failures.push('missing model');
  }

  if (options.requireArtifactPaths) {
    const artifactPaths = collectArtifactPaths(receipt);
    if (artifactPaths.length === 0) {
      failures.push('missing artifactPath');
    }
    for (const artifactPath of artifactPaths) {
      if (!fs.existsSync(path.resolve(repoRoot, artifactPath))) {
        failures.push(`artifact missing: ${artifactPath}`);
      }
    }
  }

  if (options.requireCaseCoverage) {
    const coverage = receipt.caseCoverage;
    if (!coverage || typeof coverage !== 'object') {
      failures.push('missing caseCoverage');
    } else {
      const fields = coverage as { complete?: unknown; assignmentCount?: unknown; fallbackProvenanceCount?: unknown };
      if (fields.complete !== true) failures.push('caseCoverage.complete is not true');
      if (typeof fields.assignmentCount !== 'number' || fields.assignmentCount <= 0) failures.push('caseCoverage.assignmentCount missing');
      if (typeof fields.fallbackProvenanceCount !== 'number' || fields.fallbackProvenanceCount <= 0) failures.push('caseCoverage.fallbackProvenanceCount missing');
    }
  }

  return { ok: failures.length === 0, failures, gitCommit, sourceFingerprint };
}

function listGitSourceFiles(repoRoot: string): string[] | null {
  return gitOutput(repoRoot, ['ls-files', '--cached', '--others', '--exclude-standard'])
    ?.split('\n')
    .filter(Boolean) ?? null;
}

function gitOutput(repoRoot: string, args: string[]): string | null {
  try {
    return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

function normalizeRepoPath(filePath: string): string {
  return filePath.trim().replaceAll(path.sep, '/');
}

function isExcludedProofPath(filePath: string, excludedPathPrefixes: string[]): boolean {
  return excludedPathPrefixes.some(prefix => filePath === prefix.replace(/\/$/, '') || filePath.startsWith(prefix));
}

function collectArtifactPaths(receipt: ReceiptLike): string[] {
  const paths: string[] = [];
  if (typeof receipt.artifactPath === 'string') paths.push(receipt.artifactPath);
  if (Array.isArray(receipt.artifactPaths)) {
    for (const item of receipt.artifactPaths) {
      if (typeof item === 'string') paths.push(item);
    }
  }
  for (const collection of [receipt.domains, receipt.results]) {
    if (!Array.isArray(collection)) continue;
    for (const item of collection) {
      if (item && typeof item === 'object' && typeof (item as { artifactPath?: unknown }).artifactPath === 'string') {
        paths.push((item as { artifactPath: string }).artifactPath);
      }
    }
  }
  return [...new Set(paths)];
}

function resolveGitDir(repoRoot: string): string | null {
  const dotGit = path.join(repoRoot, '.git');
  if (!fs.existsSync(dotGit)) return null;
  const stat = fs.statSync(dotGit);
  if (stat.isDirectory()) return dotGit;
  const content = readText(dotGit)?.trim();
  const prefix = 'gitdir: ';
  if (!content?.startsWith(prefix)) return null;
  const gitDir = content.slice(prefix.length).trim();
  return path.resolve(repoRoot, gitDir);
}

function resolveCommonGitDir(gitDir: string): string | null {
  const commonDir = readText(path.join(gitDir, 'commondir'))?.trim();
  return commonDir ? path.resolve(gitDir, commonDir) : gitDir;
}

function readText(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}
