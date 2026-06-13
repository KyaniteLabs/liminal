# Codex Window Tasks — 2026-06-12

Self-contained queue for headless codex while Fable's usage window resets. Repo: `~/workspaces/liminal` (product = Sinter). Forgejo is the source of truth; main is branch-protected — ALL work lands via branch → PR → merge.

## Hard rules (non-negotiable)
1. One branch per task (`codex/<slug>`), push after every commit, never commit to main.
2. NEVER weaken/skip/silence a failing check, test, or gate to make work pass. If blocked, write findings to `docs/fable-handoffs/2026-06-12/codex-findings.md` and stop that task.
3. Test-first where a test file exists; run the named verification before claiming done.
4. Never reuse a creative prompt verbatim in any generation test (LLM cache returns stale artifacts).
5. Do not touch: `~/.sinter` data files by hand, `vitest.config.ts` thresholds (they only go UP), the self-improve daemon, anything in `.quality/` (gitignored harnesses).
6. PR create+merge recipe (token never printed):
   `TOKEN=$(printf 'protocol=https\nhost=git.kyanitelabs.tech\n\n' | git credential fill | awk -F= '/^password=/{print $2}')`
   create: `curl -s -X POST -H "Authorization: token $TOKEN" -H "Content-Type: application/json" https://git.kyanitelabs.tech/api/v1/repos/KyaniteLabs/liminal/pulls -d '{"head":"<branch>","base":"main","title":"...","body":"..."}'`
   merge: `curl -s -X POST -H "Authorization: token $TOKEN" -H "Content-Type: application/json" https://git.kyanitelabs.tech/api/v1/repos/KyaniteLabs/liminal/pulls/<N>/merge -d '{"Do":"merge"}'`
   verify: `git fetch origin && git merge-base --is-ancestor <sha> origin/main`

## Context you need
- `src/prompts/PromptTier.ts` (NEW): `resolvePromptTier(model, provider)` → `'full'|'compact'`; `tiered({full, compact}, tier)` picks variants. Compact rules: ≤⅓ length, FLAT one-line JSON (no nested objects), rubric bands with concrete anchors, no prose preamble.
- The reference implementation of the recipe is `scoreRenderedEvidence` in `src/core/ScoringEngine.ts` (~line 780+): resolve tier → tiered prompts with `RUBRIC_BANDS` → pass `{ jsonMode: tier==='compact' }` → parser accepts both nested and flat shapes.
- Traps (measured this session): role configs never populate `LLMConfig.provider` — derive via `detectProviderFromUrl(baseUrl)` from `src/harness/MultiProviderConfig.ts`; `LLMClient.getConfig()` before `await LLMClient.loadRoles()` returns placeholder defaults; new relative imports in src/ need `.js` extensions (ESM dist).
- Full audit + migration queue: `docs/validation/prompt-audit-2026-06.md`.

## TASK 0 — Land `feat/prompt-tiering` (check state first)
The branch exists locally with the tiering work; a commit may still be unpushed (pre-commit hooks were running when this handoff was written).
- `git checkout feat/prompt-tiering && git status` — if changes are staged-but-uncommitted, the commit message lives in `git log` history of this handoff's session; commit as `feat(prompts): model-tiered prompts — compact variants for local models, banded rubrics for all`.
- Verify: `pnpm exec vitest run test/unit/core/ScoringEngine.test.ts test/unit/prompts/PromptTier.test.ts --coverage.enabled=false` → 93 passed; `pnpm build` → 0.
- Push, PR, merge per rule 6. Then `git checkout main && git pull` so the daemon runs main.
- IMPORTANT: `docs/validation/self-improve-ledger.jsonl` is the daemon's live file — never commit it on a feature branch (preserve via `cp` to /tmp before checkout, restore after).

