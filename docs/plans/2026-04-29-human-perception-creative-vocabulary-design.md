# Human Perception Aesthetic Guardrails and Creative Vocabulary Engines Design

**Date:** 2026-04-29
**Status:** Approved concept captured as docs-only design
**Branch:** `docs/human-perception-guardrails-design`

---

## 1. Intent

Liminal's "aesthetic guardrails" should not mean that the system judges beauty, taste, or artistic value. The product intent is more humane and more useful:

> Aesthetic guardrails are default-on, domain-specific human sensory ergonomics checks that keep generated creative artifacts perceivable, tolerable, legible, audible, and interpretable by humans.

Subjective artistic choices belong in a second, optional layer:

> Creative vocabulary engines help the user discuss and steer artistic parameters during conversation. They expose shared creative language without forcing one definition of beauty.

This design reserves "guardrail" for human-experience constraints and moves formal/theory vocabulary into explicit advisory engines.

---

## 2. Definitions

### Human Perception Aesthetic Guardrails

Default-on checks that prevent technically valid artifacts from being outside useful human experience.

They answer:

- Can a human see it?
- Can a human hear it?
- Can a human read it?
- Can a human perceive the movement/timing?
- Is it likely to be uncomfortable, harmful, or cognitively unusable?
- Does the artifact satisfy the output domain's basic sensory contract?

They do **not** answer:

- Is it beautiful?
- Is it tasteful?
- Is it professional?
- Is it harmonically conventional?
- Is it a style the system prefers?

### Creative Vocabulary Engines

Optional conversational helpers that expose domain-specific creative terms for user steering.

They answer:

- What creative parameters can the user control?
- How can Liminal ask about those parameters in plain language?
- How can a user preference become prompt/context constraints?
- How can Liminal explain tradeoffs without imposing taste?

They do **not** block generation by default.

---

## 3. Existing Systems Reclassified

### Keep as guardrails or guardrail-adjacent

- `src/guardrails/AccessibilityGuardrails.ts` — closest existing match to human sensory ergonomics. It already covers photosensitivity, contrast, color-blindness, reduced motion, and audio safety.
- `src/core/validators/*Validator.ts` — valuable domain correctness guardrails. These should stay named as validators/correctness, not aesthetic.
- `src/render/RenderAndScorePipeline.ts` — useful as perceptual evidence infrastructure, but should measure visibility/audibility/blankness/timing rather than beauty.
- `src/render/VisualScorer.ts` / `AudioScorer.ts` — useful if reframed and repaired as perceptual signal analyzers.

### Keep, but rename/reframe away from guardrails

- `src/aesthetic/AestheticCritic.ts` — currently mixes color/layout/typography/sound checks with taste-like naming. It should become a creative-form advisor or be split into human-perception checks plus creative-vocabulary helpers.
- `src/core/CreativeEvaluator.ts` — useful for domain richness/substance, not aesthetic guardrails. Better conceptual name: `DomainRichnessEvaluator` or `CreativeCompletenessEvaluator`.
- `src/aesthetic/ColorTheoryEngine.ts` — valuable Layer 2 vocabulary engine. It should help users reason about hue/value/saturation/contrast, not enforce universal palette beauty.
- `src/aesthetic/critics/LLMJudgeCritic.ts` — useful as an optional coach or preference interpreter, not a hard beauty gate.

### Current drift to fix

- CLI help says `--aesthetic <preset>` uses `lenient|moderate|strict`, but type definitions expose `minimalist|vibrant|cinematic|playful|free`.
- `--aesthetic-config` is parsed but is not clearly loaded into constraints.
- `preset` is stored in config but not applied by `AestheticCritic`.
- LLM judge is wired in some places but main scoring often calls the heuristic-only path.
- Docs sometimes imply objective aesthetic quality readiness that the runtime does not actually enforce.

---

## 4. Layer 1: Human Perception Aesthetic Guardrails

### Cross-domain principles

Every domain should have a sensory contract. A valid artifact should be:

- **Perceivable:** not blank, silent, invisible, inaudible, or outside human sensory range.
- **Legible/interpretable:** enough temporal, visual, auditory, or textual structure for humans to parse.
- **Tolerable:** avoids extreme flicker, unsafe volume, excessive motion discomfort, unreadable density, or hostile pacing.
- **Intent-aware:** allows intentional exceptions only when the user explicitly asks and the system names the tradeoff.

