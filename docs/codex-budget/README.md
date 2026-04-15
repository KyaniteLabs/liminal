# Codex Budget Operating Model

This directory defines a practical operating model for working under low Codex weekly usage.

## Files

- `OPERATING_MODEL.md` - the mental model, modes, rules, and examples.
- `ENFORCEMENT_PROPOSAL.md` - implementation options for scripts, state, and agent behavior.
- `AGENTS_SNIPPET.md` - copy-paste policy text for `AGENTS.md` or a personal agent prompt.

## Core Idea

Codex usage has two buckets:

1. **Five-hour bucket:** short-term throughput.
2. **Weekly bucket:** total fuel.

If the five-hour bucket is healthy but the weekly bucket is low, the system is not blocked by rate. It is constrained by fuel.

When weekly remaining is below 5%, switch to **Emergency Mode**:

- no subagents by default
- no broad repo scans by default
- no CI monitoring by Codex
- no autonomous loops
- one decision at a time
- prefer user-run commands and pasted output

