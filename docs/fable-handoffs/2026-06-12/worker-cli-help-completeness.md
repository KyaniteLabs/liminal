# Worker Task — CLI --help completeness (document garden/taste/dream/emergence/fs/--learn)

Repo: `~/workspaces/liminal` (Sinter). Forgejo is source of truth; main is branch-protected.
**Claude model restriction: Sonnet or Haiku only; no Opus, no Fable.** Zero LLM generation needed for this task.

## Problem
From the 2026-06-10 production audit: `sinter --help` does not document these existing, working commands/flags: `garden`, `taste`/`preferences`, `dream`, `emergence`, `fs`, and the `--learn` flag. Operators and agents can't discover them.

## Goal
Update the help output in `bin/sinter` so every implemented top-level command and the `--learn` flag appear with a one-line description matching actual behavior (verify each against the command implementations in `bin/sinter` — do not document anything that doesn't exist; if a listed command genuinely doesn't exist, note it in the PR body instead of inventing it). Follow the existing help text's format/ordering style exactly. Neurodivergent-accessible phrasing: plain, specific, one capability per line.

## Constraints
1. ISOLATED worktree: `cd ~/workspaces/liminal && git fetch origin && git worktree add .claude/worktrees/cli-help -b codex/cli-help origin/main && cd .claude/worktrees/cli-help && pnpm install --prefer-offline`. NEVER `git checkout` in the main checkout (paused daemon points at it).
2. Touch ONLY `bin/sinter` (help text) + a test (check for an existing help/CLI test under `test/`; extend it, else add `test/unit/cli/help.test.ts` asserting each command name appears in the help output — exact strings).
3. Do NOT touch `~/.sinter/**` (archive mid-write by another process), `src/`, or anything else.

## Acceptance
1. `node bin/sinter --help` prints all commands incl. the additions (paste output).
2. New/extended test green: `pnpm exec vitest run <test path> --coverage.enabled=false`; `pnpm build` green.
3. PR → main via Forgejo API: token `TOKEN=$(printf 'protocol=https\nhost=git.kyanitelabs.tech\n\n' | git credential fill | awk -F= '/^password=/{print $2}')`; create `curl -s -X POST -H "Authorization: token $TOKEN" -H "Content-Type: application/json" https://git.kyanitelabs.tech/api/v1/repos/KyaniteLabs/liminal/pulls -d '{"head":"codex/cli-help","base":"main","title":"...","body":"..."}'; merge with `.../pulls/<N>/merge -d '{"Do":"merge"}'`; verify ancestor; clean worktree+branches. If credential commands are blocked: push, open PR if possible, end NEEDS_GUIDANCE naming the blocked step. Never store the token in a file.
