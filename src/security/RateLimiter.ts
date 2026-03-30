/**
 * Rate limiting configuration for Liminal API endpoints
 */

import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { Logger } from '../utils/Logger.js';
import { logRateLimitViolation } from './SecurityLogger.js';

// Parse environment variables with defaults
const getWindowMs = (envVar: string, defaultMinutes: number): number => {
  const val = process.env[envVar];
  return val ? parseInt(val, 10) * 60 * 1000 : defaultMinutes * 60 * 1000;
};

const getMaxRequests = (envVar: string, defaultMax: number): number => {
  const val = process.env[envVar];
  return val ? parseInt(val, 10) : defaultMax;
};

/**
 * Log rate limit violations for monitoring
 */
const logRateLimitHit = (req: Request, limit?: number, windowMs?: number): void => {
  Logger.warn('RateLimiter', `Rate limit exceeded for IP: ${req.ip || 'unknown'}`, {
    path: req.path,
    method: req.method,
    userAgent: req.get('user-agent'),
    timestamp: new Date().toISOString(),
  });
  
  // Log to security monitoring
  logRateLimitViolation(req.path, {
    ip: req.ip || undefined,
    details: { method: req.method, limit, windowMs }
  });
};

/**
 * Standard API rate limiter
 * Default: 100 requests per 15 minutes per IP
 */
export const standardLimiter = rateLimit({
  windowMs: getWindowMs('LIMINAL_RATE_LIMIT_WINDOW_MINUTES', 15),
  max: getMaxRequests('LIMINAL_RATE_LIMIT_GENERAL', 100),
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    error: 'Too many requests, please try again later.',
    retryAfter: 'Wait a few minutes before retrying.',
  },
  handler: (req: Request, res: Response) => {
    const limit = getMaxRequests('LIMINAL_RATE_LIMIT_GENERAL', 100);
    const windowMs = getWindowMs('LIMINAL_RATE_LIMIT_WINDOW_MINUTES', 15);
    logRateLimitHit(req, limit, windowMs);
    res.status(429).json({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil((res.getHeader('Retry-After') as number) / 60) + ' minutes',
    });
  },
  skip: (req: Request) => {
    // Skip rate limiting for health checks in development
    if (process.env.NODE_ENV === 'development' && req.path === '/api/status') {
      return true;
    }
    return false;
  },
});

/**
 * Strict rate limiter for resource-intensive operations (exports)
 * Default: 10 requests per hour per IP
 */
export const exportLimiter = rateLimit({
  windowMs: getWindowMs('LIMINAL_RATE_LIMIT_EXPORT_WINDOW_MINUTES', 60),
  max: getMaxRequests('LIMINAL_RATE_LIMIT_EXPORT', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Export rate limit exceeded.',
    message: 'Export operations are limited to prevent resource exhaustion.',
  },
  handler: (req: Request, res: Response) => {
    const limit = getMaxRequests('LIMINAL_RATE_LIMIT_EXPORT', 10);
    const windowMs = getWindowMs('LIMINAL_RATE_LIMIT_EXPORT_WINDOW_MINUTES', 60);
    logRateLimitHit(req, limit, windowMs);
    res.status(429).json({
      error: 'Export rate limit exceeded',
      message: 'Export operations are limited to prevent resource exhaustion. Please try again later.',
      retryAfter: Math.ceil((res.getHeader('Retry-After') as number) / 60) + ' minutes',
    });
  },
});

/**
 * Medium rate limiter for sandbox operations
 * Default: 30 requests per 15 minutes per IP
 */
export const sandboxLimiter = rateLimit({
  windowMs: getWindowMs('LIMINAL_RATE_LIMIT_SANDBOX_WINDOW_MINUTES', 15),
  max: getMaxRequests('LIMINAL_RATE_LIMIT_SANDBOX', 30),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    const limit = getMaxRequests('LIMINAL_RATE_LIMIT_SANDBOX', 30);
    const windowMs = getWindowMs('LIMINAL_RATE_LIMIT_SANDBOX_WINDOW_MINUTES', 15);
    logRateLimitHit(req, limit, windowMs);
    res.status(429).json({
      error: 'Sandbox rate limit exceeded',
      message: 'Sandbox operations are rate limited. Please try again later.',
      retryAfter: Math.ceil((res.getHeader('Retry-After') as number) / 60) + ' minutes',
    });
  },
});

/**
 * Get appropriate limiter for endpoint
 */
export function getLimiterForEndpoint(endpoint: string) {
  if (endpoint.includes('/export')) {
    return exportLimiter;
  }
  if (endpoint.includes('/sandbox')) {
    return sandboxLimiter;
  }
  return standardLimiter;
}
