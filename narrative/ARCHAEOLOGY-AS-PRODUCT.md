# Archaeology as Product: Systematized Forensic Development Analysis

**Date:** April 3, 2026
**Origin:** Liminal Archaeology project (2 sessions, 16+ hours, 391 commits analyzed)
**Purpose:** Extract the archaeology process from Liminal-specific content into a repeatable, sellable methodology

---

## What We Actually Did (Not What Was Planned)

### Inputs Consumed

| Data Source | Records | Size | Mining Method |
|------------|---------|------|---------------|
| Git commits (all branches) | 391 on main, 64+ on archaeology | 6,060 lines CSV | `git log --format` extraction |
| Claude Code session JSONL | 58 sessions | 10,810 lines | jq + grep extraction |
| Claude Code session chunks | 7 eras | ~2,000 lines | Manual era chunking |
| Claude Code plans | 30+ plan files | 1,126 lines | Direct read |
| Claude Code hooks | 26 hooks (JS/SH) | ~800 lines | Direct read + annotation |
| Claude Code memory files | MEMORY.md + 5 memories | ~300 lines | Direct read |
| YouTube watch history | 1,481 AI videos over 3 years | 47,697 lines JSON | Google Takeout + keyword filter |
| YouTube search history | 618 AI searches out of 6,813 total | 47,697 lines JSON | Google Takeout + classification |
| GitHub cross-repo telemetry | 25 repos, 18 active | 12,612 lines JSON | `gh` API + commit audit |
| Lunar phase data | 33 days (Feb 28 - Apr 1) | External API | Astronomical calculation |
| Developer resume | 1 document | ~200 lines | Direct read (with user permission) |
| Cerafica.com site | Public pages | Scraped | Web scraping |

**Total raw data: ~112,000 lines across 57 files (6.5 MB)**

### Outputs Produced

| Deliverable | Format | Size | Purpose |
|-------------|--------|------|---------|
| archaeology.html | Self-contained HTML (D3.js + Chart.js) | 2,533 lines | Interactive visualization of 10 eras, 30+ charts |
| commit-eras.json | JSON | 287 lines | Structured era data for all 10 eras |
| deep-era1.md through deep-era6-9.md | Markdown | ~3,000 lines total | Per-era forensic analysis (7 files) |
| youtube-transcript-analysis.json | JSON | 482 lines | 30 video→feature correlation entries + correlation matrix |
| youtube-ai-correlation.json | JSON | 9,384 lines | Full 1,481-video dataset with topic tags |
| youtube-creators.json | JSON | 1,901 lines | Top 50 creators with monthly patterns |
| youtube-engagement-heuristics.json | JSON | 183 lines | Active vs. passive viewing model |
| audit-youtube-data.json | JSON | 308 lines | Forensic audit of YouTube claims |
| AUDIT-REPORT.md | Markdown | 299 lines | B+ forensic audit, 1 critical + 8 moderate + 8 minor issues |
| REMEDIATION-PLAN.md | Markdown | 625 lines | 10 component fixes, ML corrections, originality analysis |
| curriculum.md | Markdown | 554 lines | 8-module ML learning curriculum |
| ML-LEARNING-PLAN.md | Markdown | 361 lines | Formal ML module mapping |
| LEARNING-PLAN.md | Markdown | 301 lines | Development learning plan |
| reverse-engineering-plan.md | Markdown | 672 lines | 10 intuitive→formal ML mappings |
| BLOG-VIDEO-OUTLINES.md | Markdown | 142 lines | 5 blog + 3 video outlines |
| blog/03-the-quiet-that-wasnt.md | Markdown | 297 lines | Full bilingual blog draft |
| blog/04-the-pink-moon.md | Markdown | 173 lines | Full blog draft |
| blog/05-what-you-build-without-knowing-the-names.md | Markdown | 188 lines | Full blog draft |
| video/01-ai-rates-own-art.md | Markdown | 210 lines | Full video script |
| developer-resume.md | Markdown | ~200 lines | Career context |
| cross-repo-analysis.json | JSON | 316 lines | 25-repo telemetry |
| telemetry-*.json | JSON (6 files) | ~4,500 lines | Git, agents, sessions, codebase, visualizations, repo-depth |
| derived-patterns.json | JSON | 1,347 lines | Frustration telemetry, SDLC gaps, pattern classification |
| GAP-ANALYSIS.md | Markdown | 251 lines | Missing data and recommendations |
| DATA-GOLD-MINE.md | Markdown | 137 lines | Data source inventory |

