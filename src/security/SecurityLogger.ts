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
 * Configuration options for SecurityLogger SIEM integration
 */
export interface SecurityLoggerConfig {
  enableSIEM?: boolean;
  siemEndpoint?: string;
  siemApiKey?: string;
}

/**
 * SecurityLogger class with SIEM integration support
 */
export class SecurityLogger {
  private config: SecurityLoggerConfig;
  private siemFailureCount = 0;

  constructor(config?: SecurityLoggerConfig) {
    this.config = config ?? {};
  }

  /**
   * Log a security event with optional SIEM forwarding
   */
  logSecurityEvent(event: Omit<SecurityEvent, 'timestamp'>): void {
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

    // Send to SIEM if enabled
    if (this.config.enableSIEM && this.config.siemEndpoint) {
      this.sendToSIEM(fullEvent).catch((err) => {
        this.siemFailureCount++;
        Logger.error('SecurityLogger', `SIEM delivery failed (consecutive: ${this.siemFailureCount}): ${err instanceof Error ? err.message : err}`);
      });
    }
  }

  /**
   * Send security event to external SIEM service
   */
  private async sendToSIEM(event: SecurityEvent): Promise<void> {
    if (!this.config.siemEndpoint) return;
    
    const response = await fetch(this.config.siemEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.siemApiKey && { 'Authorization': `Bearer ${this.config.siemApiKey}` }),
      },
      body: JSON.stringify(event),
    });
    
    if (!response.ok) {
      throw new Error(`SIEM returned ${response.status}`);
    }
  }

  /**
   * Log SSRF attempt
   */
  logSSRFAttempt(url: string, context?: SecurityEvent['context']): void {
    this.logSecurityEvent({
      type: 'ssrf_blocked',
      severity: 'high',
      message: `SSRF attempt blocked: ${url}`,
      context,
    });
  }

  /**
   * Log path traversal attempt
   */
  logPathTraversalAttempt(path: string, context?: SecurityEvent['context']): void {
    this.logSecurityEvent({
      type: 'path_traversal_blocked',
      severity: 'medium',
      message: `Path traversal attempt blocked: ${path}`,
      context,
    });
  }

  /**
   * Log rate limit violation
   */
  logRateLimitViolation(endpoint: string, context?: SecurityEvent['context']): void {
    this.logSecurityEvent({
      type: 'rate_limit_violation',
      severity: 'low',
      message: `Rate limit exceeded: ${endpoint}`,
      context,
    });
  }

  /**
   * Log CSRF failure
   */
  logCSRFFailure(endpoint: string, context?: SecurityEvent['context']): void {
    this.logSecurityEvent({
      type: 'csrf_failure',
      severity: 'medium',
      message: `CSRF validation failed: ${endpoint}`,
      context,
    });
  }
}

// Default instance for backward compatibility
let defaultLogger: SecurityLogger | null = null;

function getDefaultLogger(): SecurityLogger {
  if (!defaultLogger) {
    defaultLogger = new SecurityLogger();
  }
  return defaultLogger;
}

/**
 * Initialize the security logger with configuration
 */
export function initializeSecurityLogger(config?: SecurityLoggerConfig): void {
  defaultLogger = new SecurityLogger(config);
}

/**
 * Log a security event (uses default instance)
 */
export function logSecurityEvent(event: Omit<SecurityEvent, 'timestamp'>): void {
  getDefaultLogger().logSecurityEvent(event);
}

/**
 * Log SSRF attempt (uses default instance)
 */
export function logSSRFAttempt(url: string, context?: SecurityEvent['context']): void {
  getDefaultLogger().logSSRFAttempt(url, context);
}

/**
 * Log path traversal attempt (uses default instance)
 */
export function logPathTraversalAttempt(path: string, context?: SecurityEvent['context']): void {
  getDefaultLogger().logPathTraversalAttempt(path, context);
}

/**
 * Log rate limit violation (uses default instance)
 */
export function logRateLimitViolation(endpoint: string, context?: SecurityEvent['context']): void {
  getDefaultLogger().logRateLimitViolation(endpoint, context);
}

/**
 * Log CSRF failure (uses default instance)
 */
export function logCSRFFailure(endpoint: string, context?: SecurityEvent['context']): void {
  getDefaultLogger().logCSRFFailure(endpoint, context);
}
