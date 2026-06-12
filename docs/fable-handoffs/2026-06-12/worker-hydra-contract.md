# Worker Task — Hydra generation failures: domain-specific craft contract (repro-first)

Repo: `~/workspaces/liminal` (Sinter). Forgejo is source of truth; main is branch-protected.
**Claude model restriction: Sonnet or Haiku only; no Opus, no Fable.**

## Problem
Hydra generations failed repeatedly in the daemon overnight ("All generation candidates failed", cycles 09:27Z/10:29Z/13:0xZ). Failure record `~/.sinter/failures/1781265823171-d607emr4j.json`: `Validation failed: Hydra code contains invalid method: .sin( - use math functions differently in Hydra` — the generator emits non-Hydra API (chained `.sin(`) and the validator correctly rejects all candidates. Precedent: the same class of bug hit SVG and was fixed by a domain-specific craft contract (PR #33: `SVG_CRAFT_CONTRACT` in `src/prompts/CraftContract.ts`, routed per-domain in `src/llm/PromptBuilder.ts`).

## Steps
1. ISOLATED worktree: `cd ~/workspaces/liminal && git fetch origin && git worktree add .claude/worktrees/hydra-contract -b codex/hydra-contract origin/main && cd .claude/worktrees/hydra-contract && pnpm install --prefer-offline && pnpm build`. NEVER `git checkout` in the main checkout (paused daemon points at it).
2. REPRO FIRST (mandatory evidence): 1–2 hydra generations with NOVEL prompts (e.g. `node bin/sinter "a Hydra live-coding visual of murmuration ribbons over slate water" -o /tmp/hydra-repro`); capture the raw generated code and the exact validator error. If it does not reproduce, STOP and report.
3. Fix, following #33's pattern: add `HYDRA_CRAFT_CONTRACT` / `HYDRA_CRAFT_CONTRACT_COMPACT` to `src/prompts/CraftContract.ts` — keep the craft intent but constrain to valid Hydra API (chainable Hydra transforms only; math via `() => Math.sin(time)` style function args, never `.sin()` chained methods; `.out()` at the end). Route the `hydra` domain in `src/llm/PromptBuilder.ts`. The per-domain selection is now repeated inline ternaries at 4 sites — extract a small `contractFor(domain, tier)` helper so svg/hydra (and future domains) route through ONE place; behavior for all other domains unchanged (assert in a test).
4. Do NOT weaken the Hydra validator; do NOT touch `src/core/**`; do NOT touch `~/.sinter/**` (archive mid-write by another process).

## Acceptance
1. 3 consecutive hydra generations with 3 NOVEL prompts pass end-to-end (paste scores).
2. `pnpm exec vitest run test/unit/prompts test/unit/llm --coverage.enabled=false` green (add contractFor routing tests incl. svg + default domains); `pnpm typecheck`; `pnpm build`.
3. PR → main via Forgejo API: token `TOKEN=$(printf 'protocol=https\nhost=git.kyanitelabs.tech\n\n' | git credential fill | awk -F= '/^password=/{print $2}')`; create `curl -s -X POST -H "Authorization: token $TOKEN" -H "Content-Type: application/json" https://git.kyanitelabs.tech/api/v1/repos/KyaniteLabs/liminal/pulls -d '{"head":"codex/hydra-contract","base":"main","title":"...","body":"..."}'; merge with `.../pulls/<N>/merge -d '{"Do":"merge"}'`; verify ancestor; clean worktree+branches. If credential commands are blocked: push, open PR if possible, end NEEDS_GUIDANCE naming the blocked step. Never store the token in a file.
