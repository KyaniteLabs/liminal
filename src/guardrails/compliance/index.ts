/**
 * M12-M18 Compliance Guardrails
 *
 * Enterprise-grade guardrails for production deployments.
 */

export {
  PrivacyGuardrail,
  detectPII,
  anonymizePII,
} from './PrivacyGuardrail.js';

export {
  InjectionGuardrail,
  detectInjection,
} from './InjectionGuardrail.js';

export {
  SupplyChainGuardrail,
  runNpmAudit,
  generateSBOM,
} from './SupplyChainGuardrail.js';

export {
  AuditGuardrail,
  addAuditEntry,
  verifyAuditChain,
  getAuditLog,
} from './AuditGuardrail.js';

export {
  FairnessGuardrail,
  calculateDiversity,
  recordOutput,
} from './FairnessGuardrail.js';

export {
  ExplainabilityGuardrail,
  recordDecision,
  getDecisionTrace,
  generateAttribution,
} from './ExplainabilityGuardrail.js';

export {
  ResilienceGuardrail,
  getCircuitBreaker,
  recordFailure,
  recordSuccess,
  canExecute,
} from './ResilienceGuardrail.js';
