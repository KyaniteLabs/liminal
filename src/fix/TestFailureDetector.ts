/**
 * TestFailureDetector - Parses test output to identify failing test files
 * and map them back to source files for automatic fixing.
 */

import { execSync } from 'child_process';
import { existsSync } from 'node:fs';
import { Logger } from '../utils/Logger.js';

/**
 * Represents a single test failure with file and error information.
 */
export interface TestFailure {
  /** Path to the test file */
  testFile: string;
  /** Number of failed tests in this file */
  failedCount: number;
  /** Total number of tests in this file */
  totalCount: number;
  /** Individual test failure messages */
  failureMessages: string[];
  /** Inferred source file path (if determinable) */
  sourceFile?: string;
}

/**
 * Result of detecting test failures.
 */
export interface DetectionResult {
  /** Whether detection succeeded */
  success: boolean;
  /** List of test failures found */
  failures: TestFailure[];
  /** Total number of failing test files */
  failingFileCount: number;
  /** Total number of failed tests across all files */
  totalFailedTests: number;
  /** Error message if detection failed */
  error?: string;
  /** Raw test output (for debugging) */
  rawOutput?: string;
}

/**
 * Configuration for test failure detection.
 */
export interface DetectorConfig {
  /** Test command to run (default: 'pnpm test') */
  testCommand?: string;
  /** Timeout in milliseconds (default: 300000) */
  timeout?: number;
  /** Whether to include raw output in result */
  includeRawOutput?: boolean;
  /** Pattern to identify test files (default: /\.(test|spec)\.(ts|js|tsx|jsx)$/) */
  testFilePattern?: RegExp;
  /** Mapping function from test file to source file */
  sourceMapper?: (testFile: string) => string | undefined;
}

/**
 * Detects test failures by running tests and parsing output.
 */
export class TestFailureDetector {
  private _config: Required<DetectorConfig>;

