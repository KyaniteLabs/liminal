# Human Perception Guardrails and Creative Vocabulary Engines Implementation Plan

**Goal:** Reframe Liminal's aesthetic system so hard guardrails protect human sensory ergonomics while optional creative vocabulary engines help users steer color, music, motion, video, and writing preferences.

**Architecture:** Add a small domain-neutral perception/vocabulary layer, preserve existing validators/evaluators, and migrate misleading aesthetic naming through compatibility wrappers. The first implementation should be metadata- and tests-first: make CLI/docs truthful, add perception guardrail contracts, then wire advisory vocabulary engines without forcing subjective beauty rules.

**Tech Stack:** TypeScript/ESM, Vitest, existing `src/aesthetic`, `src/music`, `src/core`, `src/guardrails`, `src/render`, CLI `bin/liminal`, docs under `docs/`.

---

## Non-negotiables

- Do not remove existing capabilities.
- Work in an isolated git worktree.
- Keep edits small and reviewable.
- Preserve current public imports until compatibility wrappers are in place.
- No new dependencies unless explicitly approved.
- Treat subjective creative preferences as advisory unless the user explicitly asks to enforce them.
- Treat human perception failures as repair targets or guardrail failures.

---

## Task 1: Lock vocabulary and naming with tests

**Files:**
- Create: `src/creative-vocabulary/types.ts`
- Create: `test/unit/creative-vocabulary/types.test.ts`
- Modify: `src/index.ts` only if public exports are already centralized there and tests require it.

**Step 1: Write the failing test**

Create `test/unit/creative-vocabulary/types.test.ts` with assertions that:

