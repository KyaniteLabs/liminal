/**
 * M14: Supply Chain Guardrail
 *
 * Audits dependencies and generates SBOM.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFile } from 'fs/promises';
import {
  GuardrailRule,
  GuardrailResult,
  ExecutionContext,
  GuardrailTier,
} from '../core/types.js';

const execFileAsync = promisify(execFile);

interface Vulnerability {
  package: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  advisory: string;
}

interface AuditResult {
  vulnerabilities: Vulnerability[];
  totalDependencies: number;
  outdatedDependencies: string[];
}

/**
 * Walk up from the current file to find the project root (directory with package.json).
 */
async function findProjectRoot(): Promise<string> {
  let current = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 20; i++) {
    try {
      await readFile(join(current, 'package.json'), 'utf8');
      return current;
    } catch {
      const parent = dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  return dirname(fileURLToPath(import.meta.url));
}

const AUDIT_TIMEOUT_MS = 30_000;

/**
 * Run npm audit programmatically.
 * Executes `npm audit --json` in the project root and parses the result.
 * Returns a safe default if npm is unavailable or the command fails.
 */
async function runNpmAudit(): Promise<AuditResult> {
  const empty: AuditResult = {
    vulnerabilities: [],
    totalDependencies: 0,
    outdatedDependencies: [],
  };

  let projectRoot: string;
  try {
    projectRoot = await findProjectRoot();
  } catch {
    return empty;
  }

  let stdout: string;
  try {
    const result = await execFileAsync(
      'npm',
      ['audit', '--json'],
      { cwd: projectRoot, timeout: AUDIT_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 },
    );
    stdout = result.stdout;
  } catch (err: unknown) {
    // npm audit exits with non-zero when vulnerabilities are found, but still
    // writes valid JSON to stdout.  If stdout contains parseable JSON, use it.
    const execErr = err as { stdout?: string };
    if (execErr.stdout) {
      stdout = execErr.stdout;
    } else {
      // npm not installed or other unrecoverable error
      return empty;
    }
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return empty;
  }

  // Extract vulnerabilities from the `vulnerabilities` map
  const vulnerabilities: Vulnerability[] = [];
  const vulnsMap = parsed.vulnerabilities as
    | Record<string, Record<string, unknown>>
    | undefined;

  if (vulnsMap && typeof vulnsMap === 'object') {
    for (const [pkgName, info] of Object.entries(vulnsMap)) {
      if (!info || typeof info !== 'object') continue;

      const severity = info.severity as string | undefined;
      const advisory = info.advisory as string | undefined;
      const title = info.title as string | undefined;

      // Some npm versions nest advisory details under `via`
      let advisoryText = advisory || title || '';
      const via = info.via as Array<Record<string, unknown>> | undefined;
      if (!advisoryText && Array.isArray(via)) {
        advisoryText = via
          .map((v) => (typeof v === 'object' && v.title ? String(v.title) : ''))
          .filter(Boolean)
          .join('; ');
      }

      const validSeverities = ['low', 'moderate', 'high', 'critical'] as const;
      const normalizedSeverity = validSeverities.includes(
        severity as (typeof validSeverities)[number],
      )
        ? (severity as Vulnerability['severity'])
        : 'low';

      vulnerabilities.push({
        package: pkgName,
        severity: normalizedSeverity,
        advisory: advisoryText || `Vulnerability in ${pkgName}`,
      });
    }
  }

  // Extract total dependency count from metadata
  let totalDependencies = 0;
  const metadata = parsed.metadata as Record<string, unknown> | undefined;
  if (metadata) {
    const deps = metadata.dependencies as Record<string, unknown> | undefined;
    if (deps) {
      const prod = typeof deps.production === 'number' ? deps.production : 0;
      const dev = typeof deps.development === 'number' ? deps.development : 0;
      totalDependencies = prod + dev;
    }
  }

  // Collect outdated / flagged dependency names
  const outdatedDependencies: string[] = [];
  if (vulnsMap) {
    for (const [pkgName, info] of Object.entries(vulnsMap)) {
      if (
        info &&
        typeof info === 'object' &&
        (info.severity === 'high' || info.severity === 'critical')
      ) {
        outdatedDependencies.push(pkgName);
      }
    }
  }

  return { vulnerabilities, totalDependencies, outdatedDependencies };
}

/**
 * Generate SBOM (Software Bill of Materials).
 * Runs `npm ls --json --all` in the project root and transforms the dependency
 * tree into a flat SBOM format.  Returns a minimal skeleton on failure.
 */
async function generateSBOM(): Promise<Record<string, unknown>> {
  const skeleton: Record<string, unknown> = {
    specVersion: '1.4',
    components: [],
  };

  let projectRoot: string;
  try {
    projectRoot = await findProjectRoot();
  } catch {
    return skeleton;
  }

  let stdout: string;
  try {
    const result = await execFileAsync(
      'npm',
      ['ls', '--json', '--all'],
      { cwd: projectRoot, timeout: AUDIT_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 },
    );
    stdout = result.stdout;
  } catch (err: unknown) {
    // npm ls exits non-zero when there are missing / extraneous deps but still
    // emits valid JSON on stdout.
    const execErr = err as { stdout?: string };
    if (execErr.stdout) {
      stdout = execErr.stdout;
    } else {
      return skeleton;
    }
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return skeleton;
  }

  // Walk the dependency tree and flatten into a component list
  const components: Array<Record<string, unknown>> = [];
  const visited = new Set<string>();

  function walkDeps(deps: Record<string, Record<string, unknown>> | undefined): void {
    if (!deps || typeof deps !== 'object') return;
    for (const [name, info] of Object.entries(deps)) {
      if (!info || typeof info !== 'object') continue;

      const version = (info.version as string) || 'unknown';
      const key = `${name}@${version}`;
      if (visited.has(key)) continue;
      visited.add(key);

      const component: Record<string, unknown> = {
        name,
        version,
      };

      const resolved = info.resolved as string | undefined;
      if (resolved) {
        component.resolved = resolved;
      }

      components.push(component);

      // Recurse into transitive dependencies
      const childDeps = info.dependencies as
        | Record<string, Record<string, unknown>>
        | undefined;
      if (childDeps) {
        walkDeps(childDeps);
      }
    }
  }

  const rootDeps = parsed.dependencies as
    | Record<string, Record<string, unknown>>
    | undefined;
  walkDeps(rootDeps);

  return {
    specVersion: '1.4',
    components,
  };
}

/**
 * M14 Supply Chain Guardrail
 */
export const SupplyChainGuardrail: GuardrailRule = {
  id: 'guardrail-m14-supply-chain',
  description: 'Audits dependencies and generates SBOM',
  tier: GuardrailTier.ADVISORY,
  category: 'compliance',

  async evaluate(_context: ExecutionContext): Promise<GuardrailResult> {
    // Run audit
    const audit = await runNpmAudit();

    // Check for critical/high vulnerabilities
    const criticalVulns = audit.vulnerabilities.filter(
      v => v.severity === 'critical' || v.severity === 'high'
    );

    if (criticalVulns.length > 0) {
      return {
        passed: false,
        guardrailId: this.id,
        severity: 'warning',
        message: `${criticalVulns.length} critical/high vulnerabilities found`,
        details: {
          vulnerabilities: criticalVulns,
          totalDependencies: audit.totalDependencies,
        },
        suggestion: 'Run npm audit fix or update dependencies',
      };
    }

    return {
      passed: true,
      guardrailId: this.id,
      message: 'Supply chain check passed',
      details: {
        totalDependencies: audit.totalDependencies,
        vulnerabilities: audit.vulnerabilities.length,
      },
    };
  },
};

export { runNpmAudit, generateSBOM };
export type { Vulnerability, AuditResult };
