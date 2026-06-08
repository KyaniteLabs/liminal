# Gallery Broken Work Validation Audit - 2026-06-08

## Verdict

Real current gap, fixed in this PR.

The normal RalphLoop candidate path already called `CodeValidator.validate(...)` before accepting a generated candidate, but not every gallery-version write went through that gate. Before this PR, the persistence layer could still write domain-correct but broken code to `gallery/YYYY-MM-DD--project/vN.js` through the iteration save path, merge-step save path, swarm final-output save path, and organism save path.

## Evidence

- Normal candidate generation was already gated: `src/core/RalphLoop.ts:559-565` validates generated code before adding the candidate, and later persistence calls go through `persistence.saveIteration(...)` / `persistence.saveMergeStep(...)` at `src/core/RalphLoop.ts:1284-1288` and `src/core/RalphLoop.ts:1415-1417`.
- `Gallery.saveIteration(...)` is a raw storage primitive: it validates project/version/non-empty code and writes `vN.js` at `src/gallery/Gallery.ts:120-155`. It is intentionally not the only product gate.
- The product persistence call site is now gated: `src/core/LoopPersistence.ts:41-44` validates and then writes normal iterations; `src/core/LoopPersistence.ts:85-88` validates and then writes merge-step output; the same cleaned code is used for SinterFS refs at `src/core/LoopPersistence.ts:52-55` and `src/core/LoopPersistence.ts:94-97`.
- The swarm path was a current pre-validation write path: `src/core/GenerationOrchestrator.ts:210-212` calls `gallery.saveSwarmSession(...)` during generation, before RalphLoop can validate the returned candidate. `Gallery.saveSwarmSession(...)` now validates `finalOutput` at `src/gallery/Gallery.ts:220-222` before saving it as a gallery version at `src/gallery/Gallery.ts:256-264`.
- The organism path also wrote a `vN.js` payload from generated Strudel/Hydra strings. It now validates those fields through their canonical domains before writing at `src/gallery/Gallery.ts:288-298`.
- Validator coverage was strengthened for the named malformed-code classes: explicit generated `throw` statements are rejected at `src/core/CodeValidator.ts:194-220`, and raw Three.js now gets JavaScript syntax parsing at `src/core/validators/ThreeValidator.ts:28-31` and `src/core/validators/ThreeValidator.ts:73-85`.

## Can Broken Code Still Slip Into Current Gallery Versions?

Before this PR: yes.

- P5 syntax errors were caught by `P5Validator`, but the persistence and swarm save paths could bypass that validator.
- Three.js syntax errors could pass structural validation because `ThreeValidator` did not parse raw JavaScript.
- Explicit guaranteed runtime throws could pass validation because `CodeValidator` did not reject `throw` statements.
- Organism saves only checked non-empty music/visual strings before writing a gallery version payload.

After this PR: the audited current save paths reject those malformed samples before writing a valid gallery version. This is covered by regression tests in `test/unit/core/LoopPersistence.test.ts`, `test/unit/gallery/gallery.test.ts`, and `test/unit/core/CodeValidator.test.ts`.

## Legacy Artifacts

Existing broken gallery works, including the `2026-05-13--...248301` SyntaxError artifact found by the vision audit, should be treated as legacy data after this PR. They were created before the current save-path gate existed.

Recommended follow-up: add a one-time gallery cleanup/quarantine script that scans existing `gallery/**/v*.js` versions through `CodeValidator` and, for visual domains, a headless render smoke check. That cleanup is intentionally not included here.

## Verification Notes

- RED: `pnpm vitest run test/unit/core/LoopPersistence.test.ts test/unit/gallery/gallery.test.ts test/unit/core/CodeValidator.test.ts` failed on 7 new cases before the implementation.
- GREEN: `pnpm vitest run test/unit/core/LoopPersistence.test.ts test/unit/gallery/gallery.test.ts test/unit/core/CodeValidator.test.ts --coverage=false` passed 3 files / 114 tests.
