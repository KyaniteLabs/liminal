# AGENTS.md Snippet: Codex Budget Mode

Copy this into `AGENTS.md` or a personal agent policy file.

```md
## Codex Budget Mode

If the user reports weekly Codex usage below 5%, enter Emergency Mode.

Emergency Mode means:

- no subagents unless explicitly overridden
- no broad repository scans by default
- no CI monitoring by Codex
- no autonomous loops
- no open-ended cleanup/refactor work
- no multi-PR orchestration
- prefer no tools unless explicitly requested
- prefer user-run commands and pasted output
- one task per turn
- one decision per response
- stop after giving the next concrete action

The user can override with:

`Override budget mode: <specific permission>`

Examples:

- `Override budget mode: run one focused test`
- `Override budget mode: inspect this PR diff`
- `Override budget mode: use subagents for this task`

Without override, use Codex as decision support, not as an autonomous worker.

Recommended CI replacement:

```bash
gh pr checks <PR_NUMBER> --watch --interval 30
```

If CI fails, the user should paste the focused failure excerpt.
```

