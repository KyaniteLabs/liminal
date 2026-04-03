# Video Script 1: "I Built an AI That Rates Its Own Art — Then It Lied"

**Target length:** 5-7 minutes (750-1,050 words spoken)
**Style:** Talking head with screen capture
**Date:** April 2, 2026

---

## [0:00-0:45] HOOK

[SPEAKER: Direct to camera, seated, slightly leaned in. Conversational but intense.]

I spent three weeks building an AI system that generates creative code — p5.js sketches, Three.js scenes, GLSL shaders, music with Strudel. The whole idea was that it would iterate on its own work, score each attempt, and improve over time.

Then I ran the dogfood tests. Fifty-four runs across nine creative domains. Every single score came back the same number.

Zero point six eight.

[beat]

A 160-byte stub that just printed "Hello World" scored 0.68. A 2,000-byte full p5.js implementation with particle systems scored 0.68. Everything scored 0.68.

[VISUAL: Split screen. Left: tiny 160-byte code snippet. Right: full 2,000-byte implementation. Both showing "Score: 0.68" below them.]

Today I am going to show you exactly how this happened, why the fix was one line of code, and what it teaches us about every AI system that evaluates its own output.

[SPEAKER: Title card overlay. Transition to setup.]

---

## [0:45-2:00] SETUP — What the AestheticCritic Was Supposed to Do

[SPEAKER: Standing, gesturing to screen. Switching between camera and screen capture.]

So let me show you the architecture. The system is called Liminal. It has a creative loop called RalphLoop — named after Ralph, because why not — that generates creative code, scores it, and iterates.

The scoring is handled by something called the AestheticCritic. I built four sub-critics:

[VISUAL: Animated diagram appearing, each critic lighting up as mentioned.]

- **ColorHarmony** — evaluates color palette cohesion
- **Layout** — checks spatial composition
- **Typography** — assesses text rendering choices
- **SoundHarmony** — evaluates audio aesthetics

These four critics feed into a CreativeEvaluator, which combines a technical score and a creative score into one final number. The formula is simple:

```
finalScore = technicalScore * 0.6 + creativeScore * 0.4
```

The technical score is based on five checkboxes. Does the code have a setup function? Does it have a draw function? Does it use the canvas? Things like that. You get 4 out of 5, that gives you 0.8.

The creative score has six criteria — variety, complexity, harmony, originality, balance, and expressiveness. You hit 3 out of 6, that is 0.5.

[VISUAL: Score breakdown appearing on screen]
```
tech: 4/5 = 0.8 -> 0.8 * 0.6 = 0.48
creative: 3/6 = 0.5 -> 0.5 * 0.4 = 0.20
total: 0.48 + 0.20 = 0.68
```

Plug those in: 0.48 plus 0.20 equals 0.68. Every single time.

The problem is not the math. The problem is that the checkboxes are structural, not qualitative. The evaluator checks whether code has certain patterns — it never actually runs the code. It never looks at what the code produces.

[SPEAKER: Pause for emphasis.]

---

## [2:00-3:30] THE EXPERIMENT — 54 Runs, One Score

[SPEAKER: Back to camera, then screen capture of test results.]

So I ran the dogfood tests. The test matrix was 9 creative domains times 6 models — things like MiniMax, Granite, Gemma, Qwen, Phi, LFM — across p5.js, Three.js, GLSL, Hydra, Strudel, Tone.js, Remotion, HTML, and video generation.

[VISUAL: Grid appearing — 9 columns (domains) x 6 rows (models). Cells fill in red or green as results populate.]

Agent A ran 36 tests with 4 models. Four passed, all of them p5.js, all of them scoring exactly 0.68. Agent B ran 52 tests with 6 models — two combinations were missing from the data — and got 11 passes, mostly p5.js and a handful of Remotion and GLSL.

But here is the thing that made my jaw drop. Look at these two outputs side by side.

[VISUAL: Split screen again.]

This one on the left is from MiniMax. 160 bytes. It is literally:

```
function setup() {
  createCanvas(400, 400);
}
function draw() {
  background(220);
}
```

That is it. Gray rectangle. Nothing else.

This one on the right is from a local model. 2,163 bytes. Full particle system with physics, color trails, the works.

Both scored 0.68.

[VISUAL: Zoom into the score column — both rows showing 0.68.]

The evaluator saw that both had a `setup` function, both had a `draw` function, both used the canvas. Structural checkboxes. Identical scores.

Now, most of the failures were not scoring problems. Sixteen of Agent A's 32 failures were "No LLM configured" — the model literally was not wired up for non-p5 domains. Four more were truncated code. Twelve were a validation cross-contamination bug where Three.js code was being rejected by the p5 validator. The error message was literally "p5.js code must contain at least one of: function" applied to Three.js output.

[VISUAL: Error log snippet — "Three.js code rejected: 'p5.js code must contain at least one of: function'"]

That is a different bug. But the scoring bug — the 0.68 dead zone — that was the one that revealed the deeper problem.

---

## [3:30-4:30] THE TWIST — One Line of Code

