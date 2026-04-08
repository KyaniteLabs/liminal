/**
 * Error types for Liminal
 *
 * Provides domain-specific error classes for better error handling
 * and debugging across the codebase.
 */

export { LiminalError } from './base.js';
export { ConfigError } from './ConfigError.js';
export { ValidationError } from './ValidationError.js';
export { GenerationError } from './GenerationError.js';
export { GitError, GitRepoError, GitCommitError, GitPushError, GitStashError } from './GitError.js';
export { CompostError, CompostDigestError, CompostSoupError, CompostStoreError } from './CompostError.js';
export { PersistenceError } from './PersistenceError.js';
export { FileDiscoveryError } from './FileDiscoveryError.js';
export { LLMGenerationError } from './LLMGenerationError.js';
