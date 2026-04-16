# Orphaned Module Catalog

> These modules exist in `src/` with zero imports from other runtime modules.
> Per user decision: **keep all** — they're infrastructure waiting for integration, not dead code.

---

## Core Infrastructure

### `src/core/BatchProcessor.ts` (328 lines)
Batch execution engine for running multiple operations in parallel with concurrency control and error aggregation. Useful for garden loop when processing multiple cells simultaneously.

### `src/core/CreativeConstraints.ts` (150 lines)
Fabrication constraints for creative output — enforces boundaries like max line count, no forbidden patterns, required imports. Natural fit for the guardrails framework.

### `src/core/TelemetryBridge.ts` (106 lines)
Wires LLM events from EventBus into TelemetryAggregator. Bridges the gap between creative generation events and the observability layer. Should connect when guardrails are activated.

### `src/core/StagnationDetector.ts` (165 lines) — **partial wiring exists**
Detects when the creative loop stops making progress. Already referenced 4x in bin/liminal (garden commands). Not fully consumed by src/ modules but partially wired via CLI.

### `src/core/SuccessRateTracker.ts` (180 lines)
Rolling success rate tracker for adaptive exploration. Tracks whether recent generations are improving or declining. Natural fit for the garden loop's adaptive behavior.

---

## LLM & Conversation

### `src/llm/ConversationState.ts` (119 lines)
Per-provider multi-turn conversation state management. Tracks message history, system prompts, and context windows across providers. Should be wired into LLMClient for multi-turn creative sessions.

---

## Generative Art Utilities

### `src/utils/PerlinNoise.ts` (139 lines)
Seeded permutation-based Perlin noise generator for procedural generation. Can drive organic variation in visual art, terrain generation, and parameter exploration.

---

## TUI & Interactive

### `src/tui/NaturalInterface.ts` (508 lines) — **partial wiring exists**
Natural language interface inspired by Claude Code. Routes slash commands, agent patterns, and free-text to appropriate handlers. Referenced in bin/liminal. Full integration pending TUI launch.

### `src/tui/PendingActionStore.ts` (47 lines)
Stores pending user confirmation actions (approve/reject) for destructive operations. Needed when TUI interactive mode asks "really delete this?"

### `src/tui/TuiDebugger.ts` (285 lines)
Verbose debug capture for the TUI. Logs state transitions, key events, and rendering calls for troubleshooting TUI behavior.

### `src/tui/TUIDebugLogger.ts` (128 lines)
File-based debug logging for runtime inspection. Writes structured debug output to a log file for post-mortem analysis.

### `src/tui/StdinValidator.ts` (59 lines)
Detects if stdin is suitable for interactive TUI (checks for TTY, pipes, etc.). Used to decide whether to launch interactive mode or fall back to batch.

### `src/tui-bridge/BridgeLauncherConfig.ts` (86 lines)
Configuration for the TUI bridge server (port, host, SSE settings). Needed when launching the bridge from CLI or programmatically.

---

## GUI & Visualization

### `src/gui/previewState.ts` (31 lines)
Derives preview URL and code content from a selected iteration index. Drives the "preview this generation" feature in the GUI.

### `src/gui/exportSelected.ts` (28 lines)
Exports a selected iteration as HTML. Reuses the Exporter module to produce standalone HTML files from generations.

### `src/ui/TransparencyViewer.ts` (356 lines)
Real-time process transparency for generation — shows what the creative loop is doing as it works. Like a terminal-based progress dashboard with live status updates.

---

## Composition & Creative

### `src/composition/PromptEnhancer.ts` (1026 lines)
Cross-layer prompt enhancement for composition. Analyzes the current project state and enhances prompts with context about active layers, blend modes, and artistic intent. The TODO at line 231 to inject LLMClient is a known gap.

---

## Quality & Fixing

### `src/quality/GenerationRegressionHarness.ts` (217 lines)
Regression testing harness for generation quality — compares new generation output against baselines to detect quality degradation. Natural fit for the garden's quality monitoring.

### `src/fix/TestFailureDetector.ts` (368 lines)
Parses test output (vitest format) to identify failing test files, extract error messages, and classify failure types. Should be wired into AutoFixOrchestrator for automated fix workflows.

---

## Security

### `src/security/ImportValidator.ts` (33 lines)
Validates that dynamically imported modules match expected shapes. Prevents supply-chain style attacks where a module's interface changes unexpectedly.

### `src/security/SecurityLogger.ts` (227 lines)
Security event logging for monitoring and alerting. Records injection attempts, permission violations, and suspicious patterns with structured audit trail.

---

## Filesystem Adapters

### `src/fs/adapters/PreferenceEvents.ts` (55 lines)
Phase 13E filesystem adapter for persisting preference learning events. Stores user taste signals (accept/reject/improve) to disk for the learning pipeline.

### `src/fs/adapters/SeedFSAdapter.ts` (33 lines)
Filesystem adapter for seed persistence. Saves and loads compost seeds so they survive across sessions.

### `src/fs/adapters/TraceFSAdapter.ts` (46 lines)
Filesystem adapter for operation tracing. Records filesystem operations for debugging and audit purposes.

---

## Config & Telemetry

### `src/config/telemetry-seed.ts` (545 lines)
Seed data for the telemetry system — pre-populated metrics, baseline thresholds, and calibration values. Large file with hardcoded reference data for the observability layer.
