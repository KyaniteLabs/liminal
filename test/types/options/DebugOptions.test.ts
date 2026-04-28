/**
 * DebugOptions tests
 */

import { describe, it, expect } from 'vitest';
import {
  type DebugOptions,
  type LogLevel,
  DEFAULT_DEBUG_OPTIONS,
  normalizeDebugOptions,
  shouldLog,
} from '../../../src/types/options/DebugOptions.js';

describe('DebugOptions', () => {
  describe('interface', () => {
    it('should accept valid debug options', () => {
      const options: DebugOptions = {
        logLevel: 'debug',
        telemetry: true,
        saveIntermediate: true,
        debugOutputDir: './debug-output',
        verbose: false,
      };

      expect(options.logLevel).toBe('debug');
      expect(options.telemetry).toBe(true);
      expect(options.saveIntermediate).toBe(true);
      expect(options.debugOutputDir).toBe('./debug-output');
      expect(options.verbose).toBe(false);
    });

    it('should accept partial debug options', () => {
      const options: DebugOptions = {
        logLevel: 'error',
        verbose: true,
      };

      expect(options.logLevel).toBe('error');
      expect(options.verbose).toBe(true);
    });

    it('should accept empty options', () => {
      const options: DebugOptions = {};
      expect(options).not.toBeNull();
    });
  });

  describe('LogLevel type', () => {
    it('should accept all valid log levels', () => {
      const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
      
      levels.forEach(level => {
        const options: DebugOptions = { logLevel: level };
        expect(options.logLevel).toBe(level);
      });
    });
  });

  describe('DEFAULT_DEBUG_OPTIONS', () => {
    it('should have expected defaults', () => {
      expect(DEFAULT_DEBUG_OPTIONS.logLevel).toBe('warn');
      expect(DEFAULT_DEBUG_OPTIONS.telemetry).toBe(false);
      expect(DEFAULT_DEBUG_OPTIONS.saveIntermediate).toBe(false);
      expect(DEFAULT_DEBUG_OPTIONS.debugOutputDir).toBe('.debug');
      expect(DEFAULT_DEBUG_OPTIONS.verbose).toBe(false);
    });
  });

  describe('normalizeDebugOptions', () => {
    it('should return defaults when given null', () => {
      const normalized = normalizeDebugOptions(null);
      expect(normalized).toEqual(DEFAULT_DEBUG_OPTIONS);
    });

    it('should return defaults when given undefined', () => {
      const normalized = normalizeDebugOptions(undefined);
      expect(normalized).toEqual(DEFAULT_DEBUG_OPTIONS);
    });

    it('should return defaults when given empty object', () => {
      const normalized = normalizeDebugOptions({});
      expect(normalized).toEqual(DEFAULT_DEBUG_OPTIONS);
    });

    it('should merge partial options with defaults', () => {
      const options: DebugOptions = {
        logLevel: 'debug',
        telemetry: true,
      };
      const normalized = normalizeDebugOptions(options);

      expect(normalized.logLevel).toBe('debug');
      expect(normalized.telemetry).toBe(true);
      expect(normalized.saveIntermediate).toBe(DEFAULT_DEBUG_OPTIONS.saveIntermediate);
      expect(normalized.debugOutputDir).toBe(DEFAULT_DEBUG_OPTIONS.debugOutputDir);
      expect(normalized.verbose).toBe(DEFAULT_DEBUG_OPTIONS.verbose);
    });

    it('should override all defaults when given complete options', () => {
      const options: DebugOptions = {
        logLevel: 'error',
        telemetry: true,
        saveIntermediate: true,
        debugOutputDir: './custom-debug',
        verbose: false,
      };
      const normalized = normalizeDebugOptions(options);

      expect(normalized.logLevel).toBe('error');
      expect(normalized.telemetry).toBe(true);
      expect(normalized.saveIntermediate).toBe(true);
      expect(normalized.debugOutputDir).toBe('./custom-debug');
      expect(normalized.verbose).toBe(false);
    });

    it('should override logLevel to debug when verbose is true', () => {
      const options: DebugOptions = {
        logLevel: 'error',
        verbose: true,
      };
      const normalized = normalizeDebugOptions(options);

      expect(normalized.logLevel).toBe('debug');
      expect(normalized.verbose).toBe(true);
    });

    it('should respect logLevel when verbose is false', () => {
      const options: DebugOptions = {
        logLevel: 'info',
        verbose: false,
      };
      const normalized = normalizeDebugOptions(options);

      expect(normalized.logLevel).toBe('info');
      expect(normalized.verbose).toBe(false);
    });

    it('should handle verbose-only options', () => {
      const options: DebugOptions = {
        verbose: true,
      };
      const normalized = normalizeDebugOptions(options);

      expect(normalized.logLevel).toBe('debug');
      expect(normalized.verbose).toBe(true);
    });
  });

  describe('shouldLog', () => {
    it('should return true when message level >= current level', () => {
      expect(shouldLog('debug', 'debug')).toBe(true);
      expect(shouldLog('debug', 'info')).toBe(true);
      expect(shouldLog('debug', 'warn')).toBe(true);
      expect(shouldLog('debug', 'error')).toBe(true);
    });

    it('should return false when message level < current level', () => {
      expect(shouldLog('error', 'debug')).toBe(false);
      expect(shouldLog('error', 'info')).toBe(false);
      expect(shouldLog('error', 'warn')).toBe(false);
      expect(shouldLog('warn', 'debug')).toBe(false);
      expect(shouldLog('warn', 'info')).toBe(false);
      expect(shouldLog('info', 'debug')).toBe(false);
    });

    it('should return true when message level == current level', () => {
      expect(shouldLog('info', 'info')).toBe(true);
      expect(shouldLog('warn', 'warn')).toBe(true);
      expect(shouldLog('error', 'error')).toBe(true);
    });

    it('should work with normalized options', () => {
      const options = normalizeDebugOptions({ logLevel: 'info' });
      
      expect(shouldLog(options.logLevel, 'debug')).toBe(false);
      expect(shouldLog(options.logLevel, 'info')).toBe(true);
      expect(shouldLog(options.logLevel, 'warn')).toBe(true);
      expect(shouldLog(options.logLevel, 'error')).toBe(true);
    });
  });
});
