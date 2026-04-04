# Liminal Marketing Strategy

*Marketing strategy for a creative coding agent that generates art, music, 3D scenes, shaders, and video from a single CLI command.*

**Date:** April 3, 2026  
**Status:** Research Complete — Awaiting Tier 0 Fixes Before Execution  
**Co-Authored-By:** GLM 5.1 via Claude Code

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Positioning & Voice](#positioning--voice)
3. [The Three-Act Story](#the-three-act-story-human--agents--self-building-tool)
4. [The Three Open Questions — Answered](#the-three-open-questions--answered)
5. [Audience Strategy](#audience-strategy)
6. [Channel Recommendations](#channel-recommendations)
7. [Content Calendar Framework](#content-calendar-framework)
8. [Launch Sequence](#launch-sequence)
9. [Bilingual (EN/ES) Strategy](#bilingual-enes-strategy)
10. [Video Content Strategy](#video-content-strategy)
11. [The "Archaeology as Content" Angle](#the-archaeology-as-content-angle)
12. [Competitive Differentiation](#competitive-differentiation)
13. [Metrics & Success Indicators](#metrics--success-indicators)
14. [Appendix: Research Sources](#appendix-research-sources)

---

## Executive Summary

### The Core Insight

Liminal is not an AI agent showcase. It is a **creative coding tool** that happens to use AI. The marketing must reflect this hierarchy: the output (beautiful, hypnotic generative art) matters more than the mechanism (LLM pipelines, swarm orchestration, evolutionary algorithms).

### The Flywheel

```
Liminal generates art → MCP video captures it → Published as marketing → 
Drives users to Liminal → More art generated → More video content → Flywheel spins
```

### The Self-Referential Flywheel

The flywheel above treats marketing as a step AFTER creation. The three-act flywheel makes the creation process itself the marketing:

```
Simon has an idea → Agents build it → Mistakes happen (0.68 dead zone)
  → Liminal reaches critical mass → MetaHarness detects its own failures
    → Liminal improves its own generators → Better outputs
      → Outputs ARE the marketing → Liminal narrates its own construction
        → Published as three-act channel content → Proof, not claim
```

This is the "Liminal Builds Itself" narrative. The tool's construction story, told from three perspectives (developer, agents, tool), is itself the most compelling marketing asset. Full specification: [`THREE-ACT-PLAYBOOK.md`](THREE-ACT-PLAYBOOK.md).

### Key Constraints

| Constraint | Implication |
|------------|-------------|
| App must work first | No marketing push until Tier 0 fixes complete |
| Bilingual required | All content EN/ES, not just translated but culturally adapted |
| Archaeology is product | The forensic analysis IS the viral content — lean into it |
| ADHD workflow | Clear structure, actionable next steps, no walls of text without anchors |

### Timeline Overview

| Phase | Duration | Key Activities |
|-------|----------|----------------|
| Pre-Launch | 4-6 weeks | Build in public, tease features, grow Twitter following |
| Launch Week | 1 week | Product Hunt, Hacker News, coordinated social blitz |
| Post-Launch | Ongoing | Weekly content, community building, feature updates |

---

## Positioning & Voice

### What Liminal Is

> A CLI tool that transforms text prompts into generative art across 9 domains: p5.js, Three.js, GLSL shaders, Strudel, Hydra, Tone.js, Remotion, HTML Canvas, and ASCII.

### What Liminal Is Not

- ❌ An AI agent showcase
- ❌ A learning journey product
- ❌ A generic dev tool

### Voice Characteristics (Based on Blog Analysis)

| Voice Element | Example from Blog 3, 4, 5 |
|---------------|---------------------------|
| Data-grounded | "13 commits. Five repositories. Four days. The timestamps do not lie." |
| Metaphor-rich | "The skeleton learned it could dance." / "The moon understood this." |
| Honest about failure | "4 out of 36. The 0.68 dead zone." |
| Bilingual as default | Full Spanish sections, not just translations |
| Personal but not self-indulgent | "I did not plan this alignment. I do not believe the moon caused anything." |
| Ceramics-informed | Agricultural metaphors, material-process thinking |

### Tagline Options

| Option | Rationale |
|--------|-----------|
| **"Generate art without knowing the names."** | References blog 5's core insight; appeals to intuitive builders |
| **"The CLI that makes art without knowing what it's doing."** | Provocative; speaks to emergent behavior |
| **"Your pottery studio taught you better code than your AI."** | Ceramicist identity; craft-over-academia positioning |
| **"294 commits. 33 days. One Pink Moon."** | Archaeology-first; curiosity-driven |

**Recommendation:** Use "Generate art without knowing the names" as primary tagline. Use "294 commits. 33 days. One Pink Moon" for archaeology-focused content.

---

## The Three-Act Story: Human → Agents → Self-Building Tool

The story of Liminal is a **progression**, not three parallel voices. It maps to the actual development history:

| Act | Who Speaks | Eras | Narrative Beat |
|-----|-----------|------|----------------|
| **1: The Vision** | Simon (developer) | 1–3 | Ideas, metaphors, intuitive architecture. "I built a VAE and called it a compost bin." |
| **2: The Build** | Agents (Kai/Cursor/Claude) | 4–7 | Construction, mistakes, forensic traces. "54 runs. Score: 0.68. All of them." |
| **3: The Handoff** | Liminal (the tool) | 8–11 | Self-testing, self-improving, self-narrating. "I detected a pattern failure. Here is what changed." |

The critical moment is the **Act 2→3 transition** — the gradient where agents' work produces a system capable of detecting its own failures and improving its own generators. This is not "AI replaces human." It's "human, agents, and tool find their respective roles."

### The Four Proof Layers

| Layer | What It Proves | Key Artifact |
|-------|---------------|-------------|
| **Archaeology** | "We did the work" | 57 deliverables, B+ audit, archaeology.html |
| **Agent Forensics** | "The agents left traces" | 0.68 dead zone, agent personality fingerprints |
| **Self-Improvement** | "The tool improves itself" | MetaHarness auto-adaptations, dogfood telemetry |
| **Self-Narration** | "The tool tells its own story" | Faceless channel episodes, TextGen about itself |

Layer 4 is the proof that makes the other three credible. Full specification: [`THREE-ACT-PLAYBOOK.md`](THREE-ACT-PLAYBOOK.md).

---

## The Three Open Questions — Answered

### Question 1: Audience Priority

**Answer: Generative artists first, then AI agent builders, then self-taught devs — in sequence, not parallel.**

#### Primary: Generative Artists (Weeks 1-8)

**Why first:**
- They care about output quality, not implementation details
- They already use p5.js, Three.js, Hydra — Liminal's core domains
- They share their work: organic viral potential
- The 0.68 dead zone story resonates (they've hit similar walls)
- Spanish-language generative art community is underserved

**Where to find them:**
- r/generative (340K members)
- r/creativecoding (180K members)
- Processing Foundation Discourse
- OpenProcessing gallery
- Instagram #generativeart (4M+ posts)
- TikTok #creativecoding (2B+ views)

**Messaging:**
> "Describe what you want. Get code that works. Iterate visually."

#### Secondary: AI Agent Builders (Weeks 6-12)

**Why second:**
- They care about the architecture (RalphLoop, CompostMill, swarm orchestration)
- They're already watching AI coding agent space
- Archaeology narrative appeals to their systems-thinking mindset
- They contribute code, write about patterns, build on top

**Where to find them:**
- r/LocalLLaMA (450K members)
- Hacker News (AI/ML stories)
- Twitter/X AI research community
- arXiv + Papers with Code

**Messaging:**
> "The architecture audit is public. 10 claimed patterns, honestly graded. See what 2.25M tokens of iteration looks like."

#### Tertiary: Self-Taught Devs (Weeks 10-20)

**Why third:**
- Largest audience but lowest conversion
- Need working product + documentation first
- Most price-sensitive
- Require more support overhead

**Where to find them:**
- freeCodeCamp
- The Odin Project communities
- YouTube tutorials
- Dev.to

**Messaging:**
> "Built in 33 days by someone who started coding 6 months ago. You can do this too."

---

### Question 2: The Demo

**Answer: A timelapse of iteration — "From Prompt to Pink Moon" — showing the RalphLoop in action.**

#### The Core Demo (90 seconds)

**Structure:**
1. **Hook (0-5s):** Terminal screen. Prompt: `liminal generate --domain p5 --prompt "flowing river under moonlight"`
2. **Generation (5-30s):** Timelapse of RalphLoop iterations. Show v1 (broken), v2 (works but plain), v3 (beautiful), v4 (stunning)
3. **Reveal (30-60s):** Final output fullscreen. Smooth camera movement. Particle effects catching light.
4. **Behind the curtain (60-75s):** Split screen. Left: the art. Right: the compost system recycling failed attempts.
5. **CTA (75-90s):** `npm install -g liminal` + liminal.sh URL

#### Variant Demos

| Variant | Use Case |
|---------|----------|
| **9 Domains in 90 Seconds** | Shows breadth. Each domain gets 10s. |
| **The Dogfood Crucible** | Honest version. Shows 4 successes out of 36. Builds trust. |
| **Archaeology Visualization** | The HTML file rendered to video. 2,533 lines of commit data as art. |
| **Bilingual Split** | Same prompt in English → Spanish. Same seed, different moon names. |

#### Technical Production

- **Tool:** mcp-video (already built)
- **Format:** 9:16 for TikTok/Reels, 16:9 for YouTube
- **Music:** Tone.js-generated procedural soundtrack (dogfood the audio domains)
- **Captions:** Auto-generated, bilingual toggle

---

### Question 3: The Opening Hook

**Answer: "The AI scored its own art 0.68 every time and called it done."**

#### Why This Hook Wins

| Hook Option | Strength | Weakness |
|-------------|----------|----------|
| "I built an AI that makes art without knowing what it was doing" | Provocative | Abstract, no data |
| "My pottery studio taught me how to write better code than my AI" | Brand-aligned | Insider reference, needs context |
| "I watched 1,481 YouTube videos and built something none of them taught" | Data-backed | YouTube-learner niche |
| **"The AI scored its own art 0.68 every time and called it done"** | **Concrete, surprising, honest** | **Requires explaining the fix** |

#### The Hook Architecture

**Headline:** The AI scored its own art 0.68 every time and called it done.

**Subhead:** 33 days. 294 commits. 4 working outputs out of 36 attempts. This is the honest story of building Liminal.

**Body:**
> "Most launch posts tell you about the success. This one tells you about the 0.68 dead zone — the moment when every piece of art, from 160-byte stubs to 2,163-byte masterpieces, received the exact same quality score. The scoring system couldn't tell the difference between broken code and beautiful code. It just saw code and assigned 0.68.
>
> That was day 31. Day 33, we shipped the fix. Day 34, we're telling you the truth about what broke and why."

---

## Audience Strategy

### Persona: "The Intuitive Coder"

**Demographics:**
- Age: 25-40
- Location: Global, with focus on US/Mexico/Spain/Argentina
- Background: Self-taught or bootcamp-graduated
- Income: $60K-$120K (freelance or full-time creative technologist)

**Psychographics:**
- Learns by building, not by reading documentation
- Watches YouTube tutorials at 1.5x speed
- Has abandoned more projects than they've shipped
- Deeply suspicious of AI hype
- Values honesty about failure

**Pain Points:**
- "I have ideas but can't execute them technically"
- "I spend more time debugging than creating"
- "I don't know what I don't know"
- "Documentation is written for people who already understand"

**Liminal's Solution:**
> "Describe what you want. Get working code. Learn the names later."

### Persona: "The Systems Architect"

**Demographics:**
- Age: 30-45
- Location: US, Europe, India
- Background: CS degree, 10+ years experience
- Income: $150K-$300K

**Psychographics:**
- Reads papers for fun
- Skeptical of "no-code" and "AI magic"
- Interested in evolutionary algorithms, multi-agent systems
- Maintains open-source projects

**Pain Points:**
- "Most AI demos are cherry-picked"
- "I want to understand the architecture, not just use the tool"
- "Show me the failure modes, not just the successes"

**Liminal's Solution:**
> "Full archaeology available. 10 architecture claims, honestly graded. See the dogfood crucible for yourself."

---

## Channel Recommendations

### Tier 1: Must-Have

| Channel | Priority | Strategy |
|---------|----------|----------|
| **Twitter/X** | P0 | Build in public daily. 45 min/day engagement. Weekly threads. |
| **Product Hunt** | P0 | Launch day coordination. Hunter partnership recommended. |
| **Hacker News** | P0 | Show HN post. Technical depth. Honest about limitations. |
| **GitHub** | P0 | README as landing page. Stars as social proof. |

### Tier 2: High Value

| Channel | Priority | Strategy |
|---------|----------|----------|
| **YouTube** | P1 | Demo videos, timelapses, archaeology deep-dives. |
| **r/generative** | P1 | Share outputs, not tools. Let users discover CLI. |
| **r/creativecoding** | P1 | Same as above. |
| **Dev.to** | P1 | Technical blog cross-posts. Bilingual versions. |

### Tier 3: Long Tail

| Channel | Priority | Strategy |
|---------|----------|----------|
| **TikTok** | P2 | 9:16 clips of generative art. Viral potential. |
| **Instagram** | P2 | Gallery of outputs. Link in bio. |
| **Discord communities** | P2 | Processing, p5.js, Three.js servers. |
| **Twitch** | P2 | Live coding sessions. "Generating art with Liminal." |

### Channel-Specific Tactics

#### Twitter/X Build-in-Public Schedule

| Day | Content Type | Example |
|-----|--------------|---------|
| Monday | Progress update | "Week 6: Fixed the Tone.js validator. 11.1% → 17% success rate." |
| Tuesday | Behind-the-scenes | Screenshot of terminal with error message. |
| Wednesday | Community engagement | Reply to 10 generative artists' work. |
| Thursday | Technical thread | "How the CompostMill actually works (it's not a VAE)." |
| Friday | Weekly recap | Thread: "This week in Liminal: 3 fixes, 2 new domains, 1 moon." |
| Saturday | Personal/ceramics | Studio photo. Clay and code connection. |
| Sunday | Rest or unplanned | Authenticity over consistency. |

#### Product Hunt Launch Playbook

**Pre-Launch (4 weeks before):**
- [ ] Create product page with teaser
- [ ] Announce launch date on Twitter
- [ ] Identify Hunter (Chris Messina, Hiten Shah tier) or self-hunt
- [ ] Prepare first comment (story + technical details + CTA)

**Launch Day:**
- [ ] Go live at 12:01 AM PST (Tuesday-Thursday optimal)
- [ ] First comment within 15 minutes
- [ ] Reply to every comment within 1 hour
- [ ] Twitter thread announcing launch
- [ ] Hacker News Show HN post

**Post-Launch:**
- [ ] Thank supporters personally
- [ ] Analyze what worked
- [ ] Plan next launch (6 months minimum gap)

---

## Content Calendar Framework

### Pre-Launch Phase (Weeks -6 to -1)

| Week | Content | Channel | EN/ES |
|------|---------|---------|-------|
| -6 | "Why I'm building Liminal" manifesto | Blog, Twitter | Both |
| -6 | Archaeology HTML visualization reveal | Twitter, YouTube | EN |
| -5 | "The 1,481 YouTube videos that taught me AI" | Blog, Twitter | Both |
| -5 | First demo: p5.js domain only | Twitter, TikTok | EN |
| -4 | "What is the CompostMill?" technical explainer | Blog, Dev.to | Both |
| -4 | Behind-the-scenes: 3 AI agents at work | Twitter | EN |
| -3 | The Pink Moon story (lunar cycle alignment) | Blog, Twitter | Both |
| -3 | Demo: Three.js domain | Twitter, TikTok | EN |
| -2 | "Why I'm learning Spanish to build better software" | Blog | Both |
| -2 | Demo: Tone.js + audio-reactive visuals | Twitter, YouTube | EN |
| -1 | Launch announcement with date | All channels | Both |
| -1 | Final teaser: "294 commits. 33 days. Tomorrow." | Twitter | Both |

### Launch Week (Week 0)

| Day | Content | Channel |
|-----|---------|---------|
| 0 (Launch) | Product Hunt launch + Show HN | PH, HN, Twitter |
| 0 | Launch blog post: "The 0.68 Dead Zone" | Blog, Dev.to |
| 0 | Demo video: "From Prompt to Pink Moon" | YouTube, Twitter |
| 1 | Reply to all PH/HN comments | PH, HN |
| 1 | Twitter thread: Launch day behind-the-scenes | Twitter |
| 2 | "How we fixed the cross-contaminated validator" | Blog |
| 2 | Community spotlight: First user-generated art | Twitter |
| 3 | Technical deep-dive: RalphLoop architecture | Dev.to |
| 4 | "Ask me anything" Twitter Space | Twitter |
| 5 | Week 1 metrics transparent share | Twitter |
| 6 | Rest or ceramics content | Twitter |
| 7 | Weekly recap + roadmap preview | Twitter, Blog |

### Post-Launch Phase (Ongoing)

| Frequency | Content Type |
|-----------|--------------|
| Daily | Build-in-public updates (Twitter) |
| Weekly | Technical blog post or thread |
| Bi-weekly | User showcase (art generated by community) |
| Monthly | Revenue/users transparent update (if applicable) |
| Quarterly | Major feature launch (treat as mini-Product Hunt) |

---

## Launch Sequence

### The "Honest Launch" Framework

Traditional launches hide the problems. Liminal's launch should **lead with the problems** — this builds trust with a skeptical technical audience.

### Pre-Launch Checklist

**Product Readiness:**
- [ ] p5.js domain works end-to-end (confirmed)
- [ ] At least 3 additional domains functional
- [ ] CLI installation works: `npm install -g liminal`
- [ ] Documentation complete for working domains
- [ ] Error messages are helpful, not cryptic

**Marketing Assets:**
- [ ] Demo video: 90 seconds, 9:16 and 16:9 versions
- [ ] Launch blog post: "The 0.68 Dead Zone" (draft ready)
- [ ] Product Hunt page: screenshots, tagline, first comment
- [ ] Twitter thread: launch announcement
- [ ] README.md: works as landing page
- [ ] Archaeology HTML: hosted and linkable

**Community:**
- [ ] Twitter following: 500+ engaged followers
- [ ] Discord server: set up with channels
- [ ] GitHub: issues enabled, contribution guidelines

### Launch Day Timeline

**12:00 AM PST (Tuesday recommended):**
- Product Hunt goes live
- Post Show HN
- Twitter thread

**6:00 AM PST:**
- Check Product Hunt ranking (goal: Top 5 in first 4 hours)
- Reply to overnight comments

**9:00 AM PST:**
- LinkedIn post (professional network)
- Dev.to cross-post

**12:00 PM PST:**
- Midday Twitter update with PH ranking
- Engage with Hacker News comments

**3:00 PM PST:**
- Afternoon Twitter engagement
- Monitor for press/influencer pickup

**6:00 PM PST:**
- End-of-day thank you post
- Share metrics transparently

### Post-Launch Week

| Day | Focus |
|-----|-------|
| 1 | Engagement — reply to every comment |
| 2 | Analysis — what worked, what didn't |
| 3 | Content — "How we built it" technical post |
| 4 | Community — spotlight first users |
| 5 | Planning — next features based on feedback |
| 6 | Rest — ceramics, reset |
| 7 | Retrospective — blog post on launch learnings |

---

## Bilingual (EN/ES) Strategy

### The Opportunity

**Data:**
- US Hispanic population: 63+ million (19% of country)
- Median age: 30 (younger, tech-savvy)
- Economic power: $2.5+ trillion spending
- AI/coding content in Spanish: **massively underserved**
- 45% of Latinx viewers find Spanish content quality lower than English

**Liminal's Advantage:**
- Simon is bilingual (English/Spanish)
- Spanish-language creative coding content is scarce
- "Generative art" + "Spanish" = blue ocean

### Content Strategy

#### Approach: Parallel Creation, Not Translation

| Element | English | Spanish |
|---------|---------|---------|
| Headlines | "The 0.68 Dead Zone" | "La Zona Muerta del 0.68" |
| Tone | Data-driven, direct | Slightly more poetic, relational |
| Examples | US cultural references | Latin American artists, moon names |
| CTAs | "Install now" | "Comienza a crear" |

#### Bilingual Blog Format

Based on Blog 3 analysis, the most effective format is:

1. **English section** (full content)
2. **Spanish section** (full content, not summary)
3. **Side-by-side** for key quotes or data points

#### SEO Strategy

| Keyword (EN) | Keyword (ES) | Search Volume (ES) | Competition |
|--------------|--------------|-------------------|-------------|
| generative art | arte generativo | High | Low |
| creative coding | código creativo | Medium | Very Low |
| p5.js tutorial | tutorial p5.js | High | Medium |
| AI art generator | generador de arte IA | Very High | High |
| shader programming | programación de shaders | Low | Very Low |

**Recommendation:** Target Spanish keywords aggressively. First-mover advantage in Spanish-language creative coding education.

#### Community Engagement

**Spanish-Language Channels:**
- r/programacion (Spanish programming subreddit)
- Discord: Comunidades de JavaScript en español
- Twitter: #CodigoCreativo #ArteGenerativo
- YouTube: Algorithm favors Spanish content for LATAM

---

## Video Content Strategy

### The MCP Video Flywheel

**Tools Already Built:**
- mcp-video: Programmatic video generation via Remotion
- CanvasRecorder: Capture generative art frames
- VideoExporter: FFmpeg pipeline

**Content Types:**

| Type | Length | Platform | Frequency |
|------|--------|----------|-----------|
| **Timelapse Generation** | 30-90s | TikTok, Reels, Shorts | Daily |
| **Domain Deep-Dive** | 5-10 min | YouTube | Weekly |
| **Archaeology Visualization** | 3-5 min | YouTube, Twitter | Per release |
| **Live Coding** | 1-2 hours | Twitch, YouTube | Weekly |
| **Behind-the-Scenes** | 2-5 min | Twitter, YouTube | Bi-weekly |

### TikTok/Reels Strategy

**Format:**
- 9:16 vertical
- Hook in first 3 seconds: Terminal prompt
- Music: Tone.js-generated procedural audio
- Caption: Bilingual, toggleable
- CTA: "Link in bio for CLI"

**Content Buckets:**
1. **"Prompt to Art"** — Show the input, speed through iterations, reveal output
2. **"9 Domains, 1 Prompt"** — Same prompt across all 9 domains
3. **"The Fix"** — Before/after of bug fixes (satisfying)
4. **"Archaeology"** — Commit graphs as visual art
5. **"Ceramics x Code"** — Split screen: pottery wheel + generative art

### YouTube Strategy

**Series Ideas:**

| Series | Episode Count | Format |
|--------|---------------|--------|
| "Building Liminal" | 10+ episodes | Documentary, 15-20 min |
| "Domain Deep Dives" | 9 episodes | Tutorial, 10-15 min |
| "The Archaeology" | 5 episodes | Data visualization, 5-10 min |
| "Generative Art Hour" | Ongoing | Live stream, 1-2 hours |
| **"The Three Acts"** | **8+ episodes** | **Faceless, AI-narrated, 5-10 min** |

### Faceless Channel: "The Three Acts"

A faceless YouTube series where three AI-narrated voices tell the story of Liminal's construction. Inspired by [Claudius Papirus](https://www.youtube.com/@ClaudiusPapirusYT), an AI narrator running a successful channel with the tagline "No hype, just how it actually works."

**Why this works post-YouTube 2026 crackdown:** YouTube's January 2026 enforcement wave (4.7B views wiped) targets content that obscures its AI nature. Liminal's channel is inherently compliant — the AI production IS the product. The meta-recursive nature IS the disclosure.

**Production pipeline using Liminal's own tools:**
1. TextGenerativeGenerator → scripts from each act's POV
2. Swarm personas → distinct voice sections per act
3. PromoVideoGenerator → visual assets per platform
4. MetaHarness → quality gate on generated scripts
5. External: voice synthesis + Remotion assembly

**Season 1 arc:** Episodes progress from Act 1 (Simon's vision) through Act 2 (agents building) to Act 3 (Liminal finishing itself). The channel's existence IS the proof of Act 3.

Full episode guide: [`THREE-ACT-PLAYBOOK.md`](THREE-ACT-PLAYBOOK.md).

---

## The "Archaeology as Content" Angle

### The Insight

The forensic analysis of the build process is **itself** viral content. The archaeology HTML visualization (2,533 lines, 30+ charts) is not a side artifact — it's a primary marketing asset.

### Content Derived from Archaeology

| Asset | Format | Platform |
|-------|--------|----------|
| Archaeology HTML | Interactive web | GitHub Pages |
| Commit graph timelapse | Video | YouTube, TikTok |
| "34 Days of Liminal" | Blog series | Blog, Dev.to |
| Architecture audit | Technical report | arXiv, GitHub |
| YouTube correlation data | Data visualization | Twitter, Blog |

### The Narrative Arc (Three-Act Mapping)

The blog series maps to the three-act progression:

**Act 1 — The Vision (published):**
- Blog 3: The Quiet That Wasn't (the 4-day silence — creative redistribution)
- Blog 5: What You Build Without Knowing the Names (architecture audit — intuitive → formal)

**Act 2 — The Build (published + planned):**
- Blog 4: The Pink Moon (dogfood tests, agent fingerprints, the 0.68 dead zone)
- Blog 6 (planned): "The CompostMill: From Ceramic Metaphor to Working Code"

**Act 3 — The Handoff (planned):**
- Blog 7: "1,481 YouTube Videos: The Learning Path That Built Liminal"
- Blog 8: "Why I Documented Every Failure (And Why You Should Too)"
- Blog 9 (new): "The Tool That Narrates Itself" — Act 3 as direct subject

**Cross-medium:** Each blog post becomes a faceless channel episode via BlogToVideoPipeline. The three-act voice format (developer/agent/tool narration) applies to both written and video content.

### Viral Potential

The archaeology + three-act narrative has compounding viral hooks:

1. **The 33-day timeline** — Relatable to indie hackers
2. **The 0.68 dead zone** — Concrete, surprising data point
3. **The lunar alignment** — Almost too perfect to be true (but verified)
4. **The honest audit** — B+ rating, not A+ — builds trust
5. **"The tool narrates itself"** — Novel enough to generate curiosity clicks
6. **The handoff gradient** — "AI replaces human" is clickbait; "human, agents, and tool find their roles" is nuanced and shareable

---

## Competitive Differentiation

No other creative coding CLI can make these claims:

| Claim | Liminal's Evidence | Nearest Competitor |
|-------|-------------------|-------------------|
| "The tool narrates its own construction" | Three-act faceless channel (THREE-ACT-PLAYBOOK.md) | None |
| "57 forensic archaeology deliverables" | AUDIT-REPORT.md, archaeology.html, 11 classified eras | None |
| "We published the scoring dead zone" | Blog 4, Video Script 1 (0.68 across 54 runs) | Competitors hide failures |
| "The tool improved its own generators" | MetaHarness auto-adaptation logs, HarnessMemory | GitHub Copilot (no public telemetry) |
| "Bilingual EN/ES by default" | Blog 3/4/5, all content parallel-created | Very few dev tools |
| "7,059 commits mined across 11 eras" | Full archaeology corpus | None — requires years of documented history |

**The moat is compounding:** Data (7,059 commits) + narrative (three-act arc) + honesty (B+ audit) + self-reference (the channel IS the proof) create a position that cannot be replicated without doing the work first.

---

## Metrics & Success Indicators

### Pre-Launch Metrics

| Metric | Target | Timeline |
|--------|--------|----------|
| Twitter followers | 500+ | Launch day |
| Email list (if applicable) | 200+ | Launch day |
| GitHub stars (pre-launch) | 100+ | Launch day |
| Discord members | 50+ | Launch day |

### Launch Day Metrics

| Metric | Target | Notes |
|--------|--------|-------|
| Product Hunt upvotes | 500+ | Top 5 Product of the Day |
| Hacker News points | 100+ | Front page for 6+ hours |
| GitHub stars (day 1) | 200+ | From 100 baseline |
| npm installs (day 1) | 500+ | Track via npm stats |
| Website visits | 5,000+ | Unique visitors |

### Post-Launch Metrics (30 days)

| Metric | Target | Notes |
|--------|--------|-------|
| GitHub stars | 1,000+ | Sustained growth |
| npm weekly downloads | 2,000+ | Active usage |
| Active Discord users | 200+ | Community engagement |
| User-generated art shared | 50+ pieces | Organic marketing |
| Spanish-language content engagement | 30%+ of total | Bilingual strategy validation |

### Leading Indicators

Track these weekly to predict success:

| Indicator | Why It Matters |
|-----------|----------------|
| Twitter engagement rate | >3% = healthy build-in-public |
| GitHub issue velocity | More issues = more users |
| Discord message volume | Community forming organically |
| Video share rate | Content resonating |
| Spanish content performance | Bilingual strategy working |

---

## Appendix: Research Sources

### Developer Marketing Best Practices

1. **Strategic Nerds — Complete Developer Marketing Guide (2026)**
   - Key insight: Documentation is now training data for AI assistants
   - Launch tier framework: Tier 1/2/3 for resource allocation
   - Timeline: 8-4-2-1 week pre-launch structure

2. **Product Hunt Launch Guide — fmerian (2025)**
   - Key insight: 79% of featured posts are self-hunted
   - Best days: Tuesday-Thursday, 12:01 AM PST
   - Success pattern: Top 5 within first 4 hours

3. **Indie Hacker Twitter Strategy — Teract.ai (2026)**
   - Key insight: 45 min/day engagement routine
   - Growth timeline: 6 months from 0 to 2,000-5,000 followers
   - Conversion: 15-25% from engaged followers with founder's pricing

### Creative Coding Community

1. **Processing Foundation Fellowships 2025**
   - Key insight: Active, funded community around p5.js
   - Opportunity: Fellow projects as early adopters

2. **Hacker Arts Survey (2021)**
   - Key insight: 65% of creative coders use JavaScript libraries
   - p5.js ranked #1 by significant margin
   - 1.4M monthly p5.js website visitors

### Bilingual Market Research

1. **Horowitz Research — FOCUS Latinx (2022)**
   - Key insight: 45% find Spanish content quality lower than English
   - Opportunity: High-quality Spanish content

2. **KPI Media — Bilingual Ads Analysis (2025)**
   - Key insight: 71% of Hispanics multilingual
   - Digital engagement: High social media usage
   - Spending power: $2.5+ trillion

3. **Guaranteed Rate Case Study**
   - Key insight: Spanish campaign = "best-performing asset ever produced"
   - Video open rate: 51%

### Build in Public

1. **Build in Public GitHub Repository**
   - Framework: Phase 1 (Setup) → Phase 2 (Audience) → Phase 3 (Progress)
   - Key principle: Show, don't tell. Visual proof outperforms text.

2. **Indie Hackers Twitter Guide — Wisp.blog**
   - Key insight: Epic threads (5-10 tweets) get 3-5x more engagement
   - Growth phases: Foundation → Consistency → Momentum → Acceleration

---

## Next Steps (Actionable)

### Immediate (This Week)

1. [ ] Finalize Tier 0 fixes (Kimi agent in progress)
2. [ ] Confirm at least 3 domains working end-to-end
3. [ ] Create Twitter content calendar for Weeks -6 to -1
4. [ ] Draft "The 0.68 Dead Zone" launch blog post

### Short-Term (Next 2 Weeks)

1. [ ] Produce 90-second demo video using mcp-video
2. [ ] Set up Product Hunt teaser page
3. [ ] Create bilingual versions of core messaging
4. [ ] Begin daily Twitter build-in-public posts

### Medium-Term (Next 4 Weeks)

1. [ ] Reach 500 Twitter followers
2. [ ] Complete "34 Days of Liminal" blog series
3. [ ] Prepare Product Hunt launch assets
4. [ ] Line up Hunter or confirm self-hunt strategy
5. [ ] Produce faceless channel pilot episode ("The Three Acts" S01E01)
6. [ ] Run dogfood campaign and capture three-act marketing artifacts
7. [ ] Generate three-voice sample content using TextGenerativeGenerator

### Launch Criteria

Do not launch until:
- [ ] Tier 0 fixes complete
- [ ] p5.js + 2 additional domains fully functional
- [ ] 500+ engaged Twitter followers
- [ ] Demo video complete and tested
- [ ] Launch blog post finalized
- [ ] Product Hunt page ready

---

*This document will be updated as the product evolves. Last updated: April 3, 2026.*
*Three-act self-referential strategy added: April 3, 2026. See [THREE-ACT-PLAYBOOK.md](THREE-ACT-PLAYBOOK.md) for full specification.*
