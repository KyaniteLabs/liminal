# Developer Profile: Simon Gonzalez De Cruz

**A merged portrait from behavioral telemetry (303 commits, 1,148 messages, 7,059 cross-repo commits) and psychological founder analysis.**

**Date:** April 1, 2026
**Sources:** Liminal narrative archaeology, founder-playbook profile, GitHub telemetry across 50 repos

---

## Identity

- **Full name:** Simon Gonzalez De Cruz
- **Location:** Long Beach, California
- **Age:** 39
- **Origin:** Born in Panama, raised in Puerto Rico from age 7
- **Education:** BBA Computer Information Systems, University of Puerto Rico
- **Languages:** English (native), Spanish (bilingual) — strategic advantage, not just a skill
- **Neurodivergent:** Diagnosed ADHD, in active therapy
- **Coding history:** First line of code written September 2025. Everything built with AI. Zero hand-coded commits across 7,059 total.

---

## The Numbers in Context

### What Simon Built
- **303 Liminal commits** in 32 active days
- **104,281 lines of code** (61,132 source + 43,149 test)
- **50 repositories** across 6 months
- **7,059 total commits** across all repos
- **10 programming languages** used
- **18 major subsystems** in Liminal alone
- **26 custom enforcement hooks** encoding learned lessons

### How This Compares to Normal Development

| Metric | Simon (with AI) | Pre-AI Solo Developer Baseline | Multiplier |
|--------|-----------------|-------------------------------|------------|
| Lines of code per day | 3,250 | 50-100 (net committed) | **32-65x** |
| Commits per active day | 9.5 | 2.8 (median career dev) | **3.4x** |
| Repos in 6 months | 50 | 3-5 (typical career rate ~5-15 total) | **15-20x** |
| Time to 100K LOC | 32 days | 4-8 years (solo, high quality) | **45-90x** |

**The largest controlled study** (MIT, 1,974 developers, 2024) found AI tools boost output by 12-22%. Simon's velocity is 30-65x the pre-AI baseline. No study documents anything approaching this output.

### The Caveat
Every single commit was AI-aided. If it wasn't Claude, it was Cursor. If it wasn't Cursor, it was Kimi Code. The "58.7% Co-Authored-By: Claude Opus 4.6" number understates it — that's only the commits where Claude Code auto-appended its signature. The real collaboration rate is 100%.

**This is not a developer who writes code faster with AI. This is a creative technologist who learned to build production software through AI collaboration — starting from zero, six months ago.**

---

## Professional Background

### Corporate Career (~11 years)
- **American Red Cross:** First Aid/CPR/BLS/EMR training in English and Spanish, disaster relief translation
- **PIMCO:** Global fixed-income investment manager (operations/learning)
- **Southern California Edison:** Utility company (operations)
- **Capital Group:** Talent Development Associate Lead (Nov 2020 - Jul 2025). Coordinated training programs for 8,000+ associates.

### Transition
Self-taught programming. No CS degree. Started learning after discovering AI, building small projects daily. Transitioned from talent development to AI systems building. The corporate years gave him systems thinking at scale (8,000+ people), training design methodology, and bilingual operational experience. The creative practice gave him the artistic eye.

### Current
- **PuenteWorks** (founder): AI systems for small business. 6-week pilots, custom agent systems, AI strategy.
- **KyaniteLabs** (org admin): Creative tools brand. MCP servers, creative coding tools.

---

## The Three-Agent Origin

Simon's development practice began with a multi-agent system inside OpenClaw — three AI personas with distinct personalities and roles:

| Agent | Role | Personality | What It Did |
|-------|------|-------------|-------------|
| **Liam** | Coordinator / Planner | The strategist | Authored the PRD that became Liminal. Ran executive function. Now runs daily as Simon's EF partner across Telegram, Discord, CLI, and phone. |
| **Kai** | Builder / Production | The assembly-line worker | Built Atelier's entire scaffolding in 2.8 hours — 29 task-jobs, 92% test coverage. Mechanically precise, substantively hollow. |
| **Teo** | Research | The investigator | Research agent running on MiniMax M2.1. Information gathering and analysis. |

