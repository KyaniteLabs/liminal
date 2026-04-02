/**
 * M15: Audit & Compliance Guardrail
 *
 * Non-repudiable operation logging with append-only log chain.
 */

import {
  GuardrailRule,
  GuardrailResult,
  ExecutionContext,
  GuardrailTier,
} from '../core/types.js';
import { createHash } from 'node:crypto';

interface AuditEntry {
  timestamp: number;
  operation: string;
  taskId: string;
  user?: string;
  hash: string;
  prevHash: string | null;
  data: Record<string, unknown>;
}

// In-memory log chain (will be file-based in production)
let auditLog: AuditEntry[] = [];

/**
 * Calculate hash for audit entry
 */
function calculateHash(entry: Omit<AuditEntry, 'hash'>): string {
  const data = JSON.stringify(entry);
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Add entry to audit log
 */
async function addAuditEntry(
  operation: string,
  taskId: string,
  data: Record<string, unknown>,
  user?: string
): Promise<AuditEntry> {
  const prevEntry = auditLog[auditLog.length - 1];
  const prevHash = prevEntry ? prevEntry.hash : null;

  const entry: AuditEntry = {
    timestamp: Date.now(),
    operation,
    taskId,
    user,
    prevHash,
    hash: '', // Will be calculated
    data,
  };

  entry.hash = calculateHash(entry);
  auditLog.push(entry);

  return entry;
}

/**
 * Verify audit chain integrity
 */
async function verifyAuditChain(): Promise<boolean> {
  for (let i = 1; i < auditLog.length; i++) {
    const entry = auditLog[i];
    const prevEntry = auditLog[i - 1];

    if (entry.prevHash !== prevEntry.hash) {
      return false;
    }

    // Verify entry hash
    const { hash, ...entryWithoutHash } = entry;
    const calculatedHash = calculateHash(entryWithoutHash);
    if (calculatedHash !== hash) {
      return false;
    }
  }

  return true;
}

/**
 * Get audit log for a task
 */
async function getAuditLog(taskId: string): Promise<AuditEntry[]> {
  return auditLog.filter(entry => entry.taskId === taskId);
}

/**
 * M15 Audit & Compliance Guardrail
 */
export const AuditGuardrail: GuardrailRule = {
  id: 'guardrail-m15-audit',
  description: 'Non-repudiable operation logging',
  tier: GuardrailTier.ENFORCING,
  category: 'compliance',

  async evaluate(context: ExecutionContext): Promise<GuardrailResult> {
    // Log this operation
    await addAuditEntry(
      'guardrail-evaluation',
      context.taskId,
      {
        step: context.step,
        resources: context.resources,
        tools: context.allowedTools,
      }
    );

    // Verify chain integrity periodically (every 10 entries)
    if (auditLog.length % 10 === 0) {
      const valid = await verifyAuditChain();
      if (!valid) {
        return {
          passed: false,
          guardrailId: this.id,
          severity: 'critical',
          message: 'Audit chain integrity check failed',
          suggestion: 'Investigate log tampering',
        };
      }
    }

    return {
      passed: true,
      guardrailId: this.id,
      message: 'Audit logged successfully',
      details: {
        logEntries: auditLog.length,
        taskId: context.taskId,
      },
    };
  },
};

export { addAuditEntry, verifyAuditChain, getAuditLog };
export type { AuditEntry };