### Visual domains: p5, GLSL, Hydra, Three.js

Guardrail dimensions:

- Visible luminance range; not all-black/all-white unless intentional.
- Useful contrast between foreground/background or motion layers.
- Color values in displayable normal gamut / valid CSS or shader ranges.
- Motion temporal frequency within human perception.
- No strobing/photosensitive patterns above safe thresholds.
- Frame rate and animation speed not too fast to parse or too slow to perceive.
- Non-trivial rendered output, not blank canvas or invisible camera/object.
- For Three.js: camera/FOV/clipping/object placement make the scene visible.
- For GLSL/Hydra: shader/video synth output changes in visible ways if motion is requested.

### Audio domains: Tone.js, Strudel, Web Audio

Guardrail dimensions:

- Frequency/register in human hearing range unless intentionally silent/subsonic/ultrasonic as metadata.
- Safe output gain; no clipping or sudden unsafe transients.
- Not silent unless silence/rest is explicit.
- Tempo interpretable by humans; not so fast it becomes unparseable or so slow it loses perceived rhythm.
- Note durations/events long enough to perceive.
- Dynamic range not flatline or chaotic overload.
- Repetition/density humanly parseable.
- Instrumentation/synthesis produces audible, intentional signal.

### Text/HTML/SVG/ASCII domains

Guardrail dimensions:

- Readable text size/line length/contrast.
- Responsive layout that keeps primary content visible.
- No overflow hiding important content.
- ASCII dimensions fit normal terminal widths or declare intended viewport.
- ASCII density/silhouette not random symbol noise unless intentional.
- Captions/subtitles remain onscreen long enough to read.

### Video domains: Revideo, HyperFrames

Guardrail dimensions:

- Duration and frame pacing create perceivable events.
- Scenes contain visible elements at export time.
- Motion has readable acceleration/deceleration and hold time.
- Captions/titles are readable per frame and remain long enough.
- Transitions do not create harmful flicker.
- Asset compositing keeps focus/foreground visible.
- Output is renderable/exportable, not only syntactically valid code.

### Cross-modal / composition domains

Guardrail dimensions:

- Audio-visual synchronization is perceptible when requested.
- Combined density does not overwhelm every channel simultaneously.
- Tempo/motion coupling stays within human timing perception.
- User can identify which generated element is responsible for sound, image, motion, or text.

---

## 5. Layer 2: Creative Vocabulary Engines

These engines are optional conversation tools. They should be used when the user wants to steer style, mood, form, or expressive parameters.

### Shared interface concept

Each engine should expose:

- Domain vocabulary terms.
- Plain-language interview questions.
- Possible preference values.
- Prompt/context hints.
- Optional parameter extraction from user language.
- Non-enforcing advisory summaries.

Example conceptual shape:

```ts
interface CreativeVocabularyEngine<TPreferences> {
  readonly domain: string;
  describeTerms(): CreativeTerm[];
  inferPreferences(text: string): Partial<TPreferences>;
  suggestQuestions(context: CreativeContext): CreativeQuestion[];
  buildPromptHints(preferences: Partial<TPreferences>): string[];
}
```

This interface should remain lightweight and not require a new dependency.

### ColorTheoryEngine

Existing useful core: `src/aesthetic/ColorTheoryEngine.ts`.

Creative vocabulary:

- hue
- tone
- value
- contrast
- saturation
- temperature
- palette size
- color relationship
- opacity/transparency
- foreground/background relationship

Role:

- Help the user choose visual color direction.
- Explain terms conversationally.
- Convert preferences into prompt hints.
- Avoid imposing fixed harmony rules unless the user asks.

### MusicTheoryEngine

Existing useful core:

- `src/music/TheoryEngine.ts`
- `src/music/EuclideanRhythm.ts`
- `src/music/MarkovChain.ts`
- `src/music/Arpeggiator.ts`
- `src/music/StructureTemplates.ts`
- `src/music/RhymeEngine.ts`
- `src/music/SyllableCounter.ts`

Creative vocabulary:

- tempo
- meter
- rhythm
- swing/groove
- scale/mode/key
- melody
- harmony
- chords/progressions
- dynamics
- instrumentation
- density
- register
- timbre
- tension/release
- space/reverb

Role:

- Help the user steer Tone.js and Strudel generation.
- Reuse existing theory functions instead of creating a new engine from scratch.
- Add a conversational wrapper that maps user preferences to musical parameters.

### MotionTheoryEngine

New conceptual engine for time and movement across p5, GLSL, Hydra, Three.js, Revideo, and HyperFrames.

Creative vocabulary:

- pacing
- rhythm of motion
- easing
- acceleration/deceleration
- loopability
- repetition
- visual beats
- hold time
- transition speed
- temporal density
- camera movement
- choreographic relationship between elements

Role:

- Help users steer movement without conflating motion with narrative.
- Useful for abstract visual domains and video domains.
- Convert phrases like "meditative", "snappy", "pulsing", "drifting", or "chaotic" into motion hints.

### CinematicLanguageEngine

New conceptual engine for video language, especially Revideo and HyperFrames.

Creative vocabulary:

- shot
- scene
- beat
- sequence
- transition
- composition
- camera framing
- title/caption timing
- voiceover/narration placement
- hook
- reveal
- call-to-action
- storyboard
- lower-third
- montage

Role:

- Help users plan video structure.
- Support both narrative and non-narrative motion graphics.
- Avoid forcing three-act structure; offer it only when useful.

### CreativeWritingEngine

New conceptual engine for language-based creative output and for text embedded inside visual/video/audio work.

Creative vocabulary:

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
- scene beats
- lyric structure
- rhyme
- meter
- line breaks
- compression vs expansiveness
- ambiguity vs clarity

Human-ergonomic overlap:

- readability
- cognitive load
- sentence length
- repetition
- spoken breath timing
- caption/narration length
- lyric singability

Role:

- Help users articulate creative intent.
- Support prose, poetry, lyrics, captions, dialogue, narration, scripts, artist statements, and prompt shaping.
- Share rhyme/syllable helpers with music where appropriate, but keep creative writing as a first-class engine rather than burying it under music or video.

---

## 6. User Conversation Model

The workbench should not expose a pile of controls. Liminal should ask natural questions only when helpful.

Examples:

- "Should the motion feel slow and meditative, sharp and rhythmic, or chaotic?"
- "Do you want the palette warm, cold, high-contrast, muted, or surprising?"
- "Should the rhythm feel steady, syncopated, sparse, or dense?"
- "Should the writing feel direct, lyrical, strange, funny, intimate, or mythic?"
- "For the video, do you want a hook-reveal-CTA structure, or a purely atmospheric loop?"

The system should also infer preferences from user language and only ask when ambiguity affects output quality.

---

## 7. Naming Decision

Use these names in user-facing and code-facing design language:

- **Human Perception Guardrails** — hard/default sensory ergonomics checks.
- **Creative Vocabulary Engines** — optional conversational parameter helpers.
- **Domain Correctness Validators** — syntax/API/runtime validators.
- **Creative Completeness / Domain Richness Evaluation** — non-triviality/substance checks.

Avoid using these terms for hard gates:

- beauty score
- taste score
- aesthetic quality as universal judgment
- professional polish as an unqualified objective

---

## 8. Implementation Boundaries

Initial implementation should be conservative:

1. Rename/reframe concepts without deleting capabilities.
2. Preserve existing validators and evaluators.
3. Add new naming and metadata first.
4. Make CLI/docs truthful.
5. Add perception guardrails gradually per domain.
6. Add creative vocabulary engines as advisory helpers, not blockers.
7. Keep UI clean and chat-first; do not expose every term as a permanent button/control.

No existing feature should be removed as part of this redesign. Capabilities that are not true aesthetic guardrails should be renamed or moved conceptually, not deleted.

---

## 9. Acceptance Criteria

A completed implementation should make these statements true:

- "Aesthetic guardrails" no longer mean objective beauty scoring.
- Human perception checks are default-on where safe and domain-appropriate.
- Subjective creative theory lives in optional vocabulary engines.
- Existing music theory code is reused as the basis for `MusicTheoryEngine` behavior.
- Video gets motion/cinematic language support, not just scriptwriting.
- Creative writing is a first-class vocabulary engine.
- CLI and docs no longer disagree about aesthetic presets.
- Tests prove that subjective preferences do not hard-block generation unless explicitly configured.
- Tests prove that unsafe/imperceptible artifacts are treated as guardrail failures or repair targets.