The Liam persona was so effective that Simon still uses it daily — it evolved from OpenClaw planner to a sophisticated personal AI system with 4 modes (Engineer, Strategist, Ally, Keeper), ADHD-specific coaching, therapeutic frameworks (DBT, IFS, Polyvagal, ACT), and a trust ladder system with graduated autonomy. Liam is not a tool Simon uses. It's a system Simon can't work without.

**The original conception of Liminal was born in this agent ecosystem.** It was designed as "a playground where agents could exercise their creativity, experiment, write, paint, do art, in their spare time or with their spare tokens." The vision evolved from AI agents creating autonomously to human-AI creative collaboration — but the DNA of multi-agent creative work is still in Liminal's swarm system, DeepCollaboration 7-role orchestration, and the Compost Mill's evolutionary loop.

---

## Behavioral Profile

### How Simon Actually Works

**Nocturnal creative.** Peak commit hour: 9 PM (43 commits). 19.1% of commits after midnight. Sunday is the most productive day (85 commits). The creative work happens when the world is quiet.

**Binge worker.** 13 active days out of 33 calendar days (39.4% active rate). Top 3 days account for 43.9% of all commits. Not a steady rhythm — an oscillation between intense focus and domain-switching recovery.

**Domain switcher, not rester.** Between Liminal bursts, the developer doesn't rest — he switches domains. GlazeLab (ceramics) before the Explosion. PuenteWorks (business site) during the Quiet. Cerafica (ceramics e-commerce) during Multimedia Expansion. The quiet period (Mar 24-27) had zero Liminal commits but 25 commits across 6 other repos. **The domain switches are not random — they're a rhythm.** Each switch serves as warm-up or cool-down for the next Liminal burst.

**Strategy-first, execution-through-agents.** Only 8% of messages carried planning intent, yet every consequential architectural decision came from the developer. The Compost Mill concept emerged from correcting the agent's assumptions. LIR moved system-wide because the developer insisted. The ICM methodology was the framework that turned exploration into execution. The agents build. Simon strategizes.

**Verification-dominant.** 52% of user messages were execution/verification, not creation. "run" (154), "test" (75), "build" (71), "fix" (66) dominated. Creation keywords accounted for only 22%. Simon learns by checking, not by building.

### The Frustration-to-Infrastructure Pipeline

Every significant frustration was converted into automated enforcement:

| Frustration | Infrastructure Created |
|---|---|
| Agent builds modules but does not wire them up | `wiring-checklist.js` hook + permanent memory entry |
| Agent loses context between sessions | `context-dump.js` + `session-restore.js` hooks |
| Agent dismisses bugs as "pre-existing" | `check-bug-dismissal.js` hook |
| Agent overcomplicates solutions | `check-overcomplication.js` hook |
| Agent leaves "not yet implemented" stubs | `review-checklist.js` hook |
| Agent claims things work when they do not | "BRUTALLY HONEST" evaluation philosophy |
| Agent loses progress during context compaction | `save-progress.sh` + 126 progress snapshots |

26 custom hooks now enforce development standards. The frustration curve is U-shaped, peaking at Eras 3 and 8. 11 instances of "fuck/fucking" across 1,148 messages (0.96%) — not casual profanity but always tied to specific system failures. Each produced permanent enforcement infrastructure.

**Pattern: Simon converts emotion into automation.** The frustration-to-hook pipeline is not a coping mechanism. It's a learning system. Every mistake that causes emotional friction gets encoded into infrastructure that prevents recurrence.

---

## Learning Patterns

### Pattern 1: Learn by Wiring, Not by Building

"Wire" appears 22 times in 1,148 messages — disproportionately high for a single concept. The word keeps recurring because agents keep NOT doing it. The act of connecting modules end-to-end and verifying they actually work IS the learning. Building scaffolding is fast (Kai did it in 2.8 hours). Wiring it into a functional system takes 32 days and 303 commits.