**Total deliverables: 57 files, ~40,000 lines of processed output from ~112,000 lines of raw input**

### Agents Used

| Agent Type | Count | Purpose |
|-----------|-------|---------|
| Data mining agents | 3 | Git extraction, YouTube classification, session parsing |
| Era classification agents | 2 | Era detection + deep era analysis |
| Parallel analysis agents | 6 | SDLC gaps, ML mapping, agentic workflow, formal terms, source code, YouTube correlation |
| Audit agents | 2 | Forensic audit + YouTube data audit |
| Content agents | 4 | Blog drafts, video script, outlines |
| Coordination | 1 | Session management, PENDING notes |
| **Total** | **~18 distinct agent runs** | Across 2 sessions |

### What Failed

1. Blog post 1 agent — timed out (~35 min)
2. Blog post 2 agent — timed out (~35 min)
3. Blog post 1 agent (retry) — connection error
4. Methodology analysis agent — connection error
5. Several YouTube classification passes had false positives (22 flagged: government "agents", Colbert interviews)

---

## The Process, Abstracted

### Phase 1: EXCAVATE (Data Mining)

**What:** Extract every digital trace left during development.
**How:** Automated scripts mine git, session logs, configs, hooks, memory, and external behavioral data (YouTube, cross-repo).
**Key insight:** The data sources that matter most are the ones the developer didn't intentionally create. Session logs, watch history, and cross-repo activity reveal learning patterns that commit messages never capture.

**Reusable components:**
- `archaeology-mine.sh` — bash script for git/session/hook extraction
- YouTube Takeout parser — keyword filtering + topic classification
- Cross-repo telemetry — `gh` API commit audit across all user repos

### Phase 2: STRATIFY (Era Classification)

**What:** Detect natural boundaries in development history.
**How:** Gap detection (>2 day silence), velocity shifts (>2x change), author changes, scope changes, cross-repo activation.
**Key insight:** Eras aren't just time periods — they're *modes of working*. The same developer in "building mode" vs. "cleanup mode" produces radically different commit patterns.

**Reusable components:**
- Era detection heuristics (5 signals)
- Era schema (JSON template with 12 fields)
- Era naming convention (descriptive + thematic)

### Phase 3: ANALYZE (6 Parallel Vectors)

**What:** Six independent analytical lenses applied simultaneously to the same data.
**How:** Each agent gets the full dataset and a specific analytical question. No cross-contamination. Results merged after.

| Vector | Question It Answers | Who Would Pay |
|--------|-------------------|---------------|
| SDLC Gap Finder | "What practices are we missing that would give us the highest ROI if we adopted them?" | CTOs, engineering managers |
| ML/AI Pattern Mapper | "Are we reinventing algorithms we don't know the names of? What should we learn?" | Self-taught developers, bootcamp grads |
| Agentic Workflow Analyzer | "How is our AI agent usage evolving? Are we getting more autonomous over time?" | AI-native teams, dev tool companies |
| Formal Terms Mapper | "What's the gap between what we built intuitively and what it's formally called?" | Self-taught developers, career changers |
| Source Code Archaeologist | "What specific code changes would give us the highest impact for lowest effort?" | Any development team |
| Behavioral Correlation Agent | "What did we watch/read/consume, and how did it shape what we built?" | Individual developers, content creators |

**Key insight:** The 6 vectors are INDEPENDENT — they never share context during analysis. This prevents confirmation bias from bleeding between analytical lenses.

### Phase 4: AUDIT (Quality Gate)

**What:** Forensic red-team audit of every claim made during analysis.
**How:** Cross-reference dates, verify counts, check for hallucinated correlations, validate named persons.
**Key insight:** AI agents hallucinate correlations with high confidence. The audit caught: fabricated dogfood scores, inflated session counts, incorrect commit attributions, and false YouTube correlations. Without the audit, 30% of claims would be wrong.

### Phase 5: SYNTHESIZE (Deliverable Generation)

**What:** Transform analysis into actionable outputs.
**How:** Produce visualization (interactive HTML), curriculum (learning plan), remediation plan (fix instructions), and content (blog/video).

