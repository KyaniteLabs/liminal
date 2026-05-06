#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCreativeDomainArtifact } from '../lib/creative-domain-artifact-validation.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const LAUNCH_CREATIVE_DOMAINS = ['p5', 'svg', 'glsl', 'three', 'hydra', 'strudel', 'tone', 'revideo', 'hyperframes', 'ascii', 'kinetic', 'textgen'];
const DEFAULT_RECEIPT = path.join(ROOT, '.omx/proof/domain-gauntlet-live.json');
const DEFAULT_LEDGER = path.join(ROOT, 'docs/launch/final-qa-test-surface-ledger.json');
const DEFAULT_PROOF_OUT = path.join(ROOT, '.omx/proof/final-qa-surface-gate.json');
const DEFAULT_RECEIPT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const REQUIRED_PACKAGE_SCRIPTS = {
  'typecheck': 'tsc --noEmit',
  'build': 'tsc --incremental false',
  'lint': 'eslint src/ --cache --cache-location .eslintcache',
  'check:orphans': 'bash scripts/check-orphans.sh',
  'check:script-targets': 'node scripts/ci/check-package-script-targets.mjs',
  'check:doc-links': 'node scripts/ci/check-doc-links.mjs',
  'check:examples': 'node scripts/ci/smoke-composition-examples.mjs',
  'test:quality:strict': 'node scripts/testing/test-quality-check.mjs --strict --baseline scripts/testing/test-quality-baseline.txt',
  'final-qa:test-quality': 'pnpm test:quality:strict',
  'final-qa:surface': 'node scripts/ci/final-qa-surface-gate.mjs',
  'gui:build': 'pnpm --dir gui build',
  'bubbletea:test': 'cd bubbletea && go test ./...',
  'verify:integration': 'npm run build && vitest run test/integration --coverage=false',
  'test:e2e': 'vitest run test/e2e --coverage=false',
  'test:ci:slow': 'LIMINAL_CI_SLOW=1 vitest run --pool=forks',
  'proof:live-creative-domains': 'tsx scripts/proof/live-creative-domain-execution.ts',
  'qa:creative-domains:static': 'node scripts/qa-creative-domains.mjs --no-serve',
};

const INCLUDED_SURFACES = [
  ['Root typecheck', 'pnpm typecheck'],
  ['Root build', 'pnpm build'],
  ['Root lint', 'pnpm lint'],
  ['Orphan source scan', 'pnpm check:orphans'],
  ['Package script target scan', 'pnpm check:script-targets'],
  ['Documentation link scan', 'pnpm check:doc-links'],
  ['Strict test quality', 'pnpm final-qa:test-quality'],
  ['Example smoke', 'pnpm check:examples'],
  ['GUI production build', 'pnpm gui:build'],
  ['Bubble Tea Go tests', 'pnpm bubbletea:test'],
  ['Integration suite', 'pnpm verify:integration'],
  ['Browser/e2e suite', 'pnpm test:e2e'],
  ['Slow CI suite', 'pnpm test:ci:slow'],
  ['Live creative-domain proof', 'pnpm proof:live-creative-domains'],
  ['Creative-domain QA cockpit', 'pnpm qa:creative-domains:static'],
];

const GATED_SURFACES = [
  ['Cloud provider tests', 'RUN_CLOUD_MODEL_TESTS=1 pnpm test:cloud', 'requires live provider credentials'],
  ['Live provider smoke', 'pnpm proof:live-provider-smoke', 'requires configured provider credentials'],
  ['Manual creative-domain senses pass', 'node scripts/qa-creative-domains.mjs --open', 'requires human visual/audio review'],
];

function usage() {
  return `Usage: node scripts/ci/final-qa-surface-gate.mjs [--receipt <path>] [--ledger <path>] [--proof-out <path>] [--no-write-proof]`;
}

function parseArgs(argv) {
  const options = {
    receipt: DEFAULT_RECEIPT,
    ledger: DEFAULT_LEDGER,
    proofOut: DEFAULT_PROOF_OUT,
    writeProof: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--receipt') {
      options.receipt = path.resolve(argv[++index] || '');
    } else if (arg.startsWith('--receipt=')) {
      options.receipt = path.resolve(arg.slice('--receipt='.length));
    } else if (arg === '--ledger') {
      options.ledger = path.resolve(argv[++index] || '');
    } else if (arg.startsWith('--ledger=')) {
      options.ledger = path.resolve(arg.slice('--ledger='.length));
    } else if (arg === '--proof-out') {
      options.proofOut = path.resolve(argv[++index] || '');
    } else if (arg.startsWith('--proof-out=')) {
      options.proofOut = path.resolve(arg.slice('--proof-out='.length));
    } else if (arg === '--no-write-proof') {
      options.writeProof = false;
    } else {
      throw new Error(`Unknown argument: ${arg}\n${usage()}`);
    }
  }

  return options;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readCurrentGitCommit(repoRoot) {
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

function resolveGitDir(repoRoot) {
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

function resolveCommonGitDir(gitDir) {
  const commonDir = readText(path.join(gitDir, 'commondir'))?.trim();
  return commonDir ? path.resolve(gitDir, commonDir) : gitDir;
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) files.push(full);
    }
  }
  return files.sort();
}

