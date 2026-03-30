/**
 * Security event logging for monitoring and alerting
 */

import { Logger } from '../utils/Logger.js';

export type SecurityEventType = 
  | 'ssrf_blocked'
  | 'path_traversal_blocked'
  | 'command_injection_blocked'
  | 'rate_limit_violation'
  | 'csrf_failure'
  | 'invalid_auth'
  | 'sandbox_escape_attempt';

export interface SecurityEvent {
  type: SecurityEventType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: string;
  context?: {
    ip?: string;
    endpoint?: string;
    userAgent?: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Log a security event
 */
export function logSecurityEvent(event: Omit<SecurityEvent, 'timestamp'>): void {
  const fullEvent: SecurityEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  };

  // Log to standard logger with security prefix
  const logMessage = `[SECURITY:${event.type}] ${event.message}`;
  
  switch (event.severity) {
    case 'critical':
      Logger.error('Security', logMessage, fullEvent);
      break;
    case 'high':
      Logger.error('Security', logMessage, fullEvent.context);
      break;
    case 'medium':
      Logger.warn('Security', logMessage, fullEvent.context);
      break;
    case 'low':
      Logger.info('Security', logMessage, fullEvent.context);
      break;
  }

  // TODO: Send to SIEM/security monitoring service in production
  // Example: sendToSIEM(fullEvent);
}

/**
 * Log SSRF attempt
 */
export function logSSRFAttempt(url: string, context?: SecurityEvent['context']): void {
  logSecurityEvent({
    type: 'ssrf_blocked',
    severity: 'high',
    message: `SSRF attempt blocked: ${url}`,
    context,
  });
}

/**
 * Log path traversal attempt
 */
export function logPathTraversalAttempt(path: string, context?: SecurityEvent['context']): void {
  logSecurityEvent({
    type: 'path_traversal_blocked',
    severity: 'medium',
    message: `Path traversal attempt blocked: ${path}`,
    context,
  });
}

/**
 * Log rate limit violation
 */
export function logRateLimitViolation(endpoint: string, context?: SecurityEvent['context']): void {
  logSecurityEvent({
    type: 'rate_limit_violation',
    severity: 'low',
    message: `Rate limit exceeded: ${endpoint}`,
    context,
  });
}

/**
 * Log CSRF failure
 */
export function logCSRFFailure(endpoint: string, context?: SecurityEvent['context']): void {
  logSecurityEvent({
    type: 'csrf_failure',
    severity: 'medium',
    message: `CSRF validation failed: ${endpoint}`,
    context,
  });
}