- `GuardrailLayer.HumanPerception` exists.
- `CreativeVocabularyDomain` includes `color`, `music`, `motion`, `cinematic`, `creative-writing`.
- `CreativeVocabularyEngine` exposes `describeTerms`, `inferPreferences`, `suggestQuestions`, and `buildPromptHints`.
- Subjective terms are not represented as hard guardrail severities.

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm exec vitest run test/unit/creative-vocabulary/types.test.ts --coverage=false --pool=forks
```

Expected: FAIL because `src/creative-vocabulary/types.ts` does not exist.

**Step 3: Implement minimal types**

Create `src/creative-vocabulary/types.ts` with:

- `GuardrailLayer = 'human-perception' | 'domain-correctness' | 'creative-completeness' | 'creative-preference'`
- `CreativeVocabularyDomain = 'color' | 'music' | 'motion' | 'cinematic' | 'creative-writing'`
- `CreativeTerm`
- `CreativeQuestion`
- `CreativeContext`
- `CreativeVocabularyEngine<TPreferences>`
- `PerceptionCheckResult`
- `PerceptionIssue`

Keep types dependency-free.

**Step 4: Run test to verify it passes**

Run:

```bash
pnpm exec vitest run test/unit/creative-vocabulary/types.test.ts --coverage=false --pool=forks
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/creative-vocabulary/types.ts test/unit/creative-vocabulary/types.test.ts
git commit -m "Define humane creative vocabulary boundaries"
```

Use Lore trailers:

```text
Constraint: Preserve existing aesthetic capabilities while preventing beauty-score semantics from spreading
Confidence: high
Scope-risk: narrow
Tested: pnpm exec vitest run test/unit/creative-vocabulary/types.test.ts --coverage=false --pool=forks
```

---

## Task 2: Add HumanPerceptionGuardrails contract

**Files:**
- Create: `src/perception/HumanPerceptionGuardrails.ts`
- Create: `src/perception/types.ts`
- Create: `src/perception/index.ts`
- Create: `test/unit/perception/human-perception-guardrails.test.ts`

**Step 1: Write failing tests**

Test cases:

1. Empty visual evidence fails as imperceptible.
2. Silent audio evidence fails unless `allowSilence: true`.
3. Dangerous flicker frequency fails.
4. Subjective choices like "muted palette" are not failures.
5. Domain-specific issue IDs are stable strings.

**Step 2: Run test to verify it fails**

```bash
pnpm exec vitest run test/unit/perception/human-perception-guardrails.test.ts --coverage=false --pool=forks
```

Expected: FAIL due missing module.

**Step 3: Implement minimal guardrail contract**

Implement pure functions only:

- `evaluateVisualPerception(input)`
- `evaluateAudioPerception(input)`
- `evaluateTextPerception(input)`
- `evaluateVideoPerception(input)`
- `evaluateHumanPerception(input)` dispatcher

Initial inputs should be simple metadata, not browser rendering:

```ts
interface VisualPerceptionInput {
  domain: 'p5' | 'glsl' | 'hydra' | 'three' | 'html' | 'ascii';
  luminanceMean?: number;
  luminanceStdDev?: number;
  contrastRatio?: number;
  flickerHz?: number;
  hasVisibleContent?: boolean;
  userIntent?: string;
}
```

Use conservative constants:

- `SAFE_MAX_FLICKER_HZ = 3`
- `MIN_AUDIBLE_HZ = 20`
- `MAX_AUDIBLE_HZ = 20_000`
- `MIN_READABLE_CONTRAST = 3`
- `MIN_CAPTION_SECONDS = 1.5`

**Step 4: Run test to verify it passes**

```bash
pnpm exec vitest run test/unit/perception/human-perception-guardrails.test.ts --coverage=false --pool=forks
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/perception test/unit/perception/human-perception-guardrails.test.ts
git commit -m "Separate human perception checks from taste scoring"
```

---

## Task 3: Reframe ColorTheoryEngine as a vocabulary engine

**Files:**
- Modify: `src/aesthetic/ColorTheoryEngine.ts`
- Create: `src/creative-vocabulary/ColorVocabularyEngine.ts`
- Create: `test/unit/creative-vocabulary/color-vocabulary-engine.test.ts`

**Step 1: Write failing tests**

Test that `ColorVocabularyEngine`:

- Describes terms: hue, tone, value, contrast, saturation, temperature.
- Infers preferences from phrases like "muted warm palette" and "high contrast neon".
- Builds prompt hints without hard-blocking generation.
- Reuses existing `ColorTheoryEngine` helpers where relevant.

**Step 2: Run test to verify it fails**

```bash
pnpm exec vitest run test/unit/creative-vocabulary/color-vocabulary-engine.test.ts --coverage=false --pool=forks
```

Expected: FAIL due missing engine.

**Step 3: Implement minimal wrapper**

Create a dependency-light adapter that imports from `src/aesthetic/ColorTheoryEngine.ts` and implements `CreativeVocabularyEngine<ColorPreferences>`.

Do not rename `ColorTheoryEngine.ts` yet; this task is compatibility-safe.

**Step 4: Run test**

```bash
pnpm exec vitest run test/unit/creative-vocabulary/color-vocabulary-engine.test.ts --coverage=false --pool=forks
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/creative-vocabulary/ColorVocabularyEngine.ts src/aesthetic/ColorTheoryEngine.ts test/unit/creative-vocabulary/color-vocabulary-engine.test.ts
git commit -m "Expose color theory as conversational vocabulary"
```

---

## Task 4: Add MusicVocabularyEngine using existing music theory code

**Files:**
- Create: `src/creative-vocabulary/MusicVocabularyEngine.ts`
- Modify: `src/music/generateMusic.ts` only if export wiring is needed.
- Create: `test/unit/creative-vocabulary/music-vocabulary-engine.test.ts`

**Step 1: Write failing tests**

Test that `MusicVocabularyEngine`:

- Describes tempo, rhythm, dynamics, instrumentation, harmony, chords, register, timbre.
- Infers "slow ambient drone" into low tempo / sparse density / long duration hints.
- Infers "fast syncopated drums" into higher tempo / rhythmic complexity hints.
- Builds hints for Tone.js and Strudel without enforcing consonance.
- Reuses `src/music/TheoryEngine.ts` and related music utilities rather than duplicating scales/chords.

**Step 2: Run test to verify it fails**

```bash
pnpm exec vitest run test/unit/creative-vocabulary/music-vocabulary-engine.test.ts --coverage=false --pool=forks
```

Expected: FAIL due missing engine.

**Step 3: Implement minimal engine**

Create `MusicVocabularyEngine` implementing `CreativeVocabularyEngine<MusicPreferences>`.

Use existing imports:

- `SCALE_INTERVALS`
- `CHORD_PROGRESSIONS`
- `NOTES`
- `generateProgression`

Do not move `src/music/*` files in this task.

**Step 4: Run test**

```bash
pnpm exec vitest run test/unit/creative-vocabulary/music-vocabulary-engine.test.ts --coverage=false --pool=forks
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/creative-vocabulary/MusicVocabularyEngine.ts test/unit/creative-vocabulary/music-vocabulary-engine.test.ts
git commit -m "Add conversational music theory vocabulary"
```

---

## Task 5: Add MotionVocabularyEngine

**Files:**
- Create: `src/creative-vocabulary/MotionVocabularyEngine.ts`
- Create: `test/unit/creative-vocabulary/motion-vocabulary-engine.test.ts`

**Step 1: Write failing tests**

Test terms:

- pacing
- easing
- velocity
- acceleration
- loopability
- repetition
- hold time
- transition speed
- temporal density
- camera movement

Test inference:

- "slow drifting loop" → slow pacing, smooth easing, loopable.
- "snappy rhythmic cuts" → fast pacing, sharp transitions, beat-oriented.
- "chaotic jitter" → high temporal density and warning that this may need perception checks.

**Step 2: Run test to verify it fails**

```bash
pnpm exec vitest run test/unit/creative-vocabulary/motion-vocabulary-engine.test.ts --coverage=false --pool=forks
```

Expected: FAIL.

**Step 3: Implement engine**

Keep implementation pure and regex/lightweight.

**Step 4: Run test**

```bash
pnpm exec vitest run test/unit/creative-vocabulary/motion-vocabulary-engine.test.ts --coverage=false --pool=forks
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/creative-vocabulary/MotionVocabularyEngine.ts test/unit/creative-vocabulary/motion-vocabulary-engine.test.ts
git commit -m "Add motion vocabulary for temporal creative control"
```

---

## Task 6: Add CinematicLanguageEngine for video domains

**Files:**
- Create: `src/creative-vocabulary/CinematicLanguageEngine.ts`
- Create: `test/unit/creative-vocabulary/cinematic-language-engine.test.ts`

**Step 1: Write failing tests**

Test terms:

- shot
- scene
- beat
- sequence
- transition
- framing
- caption timing
- voiceover
- hook
- reveal
- call-to-action
- storyboard

Test inference:

- "short product launch video with hook and CTA" → hook, beats, CTA, caption/title hints.
- "abstract looping background" → non-narrative sequence, loopable, no forced script structure.

**Step 2: Run test to verify it fails**

```bash
pnpm exec vitest run test/unit/creative-vocabulary/cinematic-language-engine.test.ts --coverage=false --pool=forks
```

Expected: FAIL.

**Step 3: Implement minimal engine**

Implement for Revideo and HyperFrames prompt hints. Keep script/storyboard optional.

**Step 4: Run test**

```bash
pnpm exec vitest run test/unit/creative-vocabulary/cinematic-language-engine.test.ts --coverage=false --pool=forks
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/creative-vocabulary/CinematicLanguageEngine.ts test/unit/creative-vocabulary/cinematic-language-engine.test.ts
git commit -m "Add cinematic language vocabulary for video domains"
```

---

## Task 7: Add CreativeWritingEngine

**Files:**
- Create: `src/creative-vocabulary/CreativeWritingEngine.ts`
- Create: `test/unit/creative-vocabulary/creative-writing-engine.test.ts`

**Step 1: Write failing tests**

Test terms:

- tone
- voice
- point of view
- tense
- genre
- mood
- pacing
- diction
- imagery
- metaphor
- symbolism
- dialogue style
- narrative arc
- lyric structure
- rhyme
- meter
- line breaks
- ambiguity vs clarity

Test inference:

- "make it mythic and lyrical" → mythic tone, lyrical diction, imagery.
- "short clear captions" → concise, readable, low cognitive load.
- "spoken narration" → breath/speech timing hints.

**Step 2: Run test to verify it fails**

```bash
pnpm exec vitest run test/unit/creative-vocabulary/creative-writing-engine.test.ts --coverage=false --pool=forks
```

Expected: FAIL.

**Step 3: Implement minimal engine**

Reuse where helpful:

- `src/music/RhymeEngine.ts`
- `src/music/SyllableCounter.ts`
- `src/music/StructureTemplates.ts`

Do not move these utilities in this task.

**Step 4: Run test**

```bash
pnpm exec vitest run test/unit/creative-vocabulary/creative-writing-engine.test.ts --coverage=false --pool=forks
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/creative-vocabulary/CreativeWritingEngine.ts test/unit/creative-vocabulary/creative-writing-engine.test.ts
git commit -m "Add creative writing vocabulary engine"
```

---

## Task 8: Add registry for vocabulary engines

**Files:**
- Create: `src/creative-vocabulary/CreativeVocabularyRegistry.ts`
- Create: `src/creative-vocabulary/index.ts`
- Create: `test/unit/creative-vocabulary/registry.test.ts`

**Step 1: Write failing tests**

Test that registry:

- Registers color/music/motion/cinematic/creative-writing engines.
- Returns engines by domain.
- Can collect suggested questions across domains.
- Can build prompt hints from multiple preference objects.

**Step 2: Run test to verify it fails**

```bash
pnpm exec vitest run test/unit/creative-vocabulary/registry.test.ts --coverage=false --pool=forks
```

Expected: FAIL.

**Step 3: Implement registry**

Keep registry static and dependency-free. Avoid global mutation unless necessary.

**Step 4: Run focused tests**

```bash
pnpm exec vitest run test/unit/creative-vocabulary --coverage=false --pool=forks
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/creative-vocabulary test/unit/creative-vocabulary
git commit -m "Register creative vocabulary engines"
```

---

## Task 9: Make CLI aesthetic flags truthful and non-misleading

**Files:**
- Modify: `bin/liminal`
- Modify: `docs/cli-reference.html`
- Modify: `docs/internal/USER_TESTING_READINESS_REPORT.md` only if still claiming stale preset behavior.
- Create or modify: `test/unit/canonical-surface-launch.test.ts` if it already checks CLI/package contracts; otherwise create `test/unit/cli-aesthetic-flags.test.ts`.

**Step 1: Write failing test**

Test that CLI help no longer claims `lenient|moderate|strict` for `--aesthetic` unless those are actually implemented.

Preferred text:

```text
--aesthetic <preset>        Creative preference preset (minimalist|vibrant|cinematic|playful|free)
--aesthetic-config <json>   Path to creative/perception preference JSON
```

Or, if product naming changes:

```text
--creative-preset <preset>
```

Keep old flags as compatibility aliases if renamed.

**Step 2: Run test to verify it fails**

```bash
pnpm exec vitest run test/unit/cli-aesthetic-flags.test.ts --coverage=false --pool=forks
```

Expected: FAIL on stale help/config handling.

**Step 3: Update CLI help and config loading**

Minimal fix:

- Align help text with actual preset names.
- If `--aesthetic-config` is provided, read JSON file and pass parsed constraints/preferences.
- If reading fails, fail loudly with a user-facing error instead of silently ignoring it.

**Step 4: Run tests**

```bash
pnpm exec vitest run test/unit/cli-aesthetic-flags.test.ts --coverage=false --pool=forks
```

Expected: PASS.

**Step 5: Commit**

```bash
git add bin/liminal docs/cli-reference.html test/unit/cli-aesthetic-flags.test.ts
git commit -m "Make aesthetic CLI flags truthful"
```

---

## Task 10: Wire perception guardrails into scoring without beauty scoring

**Files:**
- Modify: `src/core/RalphLoop.ts`
- Modify: `src/core/LoopConfig.ts`
- Modify: `src/core/ScoringEngine.ts` only if scoring result needs a perception dimension.
- Create: `test/integration/ralph-loop-human-perception.test.ts`

**Step 1: Write failing integration tests**

Test cases:

1. Human perception guardrails can be enabled independently from old aesthetic config.
2. A perception failure adds repair advice or issues.
3. A subjective preference mismatch does not multiply/penalize score as a hard gate.
4. Domain is passed into perception evaluation.

**Step 2: Run test to verify it fails**

```bash
pnpm exec vitest run test/integration/ralph-loop-human-perception.test.ts --coverage=false --pool=forks
```

Expected: FAIL due missing wiring.

**Step 3: Implement minimal wiring**

Add options:

```ts
useHumanPerceptionGuardrails?: boolean;
creativeVocabularyPreferences?: Record<string, unknown>;
```

Default `useHumanPerceptionGuardrails` should be true only if safe in current runtime tests; otherwise add an explicit default plan and document why. Do not silently change public behavior if tests show broad breakage.

**Step 4: Run tests**

```bash
pnpm exec vitest run test/integration/ralph-loop-human-perception.test.ts test/integration/ralph-loop-aesthetic.test.ts --coverage=false --pool=forks
```

Expected: PASS, old aesthetic tests preserved or intentionally updated with compatibility.

**Step 5: Commit**

```bash
git add src/core/RalphLoop.ts src/core/LoopConfig.ts src/core/ScoringEngine.ts test/integration/ralph-loop-human-perception.test.ts
git commit -m "Wire human perception guardrails into generation evaluation"
```

---

## Task 11: Update docs and migration language

**Files:**
- Modify: `docs/GUARDRAIL_TAXONOMY.md`
- Modify: `docs/THE_BIBLE.md`
- Modify: `docs/ARCHITECTURE_QUICKREF.md`
- Modify: `docs/features.html`
- Modify: `docs/launch/ml-feature-value-matrix.md`
- Add: `docs/plans/2026-04-29-human-perception-creative-vocabulary-design.md` if not already present on implementation branch.

**Step 1: Write docs check if one exists**

Run current docs validation first:

```bash
pnpm run validate-docs
```

If no script exists or it fails for unrelated reasons, note exact output and use the repo's existing docs validation command.

**Step 2: Update docs**

Make these statements consistent:

- Aesthetic guardrails = human sensory ergonomics.
- Creative vocabulary engines = optional user-guided artistic controls.
- `AestheticScorer` stale references are removed or corrected.
- Existing old aesthetic critic is marked legacy/compatibility if not renamed immediately.

**Step 3: Run docs validation**

```bash
pnpm run validate-docs
```

Expected: PASS or documented unrelated failure.

**Step 4: Commit**

```bash
git add docs
git commit -m "Document humane aesthetic guardrail model"
```

---

## Task 12: Focused verification bundle

**Files:**
- No source changes unless verification exposes defects.

**Step 1: Run focused tests**

```bash
pnpm exec vitest run test/unit/creative-vocabulary test/unit/perception test/integration/ralph-loop-human-perception.test.ts --coverage=false --pool=forks
```

Expected: PASS.

**Step 2: Run existing adjacent tests**

```bash
pnpm exec vitest run test/unit/aesthetic test/integration/ralph-loop-aesthetic.test.ts test/render/render-and-score.test.ts test/unit/guardrails/AccessibilityGuardrails.test.ts --coverage=false --pool=forks
```

Expected: PASS.

**Step 3: Run lint/build**

```bash
pnpm run lint
pnpm build
```

Expected: PASS.

**Step 4: Run fast CI-equivalent if time permits**

```bash
LIMINAL_CI_FAST=1 pnpm exec vitest run --coverage=false --pool=forks --reporter=default
```

Expected: PASS.

**Step 5: Final commit if verification required fixes**

```bash
git status --short
git log --oneline --decorate -12
```

If any fixes were required, commit with Lore trailers.

---

## Recommended execution order

1. Types and naming.
2. Perception guardrail contract.
3. Creative vocabulary engines.
4. CLI truthfulness.
5. RalphLoop/scoring wiring.
6. Docs.
7. Full verification.

This order keeps the implementation reversible and avoids breaking active frontend/UI lanes.
