# Raw Hook Scripts — Liminal Project

Extracted from `/Users/simongonzalezdecruz/.claude/hooks/`
27 hook scripts total.

---

## wiring-checklist.js — PreToolUse[ExitPlanMode]

**Enforces**: End-to-end wiring standard — no component left disconnected.
**Mechanism**: When a plan is about to be approved, it injects an XML reminder block listing six wiring checks: no stubs, no orphan modules, no dead CLI commands, no missing dependencies, no disconnected bridges, test the full path. It checks for src/lib/app directories before triggering. Logs all events to a JSONL harness log.
**Personality**: The developer has been burned repeatedly by agents that build modules and never connect them. This hook encodes the lesson: "If any component is built but not connected, the plan is NOT complete." The phrasing is absolute, unforgiving — a scar from past failures.
**Notable Quotes**: "No orphan modules — every new module must be imported and used somewhere", "No dead CLI commands — every command path must lead to working code", "If any component is built but not connected, the plan is NOT complete."

---

## process-enforcement.js — PreToolUse[ExitPlanMode]

**Enforces**: Five mandatory process standards: plan first, context-window-sized tasks, parallel sub-agent waves, red-green-refactor TDD, full testing pyramid.
**Mechanism**: Injects a block of five non-negotiable rules before plan approval. Each rule is stated as an absolute requirement, not a suggestion. The testing pyramid rule demands unit, integration, AND e2e tests — "All three layers are required. Skipping any layer is unacceptable."
**Personality**: This is a battle-hardened engineering manager speaking. The language is deliberately prescriptive: "This is not optional", "unacceptable", "MUST". The developer has seen what happens when these standards slip and encoded the pain into a pre-commit gate.
**Notable Quotes**: "Never start coding without a written plan. If you skipped planning, go back.", "This is not optional. No implementation without a test written first.", "All three layers are required. Skipping any layer is unacceptable."

---

## check-overcomplication.js — PreToolUse[Write/Edit]

**Enforces**: The AHA (Avoid Hasty Abstractions) principle — no premature abstraction without three or more observed repetitions.
**Mechanism**: Reads tool input from stdin, scans file content for patterns of premature abstraction (base class with single subclass, abstract classes, generic utility naming, automation-instead-of-work patterns). Has a 75-line limit for scripts. Blocks writes (exit 2) that match overcomplication patterns UNLESS they contain justification markers like "AHA: 3+ repetitions" or architecture decision records.
**Personality**: This developer has watched AI agents build elaborate frameworks when a simple function would do. The error message is a direct command: "DO THE WORK DIRECTLY." The three-step remediation reveals the philosophy: do it manually first, observe the pattern, only then abstract. Fail-open on errors — trust over safety when parsing fails.
**Notable Quotes**: "DO THE WORK DIRECTLY. Scripts after 3+ repetitions only.", "DO THE TASK DIRECTLY 2-3 times first", "Only then create the abstraction"

---

## check-bug-dismissal.js — PreToolUse[Write/Edit]

**Enforces**: Zero tolerance for bug dismissal without verification — "OWN THE WHOLE SYSTEM."
**Mechanism**: Scans file content for dismissal patterns ("this existed before", "out of scope", "not my problem", "I didn't introduce this"). If dismissal patterns are found, checks for git verification patterns (git log, git blame, confirmed via git). If no verification is present, blocks the write with exit 2. The error message demands proof or ownership.
**Personality**: This is the most revealing hook about the developer's values. The agent is not allowed to say "not my problem" — ever. The system is holistic; every bug in sight is the agent's responsibility. The remediation instructions are explicit: verify with git before claiming pre-existence, ask the user before declaring scope boundaries, fix it or document why.
**Notable Quotes**: "OWN THE WHOLE SYSTEM. No artificial boundaries.", "IT IS YOUR PROBLEM. Fix it or document why."

---

## code-quality.js — PostToolUse[Write/Edit]

