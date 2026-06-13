# Reliability Baseline — 2026-06-13

> Phase 0.3 of the diagnose-and-fix campaign (`docs/fable-handoffs/2026-06-12/diagnose-and-fix-plan.md`).
> The **before** number every Phase-1 reliability fix gates against.

## Method
- `pnpm reliability:probe --domain p5,glsl,three,svg,ascii,kinetic,textgen --n 3`
- Real generator path (`bin/sinter`), novel prompts, **no `--learn`** (zero archive mutation).
- Captured `2026-06-13T05:11Z` while `com.sinter.self-improve` was running (probe doesn't touch the archive, so no freeze needed; only shared GLM rate-limit contention, none observed — zero `rate_limited` classes).
- `hydra` excluded (≈8 min/gen — handled in Phase 3); `tone`/`strudel` excluded (audio, judge-only, not a reliability target).

## Results (N=3 per domain)

| Domain  | Pass | Rate | Mean score | Failure class |
|---------|------|------|-----------|---------------|
| p5      | 2/3  | 67%  | 0.80 | `other` ×1 |
| glsl    | 2/3  | 67%  | 0.72 | **`glsl_undefined_fn` ×1** (A3) |
| three   | 2/3  | 67%  | 0.73 | `brightness_dark` ×1 |
| svg     | 2/3  | 67%  | 0.70 | **`svg_no_raw` ×1** (A1) |
| ascii   | 3/3  | 100% | 0.71 | — (clean) |
| kinetic | 1/3  | 33%  | 0.82 | `other` ×2 |
| textgen | 2/3  | 67%  | 0.67 | **`empty_after_strip` ×1** (A2) |
| **Overall** | **14/21** | **67%** | — | |

Aggregate 67% matches the daemon ledger's all-time 66% completion — the probe is calibrated to live behavior.

## Read

**The three Phase-1 targets are confirmed live**, each firing in the baseline:
- **A1 `svg_no_raw`** (svg) — provider returns no raw `<svg>` after 2 bounded attempts.
- **A2 `empty_after_strip`** (textgen) — code empty after reasoning-strip.
- **A3 `glsl_undefined_fn`** (glsl) — validator rejects common helpers (rot/hash/noise).

**Two findings beyond the Phase-1 three:**
- **kinetic is the worst domain (33%)** with 2 **unclassified (`other`)** failures — the classifier has no signature for them yet. This is a Phase-1 diagnosis task: re-probe kinetic with raw error capture, identify the signature, add a class, then fix or route. Possibly the same `<head>`-balance class the watchman fixed (#45) recurring, or a new one.
- **three hit `brightness_dark`** — the hydra brightness gate firing on a three.js render. Belongs with the Phase-3 hydra/brightness work, not Phase 1.

## Sampling caveat (gating rule)
N=3 gives only ±33% resolution on pass-rate, so **the durable signal is the failure CLASS, not the exact rate.** Phase-1 gating rule:

> A Phase-1 fix is verified when an **N=10 re-probe of its domain shows the targeted class at 0 occurrences** AND the domain pass-rate is ≥ baseline. The class going to zero is the contract; the rate is indicative.

## Per-domain Phase-1 targets

| Domain  | Target | Verify |
|---------|--------|--------|
| svg     | `svg_no_raw` → 0 | `pnpm reliability:probe --domain svg --n 10` |
| textgen | `empty_after_strip` → 0 | `pnpm reliability:probe --domain textgen --n 10` |
| glsl    | `glsl_undefined_fn` → 0 | `pnpm reliability:probe --domain glsl --n 10` |
| kinetic | classify `other`, then drive → 0 | diagnose raw error first |

Raw capture: `.quality/reliability-baseline.json` (gitignored) in the Phase-0 worktree at capture time.
