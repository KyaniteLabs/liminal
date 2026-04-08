/**
 * Security-related errors for the harness system
 */

export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

export class PathTraversalError extends SecurityError {
  constructor(message: string) {
    super(message);
    this.name = 'PathTraversalError';
  }
}