**Key insight:** The deliverables aren't just reports — they're ACTIONABLE. The remediation plan gives exact agent instructions. The curriculum tells you what to learn. The blog posts are ready to publish.

---

## What Makes This Different

### vs. GitHub Insights /Contributor Stats

| Feature | GitHub Insights | Archaeology |
|---------|----------------|------------|
| What it measures | Lines changed, PR velocity, review time | *Why* things were built, learning patterns, creative arc |
| Behavioral data | No | YouTube, cross-repo, session depth |
| Attribution tracking | No | Traces ideas to specific videos/people |
| ML pattern detection | No | Maps intuitive code to formal algorithms |
| Remediation | No | Exact fix instructions for every issue |
| Narrative output | No | Blog posts, video scripts, visualization |

### vs. git-standup / git-history tools

These tell you WHAT happened. Archaeology tells you WHY it happened and WHAT IT MEANS.

### vs. YouTube watch history analysis (standalone)

YouTube analytics tells you what you watched. Archaeology tells you what you *learned* and how it *changed your code*.

### The Unique Value Proposition

**Nobody else cross-references development artifacts (git, sessions, hooks) with behavioral data (YouTube, cross-repo activity) to produce a forensic narrative of how a project came to exist.**

This is not analytics. This is *development forensics* — CSI for codebases.

---

## Productization Framework

### Tier 1: Self-Service Tool (Open Source)

**What:** The archaeology pipeline as a CLI tool or Claude Code skill.

**Inputs:**
- Git repo (required)
- YouTube Takeout JSON (optional)
- Session logs (optional, if using Claude Code)
- Cross-repo access (optional, if using GitHub)

**Process:**
1. `archaeology excavate` — mine all available data sources
2. `archaeology stratify` — detect eras automatically
3. `archaeology analyze` — run 6 parallel analysis vectors
4. `archaeology audit` — forensic quality gate
5. `archaeology synthesize` — generate deliverables

**Outputs:**
- Interactive HTML visualization
- JSON era/classification data
- Markdown analysis reports
- Learning curriculum (if ML patterns detected)

**Target:** Individual developers who want to understand their own learning journey.

**Price:** Free / open source (with paid tiers for advanced analysis)

### Tier 2: Developer Archaeology Report (Consulting Service)

**What:** A human-guided archaeology session with a developer, producing a comprehensive forensic report.

