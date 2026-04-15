# Codex Budget Enforcement Proposal

## Goal

Turn the Codex Budget Operating Model into enforceable workflow behavior.

The enforcement should be lightweight, reversible, and operator-controlled.

## Proposed Layers

1. Manual mode declaration.
2. Machine-readable budget state.
3. AGENTS policy.
4. Pre-tool checklist.
5. CI monitoring replacement.
6. Subagent gate.

## 1. Manual Mode Declaration

The user can declare mode in plain language:

```text
budget normal
budget conserve
budget emergency
```

The agent should obey the declared mode for the rest of the session unless the user changes it.

## 2. Machine-Readable Budget State

Store budget mode in:

```text
.omx/state/codex-budget.json
```

Suggested shape:

```json
{
  "mode": "emergency",
  "weeklyRemainingPercent": 1,
  "fiveHourRemainingPercent": 96,
  "refreshesAt": "2026-04-16T00:00:00Z",
  "updatedAt": "2026-04-15T00:00:00Z",
  "source": "user_reported"
}
```

Mode values:

- `normal`
- `conserve`
- `emergency`

## 3. Helper Script

Add a script:

```text
scripts/codex-budget-mode.mjs
```

Example usage:

```bash
node scripts/codex-budget-mode.mjs emergency --weekly 1 --five-hour 96 --refreshes "2026-04-16T00:00:00Z"
node scripts/codex-budget-mode.mjs conserve --weekly 12 --five-hour 80
node scripts/codex-budget-mode.mjs normal --weekly 75 --five-hour 100
```

Responsibilities:

- create `.omx/state/` if needed
- write `codex-budget.json`
- print the active mode
- optionally warn when weekly remaining is below 5%

## 4. Session Start Behavior

At coding session start, the agent should inspect:

```text
.omx/state/codex-budget.json
```

If missing, continue normally.

If present:

- `normal`: no restrictions
- `conserve`: avoid broad work unless requested
- `emergency`: no autonomous/tool-heavy work unless explicitly requested

## 5. Pre-Tool Checklist

In Conservation or Emergency Mode, before tool use, the agent must ask internally:

1. Is this tool call necessary?
2. Can the user run this command instead?
3. Will this save more time than it costs?
4. Is the scope bounded?
5. Is this the highest-ROI next action?

If the answer is no, do not call the tool.

## 6. Emergency Mode Tool Policy

Default denied:

- broad `rg`
- full test suite
- CI watch loops
- subagents
- branch archaeology
- repo-wide cleanup
- multi-PR orchestration

Allowed if explicitly requested:

- one focused command
- one file read
- one failing log inspection
- one minimal patch

## 7. CI Policy

In Emergency Mode, Codex must not monitor CI by default.

Tell the user to run:

```bash
gh pr checks <PR_NUMBER> --watch --interval 30
```

Codex should inspect CI only when:

- a check has failed, and
- the user pasted a focused excerpt or explicitly asked Codex to fetch logs.

## 8. Subagent Gate

In Emergency Mode:

- `spawn_agent` is disabled by default.
- team/swarm/parallel work is disabled by default.

Override phrase:

```text
Override budget mode: use subagents for this task.
```

Without that phrase, the agent should refuse or propose a manual low-budget alternative.

## 9. Output Contract In Emergency Mode

Every Emergency Mode answer should end with exactly one of:

- a single next command
- a single patch
- a single decision
- a request for one specific pasted output

Avoid:

- broad plans
- multiple optional paths
- tool-heavy next steps

## 10. Suggested AGENTS Integration

Add `AGENTS_SNIPPET.md` to repo/root or user-level `AGENTS.md`.

The snippet should be short enough to survive compaction and strong enough to override default autonomous behavior.

## 11. Acceptance Criteria

This proposal is implemented when:

- `.omx/state/codex-budget.json` can declare mode.
- `AGENTS.md` references the policy.
- Emergency Mode disables subagents by default.
- Emergency Mode replaces CI monitoring with user-run `gh pr checks`.
- Agents provide one next action at a time under weekly remaining below 5%.

