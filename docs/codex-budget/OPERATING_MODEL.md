# Codex Budget Operating Model

## Purpose

Prevent accidental exhaustion of weekly Codex usage by defining clear operating modes, trigger thresholds, and enforcement rules.

This is a working doctrine, not a prediction of OpenAI's internal quota accounting. The goal is to help operators make good decisions when the UI says weekly Codex usage is nearly exhausted.

## Mental Model

Codex usage has two constraints:

1. **Five-hour bucket:** short-term throughput.
2. **Weekly bucket:** total fuel.

The five-hour bucket controls how much work can happen right now.

The weekly bucket controls whether Codex should be doing autonomous work at all.

If five-hour capacity is high but weekly capacity is low, the system is not blocked by rate. It is constrained by fuel.

The simplest metaphor:

> You have plenty of pressure in the hose, but almost no water left in the tank.

## Operating Modes

### Normal Mode

Use when weekly remaining is above 25%.

Allowed:

- autonomous implementation
- CI monitoring
- multi-step debugging
- broad repo inspection
- subagents when useful
- multi-file refactors when scoped and verified

### Conservation Mode

Use when weekly remaining is 5-25%.

Allowed:

- focused implementation
- single-lane debugging
- targeted tests
- short code review
- bounded file inspection

Avoid:

- broad exploration
- multi-agent work
- repeated CI polling
- speculative refactors
- branch archaeology
- open-ended cleanup

### Emergency Mode

Use when weekly remaining is below 5%.

Allowed:

- answer-only reasoning
- interpreting pasted logs
- one-file patches
- next-command recommendations
- final review before manual push
- focused inspection only when explicitly requested

Forbidden by default:

- subagents
- autonomous loops
- "monitor CI"
- broad repo scans
- long-running tool use
- cleanup/refactor missions
- multi-PR orchestration
- speculative implementation

## Emergency Mode Rules

When weekly remaining is below 5%:

1. Prefer no tools unless explicitly requested.
2. Ask for pasted output instead of running broad inspection.
3. Use Codex as a scalpel, not a worker.
4. One task per turn.
5. One decision per response.
6. No subagents.
7. No background monitoring.
8. No open-ended "continue until done."
9. Prefer commands the human can run manually.
10. Stop after providing the next concrete action.

## Tool Cost Classes

### Low Cost

Allowed in Emergency Mode when needed:

- read one specified file
- inspect one pasted log excerpt
- run one focused test
- generate one minimal patch
- answer one concrete question

### Medium Cost

Allowed in Conservation Mode; avoid in Emergency Mode unless explicitly requested:

- grep broad repo
- run build
- inspect PR diff
- inspect focused GitHub checks
- compare a small branch

### High Cost

Forbidden by default in Emergency Mode:

- monitor CI
- run full test suite
- multi-agent delegation
- broad refactor
- branch archaeology
- multi-PR orchestration
- "fix whatever comes up"

## CI Monitoring Replacement

Do not spend Codex on CI polling in Emergency Mode.

The human should run:

```bash
gh pr checks <PR_NUMBER> --watch --interval 30
```

Invoke Codex again only if a check fails. Paste the failing log excerpt, not the entire CI stream.

## Emergency Prompt Patterns

### Good

```text
Answer only. No tools. Here is the failing CI excerpt. What is the next command?
```

```text
Patch only this file. Do not inspect the repo beyond this pasted function.
```

```text
Given this diff, identify the single highest-risk issue.
```

```text
Tell me whether to merge, close, or split this PR. No tools.
```

### Bad

```text
Fix the PR and monitor CI.
```

```text
Explore the repo and clean up anything stale.
```

```text
Keep going until done.
```

```text
Use agents to finish this quickly.
```

## Agent Behavior Examples

### Bad Emergency Behavior

> I will inspect the repo, run tests, check GitHub, and fix whatever I find.

Why bad:

- open-ended
- tool-heavy
- burns weekly fuel
- may trigger long autonomous loops

### Good Emergency Behavior

> The error points to `src/foo.ts`. Run:
>
> ```bash
> npx vitest run test/foo.test.ts --reporter=dot
> ```
>
> Paste the failure if it persists.

Why good:

- one next action
- user runs the command
- Codex is used for decision support

## One-Sentence Summary

When weekly Codex usage is low, Codex should stop being the worker and become the navigator.

