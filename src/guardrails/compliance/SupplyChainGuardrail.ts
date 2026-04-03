/**
 * M14: Supply Chain Guardrail
 *
 * Audits dependencies and generates SBOM.
 */

import {
  GuardrailRule,
  GuardrailResult,
  ExecutionContext,
  GuardrailTier,
} from '../core/types.js';

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
 * Run npm audit programmatically
 * NOTE: This is a stub that will be implemented with actual npm audit integration
 */
async function runNpmAudit(): Promise<AuditResult> {
  // STUB: Will integrate with npm audit API
  // For now, return empty result (green phase will implement)
  return {
    vulnerabilities: [],
    totalDependencies: 0,
    outdatedDependencies: [],
  };
}

/**
 * Generate SBOM (Software Bill of Materials)
 * NOTE: This is a stub that will be implemented
 */
async function generateSBOM(): Promise<Record<string, unknown>> {
  // STUB: Will integrate with npm sbom or spdx-sbom-generator
  return {
    specVersion: '1.4',
    components: [],
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
