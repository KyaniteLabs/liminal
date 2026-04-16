# Task Corpus — Self-Hosting Task Ledger

This directory contains the task corpus for Liminal's Self-Hosting Task Ledger (Phase 9). Each JSON file defines a single task that can be loaded into the TaskLedger system for bounded, tracked execution.

## Task Classes

| Class | Difficulty | Scope | Typical Agent |
|-------|-----------|-------|---------------|
| `leaf` | Low | Single file, clear contract | Any agent |
| `wiring` | Medium | 2-5 files, connect existing modules | Executor |
| `harness-quality` | Medium | Improve test infrastructure or failure detection | Executor |
| `orchestrator` | High | Bounded logic change in a single complex module | Senior agent |

## File Format

Each JSON file is a partial `TaskManifest` — it contains all user-defined fields but omits the fields that `TaskLedger.createTask()` auto-fills:

**Required fields (you provide):**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (e.g., `L001`, `W001`) |
| `title` | string | Short human-readable title |
| `description` | string | Detailed description of what the task accomplishes |
| `taskClass` | string | One of: `leaf`, `wiring`, `harness-quality`, `orchestrator` |
| `files` | object | `{ allowlist: string[], denylist: string[] }` — glob patterns for file boundaries |
| `verifyCommand` | string | Shell command to verify task completion |
| `scoringCriteria` | string[] | Criteria passed to ScoringEngine for semantic evaluation |
| `lane` | number | Lane assignment for parallel execution (1-4) |
| `maxAttempts` | number | Maximum attempts before marking as failed |

**Auto-filled fields (set by TaskLedger):**

| Field | Default |
|-------|---------|
| `status` | `'pending'` |
| `attemptCount` | `0` |
| `createdAt` | ISO 8601 timestamp at creation |
| `updatedAt` | ISO 8601 timestamp at creation |

## Creating New Tasks

1. Choose an ID following the convention: `L` for leaf, `W` for wiring, `H` for harness-quality, `O` for orchestrator, followed by a zero-padded number (e.g., `L002`, `W003`).
2. Create a JSON file at `ledger-tasks/<ID>.json` with all required fields.
3. Test loading: `liminal ledger load ledger-tasks/` — validates and registers all tasks.
4. Run a single task: `liminal ledger run <ID>`.

## Loading Tasks

```bash
# Load all tasks from the corpus directory
liminal ledger load ledger-tasks/

# View loaded tasks
liminal ledger list

# Filter by lane
liminal ledger list --lane 1

# Show task details
liminal ledger show L001
```
