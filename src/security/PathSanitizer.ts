/**
 * Path sanitization utilities to prevent command injection
 */

import path from 'path';
import { logPathTraversalAttempt } from './SecurityLogger.js';

export class PathSanitizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PathSanitizationError';
  }
}

// Characters that could be used for shell injection
const DANGEROUS_CHARS = /[;|&$`\\<>{}[\]]/;

// Control characters
const CONTROL_CHARS = /[\x00-\x1f\x7f-\x9f]/;

/**
 * Sanitize a filename to prevent command injection
 * 
 * @param filename - The filename to sanitize
 * @returns Sanitized filename
 * @throws PathSanitizationError if filename contains dangerous characters
 */
export function sanitizeFilename(filename: string): string {
  if (DANGEROUS_CHARS.test(filename)) {
    logPathTraversalAttempt(filename, {
      details: { reason: 'dangerous_chars' }
    });
    throw new PathSanitizationError(
      `Filename contains dangerous characters: ${filename}`
    );
  }
  
  if (CONTROL_CHARS.test(filename)) {
    logPathTraversalAttempt(filename, {
      details: { reason: 'control_chars' }
    });
    throw new PathSanitizationError(
      `Filename contains control characters: ${filename}`
    );
  }
  
  // Normalize to remove path traversal attempts
  const normalized = path.normalize(filename);
  
  // Ensure filename doesn't start with .. or /
  if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
    logPathTraversalAttempt(filename, {
      details: { reason: 'path_traversal' }
    });
    throw new PathSanitizationError(
      `Filename must be a relative path without traversal: ${filename}`
    );
  }
  
  return normalized;
}

/**
 * Validate and sanitize a file path
 * 
 * @param filepath - Full file path
 * @param allowedBaseDir - Base directory that must contain the path
 * @returns Sanitized absolute path
 * @throws PathSanitizationError if path is invalid or outside base directory
 */
export function validateFilePath(
  filepath: string, 
  allowedBaseDir: string
): string {
  // First sanitize the filename portion
  const basename = path.basename(filepath);
  sanitizeFilename(basename);
  
  // Resolve to absolute path
  const resolved = path.resolve(filepath);
  const baseResolved = path.resolve(allowedBaseDir);
  
  // Ensure resolved path is within allowed base
  const relative = path.relative(baseResolved, resolved);
  
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    logPathTraversalAttempt(filepath, {
      details: { reason: 'escapes_allowed_directory', baseDir: allowedBaseDir }
    });
    throw new PathSanitizationError(
      `Path escapes allowed directory: ${filepath}`
    );
  }
  
  return resolved;
}

/**
 * Sanitize FFmpeg argument string
 * 
 * @param arg - Argument to sanitize
 * @returns Sanitized argument
 */
export function sanitizeFFmpegArg(arg: string): string {
  // FFmpeg args should not contain shell metacharacters
  if (DANGEROUS_CHARS.test(arg)) {
    logPathTraversalAttempt(arg, {
      details: { reason: 'dangerous_chars_in_ffmpeg_arg' }
    });
    throw new PathSanitizationError(
      `FFmpeg argument contains dangerous characters: ${arg}`
    );
  }
  return arg;
}
