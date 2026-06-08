# Failure-Message Audit — 2026-06-08

This audit reviews every boundary in the Sinter CLI entry point (`bin/sinter`) and config/provider resolution where raw stack traces or unhandled promise rejections can reach the user.

## Boundaries Evaluated

### 1. Global Process Uncaught Exceptions and Unhandled Promise Rejections
- **Location**: `bin/sinter` (global scope)
- **Current Behavior**: If an error is thrown in any synchronous block, or if an async operation rejects a promise that has no catch block, Node.js prints the raw stack trace to `stderr` and exits with code 1.
- **Risk Level**: **HIGH**. Uncaught errors from third-party libraries, dynamic imports, or network-level rejections print voluminous debug text instead of clear human actions.
- **Example Trace**:
  ```
  node:internal/process/promises:288
              triggerUncaughtException(err, true /* fromPromise */);
              ^
  Error: Cannot find module '../dist/runtime-core/SelfImprovementReflexes.js'
      at Module._resolveFilename (node:internal/modules/cjs/loader:1134:15)
      ...
  ```
- **Recommendation**: Register top-level process event listeners for `uncaughtException` and `unhandledRejection` at the very start of `bin/sinter`. Print a clean message and exit with code 1.

---

### 2. Command Groups with `try ... finally` but No `catch` Block
- **Location**: `bin/sinter` (subcommands: `preferences`, `report`, `taste`, `dream`, `garden`)
- **Current Behavior**:
  ```javascript
  const sinterFs = SinterFS.open(process.cwd());
  try {
    // database and filesystem operations
  } finally {
    sinterFs.close();
  }
  ```
  If an operation fails (e.g. database locked, write permission denied, file not found), the `finally` block correctly executes to close `sinterFs`, but the error is re-thrown uncaught, causing a process crash with a raw stack trace.
- **Risk Level**: **HIGH**. Any filesystem or SQLite exception directly exposes raw traces.
- **Example Trace**:
  ```
  Error: SqliteError: database is locked
      at Database.prepare (...)
      ...
  ```
- **Recommendation**: Add a `catch (err)` block to each of these subcommands to print `Error: ${err.message}` to standard error and exit with code 1.

---

### 3. Top-Level Command Blocks without Try-Catch Wrappers
- **Location**: `bin/sinter` (subcommands: `self-improve`, `domains`, `model`, `release`, `improve run`, `site`, `serve` initialization)
- **Current Behavior**: These blocks perform dynamic imports or invoke asynchronous functions (e.g. `runLevel6ReleaseGate()`, `runCreativeDomainGauntlet()`) directly under `if (cmd === '...')` without any local try-catch wrapper.
- **Risk Level**: **MEDIUM-HIGH**. If imports are missing or gates crash internally, the error bubbles up uncaught.
- **Example Trace**:
  ```
  Error: failed to load --aesthetic-config from ...
      at loadAestheticConfig (bin/sinter:348:13)
      at bin/sinter:1094:5
  ```
- **Recommendation**: Wrap each of these command execution segments in a try-catch block to display a clean failure message.

---

### 4. Config and Provider Key Resolution
- **Location**: `src/config/ConfigLoader.ts`, `src/llm/LLMClient.ts`
- **Current Behavior**: 
  - If the config is missing or invalid, `loadConfig` returns a rejected `PersistenceError` which is caught in `getEffectiveConfig` and logged as a warning.
  - If a model is not running locally (e.g. LM Studio not active on port 1234), `LLMClient.resolveModel()` throws an `LLMError`. When invoked from `sinter "prompt"`, the catch block in `run(...).catch(...)` correctly formats the error as `❌ Error: ${err.message}`.
- **Risk Level**: **LOW** (already partially mitigated by callers, though CLI-level uncaught exceptions can still happen if caller doesn't catch).
- **Recommendation**: Ensure that all CLI subcommands that instantiate or run `LLMClient` have robust try-catch wrapping around their execution paths.
