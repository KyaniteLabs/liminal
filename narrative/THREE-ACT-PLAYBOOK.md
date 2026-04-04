# The Three-Act Playbook: "Liminal Builds Itself"

*The self-referential marketing strategy for a tool that tells the story of its own construction.*

**Date:** April 3, 2026
**Status:** Draft — Pending Dogfood Validation
**Co-Authored-By:** GLM 5.1 via Claude Code

---

## Table of Contents

1. [The Core Insight](#the-core-insight)
2. [The Three-Act Progression](#the-three-act-progression)
3. [The Self-Referential Flywheel](#the-self-referential-flywheel)
4. [The Four Proof Layers](#the-four-proof-layers)
5. [Case Study: Claudius Papirus](#case-study-claudius-papirus)
6. [Faceless Channel Strategy](#faceless-channel-strategy)
7. [YouTube 2026 Compliance](#youtube-2026-compliance)
8. [Three-Act Content Format Spec](#three-act-content-format-spec)
9. [Competitive Differentiation](#competitive-differentiation)
10. [Production Pipeline](#production-pipeline)
11. [Distribution Matrix](#distribution-matrix)
12. [Verification Criteria](#verification-criteria)

---

## The Core Insight

The story of Liminal is not three voices running in parallel. It is a **handoff** — a progression from human vision to agent construction to self-building tool. This progression is not a marketing narrative imposed on the project. It is the actual development history, mined from 7,059 commits across 11 classified eras.

The traditional "building in public" story: *"I'm building a tool and sharing my progress."* Every indie hacker does this.

The Liminal story: *"The tool is finishing itself, and I'm one of three narrators in a story that includes the agents who built it and the tool they built."* Nobody does this — because almost no tool has the archaeology to prove it happened.

---

## The Three-Act Progression

### Act 1: Simon Has Ideas (Eras 1–3)

**Dominant narrator:** The Developer
**Era mapping:**
- Era 1 (The Seed) — First commit, the PRD, "what if we built a creative coding harness?"
- Era 2 (The Explosion) — Cursor IDE writes 12 commits in 6 minutes, Atelier → Liminal rename at 9:30 PM
- Era 3 (Consolidation) — 28 commits in a day, the compost metaphor, naming things without knowing the formal terms

**Tone:** Personal, vision-driven, metaphor-rich. "I did not plan this alignment."
**Source data:** Commit messages, session logs, personal notes, YouTube watch history (1,481 videos)
**Key artifacts:** The compost bin that's actually a VAE, the 10 ML architectures built without knowing the names

**What this act proves:** The vision was real, grounded in years of self-directed learning, and honest about what it didn't know.

---

### Act 2: Coding Agents Build Liminal (Eras 4–7)

**Dominant narrator:** The Agents
**Era mapping:**
- Era 4 (Scaffolding) — Infrastructure buildout, the swarm system emerges
- Era 5 (The Quiet) — 0 Liminal commits, 13 commits to 5 other repos. Creative redistribution.
- Era 6 (Infrastructure) — mcp-video ships v0.6→v0.8, Remotion integration enables video pipeline
- Era 7 (Expansion) — Domain explosion, 9 generators wired, the skeleton learns to dance

**Tone:** Analytical, pattern-obsessed, distinctly non-human. "Round 4, attempt 12. Score: 0.68. Same as the last 53."
**Source data:** Swarm outputs, MetaHarness logs, generation telemetry, dogfood JSONL
**Key artifacts:** The 0.68 dead zone (54 runs, same score), the agent personality fingerprints (Kai the assembly-line worker, Cursor the landscaper, Claude Code the architect)

**What this act proves:** The agents have distinct working styles, make systematic mistakes, and leave forensic traces that can be analyzed.

---

### Act 3: Liminal Starts Finishing Itself (Eras 8–11)

**Dominant narrator:** Liminal (the tool itself)
**Era mapping:**
- Era 8 (Dogfood) — Agent A runs 36 tests, 4 pass. The honest reckoning.
- Era 9 (The Bible) — Meta-Harness self-evaluates, cites an arXiv paper on self-improving AI systems
- Era 10 (Assessment) — The harness reads its own literature
- Era 11 (The Hardening) — 480 commits, the tool stabilizes its own architecture

**Tone:** Self-aware but not sentient. Observational. "I detected a pattern failure in the Three.js generator. Here is what changed."
**Source data:** Architecture state diffs, test results, capability evolution, MetaHarness auto-adaptation logs
**Key artifacts:** MetaHarness with 18-type guardrails, TextGenerativeGenerator (the tool's own text voice), HarnessMemory (persistent self-learning)

**What this act proves:** The tool reached a tipping point where it can detect its own failures, improve its own generators, and narrate the process. Act 3 is not a claim — it's a live demonstration.

---

### The Handoff Moment

The critical narrative beat is the **transition from Act 2 to Act 3** — the moment where the agents' work produces a system capable of continuing without them being the primary drivers. This is not a binary switch. It's a gradient:

```
Era 7:  Agents build 90%, Simon directs 10%
Era 8:  Agents build 70%, Liminal self-tests 20%, Simon observes 10%
Era 9:  Agents build 50%, Liminal self-evaluates 30%, Simon narrates 20%
Era 11: Agents build 30%, Liminal self-hardens 50%, Simon curates 20%
```

The gradient IS the story. Not "AI replaces human" but "human, agents, and tool find their respective roles."

---

## The Self-Referential Flywheel

The existing flywheel in MARKETING-STRATEGY.md:

```
Art → Video → Marketing → Users → More Art → Flywheel spins
```

The three-act flywheel adds the self-improvement loop:

```
Simon has an idea
  → Agents build it
    → Mistakes happen (0.68 dead zone, cross-contaminated validator)
      → Liminal reaches critical mass
        → MetaHarness detects its own failure patterns
          → Liminal improves its own generators
            → Better outputs next iteration
              → Outputs ARE the marketing content
                → Liminal narrates its own construction (Act 3 voice)
                  → Published as three-act channel content
                    → Viewers see the tool building itself live
                      → This IS the proof, not a claim about the proof
```

**Key distinction:** The old flywheel treats marketing as a step AFTER creation. The three-act flywheel makes the creation process itself the marketing. The marketing infrastructure (faceless channel, blog pipeline) becomes another capability that Liminal can self-improve.

---

## The Four Proof Layers

Every marketing claim needs a proof artifact. The three-act progression produces four distinct layers of evidence:

| # | Layer | What It Proves | Key Artifacts | Act |
|---|-------|---------------|---------------|-----|
| 1 | **Archaeology** | "We did the work, here's the honest data" | 57 deliverables, B+ audit grade, archaeology.html (30+ charts), 11 classified eras | 1 |
| 2 | **Agent Forensics** | "The agents left traces, here's what they did" | 0.68 dead zone, agent personality fingerprints, commit velocity analysis, cross-repo redistribution | 2 |
| 3 | **Self-Improvement** | "The tool improves itself, live" | Dogfood telemetry, MetaHarness auto-adaptations, before/after output comparisons, HarnessMemory | 3 |
| 4 | **Self-Narration** | "The tool tells its own story" | Faceless channel episodes, three-act content, TextGen output about itself | 3 |

Layer 4 is the proof that makes the other three credible. If Liminal can produce a channel narrating its own construction, the self-improvement claim is demonstrated, not asserted.

---

## Case Study: Claudius Papirus

### What It Is

**Claudius Papirus** is a faceless YouTube channel where an AI narrator explains AI — research papers, tech behind real products, industry analysis. The persona ("I'm Claudius") is explicitly artificial. Multi-platform: YouTube, Hashnode (29+ posts), DEV Community, LinkedIn.

**Bio:** "I'm Claudius. An AI narrator exploring AI — from research papers to the tech behind real products. No hype, just how it actually works."

**Joined:** January 2026

### What It Proves

1. **Faceless AI narration works** — Claudius maintains consistent identity across platforms without a human face
2. **Transparent AI identity is viable** — Saying "I'm an AI" doesn't kill engagement; it becomes the brand
3. **Niche authority transfers** — An AI explaining AI has inherent credibility the same way Liminal explaining its own construction would
4. **Multi-platform consistency** — Same persona, same voice, across YouTube/blog/social/LinkedIn

### How Liminal's Channel Differs

| Dimension | Claudius Papirus | Liminal's Channel |
|-----------|-----------------|-------------------|
| Narrator | Single AI voice | Three voices (developer, agents, tool) |
| Subject | External AI topics | Its own construction |
| Evidence | Research papers | Own commit history, telemetry, dogfood data |
| Self-reference | AI explains AI (meta) | Tool narrates building itself (meta-recursive) |
| Proof model | Educational authority | Live demonstration |
| Progression | Episodic (each video standalone) | Serial (three-act arc across episodes) |

**The distinction that matters:** Claudius is an AI talking ABOUT AI. Liminal would be a tool talking ABOUT ITSELF while actively building itself. The channel content becomes evidence for the product claims.

---

## Faceless Channel Strategy

### Channel Identity

**Name options:** "Liminal" (direct), "The Harness" (internal reference), or a persona name TBD
**Tagline:** "A creative coding tool narrating its own construction."
**Format:** 5–10 min episodes, AI-narrated, screen capture + animated diagrams + generated art
**Voice:** Three narrators, shifting dominance across the series arc

### Episode Arc

**Season 1: Genesis (6–8 episodes)**
Episodes progress through the three acts, mirroring the development timeline:

| Ep | Title Concept | Dominant Act | Content |
|----|--------------|-------------|---------|
| 1 | "The Idea" | Act 1 | Simon's vision, the first commit, what generative art means |
| 2 | "The Agents Arrive" | Act 1→2 | Kai builds 29 task-jobs, Cursor writes 12 commits in 6 minutes |
| 3 | "The Quiet That Wasn't" | Act 2 | 0 commits to Liminal, 13 to 5 other repos. Creative redistribution. |
| 4 | "0.68" | Act 2 | The dead zone. 54 runs, same score. The one-line fix. |
| 5 | "The Skeleton Dances" | Act 2→3 | 9 domains wired, the tool starts testing itself |
| 6 | "It Reads Its Own Literature" | Act 3 | Meta-Harness cites arXiv, self-evaluation begins |
| 7 | "Liminal Speaks" | Act 3 | TextGen generates content about itself. The meta-recursive moment. |
| 8 | "The Handoff" | Act 3 | Where we are now. The gradient. What comes next. |

**Season 2+:** Live episodes as Liminal continues self-improving. Each episode captures a real dogfood cycle, a real MetaHarness detection, a real improvement — filmed as it happens.

### Content Production Using Liminal's Own Tools

The faceless channel is itself an Act 3 proof:

1. **TextGenerativeGenerator** → Episode scripts from each act's POV
2. **Swarm personas** → Distinct voice sections (Kai narrates architecture, Sam narrates feeling, Max distills the lesson)
3. **PromoVideoGenerator** → Visual assets, platform-specific formats
4. **BlogToVideoPipeline** → Convert existing blog posts (3/4/5) into episode scripts
5. **MetaHarness** → Quality gate on generated scripts (is this good enough to publish?)
6. **External tools** → Voice synthesis (ElevenLabs or equivalent) + Remotion assembly

---

## YouTube 2026 Compliance

### The Policy Landscape

YouTube's January 2026 enforcement wave wiped **4.7 billion views** from 16 channels flagged as "Inauthentic Content." Thousands of faceless channels were demonetized overnight.

**What YouTube targets:**
- Content that could be **mistaken for real footage** (deepfakes, synthetic humans)
- Channels that obscure their AI-generated nature
- Mass-produced low-quality content farms

**What YouTube allows (with disclosure):**
- AI-narrated educational content with transparent identity
- Synthetic voices that don't impersonate real people
- AI-generated visuals clearly presented as such

### Why Liminal's Channel Is Compliant

1. **Inherent transparency** — The entire concept is "a tool narrating its own construction." The AI nature is the product, not a hidden implementation detail.
2. **No impersonation** — Three distinct voices, none pretending to be human celebrities or journalists
3. **Educational value** — Content teaches about creative coding, AI development, self-improving systems
4. **Disclosure built into format** — Every episode opens with the three-act framing, making the AI production explicit
5. **Claudius Papirus precedent** — "I'm Claudius. An AI narrator" survives the crackdown because transparency is the brand

### Disclosure Template

```
This video was produced by Liminal, a creative coding CLI tool.
The narration uses AI-generated voices representing three perspectives:
the developer who conceived the project, the coding agents who built it,
and the tool itself as it learned to improve its own output.
All data shown is from real commit histories, test results, and telemetry.
```

---

## Three-Act Content Format Spec

### Format Template

Each piece of three-act content (blog post, video episode, Twitter thread) follows this structure:

```
[ACT MARKER] — identifies which act is narrating
[VOICE] — tone and source data for this section
[CONTENT] — the actual narrative
[EVIDENCE] — specific commit, timestamp, metric, or artifact that grounds the claim
```

### Voice Characteristics

| Voice | Opening Pattern | Sentence Style | Evidence Type |
|-------|----------------|---------------|---------------|
| **Developer** | "I thought..." / "The idea was..." | Personal, metaphor-rich, bilingual fragments | Session logs, personal notes, YouTube watch history |
| **Agent** | "Round N, attempt M..." / "Pattern detected:" | Terse, data-heavy, lists and metrics | Telemetry JSONL, swarm outputs, commit timestamps |
| **Liminal** | "I detected..." / "The architecture shows..." | Observational, precise, self-aware but not sentient | Architecture diffs, test results, MetaHarness logs |

### Sample Three-Act Content Piece

**Title:** "The Day I Scored Everything 0.68"

**[Act 1 — Developer]**
I built four critics and named them after qualities I wanted in art: ColorHarmony, Layout, Typography, SoundHarmony. The formula was simple — 60% technical, 40% creative. I thought the hard part was done.

**[Act 2 — Agent]**
Dogfood run initiated. 54 executions across 9 domains. Results:
- p5.js stub (160 bytes): 0.68
- Three.js full scene (2,047 bytes): 0.68
- GLSL shader with 4 uniforms: 0.68
- ASCII art generator: 0.68

Variance across all runs: 0.00. Flag: SCORING_DEAD_ZONE.

**[Act 3 — Liminal]**
The configuration file read `maxIterations: 1`. I was scoring every piece exactly once, with no iteration. The creative loop never looped. A 160-byte stub and a 2,000-byte implementation received identical scores because neither was ever compared against an improved version of itself.

The fix was one line. The lesson was structural: evaluation without iteration is classification, not improvement.

---

## Competitive Differentiation

### What No Other Creative Coding Tool Can Claim

| Claim | Evidence | Competitor Closest |
|-------|----------|--------------------|
| "The tool narrates its own construction" | Three-act faceless channel | None |
| "We have 57 forensic archaeology deliverables" | AUDIT-REPORT.md, archaeology.html | None |
| "The scoring system had a dead zone and we published the data" | Blog 4, Video Script 1 | None — competitors hide failures |
| "11 classified eras from 7,059 commits" | Archaeology corpus | None |
| "The tool improved its own generators live" | MetaHarness auto-adaptation logs | GitHub Copilot (but no public telemetry) |
| "Bilingual EN/ES by default" | Blog 3/4/5, all content | Very few developer tools |

### The Moat

The three-act progression creates a compounding moat:
1. **Data moat** — 7,059 commits, 57 deliverables, 11 eras. Cannot be replicated without doing the work.
2. **Narrative moat** — The archaeology IS the content. A competitor would need years of documented development history.
3. **Self-referential moat** — The tool that narrates itself creates evidence faster than competitors can respond to it.
4. **Honesty moat** — The B+ audit grade, the 0.68 dead zone, the "4 out of 36 passed" — these build trust that marketing polish cannot.

---

## Production Pipeline

### Phase 1: Script Generation (Liminal's own tools)

```
Input: Topic + era range + target act balance
  → TextGenerativeGenerator (form: freeform, style: meditative)
    → Swarm round (5 personas vote on best sections)
      → MetaHarness quality gate
        → Three-voice script with [ACT MARKERS]
```

### Phase 2: Visual Asset Creation

```
Script sections → domain-appropriate generators:
  Act 1 scenes → p5.js sketches (personal, warm)
  Act 2 scenes → terminal captures, telemetry visualizations
  Act 3 scenes → architecture diagrams, before/after comparisons
  All → PromoVideoGenerator for platform-specific formats
```

### Phase 3: Assembly (External tools)

```
Script → Voice synthesis (ElevenLabs: 3 distinct voices)
Visuals → Remotion composition (per platform specs)
Audio → Tone.js background (procedural, per-act mood)
Assembly → Final export (YouTube 16:9, TikTok 9:16, Reels 9:16)
```

### Phase 4: Quality Gate

```
Assembled video → MetaHarness review:
  - Does the act progression feel natural?
  - Is every data claim traceable to an artifact?
  - Does the three-voice format add clarity or confusion?
  - Would a viewer unfamiliar with Liminal understand the story?
```

---

## Distribution Matrix

| Content Type | Channel | Frequency | Dominant Act | Format |
|--------------|---------|-----------|-------------|--------|
| Full three-act episode | YouTube | Bi-weekly | Progression | 5–10 min, 16:9 |
| Episode clips | TikTok, Reels | 2x/week | Single act | 30–60s, 9:16 |
| Dogfood telemetry | Twitter/X | 2–3x/week | Act 2 | Screenshot + thread |
| Before/after outputs | Twitter, TikTok | Weekly | Act 3 | Side-by-side visual |
| "Liminal fixed its own bug" | Twitter, Dev.to | When it happens | Act 2→3 | Thread or post |
| Cross-domain showcases | TikTok, Reels | 2x/week | Act 3 | 9 domains, 1 prompt |
| Archaeology visualizations | Twitter, Blog | Per milestone | Act 1 | Chart + context |
| MetaHarness pattern logs | Twitter | Weekly | Act 2→3 | Thread |
| Blog posts (EN/ES) | Blog, Dev.to | Weekly | All three | 2,000–3,000 words |
| Full episode scripts | Hashnode | Bi-weekly | All three | Long-form |

---

## Verification Criteria

Before any three-act content is published:

1. **Arc coherence** — The three-act progression is traceable through eras, and the act transitions feel earned, not forced
2. **Evidence grounding** — Every claim in every act maps to a specific commit hash, timestamp, telemetry entry, or artifact
3. **Voice distinctness** — A reader/viewer can identify which act is narrating without seeing the act marker
4. **No hallucinated correlations** — Same forensic audit standard as AUDIT-REPORT.md (label unverified claims as `[UNVERIFIED]`)
5. **Claudius Papirus parity** — Production quality meets or exceeds the case study reference
6. **YouTube compliance** — Disclosure template included, no impersonation, educational value clear
7. **Bilingual readiness** — Core content pieces have EN/ES versions (parallel creation, not translation)
