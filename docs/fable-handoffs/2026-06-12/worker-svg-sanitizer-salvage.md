# Worker Task — SVG deterministic salvage (fence-strip + prose-extract before reject)

Repo: `~/workspaces/liminal` (Sinter). Forgejo is source of truth; main is branch-protected.
**Claude model restriction: Sonnet or Haiku only; no Opus, no Fable.**

## Problem
Post-#33, SVG generation still fails intermittently in the daemon: `SVGGenerator: provider returned no valid SVG after 2 bounded direct attempts: SVG output must be a raw <svg> document` (validator `src/generators/svg/SVGValidator.ts:52`). Root cause measured in PR #33's repro: providers sometimes wrap a perfectly valid SVG in markdown fences (```svg ... ```) or surround it with prose. Today that valid art is discarded. Precedent: kinetic got a deterministic normalizer for its failure mode (commit 564c6856 "balance unclosed <head> tags during normalization").

## Goal
In the SVG validation/sanitization path, BEFORE rejecting: (1) strip leading/trailing markdown fences (```svg, ```xml, ``` variants); (2) if prose surrounds the document, extract the first complete `<svg ...>...</svg>` block. Genuinely truncated output (no closing `</svg>`) must STILL be rejected — do not fabricate closing tags, do not weaken any other validation rule.

## Constraints
1. ISOLATED worktree: `cd ~/workspaces/liminal && git fetch origin && git worktree add .claude/worktrees/svg-salvage -b codex/svg-salvage origin/main && cd .claude/worktrees/svg-salvage && pnpm install --prefer-offline && pnpm build`. NEVER `git checkout` in the main checkout (paused daemon points at it).
2. Touch ONLY `src/generators/svg/` + its tests.
3. Do NOT touch `~/.sinter/**` — the archive file is mid-write by another process right now.
4. Repo test rules: exact-value assertions, error paths, vi.hoisted for mock vars.

## Acceptance
1. Unit tests: fenced-valid-SVG → sanitized+valid; prose-wrapped → extracted+valid; truncated (no `</svg>`) → still invalid; already-raw → unchanged.
2. `pnpm exec vitest run test/unit/generators --coverage.enabled=false` green; `pnpm typecheck`; `pnpm build`.
3. 2 SVG generations with NOVEL prompts pass end-to-end (paste scores).
4. PR → main via Forgejo API: token `TOKEN=$(printf 'protocol=https\nhost=git.kyanitelabs.tech\n\n' | git credential fill | awk -F= '/^password=/{print $2}')`; create `curl -s -X POST -H "Authorization: token $TOKEN" -H "Content-Type: application/json" https://git.kyanitelabs.tech/api/v1/repos/KyaniteLabs/liminal/pulls -d '{"head":"codex/svg-salvage","base":"main","title":"...","body":"..."}'; merge with `.../pulls/<N>/merge -d '{"Do":"merge"}'`; verify `git merge-base --is-ancestor <sha> origin/main`; clean worktree+branches. If credential commands are blocked: push, open PR if possible, end NEEDS_GUIDANCE naming the blocked step. Never store the token in a file.