**Process:**
1. Developer provides repo access + optional behavioral data
2. Archaeologist (Simon or trained agent) runs the full pipeline
3. Interactive session to validate findings and capture oral history
4. Forensic audit of all claims
5. Comprehensive report with:
   - Interactive visualization
   - Learning curriculum (personalized)
   - Remediation plan (actionable fix instructions)
   - Attribution map (where ideas came from)
   - Originality analysis (what's genuinely yours)
   - Blog/video content drafts

**Target:** Content creators (dev YouTubers, bloggers), indie developers, bootcamp graduates, portfolio builders.

**Price:** $500-2,000 per project (depending on size)

**Why people would pay:** Every developer has a story they can't tell because they don't have the data or the analytical framework. Archaeology gives them that story — verified, visualized, and ready to publish.

### Tier 3: Team Archaeology (Enterprise)

**What:** Archaeology applied to a team's development history over months/years.

**Additional vectors:**
- Team learning patterns (who learned what, when, from where)
- Knowledge distribution (which team members hold which domain knowledge)
- Process evolution (how the team's practices changed over time)
- AI adoption trajectory (how agents were adopted and what changed)

**Target:** Engineering managers, CTOs, VP Engineering who want to understand team dynamics, identify skill gaps, and track AI adoption.

**Price:** $5,000-20,000 per engagement

---

## What Makes This Sellable

### 1. The Visual Deliverable is the Hook

The archaeology.html file is a 2,533-line self-contained interactive visualization with 30+ charts. It's immediately impressive. You open it in a browser and SEE your development history come alive. This is the demo that sells the service.

### 2. The Attribution Map is Unique

Nobody else can tell you: "Your most original idea was the CompostMill. It came from your ceramics practice, not from any YouTube video. Here are the 7 videos that influenced your other architectural decisions, and here are the 4 ideas that are genuinely yours."

### 3. The Remediation Plan Has Immediate ROI

The output isn't just a report — it's a fix plan. "Run these exact commands. Give your building agents these exact instructions. Your app will go from 11.1% to working." That's measurable value.

### 4. The Content Angle

Every archaeology produces blog-ready content. For developer content creators, this is a content machine: "I had AI archaeologically analyze my entire project. Here's what it found." That's a YouTube video, a blog post, and a Twitter thread from a single archaeology run.

### 5. The Learning Curriculum is Personalized

Not "here are 10 ML concepts to learn." But "here are the 4 concepts you ALREADY use but don't know the names of, and here's the specific paper to read for each one." That's a learning plan tailored to actual knowledge gaps, not generic curriculum.

---

## Reusable IP from Liminal Archaeology

| Component | Reusability | Notes |
|-----------|------------|-------|
| Era detection heuristics (5 signals) | **Universal** | Works on any git repo |
| YouTube correlation pipeline | **Universal** | Works on any Google Takeout + git repo |
| Topic classification (9 categories) | **Adaptable** | AI-focused now, but extensible |
| Forensic audit methodology | **Universal** | Quality gate for any analysis |
| Attribution tracing framework | **Universal** | Any project with external learning sources |
| Originality analysis template | **Universal** | Any creative/technical project |
| Interactive HTML visualization | **Reusable** | Template with configurable data |
| 6-vector parallel analysis | **Universal** | Core analytical engine |
| Blog/video content extraction | **Universal** | Any archaeology produces content |
| Remediation plan template | **Universal** | Any project with fixable issues |
| Engagement heuristics (active/passive) | **Adaptable** | Any YouTube + development context |
| Creator tier classification | **Adaptable** | Any YouTube analysis |

---

## Minimum Viable Product

### MVP: Archaeology CLI (v0.1)

```bash
# Install
npm install -g dev-archaeology

# Run on any git repo
cd your-project
archaeology excavate --youtube ~/Downloads/takeout.json
archaeology stratify
archaeology analyze --vectors all
archaeology audit
archaeology synthesize --output ./archaeology-report/

# Outputs:
# ./archaeology-report/
# ├── archaeology.html        # Interactive visualization
# ├── eras.json               # Era classification
# ├── curriculum.md           # Personalized learning plan
# ├── remediation.md          # Fix instructions (if issues found)
# ├── attribution.md          # Where ideas came from
# └── blog-drafts/            # Ready-to-publish content
```

### What's needed to build it:

1. **Data mining scripts** — Already written (in Liminal archaeology). Extract and generalize.
2. **Era detection algorithm** — Already written. Extract the 5 heuristics into a configurable module.
3. **YouTube correlation engine** — Already written. Extract the keyword filter + topic classifier + temporal correlator.
4. **Analysis vector templates** — Already written (6 prompts). Generalize from Liminal-specific to universal.
5. **Forensic audit prompts** — Already written. Generalize.
6. **HTML visualization template** — Already written (2,533 lines). Make it data-driven instead of hardcoded.
7. **Attribution tracing** — Already written. Generalize.
8. **Content generation** — Already written (blog + video templates). Generalize.

**Estimated build time:** 2-3 weeks for a working CLI that produces meaningful output on any git repo.

---

## Competitive Moat

1. **Behavioral data fusion** — Nobody else cross-references git with YouTube/watch history. This is the unique data advantage.
2. **Attribution tracing** — Nobody else maps ideas back to their sources with temporal correlation.
3. **Originality detection** — Nobody else separates "what you learned" from "what you invented."
4. **Visual deliverable** — The HTML visualization is immediately impressive and shareable.
5. **Content generation** — Every archaeology produces publishable content. This is a viral loop.

---

## Next Steps (Priority Order)

1. **Extract the pipeline from Liminal archaeology** into standalone, configurable modules
2. **Test on 2-3 other projects** (Simon's other repos: CEO_Agents, cerafica, mcp-video)
3. **Build the CLI scaffold** (`archaeology excavate/stratify/analyze/audit/synthesize`)
4. **Make the HTML template data-driven** (currently hardcoded to Liminal's 10 eras)
5. **Write the landing page** (cerafica.com/archaeology or separate domain)
6. **Run archaeology on yourself as a case study** (the Liminal archaeology IS the case study)
7. **Launch as open-source tool + paid consulting service**

---

*This document was produced by archaeologically analyzing the archaeology process. The archaeologist has been archaeologized.*
