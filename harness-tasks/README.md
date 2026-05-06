# Harness Tasks

This directory contains the harness task definitions used by the Liminal Meta-Harness. Each task is a self-contained JSON file that specifies a targeted system fix or improvement.

## Task Inventory

| ID  | Title |
|-----|-------|
| M1  | Fix Tone.js Validation Gate |
| M4  | Fix Thinking Regex Greedy Match |
| M6  | Fix Console.log Leaks in FailureLogger |
| M7  | Fix Console.log Leaks in PatternDetector |
| M8  | Verify Removed HarnessUpdater Claim |
| M9  | Implement SemanticValidator |
| M10 | Implement AccessibilityGuardrails |
| M11 | Implement RuntimeHealthMonitor |

## Task Schema

Every task file must include the following fields:

- `id` — Unique task identifier
- `title` — Short human-readable title
- `description` — What the task does
- `targetFile` — File to modify
- `search` — String to search for in the target file
- `replace` — Replacement string
- `verifyCommand` — Command to run after applying the change
- `risk` — Risk level (`low`, `medium`, `high`)
- `complexity` — Complexity level (`low`, `medium`, `high`)
- `files` — Number of files changed
- `approved` — Whether the task is approved for auto-execution