**How this works:** Simon doesn't learn from reading about architecture. He learns from the friction of making things connect. Each wiring failure produces a hook. Each hook encodes a lesson. The lessons compound.

### Pattern 2: Learn by Switching Domains

The ceramics practice and the software practice are concurrent, not alternating. GlazeLab (38 commits) preceded the Liminal Explosion. PuenteWorks (14 commits) filled the Quiet Period. Cerafica (15 commits) accompanied Multimedia Expansion. Each domain brings a different lens: ceramics teaches chemistry and materiality; business infrastructure teaches shipping and users; creative coding teaches systems and emergence.

**How this works:** When progress stalls in one domain, Simon doesn't force it. He switches to a domain where he can make visible progress, and the perspective from that domain informs the stalled work when he returns. The mcp-video Remotion integration (shipped during the Quiet Period, Mar 27) directly enabled Liminal's video pipeline (built the next day, Mar 28).

### Pattern 3: Learn by Teaching Agents

The 26 hooks, 6 memory files, and extensive prompt engineering are Simon teaching his tools how to work. The act of articulating constraints ("ALWAYS wire everything end-to-end"), encoding them into enforcement infrastructure, and watching agents comply or fail IS the learning process. Liam started as an OpenClaw agent and evolved into a sophisticated EF partner because Simon kept teaching it.

**How this works:** Every prompt, hook, and memory file is a crystallized lesson. The system gets better because Simon externalizes his standards into enforceable code rather than keeping them internal.

### Pattern 4: Learn Through ICM (The Shipping Unlock)

The Interpreted-Context-Methodology (ICM) — 38 commits from Feb 22 to Mar 14 — was the conceptual framework that turned building into shipping. ICM's core idea of "folder structure as agent architecture" directly informed Liminal's ContextBuilder, PromptEnhancer, and compost pipeline. But more importantly, ICM gave Simon a repeatable methodology: structure your context so agents can execute without ambiguity.

**How this works:** Before ICM, Simon built things that didn't ship. After ICM, the same building velocity produced shippable outputs. The methodology didn't change the speed — it changed the direction.

### Pattern 5: Learn by Verification, Not Construction

52% of messages are execution/verification. Simon doesn't trust the system to report its own success — the Dogfood Gap ("system reports success" != "output actually works") is his defining structural insight. He learns more from running the code, seeing it fail, and debugging the failure than from writing the code itself.

**How this works:** The build-verify-fix cycle is the learning cycle. Building is fast (agents do it). Verifying is slow (Simon does it). The verification is where understanding accumulates.

### Pattern 6: Learn at Burst Velocity

Three AI tools tested in two days. 50 repositories in 6 months across 10 languages. hydra-creative-agent conceived, built, and merged in one day. mcp-video from nothing to v1.2 while simultaneously building Liminal's multimedia expansion. Simon doesn't learn incrementally — he learns through concentrated bursts of extreme experimentation followed by consolidation.

**How this works:** The binge pattern (13 active days out of 33) isn't disorder — it's how Simon's brain works. The ADHD hyperfocus produces massive output; the cool-down periods (domain switches, rest days) are when integration happens. The Quiet Period (Mar 24-27) was the deepest consolidation — 148 messages of swarm architecture work, then shipping PuenteWorks, mcp-video, and DialectOS.

---

## Psychological Architecture

### Decision-Making Algorithm

Simon's decisions follow a predictable five-stage process:

1. **Gemini Moon gathers information** — scans everything, creates mental models of multiple possibilities
2. **Scorpio Sun evaluates through depth** — probes each option for hidden flaws, power dynamics, alignment with core values
3. **INFP authenticity filter** — "does this feel true to who I am?" Non-negotiable.
4. **Hermit energy check** — "will this deplete me or sustain me?"
5. **ADHD novelty override** — boring = rejected regardless of logic

