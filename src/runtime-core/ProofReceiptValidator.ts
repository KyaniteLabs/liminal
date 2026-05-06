import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_RECEIPT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

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
}

interface ReceiptLike {
  status?: unknown;
  ready?: unknown;
  mode?: unknown;
  generatedAt?: unknown;
  gitCommit?: unknown;
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

export function validateProofReceipt(
  repoRoot: string,
  receipt: ReceiptLike,
  options: ProofReceiptValidationOptions = {},
): ProofReceiptValidationResult {
  const failures: string[] = [];
  const gitCommit = readCurrentGitCommit(repoRoot);
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

  if (!gitCommit) {
    failures.push('current git commit unavailable');
  } else if (typeof receipt.gitCommit !== 'string' || receipt.gitCommit.length === 0) {
    failures.push('missing gitCommit');
  } else if (receipt.gitCommit !== gitCommit) {
    failures.push(`gitCommit ${receipt.gitCommit} does not match current ${gitCommit}`);
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

  return { ok: failures.length === 0, failures, gitCommit };
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