function relativeToRoot(filePath) {
  return path.relative(ROOT, filePath).replaceAll(path.sep, '/');
}

function stripComments(content) {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

function findPendingTests() {
  return walkFiles(path.join(ROOT, 'test/pending'))
    .filter(file => /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file))
    .map(relativeToRoot)
    .sort();
}

function findSkippedOrGatedTests() {
  const skipPattern = /\b(?:describe|it|test)\.skip(?:If)?\s*\(/;
  return walkFiles(path.join(ROOT, 'test'))
    .filter(file => /\.(?:test|spec|e2e\.test)\.[cm]?[jt]sx?$/.test(file))
    .filter(file => skipPattern.test(stripComments(fs.readFileSync(file, 'utf8'))))
    .map(relativeToRoot)
    .sort();
}

function validatePackageScripts(errors) {
  const pkg = readJson(path.join(ROOT, 'package.json'));
  for (const [scriptName, expected] of Object.entries(REQUIRED_PACKAGE_SCRIPTS)) {
    if (pkg.scripts?.[scriptName] !== expected) {
      errors.push(`Package script ${scriptName} must be '${expected}'`);
    }
  }
}

function validateLedger(ledgerPath, errors) {
  if (!fs.existsSync(ledgerPath)) {
    errors.push(`Missing final QA test surface ledger: ${relativeToRoot(ledgerPath)}`);
    return { pending: [], skipped: [], pendingCount: 0, skippedCount: 0 };
  }

  const ledger = readJson(ledgerPath);
  const pendingEntries = Array.isArray(ledger.pendingTests) ? ledger.pendingTests : [];
  const skippedEntries = Array.isArray(ledger.skippedOrGatedTests) ? ledger.skippedOrGatedTests : [];
  const pendingPaths = new Set(pendingEntries.map(entry => entry.path));
  const skippedPaths = new Set(skippedEntries.map(entry => entry.path));
  const pending = findPendingTests();
  const skipped = findSkippedOrGatedTests();

  for (const file of pending) {
    if (!pendingPaths.has(file)) errors.push(`Unclassified pending test: ${file}`);
  }
  for (const file of skipped) {
    if (!skippedPaths.has(file)) errors.push(`Unclassified skipped/gated test: ${file}`);
  }
  for (const entry of [...pendingEntries, ...skippedEntries]) {
    for (const key of ['path', 'owner', 'launchRisk', 'reason', 'action', 'verification']) {
      if (!entry[key]) errors.push(`Ledger entry missing ${key}: ${entry.path || '<unknown>'}`);
    }
  }

  return {
    pending,
    skipped,
    pendingCount: pending.length,
    skippedCount: skipped.length,
  };
}

function normalizeReceiptResults(receipt) {
  if (Array.isArray(receipt)) return receipt;
  if (Array.isArray(receipt?.domains)) return receipt.domains;
  if (Array.isArray(receipt?.results)) return receipt.results;
  if (receipt?.results && typeof receipt.results === 'object') return Object.values(receipt.results);
  return [];
}

function resolveArtifactPath(rawPath, receiptPath) {
  if (!rawPath || typeof rawPath !== 'string') return null;
  const candidates = path.isAbsolute(rawPath)
    ? [rawPath]
    : [path.resolve(ROOT, rawPath), path.resolve(path.dirname(receiptPath), rawPath)];
  return candidates.find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || null;
}

function validateLiveReceipt(receiptPath, errors) {
  if (!fs.existsSync(receiptPath)) {
    errors.push(`Missing live creative-domain receipt: ${relativeToRoot(receiptPath)}`);
    return { covered: [], missing: [...LAUNCH_CREATIVE_DOMAINS] };
  }

  const receipt = readJson(receiptPath);
  validateReceiptIntegrity(receipt, errors);
  const results = normalizeReceiptResults(receipt);
  const byDomain = new Map();
  for (const result of results) {
    const domain = String(result?.domain || result?.name || '').toLowerCase();
    if (LAUNCH_CREATIVE_DOMAINS.includes(domain)) byDomain.set(domain, result);
  }

  const covered = [];
  const missing = [];
  for (const domain of LAUNCH_CREATIVE_DOMAINS) {
    const result = byDomain.get(domain);
    const artifactPath = resolveArtifactPath(result?.artifactPath || result?.artifact || result?.html || result?.path, receiptPath);
    const statusPass = result?.status === 'pass' || result?.success === true;
    const hasBytes = Number(result?.codeBytes ?? (artifactPath ? fs.statSync(artifactPath).size : 0)) > 0;
    const artifactValidation = artifactPath ? validateCreativeDomainArtifact(domain, artifactPath, fs.readFileSync(artifactPath, 'utf8')) : null;
    const receiptValidationPass = result?.artifactValidation?.status === 'pass';
    if (result && statusPass && artifactPath && hasBytes && artifactValidation?.status === 'pass' && receiptValidationPass) {
      covered.push(domain);
    } else {
      missing.push(domain);
      if (artifactValidation?.status === 'fail') {
        errors.push(`${domain} artifact failed domain validation: ${artifactValidation.errors.join('; ')}`);
      }
      if (result && !receiptValidationPass) {
        errors.push(`${domain} receipt missing passing artifactValidation evidence`);
      }
    }
  }

  if (missing.length > 0) {
    errors.push(`Missing creative-domain live artifacts: ${missing.join(', ')}`);
  }

  return { covered, missing };
}

function validateReceiptIntegrity(receipt, errors) {
  if (!(receipt?.status === 'pass' || receipt?.ready === true)) {
    errors.push(`Live creative-domain receipt status ${String(receipt?.status ?? receipt?.ready ?? 'unknown')} is not pass`);
  }

  if (receipt?.mode !== 'live-execution') {
    errors.push(`Live creative-domain receipt mode ${String(receipt?.mode ?? 'missing')} is not live-execution`);
  }

  if (typeof receipt?.generatedAt !== 'string') {
    errors.push('Live creative-domain receipt missing generatedAt');
  } else {
    const generatedAt = Date.parse(receipt.generatedAt);
    if (Number.isNaN(generatedAt)) {
      errors.push('Live creative-domain receipt generatedAt is unreadable');
    } else if (Date.now() - generatedAt > DEFAULT_RECEIPT_MAX_AGE_MS) {
      errors.push(`Live creative-domain receipt is stale (${receipt.generatedAt})`);
    } else if (generatedAt - Date.now() > 5 * 60 * 1000) {
      errors.push(`Live creative-domain receipt generatedAt is in the future (${receipt.generatedAt})`);
    }
  }

  const gitCommit = readCurrentGitCommit(ROOT);
  if (!gitCommit) {
    errors.push('Current git commit unavailable for live creative-domain receipt validation');
  } else if (typeof receipt?.gitCommit !== 'string' || receipt.gitCommit.length === 0) {
    errors.push('Live creative-domain receipt missing gitCommit');
  } else if (receipt.gitCommit !== gitCommit) {
    errors.push(`Live creative-domain receipt gitCommit ${receipt.gitCommit} does not match current ${gitCommit}`);
  }

  if (typeof receipt?.provider !== 'string' || receipt.provider.trim().length === 0) {
    errors.push('Live creative-domain receipt missing provider');
  }
  if (typeof receipt?.model !== 'string' || receipt.model.trim().length === 0) {
    errors.push('Live creative-domain receipt missing model');
  }
}

function printReport({ ledgerResult, receiptResult }) {
  console.log('Included surfaces');
  for (const [label, command] of INCLUDED_SURFACES) {
    console.log(`- ${label}: ${command}`);
  }
  console.log('');
  console.log('Excluded/gated surfaces');
  for (const [label, command, reason] of GATED_SURFACES) {
    console.log(`- ${label}: ${command} (${reason})`);
  }
  console.log('');
  console.log(`Creative domains: ${receiptResult.covered.length}/${LAUNCH_CREATIVE_DOMAINS.length} covered`);
  console.log(`Pending tests classified: ${ledgerResult.pendingCount}/${ledgerResult.pendingCount}`);
  console.log(`Skipped/gated tests classified: ${ledgerResult.skippedCount}/${ledgerResult.skippedCount}`);
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(usage());
    return;
  }

  const errors = [];
  validatePackageScripts(errors);
  const ledgerResult = validateLedger(options.ledger, errors);
  const receiptResult = validateLiveReceipt(options.receipt, errors);
  const passed = errors.length === 0;

  printReport({ ledgerResult, receiptResult });

  const proof = {
    contract: 'liminal-final-qa-surface-gate-v1',
    generatedAt: new Date().toISOString(),
    passed,
    includedSurfaces: INCLUDED_SURFACES.map(([label, command]) => ({ label, command })),
    gatedSurfaces: GATED_SURFACES.map(([label, command, reason]) => ({ label, command, reason })),
    launchCreativeDomains: LAUNCH_CREATIVE_DOMAINS,
    coveredCreativeDomains: receiptResult.covered,
    missingCreativeDomains: receiptResult.missing,
    pendingTestsClassified: ledgerResult.pendingCount,
    skippedOrGatedTestsClassified: ledgerResult.skippedCount,
    errors,
  };

  if (options.writeProof) {
    fs.mkdirSync(path.dirname(options.proofOut), { recursive: true });
    fs.writeFileSync(options.proofOut, `${JSON.stringify(proof, null, 2)}\n`);
    console.log(`Proof: ${options.proofOut}`);
  }

  if (!passed) {
    for (const error of errors) console.error(error);
    process.exit(1);
  }
}

main();