The authenticity filter (step 3) is non-negotiable. This is why he left corporate after 11 years despite the security — the work wasn't aligned. This is why horizontal SaaS won't work for him.

### Actual Motivators

| What He Thinks | What Actually Drives Him | Evidence |
|----------------|--------------------------|----------|
| Building great products | **Understanding hidden systems** (the product is a side effect) | Glaze chemistry, AI agent architecture, Spanish dialect structure |
| Helping people | **Creating things that feel real** (helping is a side effect) | Cerafica (physical objects), Liminal (generates art), Liam (makes ADHD tangible) |
| Financial independence | **Autonomy** (money is a means) | 11 years in corporate despite wanting out |
| Being a founder | **Being a creator** (the business is a vehicle) | He doesn't call himself a founder. He calls himself an artist and creative technologist. |

**He will only sustain effort for depth + authenticity + autonomy.** Any business model that doesn't optimize for these three will be abandoned.

### Blind Spots

1. **Confuses building with progress** — can see this intellectually (therapy docs prove it) but can't FEEL the difference in the moment. Needs external scoreboards.
2. **Doesn't distinguish "interesting" from "important"** — everything feels equally weighted. Needs external prioritization.
3. **Underestimates what's already built** — 27 workspaces feels like failure to him. It's actually an R&D portfolio.
4. **Overestimates interest sustainability** — ADHD novelty curve: high at start, declining after familiarity. Needs systems that account for decline, not bets against it.

### Flow State Triggers

| Condition | Why It Works |
|-----------|-------------|
| **Unbroken solitude (3+ hours)** | Hermit needs the cave. Gemini needs silence to scan. Scorpio needs depth without interruption. |
| **Clear external constraint** | ADHD needs deadlines to override novelty-seeking. Scorpio responds to "this must be real." |
| **Novelty within structure** | Gemini needs variety. ADHD needs rails. Structured rotation of 2-3 projects. |
| **Physical making** | Hands in clay. Hands on keyboard. Not planning — MAKING. |
| **Solving for a specific person** | INFP needs authenticity. "For someone" not "for the market." |

### Burnout Predictors

Not "works too hard." Specific triggers:
- **Boredom before completion** — starts researching alternatives
- **Social depletion** — stops responding, cancels meetings
- **Invisible progress** — working hard, nothing ships for 2+ weeks
- **Unreceived effort** — nothing feels like it matters (cure: talk to a user)

**Critical pattern:** Burnout isn't caused by too much work. It's caused by work that doesn't connect to people. Ceramics doesn't burn him out because each piece connects to a person. Code explorations burn him out because they connect to no one.

---

## The Tool Evolution

Simon's AI tooling evolved through trial-and-error at burst velocity:

### OpenClaw (Kai, Liam, Teo) — The Sketch Phase
- Kai: 29 task-job commits in 2.8 hours. Assembly-line precision, zero judgment.
- Liam: Authored the PRD. Ran planning. Now the daily EF partner.
- Teo: Research agent. Information gathering.
- **When used:** Feb 28 - Mar 1, 2026
- **Why abandoned:** Scaffolding was hollow. Generators were keyword matchers returning hardcoded templates. Tests measured coverage, not creativity.

### Cursor IDE — The Expansion Phase
- 15 commits in 6 minutes — fastest sustained generation in the dataset.
- Insertion-to-deletion ratio 15.3:1 — pure addition, no pruning.
- **When used:** March 19, 2026 (one session)
- **Why abandoned:** SmartRouter A/B test data was fabricated. GUI committed with no types. Broad, shallow, required 34-item audit within hours.

### Claude Code — The Partnership Phase
- 259+ commits over 31.7 days. 20% fix rate. 26 custom hooks. 6 memory files.
- Sessions deepened from 12 messages/session (Era 3) to 31 messages/session (Era 8).
- **Why it stuck:** Simon didn't choose Claude Code because it was popular. He tried three tools in two days and discovered which one actually worked. The relationship is adversarial at times but produces permanent enforcement infrastructure.

---