**Enforces**: Automated linting after every file write or edit.
**Mechanism**: Detects the file extension and selects the appropriate linter (ruff for Python, eslint for JS/TS/JSX/TSX, golint for Go, cargo clippy for Rust). Runs the linter and distinguishes between "linter found issues" (shows condensed warning, max 15 lines) and "linter binary crashed" (logs the crash). Never blocks — always exits 0. Results are logged to the harness JSONL.
**Personality**: Pragmatic quality enforcement. The developer wants feedback, not gatekeeping. The 15-line truncation shows respect for context windows. The distinction between "lint issues" and "crash" reveals someone who has dealt with flaky tooling and doesn't want false positives blocking work.
**Notable Quotes**: "Distinguishes 'code has lint issues' from 'linter binary crashed'." (from the docstring)

---

## file-protection.sh — PreToolUse[Write/Edit]

**Enforces**: Two-tier file protection — hard block for secrets/identity, soft warn for meta files.
**Mechanism**: Checks file paths against hard-block patterns (.openclaw/, auth-profiles.json, .plist, SOIL.md, IDENTITY.md) — these get exit 1 (block). Warn-allow patterns (MEMORY.md, settings.json, CLAUDE.md) get exit 0 with a reminder. Logs all checks.
**Personality**: The two-tier system reveals nuance. Some files are sacred and must never be touched (identity, auth). Others are important but legitimately need updates (memory, config, instructions) — the agent is trusted but reminded to be intentional. The developer protects their identity files with particular ferocity.
**Notable Quotes**: "BLOCKED: Cannot modify $FILE_PATH (protected)", "[file-protection] Modifying $FILE_PATH — ensure changes are intentional."

---

## review-checklist.js — PostToolUse[Write/Edit]

**Enforces**: Self-review after every code write — catch stubs, TODOs, console.log leaks, and excessive `any` usage.
**Mechanism**: After any Write/Edit to source code files, reads the file and checks for: "not yet implemented" stubs, TODO/FIXME markers, console.log in non-test/non-cli files, excessive `any` TypeScript usage (>3 occurrences), and missing imports (basic heuristic). Outputs an XML reminder block with numbered issues. Never blocks — soft reminder only.
**Personality**: This is the developer's inner quality voice, activated on every file save. The checks are specific to past failures: console.log leaks, stub code, type-safety erosion. The "not yet implemented" check directly mirrors the wiring-checklist's concern. The >3 `any` threshold shows the developer tolerates some pragmatism but draws a line.
**Notable Quotes**: "Contains 'not yet implemented' — this is a stub that needs real code", "Excessive 'any' usage (N occurrences) — use proper types", "Fix these before considering the task complete."

---

## destructive-guard.sh — PreToolUse[Bash]

**Enforces**: Block dangerous shell commands — no `rm -rf /`, no force pushes, no table drops.
**Mechanism**: Checks bash commands against a hardcoded list of destructive patterns (rm -rf /, dd if=/dev/zero, mkfs, fork bombs, git reset --hard, git push --force, drop table, etc.). Matches via case-insensitive regex. Blocks with exit 1 on match, suggests explicit confirmation as override.
**Personality**: Safety-first but not paternalistic. The guard blocks known-dangerous patterns but provides an escape hatch: "If you're sure this is safe, use the exact command in a single Bash call." The pattern list reads like a history of things that went wrong — fork bombs and mkfs suggest the developer has seen (or feared) catastrophic mistakes.
**Notable Quotes**: "This operation requires explicit confirmation.", "If you're sure this is safe, use the exact command in a single Bash call."

---

## session-end-wiring-check.js — Stop

