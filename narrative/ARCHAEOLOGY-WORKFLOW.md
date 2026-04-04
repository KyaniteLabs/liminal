# Archaeology Workflow Specification
## Permanent Development Archaeology for Liminal Projects

> **Version:** 1.0  
> **Status:** Draft  
> **Date:** April 2, 2026  
> **Origin:** Liminal Archaeology Pipeline (branch `narrative/liminal-archaeology`)

---

## What Is Archaeology?

Archaeology is a **post-hoc forensic mining** of a project's development history. It treats commits, sessions, hooks, watch history, and repo interactions as **stratigraphic layers** — each one a data point in a narrative that would otherwise be invisible.

The goal: transform raw git/session/behavioral data into **structured narrative deliverables** (HTML visualizations, learning curricula, reverse-engineering plans, blog posts, video scripts).

---

## When to Run Archaeology

| Trigger | Scope | Depth |
|---------|-------|-------|
| Project milestone (v1.0, major refactor) | Full | All phases |
| Monthly retrospective | Incremental | New month only |
| Before blog/post publication | Targeted | Specific era or feature |
| Onboarding new contributor | Summary | Key decisions and patterns |
| Post-sprint reflection | Sprint window | Commit/session density |

---

## Phase 1: Data Mining (Automated)

### Required Data Sources

| Source | Location | Method | Output |
|--------|----------|--------|--------|
| Git commits | `git log --format` | Bash extraction | `github-commits.csv` |
| Session JSONL | `.claude/projects/*/sessions/*.jsonl` | Grep + jq | `human-messages.json` |
| Session chunks | `.claude/projects/*/chunks/*.json` | Merge + classify | `era-chunks/*.json` |
| Plans directory | `.claude/plans/*.md` | Read + extract | `raw-plans.md` |
| Hooks directory | `.claude/hooks/*.{js,sh}` | Read + annotate | `raw-hooks.md` |
| Memory files | `.claude/memory/*.md` | Read + merge | `raw-philosophy.md` |
| Cross-repo data | GitHub API or `gh` | Commit audit | `cross-repo-analysis.json` |
| YouTube history | Google Takeout JSON | Keyword filter + classify | `youtube-ai-correlation.json` |
| Model usage | Session JSONL `model` field | Aggregate | `model-adoption.json` |

### Data Mining Script Template

```bash
#!/bin/bash
# archaeology-mine.sh — Run from worktree root
PROJECT_ROOT=$(git rev-parse --show-toplevel)
OUTPUT_DIR="narrative/data"
mkdir -p "$OUTPUT_DIR"

# 1. Git commits
git log --all --format='%H,%ai,%ae,%s,%ci,"%s"' > "$OUTPUT_DIR/github-commits.csv"

# 2. Session messages (requires jq)
find .claude -name "*.jsonl" -exec jq -Rr '"(.|\n)+"' '[:message] | select(.human == true)' {} \; > "$OUTPUT_DIR/human-messages.json"

# 3. Plans
cat .claude/plans/*.md > "$OUTPUT_DIR/raw-plans.md" 2>/dev/null

# 4. Hooks
for f in .claude/hooks/*.{js,sh}; do echo "## $f"; cat "$f"; echo; done > "$OUTPUT_DIR/raw-hooks.md"
```

---

## Phase 1.5: Database Construction (Automated)

Phase 1 produces flat files. Phase 1.5 converts them into a single SQLite database for interactive exploration and programmatic querying.

### Toolchain

| Tool | Purpose | Install |
|------|---------|---------|
| `sqlite-utils` | JSON/CSV → SQLite conversion | `uv tool install sqlite-utils` |
| `datasette` | Interactive web UI + JSON API | `uv tool install datasette` |

### Build

```bash
# From project root
python3 narrative/scripts/build-archaeology-db.py --verbose

# Or let the serve script build automatically:
bash narrative/scripts/serve-archaeology.sh
```