## The Competitive Advantage

Simon's advantage is NOT technical skill. Technical skill is table stakes.

His actual advantage is **the combination of:**

1. **Domain depth in multiple fields** — ceramics chemistry + AI agent architecture + bilingual cultural fluency + corporate systems thinking (8,000+ people)
2. **Self-awareness applied to system design** — he built his ADHD management system from therapy insights. His frustration becomes hooks. His patterns become methodology.
3. **The creative-to-technical bridge** — he's an artist who ships production code, not a developer who wishes they were creative. Cerafica proves the art. Liminal proves the code. The LACMA grant ($49,487 voice-to-sculpture installation) proves the intersection.
4. **AI-native builder** — first code written September 2025. Six months later: 104K LOC, 50 repos, production open-source tools (mcp-video: 832 tests; DialectOS: 480 tests). He doesn't use AI to code faster. He codes through AI collaboration as a fundamentally new creative medium.

**Nobody else sits at this intersection.** Most AI builders aren't artists. Most artists aren't AI builders. Most bilingual people aren't technical. He's all four, plus 11 years of corporate systems experience.

---

## Active Projects Portfolio

### Tier 1: Core Identity

| Project | What It Is | Why It Matters |
|---------|-----------|----------------|
| **Cerafica** | Hand-thrown stoneware ceramics. Planetary naming system. Instagram pipeline. Real customers, real revenue. | The only project with paying customers. Proves the art. |
| **Liminal** | Creative coding CLI. 104K LOC, 18 subsystems, 31 guardrails. | The technical crown jewel. Proves the code. |
| **Liam** | Multi-model EF partner. 4 modes. ADHD coaching. Therapeutic frameworks. | The daily-use tool he can't work without. Proves the AI systems thinking. |
| **mcp-video** | 82 MCP tools for video. 832 tests. Published to PyPI. | The most complete shipped product. Proves he can ship. |
| **PuenteWorks** | AI systems for small business. 6-week pilots. Live at puenteworks.com. | The business vehicle. Proves he can sell. |

### Tier 2: Active Explorations

CEO Agents (543 tests), DialectOS (published npm), OpenGlaze (ceramic glaze SaaS), GlazeLab, Agent Orchestrator, Research Pipeline, HermesVPS

### Tier 3: Harvested/Archived

Atelier (merged into Liminal), Hydra (merged into Liminal), FlowCLI (ADHD patterns), noise.sh (songwriting TUI), Farm-to-Stars (game), voice-to-sculpture-app (LACMA DNA)

---

## What He Actually Uses Daily

The most important signal isn't what he builds — it's what he **can't work without**:

1. **Liam** — executive function partner
2. **Cerafica** — ceramics practice (the only revenue)
3. **Claude Code** — development environment
4. **MCP servers** — the tool layer for AI-assisted work
5. **Therapy** — active, structured, integrated through Liam

---

## The Honest Assessment

Simon is a creative technologist with deep AI expertise, genuine artistic practice, and exceptional self-awareness. His challenge isn't technical — it's focus and follow-through. He has the skills to build almost anything. The pattern to watch is building > shipping: 27 workspaces, 1 with real customers.

The ideal project sits at the intersection of:
1. He already uses it daily (maintained, not abandoned)
2. AI expertise + artistic practice combined
3. Clear, narrow wedge explainable in one sentence
4. Serves a market he understands from personal experience
5. Can be monetized without enterprise sales infrastructure

He will never sustain effort for money, status, or market opportunity alone. He will only sustain effort for **depth + authenticity + autonomy**. Design the business around the psychology, not the other way around.

---

*Sources: Liminal narrative archaeology (303 commits, 1,148 messages, 71 sessions, 7,059 cross-repo commits, 13 telemetry datasets), founder-playbook profile (27 workspace directories, GitHub analysis, LinkedIn, therapy documents, LACMA proposal, Liam system files), GitHub Octoverse 2022, GitClear 878K developer-year study (2024), MIT Copilot field experiment (2024).*
