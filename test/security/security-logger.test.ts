import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  logSecurityEvent, 
  logSSRFAttempt, 
  logPathTraversalAttempt,
  logRateLimitViolation,
  logCSRFFailure
} from '../../src/security/SecurityLogger.js';
import { Logger } from '../../src/utils/Logger.js';

describe('SecurityLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should log SSRF attempts as high severity', () => {
    const spy = vi.spyOn(Logger, 'error');
    logSSRFAttempt('http://169.254.169.254/');
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][0]).toBe('Security');
    expect(spy.mock.calls[0][1]).toContain('SSRF');
  });

  it('should log path traversal as medium severity', () => {
    const spy = vi.spyOn(Logger, 'warn');
    logPathTraversalAttempt('../../../etc/passwd');
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][1]).toContain('traversal');
  });

  it('should log rate limit violations as low severity', () => {
    const spy = vi.spyOn(Logger, 'info');
    logRateLimitViolation('/api/test');
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][1]).toContain('Rate limit');
  });

  it('should log CSRF failures as medium severity', () => {
    const spy = vi.spyOn(Logger, 'warn');
    logCSRFFailure('/api/submit');
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][1]).toContain('CSRF');
  });

  it('should include timestamp in events', () => {
    const spy = vi.spyOn(Logger, 'error');
    const eventDetails = { source: 'test' };
    logSecurityEvent({
      type: 'ssrf_blocked',
      severity: 'high',
      message: 'test',
      context: eventDetails,
    });
    expect(spy).toHaveBeenCalled();
    // Check that context is passed (which includes the context details provided)
    const context = spy.mock.calls[0][2];
    expect(context).toBeDefined();
    expect(context).toHaveProperty('source', 'test');
  });

  it('should log critical events with full event context', () => {
    const spy = vi.spyOn(Logger, 'error');
    logSecurityEvent({
      type: 'sandbox_escape_attempt',
      severity: 'critical',
      message: 'Sandbox escape detected',
      context: {
        ip: '192.168.1.1',
        endpoint: '/sandbox/run',
        details: { attemptType: 'code_injection' }
      }
    });
    expect(spy).toHaveBeenCalled();
    const context = spy.mock.calls[0][2];
    expect(context).toHaveProperty('type', 'sandbox_escape_attempt');
    expect(context).toHaveProperty('severity', 'critical');
    expect(context).toHaveProperty('timestamp');
  });

  it('should include context details in SSRF logs', () => {
    const spy = vi.spyOn(Logger, 'error');
    logSSRFAttempt('http://169.254.169.254/', {
      ip: '10.0.0.1',
      endpoint: '/api/fetch',
      details: { blockedHost: '169.254.169.254' }
    });
    expect(spy).toHaveBeenCalled();
    const context = spy.mock.calls[0][2];
    expect(context).toHaveProperty('ip', '10.0.0.1');
    expect(context).toHaveProperty('endpoint', '/api/fetch');
    expect(context).toHaveProperty('details.blockedHost', '169.254.169.254');
  });
});