### Output

| Artifact | Location | Notes |
|----------|----------|-------|
| `archaeology.db` | `narrative/data/archaeology.db` | Gitignored — rebuild at any time |
| Datasette UI | `http://localhost:8001` | Faceted browsing, FTS, canned queries |
| JSON API | `http://localhost:8001/archaeology.json` | For programmatic access by Phase 3 agents |

### What the DB Contains

The build script auto-detects and imports:
- CSV files (commits) → indexed tables
- Flat JSON arrays (sessions, YouTube searches) → tables
- Nested JSON (eras, telemetry, derived patterns) → flattened into separate tables
- Audit files → verification tables
- FTS5 enabled on: commit messages, session content, era descriptions

---

## Phase 2: Era Classification (Human + AI)

### Era Detection Heuristics

1. **Gap detection**: >2 days with no commits = era boundary
2. **Velocity shift**: >2x change in daily commit rate = era transition
3. **Author change**: different co-author pattern = new era
4. **Scope change**: switch from `feat` to `fix` to `docs` = new era
5. **Cross-repo activation**: commits to other repos = redistribution era

### Era Schema

```json
{
  "id": 1,
  "name": "Era Name",
  "dates": "Start – End",
  "commits": 0,
  "author": "Who",
  "description": "One-line summary",
  "key_events": ["Event 1", "Event 2"],
  "narrative_arc": "Story beat in 2-3 sentences",
  "repos_active": ["repo1", "repo2"],
  "lunar_phase": "Waxing Crescent"
  "moon_illumination": "28%"
  "frustration_category": "wiring_problem",
  "ai_videos_watched": 15
  "dominant_intent": "build"
}
```

---

## Phase 3: Analysis Vectors (Parallel Agents)

Launch these as parallel sub-agents:

### Data Access Pattern

All Phase 3 agents should query the archaeology database instead of parsing raw files:

```bash
# Example: Query commits via Datasette JSON API
curl "http://localhost:8001/archaeology/commits.json?_facet=repo&_facet=author&_sort=date"

# Example: Full-text search
curl "http://localhost:8001/archaeology/commits.json?_search=telemetry"

# Example: Era velocity query
curl "http://localhost:8001/archaeology.json?sql=SELECT+e.name,e.commits+FROM+eras+e"
```

If the Datasette server is not running, agents can query archaeology.db directly with sqlite3 or sqlite-utils.

### Agent 1: SDLC Gap Finder
Identifies missing practices: test-first, integration testing, CI/CD, code review, refactoring cycles. Ranks by ROI.

### Agent 2: ML/AI Pattern Mapper
Maps intuitive implementations to formal ML/AI terms. Identifies reinvented algorithms. Calculates token waste from knowledge gaps.

### Agent 3: Agentic Workflow Analyzer
Analyzes session depth, autonomy evolution, hook effectiveness, memory usage, frustration-to-automation conversion.

### Agent 4: Formal Terms Mapper
Cross-references code naming against academic literature. Produces the intuitive-to-formal dictionary.

### Agent 5: Source Code Archaeologist
Line-level code analysis. Identifies specific improvements ranked by effort-to-impact.

### Agent 6: YouTube Correlation Agent (if watch history available)
Correlates video watching with commit themes. Identifies smoking guns. Maps creator influence to subsystems.

---

## Phase 4: Deliverable Generation

### Standard Deliverables

