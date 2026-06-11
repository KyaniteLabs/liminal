# Handoff 01 — Code review: F4 sing render-pipeline wiring test (forge branch `feat/f4-sing-wiring-test` @ ce0b2011)

**Mode:** INSPECT ONLY. You may not edit code, tests, or docs.

## Purpose

Independent review pass for the audit-F4 fix before it merges on Forgejo (the source of truth; GitHub PR #699 was closed unmerged — review happens here instead because Forgejo CI is not yet wired).

## Why this matters

`packages/sing` (the voice→visual performance instrument) had **zero tests**. This one-commit branch adds `test/unit/sing/pipeline-wiring.test.ts` (4 tests) pinning the One-Euro binder wiring: rms smoothing, pitch hold/release across unvoiced gaps, exponential onset decay, and preset-uniform mapping. There is no automated CI gate on forge yet, so this review + local commands ARE the merge gate.

## Exact files to inspect

- `test/unit/sing/pipeline-wiring.test.ts` (the only file in the diff: `git show ce0b2011 --stat`)
- `packages/sing/src/render/pipeline.ts` (the module under test — read, don't edit)
- `CLAUDE.md` § "Test Quality Standards" (the 7 rules the test must meet)

## Exact commands to run

```bash
git log --oneline -1   # must be ce0b2011
pnpm exec vitest run test/unit/sing/pipeline-wiring.test.ts --coverage.enabled=false
pnpm typecheck
```

Expected: 4/4 tests pass; typecheck exit 0 (both verified 2026-06-10 by the orchestrator — reproduce, don't trust).

## Review checklist (each item gets a verdict + one-line evidence)

1. Assertions test outcomes with specific values/tight ranges (CLAUDE.md rules 1–2) — flag any `toBeDefined`/bare `toBeGreaterThan(0)`-style weakness.
2. Test imports the real module (no mocking of the module under test — rule 4).
3. The magic constants asserted (`0.82` decay, `>150` pitch hold, normalization of `0.2→1.0`) match what `packages/sing/src/render/pipeline.ts` actually computes — verify against the source, not the test's comments.
4. Error/edge paths: does the file cover reset, unvoiced, zero-input shapes (rule 6)? Name any missing edge worth a follow-up test.
5. The test is deterministic (no timers, randomness, or browser/microphone deps).

## Definition of done

A filled checklist with verdicts, plus an overall verdict: APPROVE / APPROVE-WITH-NITS / REQUEST-CHANGES.

## Do not touch

Anything outside reading the three files listed. No commits, no pushes, no new files.

## Final report format

```
VERDICT: <APPROVE|APPROVE-WITH-NITS|REQUEST-CHANGES>
COMMANDS: <each command + exit code + 1-line result>
CHECKLIST: <5 numbered verdicts with evidence>
FOLLOW-UPS: <bullet list or "none">
```

Stop and ask if: HEAD is not ce0b2011, the test fails, or the diff contains more than the one test file.