## TASK 1 — Band + tier the ScoringEngine LLM strategy
`src/core/ScoringEngine.ts` ~line 344-360 (`scoreWithResult` / llm strategy): same anchor-free `"score": <number 0-1>` JSON ask. Apply the reference recipe: add the same `RUBRIC_BANDS` text (extract it to a shared const at module top so both judge prompts use ONE copy), tiered full/compact variants, flat compact shape, jsonMode on compact. Extend `test/unit/core/ScoringEngine.test.ts` minimally (the llm strategy tests exist — keep mock contracts real: mocks need `getConfig` + static `loadRoles`, see existing factory).
- Verify: same vitest command as Task 0, all green.

## TASK 2 — Band + tier LLMJudgeCritic
`src/aesthetic/critics/LLMJudgeCritic.ts` (~line 63 `SYSTEM_PROMPT`, 0.0-1.0 scale, dimension scores). Add rubric bands; author a compact variant with FLAT dimension keys (`"score":0.0,"composition":0.0,...` — no nested objects); resolve tier from the critic's LLM client config (same baseUrl trap applies). Parser must accept both shapes.
- Verify: `pnpm exec vitest run test/unit/aesthetic --coverage.enabled=false` green (extend tests if the prompt shape is asserted), `pnpm typecheck`.

## TASK 3 — Fold generateP5Sketch's bespoke check into PromptTier
`src/llm/LLMClient.ts` `generateP5Sketch` (~line 1065): has its own capability-based simplification (`!capabilities.jsonMode || maxContextTokens < 8192`). Replace the condition with `resolvePromptTier(this.config.model, detectProviderFromUrl(this.config.baseUrl)) === 'compact'` (keep the simplified prompt text as the compact variant via `tiered()`). No behavior change for current frontier models — assert that in a test (glm-5v → full path).
- Verify: `pnpm exec vitest run test/unit --coverage.enabled=false -t p5` relevant suites green; typecheck.

## TASK 4 — gemma vision pattern in CapabilityRegistry
`src/llm/CapabilityRegistry.ts` VISION_MODEL_PATTERNS: add `'gemma4*'` and `'gemma3*'` (gemma 3/4 are multimodal; today they require a manual config `capabilities` override). Add a unit test in the registry's test file asserting `supportsVision('gemma4:12b') === true` and `supportsVision('glm-5.1') === false` stays.
- Verify: registry tests green.

## TASK 5 — Archive top re-score script (NEW, wired, no daemon change)
Stored archive scores are stale (gen-time 0.95s re-score at 0.85 fresh — measured 2026-06-12). Create `scripts/quality/rescore-tops.mjs`: for each visual domain (p5,glsl,three,hydra,svg,ascii,textgen,kinetic), take the top-2 non-quarantined entries, re-render via `dist/render/HeadlessRenderer.js` `renderWithEvidence(entry.output, {domain})`, re-score via `dist/core/ScoringEngine.js` `scoreRenderedEvidence`, and print a JSON line per entry `{id, domain, stored, fresh, delta}`. DO NOT mutate the archive (read-only report — mutation needs the class-mutation rule and a separate decision). Add `"quality:rescore": "node scripts/quality/rescore-tops.mjs"` to package.json scripts (integration-first rule: must have a call site).
- Verify: run it once end-to-end (`pnpm quality:rescore`) — 16 JSON lines, no exceptions. Costs ~16 evaluator calls (cloud GLM) — acceptable, run ONCE.

## TASK 6 (stretch) — Full-tier guard for agentic prompts
Per the audit register: tool-loop/agentic prompts (`src/harness/agent/LLMModeAgent.ts`, `src/ledger/TaskRunner.ts`) should refuse compact-tier models rather than degrade. Add a small guard: if `resolvePromptTier(...)==='compact'`, log a clear warning naming the model and proceed with full (never silently compact). Keep it to ≤15 lines + one test.

## Report
Append per-task outcomes (branch, PR#, verification output) to `docs/fable-handoffs/2026-06-12/codex-findings.md`. Anything ambiguous: write it down and move on — do not improvise beyond a task's stated scope.