**Enforces**: No unfinished work markers left in source at session end.
**Mechanism**: On session stop, greps source directories (src/lib/app) for TODO, FIXME, HACK, "not yet implemented", "placeholder", and "no-op" markers. Groups findings by label and outputs a summary. Never blocks — purely informational. Logs findings to harness JSONL.
**Personality**: A final quality gate before the session closes. The developer wants to know what was left unfinished. The exclusion of "TODO: remove" and "TODO: delete" from the pattern shows sophistication — intentional TODOs for cleanup are acceptable.
**Notable Quotes**: "[session-end-wiring-check] N unfinished marker(s) found"

---

## bash-exit-logger.sh — PostToolUse[Bash]

**Enforces**: Logging of every failed bash command for retrospective analysis.
**Mechanism**: Reads stdin JSON from Claude Code (with positional arg fallback). If the exit code is non-zero, writes a structured JSON log entry with timestamp, command, exit code, stdout, stderr, and working directory to a daily JSONL file. Skips template variables that weren't interpolated.
**Personality**: The developer values observability. Every failure is recorded for later analysis — not to block, but to learn. The JSONL format and daily rotation suggest this data feeds into some review process. The template variable guard shows attention to edge cases from the Claude Code integration.
**Notable Quotes**: (This hook is utilitarian — its personality is in the silent, methodical recording of failures rather than error messages.)

---

## win-loss-tracker.js — PostToolUse[Bash]