| Deliverable | Format | Location | Description |
|-------------|--------|----------|-------------|
| Raw data archive | JSON/CSV/MD | `narrative/data/` | All mined data,| Visualization | Self-contained HTML | `narrative/archaeology.html` | D3.js + Chart.js interactive document |
| Learning curriculum | Markdown | `narrative/curriculum.md` | ROI-ranked topics with prerequisites |
| Reverse-engineering plan | Markdown | `narrative/reverse-engineering-plan.md` | Intent deltas, formal terms, code fixes |
| YouTube correlation | JSON | `narrative/data/youtube-ai-correlation.json` | Video-topic-commit mapping |
| Creator profiles | JSON | `narrative/data/youtube-creators.json` | Top creator monthly patterns |
| Blog outlines | Markdown | `narrative/blog/` | Era-based posts |
| Video scripts | Markdown | `narrative/video/` | Using blog-to-video pipeline |
| Interactive Datasette | SQLite DB + Datasette config | `narrative/data/archaeology.db` | Faceted browsing, FTS, JSON API, canned queries |

### Quality Gate: Red Team Audit

Before ANY deliverable is published:
1. Run full forensic audit on all data claims
2. Cross-reference dates between all files
3. Verify numbers sum correctly (commit counts, video counts, token estimates)
4. Check for hallucinated correlations or lunar phases, topic assignments)
5. Verify all named persons and attributions

---

## Phase 5: Integration

### With Main Branch
1. PR from archaeology branch → main
2. Update MEMORY.md with archaeology findings
3. Update CLAUDE.md with workflow reference
4. Tag release: `archaeology-v1.0`

### With Repo Organization Agent
Coordinate worktree cleanup with repo organization agent

---

## Directory Structure

```
.claude/worktrees/archaeology/
├── narrative/
│   ├── scripts/
│   │   ├── build-archaeology-db.py
│   │   ├── datasette-metadata.yaml
│   │   └── serve-archaeology.sh
│   ├── archaeology.html          # Main visualization deliverable
│   ├── curriculum.md             # Learning curriculum
│   ├── reverse-engineering-plan.md
│   ├── ARCHAELOGY-WORKFLOW.md     # This file
│   ├── PENDING-DEEPER-ANALYSIS.md # User's live notes
│   ├── blog/                      # Blog outlines (pending)
│   ├── video/                     # Video scripts (pending)
│   └── data/                      # Raw mined data
│       ├── github-commits.csv
│       ├── human-messages.json
│       ├── raw-sessions.md
│       ├── raw-narrative.md
│       ├── derived-patterns.json
│       ├── youtube-ai-correlation.json
│       ├── youtube-creators.json
│       └── ... (30+ files total)
```

---

## Anti-Patterns for Archaeology

1. **No speculative narrative** — Every claim must be traceable to a specific commit, message, or data point. If unsure, label it "[UNVERIFIED]".

2. **Atomic tasks** — Break work into smallest possible units. If a task takes >10 minutes, it chunk it.

3. **Parallel agents** — Independent analysis vectors MUST run in parallel. Never serialize.

4. **Verify before publishing** — Red team audit is mandatory before any deliverable is marked "complete."

5. **Data over narrative** — When data contradicts narrative, trust data. Update narrative.

6. **Living notes** — PENDING-DEEPER-ANALYSIS.md is the user's scratchpad. Never ignore it.

---

## Configuration for CLAUDE.md

Add to project CLAUDE.md:

```markdown
## Archaeology Pipeline

When a milestone or retrospective is needed:
1. Create archaeology worktree: `claude worktree add archaeology`
2. Branch: `narrative/liminal-archaeology`
3. Follow workflow: `narrative/ARCHAELOGY-WORKFLOW.md`
4. Data goes to `narrative/data/`, deliverables to `narrative/`
5. Always run red team audit before publishing
```

---

## Scale Calibration

| Project Size | Commits | Sessions | Estimated Time |
|-------------|---------|----------|-----------------|
| Micro (<100 commits) | <100 | <10 | 2-4 hours |
| Small (100-500) | 100-500 | 10-30 | 4-8 hours |
| Medium (500-2000) | 500-2000 | 30-100 | 8-16 hours |
| Large (2000+) | 2000+ | 100+ | 16-40 hours |

Liminal (324 commits, 71 sessions) took ~16 hours across 2 sessions.