  /**
   * Default source mapper: converts test file paths to source file paths.
   * Handles common conventions like:
   * - src/foo.ts → test/unit/foo.test.ts
   * - src/foo.ts → test/foo.test.ts
   * - lib/foo.js → test/foo.test.js
   */
  private static defaultSourceMapper(testFile: string): string | undefined {
    // Remove test/unit/ or test/ prefix and .test.ts/.spec.ts suffix
    const patterns = [
      // test/unit/foo.test.ts → src/foo.ts
      { testPattern: /^test\/unit\//, suffixPattern: /\.test\.(ts|js|tsx|jsx)$/ },
      // test/integration/foo.test.ts → src/foo.ts
      { testPattern: /^test\/integration\//, suffixPattern: /\.test\.(ts|js|tsx|jsx)$/ },
      // test/e2e/foo.test.ts → src/foo.ts
      { testPattern: /^test\/e2e\//, suffixPattern: /\.test\.(ts|js|tsx|jsx)$/ },
      // test/foo.test.ts → src/foo.ts
      { testPattern: /^test\//, suffixPattern: /\.test\.(ts|js|tsx|jsx)$/ },
      // foo.test.ts → foo.ts
      { testPattern: /^(\.\/)?/, suffixPattern: /\.test\.(ts|js|tsx|jsx)$/ },
      // foo.spec.ts → foo.ts
      { testPattern: /^(\.\/)?/, suffixPattern: /\.spec\.(ts|js|tsx|jsx)$/ },
    ];

    for (const { testPattern, suffixPattern } of patterns) {
      if (testPattern.test(testFile)) {
        const basePath = testFile.replace(testPattern, '').replace(suffixPattern, '');
        // Try src/ first, then lib/, then root
        const candidates = [
          `src/${basePath}.ts`,
          `src/${basePath}.js`,
          `src/${basePath}.tsx`,
          `src/${basePath}.jsx`,
          `lib/${basePath}.js`,
          `lib/${basePath}.ts`,
          `${basePath}.ts`,
          `${basePath}.js`,
          `${basePath}.tsx`,
          `${basePath}.jsx`,
        ];
        return candidates.find((c) => this.fileExists(c));
      }
    }

    return undefined;
  }

  /**
   * Check if a file exists (synchronous, used by mapper)
   */
  private static fileExists(filePath: string): boolean {
    try {
      return existsSync(filePath);
    } catch (err) {
      Logger.debug('TestFailureDetector', `existsSync failed for ${filePath}:`, err);
      return false;
    }
  }

  constructor(config: DetectorConfig = {}) {
    this._config = {
      testCommand: config.testCommand ?? 'pnpm test',
      timeout: config.timeout ?? 300_000,
      includeRawOutput: config.includeRawOutput ?? false,
      testFilePattern: config.testFilePattern ?? /\.(test|spec)\.(ts|js|tsx|jsx)$/,
      sourceMapper: config.sourceMapper ?? TestFailureDetector.defaultSourceMapper,
    };
  }

  /**
   * Run tests and detect failures.
   *
   * @returns DetectionResult with failures and metadata
   */
  detect(): DetectionResult {
    Logger.info('TestFailureDetector', 'Running tests to detect failures...', {
      command: this._config.testCommand,
      timeout: this._config.timeout,
    });

    try {
      // Run tests, capturing output. Tests may "fail" (exit non-zero) which is expected.
      const output = execSync(this._config.testCommand, {
        encoding: 'utf-8',
        timeout: this._config.timeout,
        stdio: ['pipe', 'pipe', 'pipe'],
        // Don't throw on non-zero exit - test failures are expected
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large test output
      });

      // If we get here, all tests passed
      Logger.info('TestFailureDetector', 'All tests passed - no failures detected');
      return {
        success: true,
        failures: [],
        failingFileCount: 0,
        totalFailedTests: 0,
        rawOutput: this._config.includeRawOutput ? output : undefined,
      };
    } catch (error) {
      // Tests failed - this is the expected path when there are failures
      const output = this.extractOutputFromError(error);

      if (!output) {
        const msg = error instanceof Error ? error.message : String(error);
        Logger.error('TestFailureDetector', `Failed to run tests: ${msg}`);
        return {
          success: false,
          failures: [],
          failingFileCount: 0,
          totalFailedTests: 0,
          error: `Test execution failed: ${msg}`,
        };
      }

      // Parse the test output for failures
      const failures = this.parseTestOutput(output);

      Logger.info('TestFailureDetector', `Detected ${failures.length} failing test files`, {
        totalFailedTests: failures.reduce((sum, f) => sum + f.failedCount, 0),
      });

      return {
        success: true,
        failures,
        failingFileCount: failures.length,
        totalFailedTests: failures.reduce((sum, f) => sum + f.failedCount, 0),
        rawOutput: this._config.includeRawOutput ? output : undefined,
      };
    }
  }

  /**
   * Detect failures from a specific test file or pattern.
   *
   * @param testPattern - Test file pattern to run (e.g., "test/unit/foo.test.ts")
   * @returns DetectionResult with failures
   */
  detectPattern(testPattern: string): DetectionResult {
    const originalCommand = this._config.testCommand;
    this._config.testCommand = `${originalCommand} ${testPattern}`;

    try {
      return this.detect();
    } finally {
      this._config.testCommand = originalCommand;
    }
  }

  /**
   * Get source files that correspond to failing tests.
   *
   * @param detectionResult - Result from detect()
   * @returns Array of source file paths
   */
  getSourceFiles(detectionResult: DetectionResult): string[] {
    const sourceFiles: string[] = [];

    for (const failure of detectionResult.failures) {
      // If we have a source file mapping, use it
      if (failure.sourceFile) {
        sourceFiles.push(failure.sourceFile);
        continue;
      }

      // Try to infer from the test file name
      const inferred = this._config.sourceMapper(failure.testFile);
      if (inferred) {
        failure.sourceFile = inferred;
        sourceFiles.push(inferred);
      }
    }

    // Remove duplicates
    return [...new Set(sourceFiles)];
  }

  /**
   * Extract stdout/stderr from an exec error.
   */
  private extractOutputFromError(error: unknown): string | undefined {
    if (typeof error === 'object' && error !== null) {
      const execError = error as { stdout?: string | Buffer; stderr?: string | Buffer };
      const stdout = this.bufferToString(execError.stdout);
      const stderr = this.bufferToString(execError.stderr);
      return stdout || stderr || undefined;
    }
    return undefined;
  }

  /**
   * Convert Buffer or string to string.
   */
  private bufferToString(data: string | Buffer | undefined | null): string {
    if (!data) return '';
    if (Buffer.isBuffer(data)) return data.toString('utf-8');
    return String(data);
  }

  /**
   * Parse test output to extract failing test files.
   * Supports Vitest, Jest, and Mocha formats.
   */
  private parseTestOutput(output: string): TestFailure[] {
    const failures: TestFailure[] = [];
    const lines = output.split('\n');

    // Try Vitest format first: "❯ test/file.test.ts (5 tests | 2 failed)"
    const vitestPattern = /❯\s+(\S+)\s+\((\d+)\s+tests?\s*\|\s*(\d+)\s+failed[^)]*\)/;

    // Alternative format: "FAIL test/file.test.ts" or "✕ test/file.test.ts"
    const failPattern = /(?:FAIL|✕)\s+(test\/\S+|\S+\.test\.\S+|\S+\.spec\.\S+)/;

    // Pattern to capture failure details (test name after ✕ or ×)
    const testFailPattern = /[✕×]\s+(.+?)\s+\d+ms/;

    let currentFailure: TestFailure | null = null;

    for (const line of lines) {
      // Check for Vitest file summary line
      const vitestMatch = line.match(vitestPattern);
      if (vitestMatch) {
        if (currentFailure) {
          failures.push(currentFailure);
        }
        currentFailure = {
          testFile: vitestMatch[1],
          totalCount: parseInt(vitestMatch[2], 10),
          failedCount: parseInt(vitestMatch[3], 10),
          failureMessages: [],
          sourceFile: this._config.sourceMapper(vitestMatch[1]),
        };
        continue;
      }

      // Check for FAIL line (Jest style)
      const failMatch = line.match(failPattern);
      if (failMatch && (!currentFailure || currentFailure.testFile !== failMatch[1])) {
        if (currentFailure) {
          failures.push(currentFailure);
        }
        currentFailure = {
          testFile: failMatch[1],
          totalCount: 0,
          failedCount: 0,
          failureMessages: [],
          sourceFile: this._config.sourceMapper(failMatch[1]),
        };
        continue;
      }

      // Capture individual test failure messages
      if (currentFailure) {
        const testFailMatch = line.match(testFailPattern);
        if (testFailMatch) {
          currentFailure.failureMessages.push(testFailMatch[1].trim());
        }

        // Capture assertion errors (lines with AssertionError or expect())
        if (line.includes('AssertionError') || line.includes('expect(') || line.includes('Error:')) {
          currentFailure.failureMessages.push(line.trim());
        }
      }
    }

    // Don't forget the last failure
    if (currentFailure) {
      failures.push(currentFailure);
    }

    // If no failures found with patterns, try to extract from summary
    if (failures.length === 0) {
      return this.parseFallback(output);
    }

    return failures;
  }

  /**
   * Fallback parser for non-standard test output formats.
   */
  private parseFallback(output: string): TestFailure[] {
    const failures: TestFailure[] = [];

    // Look for any file paths that look like test files
    const testFilePattern = /(test\/\S+\.test\.(ts|js|tsx|jsx)|src\/\S+\.test\.(ts|js|tsx|jsx))/g;
    const matches = output.match(testFilePattern);

    if (matches) {
      const uniqueFiles = [...new Set(matches)];
      for (const testFile of uniqueFiles) {
        failures.push({
          testFile,
          totalCount: 0,
          failedCount: 1, // Assume at least one failure
          failureMessages: ['Test failure detected in output'],
          sourceFile: this._config.sourceMapper(testFile),
        });
      }
    }

    return failures;
  }
}