**Enforces**: Track the agent's command execution win/loss ratio.
**Mechanism**: After every bash command, records whether it succeeded (exit 0) or failed (non-zero) to a stats.json file. Maintains a running count and a rolling window of the last 1000 commands with timestamps. Calculates and logs the success rate percentage. Never blocks.
**Personality**: The developer treats AI agent performance like a sports stat line — wins and losses, tracked over time. This is a measurement mindset: you can't improve what you don't measure. The 1000-command rolling window suggests ongoing monitoring, not just one-off checks.
**Notable Quotes**: (The personality is in the concept itself — treating an AI coding agent's reliability as a measurable statistic.)

---

## session-restore.js — SessionStart

**Enforces**: Continuity across sessions — restore context from previous work.
**Mechanism**: On session start, reads the most recent progress JSON file from ~/.claude/progress/, extracts branch, commit, diff summary, and uncommitted files, and displays them. Also checks for pending handoff files in ~/.claude-handoff/ that match the current project context, displaying any with "pending" status. Logs all events.
**Personality**: The developer hates losing context. Every session should pick up where the last one left off. The handoff system suggests multi-agent or multi-session workflows where work transfers between contexts. The emoji usage in output (📋, 📬, 📄) is notable — the only hook that uses them, suggesting this is a user-facing notification, not just internal logging.
**Notable Quotes**: "Restored context from: [project]", "PENDING HANDOFFS — ACTION REQUIRED"

---

## staleness-check.js — SessionStart

**Enforces**: Memory files must not go stale — 7-day freshness requirement.
**Mechanism**: On session start, checks MEMORY.md, CLAUDE.md, and project memory files for age. If any file's mtime is older than 7 days, it's flagged as stale. Also checks for embedded date patterns in file content. Outputs warnings to stderr and logs findings.
**Personality**: The developer recognizes that AI agent memory rots. Instructions written weeks ago may be inaccurate today. The 7-day threshold is a pragmatic balance — not too aggressive, but not negligent. The embedded date check is clever: even if the file was touched, the content may reference outdated dates.
**Notable Quotes**: "[staleness-check] N stale memory file(s) detected"

---

## write-active-flag.sh — SessionStart

**Enforces**: Signal that a session is active for other tools to detect.
**Mechanism**: Creates a JSON file at ~/.claude/sessions/active containing the PID, start time, user, and working directory. This flag can be checked by other tools to know a session is running.
**Personality**: Infrastructure for multi-tool coordination. The developer has built a system where multiple tools need to know if a Claude session is active — this simple flag file enables that awareness.
**Notable Quotes**: (Minimal personality — pure infrastructure.)

---

## session-lock-acquire.sh — SessionStart

**Enforces**: Only one Claude session can run at a time — prevent concurrent session conflicts.
**Mechanism**: Uses a file lock (session.lock) and PID file. On session start, checks if a lock exists. If the lock-holding process is still running, blocks with exit 1. If the process is dead (stale lock), removes the lock and acquires it. Writes current PID to the lock files.
**Personality**: The developer has experienced the chaos of concurrent sessions modifying the same codebase. The 30-second MAX_WAIT variable suggests there was once a waiting mechanism that was simplified. The stale lock detection shows the developer anticipated crashes that leave orphaned locks.
**Notable Quotes**: "Please close that session first, or remove session.lock if you're sure it's stale."

---

## health-write.sh — SessionStart/Stop

**Enforces**: Health monitoring — external tools need to know session status.
**Mechanism**: Writes a JSON status file (start/stop) with timestamp, PID, user, and hostname to ~/.claude/health/status.json. Used by monitoring infrastructure.
**Personality**: Pure observability infrastructure. The developer has built an ecosystem of tools around Claude sessions that need health checks.
**Notable Quotes**: (Minimal personality — pure infrastructure.)

---

## remove-active-flag.sh — Stop

**Enforces**: Clean up the active session flag when session ends.
**Mechanism**: Checks if the active flag file exists and is owned by the current PID. If so, removes it. If owned by a different PID, logs a warning instead of removing. If no flag exists, logs a warning.
**Personality**: Careful about ownership — won't remove another session's flag. The PID check prevents race conditions between concurrent sessions.
**Notable Quotes**: (Minimal personality — responsible cleanup.)

---

## session-lock-release.sh — Stop

**Enforces**: Release the session lock on exit — let the next session start.
**Mechanism**: Checks if the lock file exists and is owned by the current PID. Only releases if ownership matches. Logs warnings for mismatches or missing locks.
**Personality**: Symmetrical with session-lock-acquire.sh. The lock-release/lock-acquire pair forms a mutex pattern adapted for shell scripting. The ownership check prevents one session from releasing another's lock.
**Notable Quotes**: (Minimal personality — responsible cleanup.)

---

## uncommitted-check.sh — Stop

**Enforces**: Warn about uncommitted work before session ends.
**Mechanism**: Runs git status --porcelain and counts staged/unstaged files. Outputs a summary with file counts and the current branch. Suggests committing. Never blocks — purely informational.
**Personality**: The developer has lost work by ending sessions without committing. This is a gentle but persistent reminder. The phrasing "Consider committing before ending the session" is suggestive, not commanding — the developer trusts their own judgment but wants the safety net.
**Notable Quotes**: "Session ending with N uncommitted file(s) on branch 'X'", "Consider committing before ending the session."

---

## context-dump.js — PreCompact

**Enforces**: Preserve context before the AI's context window is compacted.
**Mechanism**: Before context compaction, dumps session state (timestamp, session ID, agent ID, cwd, env, memory usage, uptime) and reads previews of project files (CLAUDE.md, CONTEXT.md, PROGRESS.md, README.md). Saves to a JSON file in ~/.claude/context-dumps/. Cleans up old dumps, keeping the last 50.
**Personality**: The developer treats context compaction as a potential data loss event. Every compact is preceded by a snapshot, ensuring nothing is truly lost. The 50-dump retention limit shows practical resource management. Reading project file previews is a clever hedge — even if the context is lost, the structure is preserved.
**Notable Quotes**: (The personality is in the precaution itself — treating AI memory as fragile and worth preserving.)

---

## save-progress.sh — PreCompact

**Enforces**: Save git-aware progress before context compaction.
**Mechanism**: Before compaction, gathers git context (branch, commit, diff stat, uncommitted files, staged files) and writes a structured JSON progress file. Keeps the last 20 progress files per project. Uses jq for JSON construction.
**Personality**: Companion to context-dump.js — this one focuses on git state specifically. The developer wants to know exactly what was in-flight when context was compacted. The 20-file retention per project suggests the developer works on multiple projects and wants per-project history.
**Notable Quotes**: (The personality is in the pairing with context-dump.js — double protection against context loss.)

---

## block-websearch.sh — PreToolUse[WebSearch]

**Enforces**: The built-in WebSearch tool is permanently disabled — use MCP alternatives.
**Mechanism**: Unconditionally outputs an error message to stderr and exits with code 2 (block). Lists four MCP alternatives: firecrawl_search, exa web_search_exa, brave_web_search, ref_search_documentation, plus the /web-research skill.
**Personality**: Absolute and unapologetic. The built-in tool doesn't work with the developer's GLM coding plan, so it's blocked entirely. The error message is helpful — it doesn't just say "no", it says "no, use this instead." This reflects a philosophy of redirecting rather than just restricting.
**Notable Quotes**: "BLOCKED: Built-in WebSearch is disabled — it does not work with GLM coding plan."

---

## block-webfetch.sh — PreToolUse[WebFetch]

**Enforces**: The built-in WebFetch tool is permanently disabled — use MCP alternatives.
**Mechanism**: Unconditionally outputs an error message to stderr and exits with code 2 (block). Lists four MCP alternatives: firecrawl_scrape, web_reader, ref_read_url, exa web_search_exa.
**Personality**: Same philosophy as block-websearch.sh — redirect, don't just restrict. The developer has invested in a superior tooling stack and wants to ensure it's used consistently.
**Notable Quotes**: "BLOCKED: Built-in WebFetch is disabled — use MCP alternatives instead."

---

## vault-notify.sh — Notification

**Enforces**: Session events should be logged to Obsidian vault and trigger macOS notifications.
**Mechanism**: Sends a macOS notification via osascript (with "Glass" sound) and appends session event details to a daily markdown file in an Obsidian vault's "Claude Sessions" folder. Each entry includes timestamp, event type, message, PID, and working directory.
**Personality**: The developer uses Obsidian as a second brain and wants Claude session events integrated into it. The "Glass" sound notification is a subtle personal touch. The vault integration suggests the developer reviews Claude sessions as part of a broader knowledge management workflow.
**Notable Quotes**: (The personality is in the Obsidian integration itself — treating AI coding sessions as first-class knowledge artifacts.)

---

## mcp-enforcement-check.sh — Session End (soft)

**Enforces**: jcodemunch and jdocmunch must be used for code/doc exploration instead of raw Grep/Glob/Read.
**Mechanism**: Outputs a soft reminder at session end asking the reviewer to verify that indexed search tools were used instead of raw filesystem tools. Does not block (exit 0).
**Personality**: Soft enforcement — the developer wants the behavior but recognizes that perfect compliance isn't always possible. The reminder is phrased as a checklist ("verify that... was used") rather than a command.
**Notable Quotes**: "If this session involved code exploration, symbol lookup, or understanding codebase structure, verify that jcodemunch (mcp__jcodemunch__*) tools were used instead of raw Grep/Glob/Read."

---

## superpowers-enforcement-check.sh — Session End (soft)

**Enforces**: The superpowers skills workflow must be followed — brainstorm before creative work, plan before multi-step, TDD before implementation, systematic debugging before fixes, verification before completion, code review after features.
**Mechanism**: Outputs a soft reminder at session end listing six superpowers skill triggers to check compliance against. Does not block (exit 0).
**Personality**: This encodes the developer's ideal workflow as a checklist. The six items form a complete development lifecycle: think, plan, test-first, debug-systematically, verify, review. The soft enforcement suggests the developer values the process but is realistic about its consistent application.
**Notable Quotes**: "Review this session for superpowers skill compliance. Check if: (1) brainstorming was invoked before creative/feature work, (2) writing-plans was used before multi-step tasks, (3) test-driven-development was used before writing implementation code..."