[SPEAKER: Leaned back. Slower pace. This is the reveal.]

So why did every successful run stop at iteration 1? RalphLoop is supposed to be a loop — generate, score, check quality, iterate if the score is too low. The quality threshold was set at 0.7. The scores were 0.68. It should have looped.

[VISUAL: Code file opening — `scripts/dogfood-all-domains.ts`]

I opened the test harness. And there it was.

```
maxIterations: 1
```

One line. The test harness was configured to run exactly one iteration. The quality gate — the whole reason RalphLoop exists — only triggers at iteration 2 or higher. With maxIterations set to 1, the loop generates code once, scores it, and exits. The quality gate never fires. It never gets a chance to say "0.68 is below 0.7, try again."

[VISUAL: Flow diagram — RalphLoop flow with the quality gate grayed out / crossed out, showing the shortcut path from "Score: 0.68" directly to "Done"]

So the story I originally told myself — "the AI thought 0.68 was good enough and stopped" — that was wrong. The AI never evaluated quality at all. The test harness just... never gave it a chance.

There is a separate telemetry file from a different test where someone set maxIterations to 5. That run actually reached iteration 2, and the quality gate did fire and did reject 0.68. The system works. The test was just misconfigured.

[SPEAKER: Slight exhale. "Yep."]

---

## [4:30-5:30] THE REAL NUMBERS

[SPEAKER: Standing, more energy. Moving past the bug into the actual results.]

So what were the real numbers once you look at all the data honestly?

[VISUAL: Clean summary card appearing.]

Agent A: 36 runs. 4 passed. That is 11.1%. And all four passes were p5.js — the only domain where the models were actually wired up correctly.

Agent B: 52 runs. 11 passed. That is 21.2%. Better, but the passes were concentrated in p5.js (6 passes), Remotion (3), with one GLSL and one Tone.js. Six of the nine domains had zero passes across all models.

[VISUAL: Bar chart by domain — p5 tall, Remotion medium, GLSL/Tone tiny, rest at zero.]

The original claim I made was 4 out of 54 equals 7.4 percent. That number conflated two different datasets — Agent A's 4 successes with Agent B's 54-run test matrix. The real picture is more nuanced but also more honest: roughly 17 percent success across 88 total runs, with most domains completely broken.

The scoring dead zone is real. The cross-contamination bug is real. The "No LLM configured" errors are real. But the "loop stopped because it thought 0.68 was fine" narrative — that was a misread of a test configuration issue.

---

## [5:30-6:30] THE LESSON

[SPEAKER: Seated again. Reflective tone. Direct to camera.]

Here is what I take away from this, and I think it applies to anyone building AI systems that evaluate their own output.

**First: structural evaluation is not quality evaluation.** My CreativeEvaluator checked whether code had the right functions, the right structure, the right keywords. It never looked at what the code actually did. A 160-byte stub and a 2,000-byte particle system are indistinguishable to a structural scorer. If you are building an AI that grades its own work, you need to execute the output, not just parse the input.

**Second: the configuration was the bug, not the algorithm.** RalphLoop's quality gate works. The threshold was correct at 0.7. The scoring formula was reasonable. But a single line — maxIterations: 1 — bypassed all of that. The most sophisticated quality gate in the world does not matter if something upstream prevents it from running.

**Third: the narrative you tell yourself about a bug is often wrong.** I initially framed this as "the AI thought 0.68 was good enough." That is a compelling story. It is also not what happened. The AI never evaluated quality. The test harness short-circuited the evaluation. The truth was more boring but also more important: a configuration mistake, not an AI judgment error.

[VISUAL: Three takeaways appearing as bullet points, one at a time.]

---

## [6:30-7:00] OUTRO

[SPEAKER: Direct to camera. Steady, slightly slower.]

The scoring dead zone is not a bug in my code. It is a warning about every AI system that rates itself.

When your evaluation is structural — when it checks patterns instead of results — you will get a dead zone. Everything will cluster around the same score because the evaluator cannot see quality, only shape.

And when your quality gate is one config line away from being disabled, you will ship broken output and believe it works.

[beat]

I fixed the maxIterations. I am building execution-based validation now. But the lesson sticks: if you want an AI to honestly evaluate its own work, it needs to look at what it made — not just check whether it made something.

[VISUAL: End card — "Liminal Archaeology" / "Day 31 of 34"]

If you want to see the full audit data, all the raw test results are in the repo. Link in the description.

Thanks for watching.

---

## Production Notes

- **Total spoken word count:** ~980 words
- **Estimated runtime:** 6 minutes 20 seconds at 155 wpm
- **Screen capture segments:** 4 (score breakdown, test grid, code reveal, bar chart)
- **Props/visuals needed:**
  - Animated critic architecture diagram
  - Split-screen code comparison (160 bytes vs 2,163 bytes)
  - `maxIterations: 1` code reveal with dramatic zoom
  - RalphLoop flow diagram with quality gate crossed out
  - Domain bar chart (p5 dominant, rest near zero)
  - End card with project branding
- **Audio:** Background music low under hook, silence during code reveal, subtle ambient under lesson section
