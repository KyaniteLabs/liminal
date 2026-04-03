# Blog + Video Deliverable Outlines
## Raw Material → Publication Pipeline

> **Status:** Audit-verified outlines (full drafts exist for posts 4, 5, and video script 1)
> **Source:** Archaeology data (30+ data files, archaeology.html, reverse-engineering-plan.md, AUDIT-REPORT.md)
> **Date:** April 2,2026
> **Audit:** Forensic audit completed Apr 2. All numbers below reflect verified corrections. See AUDIT-REPORT.md for details.

---

## Blog Series: "34 Days of Liminal"

### Post 1: The Seed and the Silence
**Era:** 1 (Seed) + 18-day dormancy + 2 (Explosion)  
**Arc:** Excitement → abandonment → detonation  
**Hook:** "A project that was born, died, and resurrected — all in 33 days"  
**Data vignettes:**
- Kai agent building 29 task-jobs in 2.8 hours (assembly line worker pattern — **audit-verified**)
- 18 days of silence — what was happening? (ICM methodology work, GlazeLab, openglaze)
- The Explosion: Cursor IDE writes **12** commits in 6 minutes (**audit-corrected**: was "15"), then a full day hydra merge
- The rename: Atelier → Liminal at 9:30 PM  
**Key insight:** AI agents have distinct "personalities" — Kai is assembly-line worker, Cursor the landscaper, Claude Code the architect  
**Word count target:** 2,500-3,000  
**Video potential:** High — time-lapse of commit velocity, the Kai→Cursor→Claude handoff

---

### Post 2: The Compost Metaphor
**Era:** 3 (Consolidation)  
**Arc:** Chaos → metaphor → system  
**Hook:** "I built a Variational Autoencoder and called it a compost bin"  
**Data vignettes:**
- 28 commits in a single day (**audit-verified**: was originally listed as 23 — the audit corrected some to 12)
- Lifespan: **33 days** (not "32 days" — **audit-corrected**)
- Era 3 commit count: **audit-verified exact**
- What it actually is: a VAE (Encoder/Latent Space/Sampling)
- The intuitive-to-formal dictionary: every invented name → its ML equivalent  
**Key insight:** Building without knowing formal terms leads to 80% correct architecture but 20% broken feedback loops  
**Word count target:** 2,500-3,000  
**Video potential:** Medium — code walkthrough of compost pipeline, screen recordings of the stages

---

### Post 3: The Quiet That Wasn't
**Era:** 6 (Quiet) + cross-repo analysis  
**Arc:** Silence → revelation → redistribution  
**Hook:** "The 4 days my project went silent weren't a break — they were a creative redistribution"  
**Data vignettes:**
- 0 Liminal commits, **29 commits to 8 other repos** (quiet-period deep-dive, audit-verified)
- **mcp-video** received 3 releases (v0.6.0→v0.8.0) — the Remotion integration directly enabled Era 7
- PuenteWorks website built from scratch (overnight sprint Mar 27 2:01-6:57 AM)
- mcp-video shipped v0.6→v0.8 with Remotion integration
- The inversion: creative energy didn't stop, it redirected
**Key insight:** "Quiet periods" in creative work are often the most productive — the incubation is happening in adjacent domains  
**Word count target:** 2,000-2,500  
**Video potential:** High — the "plot twist" narrative (everyone assumes you stopped, then reveal the 13 commits)

---

### Post 4: The Pink Moon
**Era:** 7-9 (Multimedia → Dogfood → Bible)  
**Arc:** Expansion → reckoning → documentation  
**Hook:** "I shipped 21 subsystems. Then I tested them. 7.4% worked."  
**Data vignettes:**
- The 0.68 dead zone: every creative evaluation scores exactly 0.68 (**audit-verified**: stubs and full implementations both score 0.68)
- RalphLoop stops at iteration 1 — **audit-correction**: not a quality judgment but `maxIterations: 1` in test harness forced stop; quality gate never ran
- 8 of 9 generators return "No LLM configured" (**audit-verified**: 16/32 failures were config errors, not generation failures)
- THE BIBLE: 53 commits of documentation day
- The Full Pink Moon at 9:13 PM — project peaks on the exact full moon
**Key insight:** Building fast creates technical debt. The 7.4% success rate on dogfood testing was the wake-up call  
**Word count target:** 3,000-3,500  
**Video potential:** Very high — the honest dogfood results, the "it works" vs "it doesn't" split screen

---

### Post 5: What You Build Without Knowing the Names
**Era:** All (meta-analysis)  
**Arc:** Intuition → formal mapping → curriculum  
**Hook:** "I accidentally invented 10 ML architectures through agricultural metaphors"  
**Data vignettes:**
- The formal name dictionary: RalphLoop = (1+1) ES, CompostMill = VAE, Swarm = MoE — **audit-graded**: 0 exact matches, 6 rough analogies, 2 forced comparisons
- **~2.25M tokens wasted** — **audit note**: archaeological approximation without documented methodology, not a measured figure
- The curriculum: 24 topics in 5 tiers, ranked by ROI
- The three most costly gaps: completion detection, write-only archives, triple redundancy
**Key insight:** Knowing the name of a concept is worth ~400K tokens in wasted iteration (**audit note**: speculative estimate)  
**Word count target:** 3,000-3,500  
**Video potential:** Very high — the "mind blown" reactions, formal name reveals

---

## Video Scripts

### Video 1: "I Built an AI That Rates Its Own Art — Then It Lied" (5-7 min)
**Source material:** Post 4 (Dogfood)  
**Visual treatment:**
- Split screen: code running on left, actual output on right
- The 0.68 score reveal (graph showing flat scoring line)
- RalphLoop iteration counter (stops at 1 every time)
- The honest audit: red → green screen results
**Tone:** Technical but entertaining — "I asked it to be brutally honest and and it was"

### Video 2: "34 Days, 3 Agents, 1 Moon Cycle" (8-10 min)
**Source material:** Posts 1+5 (full arc)  
**Visual treatment:**
- Animated commit timeline with era color bands
- Agent handoff visualization (Kai → Cursor → Claude)
- Lunar phase overlay (waxing cycle sync)
- The explosion replay (fast-forward commit burst)
**Tone:** Cinematic — "a creative coding project that traced one complete waxing lunar cycle"

### Video 3: "The Compost Metaphor: How I Built a VAE Without Knowing What One Was" (6-8 min)
**Source material:** Post 2 (Consolidation) + Post 5 (formal names)  
**Visual treatment:**
- Agricultural metaphor → formal ML architecture comparison
- Code walkthrough of compost pipeline stages
- The "before/after" of naming
- The 3 gaps that formal knowledge would fix
**Tone:** Educational — "you don't need a know the name to build the thing, but here's what happens when you don't"

---

## Blog-to-Video Pipeline

For each blog post:
1. Extract key data vignettes and identify visual opportunities
2. Write script around visuals (not around the text)
3. Record screen captures: code running, charts loading, timeline animations)
4. Use `mcp-video` + Remotion for automated video assembly
5. Use `blog-to-video.ts` pipeline from Liminal for final production

---

## Priority Order

1. **Post 5** (formal names) — most shareable, "mind blown" content
2. **Post 4** (dogfood/honest audit) — authentic and relatable
3. **Video 1** (0.68 score reveal) — most visual, most viral
4. **Post 3** (quiet period twist) — narrative surprise
5. **Post 1** (full arc) — comprehensive overview
6. **Post 2** (compost metaphor) — technical depth
7. **Video 2** (lunar cycle) — cinematic
8. **Video 3** (VAE/compost) — educational
