# Handoff 08 — F18 live-compose receipt (run AFTER `fix/f18-base-layer-background` merges)

**Mode:** Agent-executable. Spends 2 composite generations (multiple LLM calls). Vision grading stays in the MAIN agent (do not delegate the visual judgment to a text-only subagent).

## Purpose

The F18 fix (commit 92b8defc) changes LLM behavior via prompt contract; unit tests pin the prompt content, but the claim "the rendered composite now honors spec.background" needs one live receipt — the same standard #619's seam fix met.

## Why this matters

Register row F18 cites two inversions: Paper Signal (spec `#fbfaf7` paper-white → rendered dark) and Dusk Bloom (spec `#1a1020` dark dusk → rendered pale). Those exact two specs are the regression probes.

## Exact commands

```bash
git log --oneline -3   # confirm 92b8defc (or its merge) is in HEAD
pnpm build
node scripts/quality/matrix.mjs   # or the focused equivalent for the 'Paper Signal' and 'Dusk Bloom' specs only, if the script supports it
```

NOVEL-PROMPT RULE: the matrix specs are fixed strings by design (comparability) and #687 added a per-run nonce — verify the nonce is active in the run logs; if not, stop and flag.

## What to check (main-agent vision pass)

1. Paper Signal: the composite's dominant background reads light/paper (NOT dark). Exact match not required; lightness must not be inverted.
2. Dusk Bloom: dominant background reads dark dusk (NOT pale). The #694 render gate may also demote blends — read the gate verdict in the output; the F18 claim concerns the base layer's painted color, not the blend demotion.
3. Record measured mean luminance per composite if the gate prints it.

## Definition of done

Both renders attached/saved, lightness direction matches spec for both, one-line update to the register's F18 row: "live receipt <date>: paper-signal lum X.XX, dusk-bloom lum Y.YY — inversion gone".

## What not to touch

No code edits. If a composite still inverts, do NOT tune prompts — report with the render and the generated base-layer code so the contract wording can be revisited deliberately.

## Final report format

```
HEAD: <sha>
RUNS: <2 composite outputs + gate verdicts>
LUMINANCE: <per composite>
VERDICT: <inversion gone / persists (with evidence)>
REGISTER: <the one-line row update made or proposed>
```
