/**
 * Public exports for the AutoFixOrchestrator module.
 *
 * This module provides the `sinter fix` command functionality
 * for self-healing code fixes.
 */

export { AutoFixOrchestrator } from './AutoFixOrchestrator.js';
export { TestFailureDetector } from './TestFailureDetector.js';
export type { TestFailure, DetectionResult, DetectorConfig } from './TestFailureDetector.js';
export * from './types.js';
