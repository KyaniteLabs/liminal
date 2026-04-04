# Liminal — Project Instructions

## Git Hygiene (mandatory for all agents)

This repo has multiple agents working simultaneously in worktrees. Breaking these rules causes data loss and merge conflicts.

### The 5 Rules

1. **Always push after committing.** Run `git push` immediately after every commit. Unpushed commits on a worktree that gets cleaned up = lost work. No exceptions.
2. **Clean up your worktree when done.** After your work is pushed and/or merged: remove the worktree (`git worktree remove <path>`), delete your local branch if merged, delete remote branch if merged. Never leave idle worktrees behind.
3. **Start fresh branches after merges.** If your branch was merged (squash or otherwise) to main, do NOT continue committing on it. Checkout main, pull, create a new branch. Continuing on merged branches creates divergence.
4. **Check the monitor log.** Before starting work, read `memory/git-monitor-log.md` to see what other agents are doing. Avoid stepping on active worktrees.
5. **Commit incrementally.** Don't let 20+ files sit dirty. Commit in logical batches (every 5-10 files). Large uncommitted diffs make conflict resolution harder.

### Convention Violation Monitor

A cron job scans every 5 minutes and logs violations to `memory/git-monitor-log.md`. Violations are flagged as:
- **HIGH** — Data loss risk (unpushed work, diverged branches)
- **MEDIUM** — Hygiene (idle worktrees, main behind remote)
- **LOW** — Naming, stale branches

If you see your worktree flagged, fix it immediately.

## Archaeology Data Access (MANDATORY)

All archaeology and telemetry data lives in a SQLite database. **NEVER parse raw JSON/CSV files from `narrative/data/` directly.** Always use the DB.

### Database Location
- **Path:** `narrative/data/archaeology.db` (gitignored, derived data)
- **Rebuild:** `python3 narrative/scripts/build-archaeology-db.py --project-root . --verbose`
- **Serve:** `bash narrative/scripts/serve-archaeology.sh` → http://localhost:8001

### How to Query

```bash
# Direct query (fastest, no server needed)
sqlite-utils query narrative/data/archaeology.db "SELECT * FROM commits WHERE repo='web' LIMIT 5" --table

# Full-text search
sqlite-utils query narrative/data/archaeology.db "SELECT * FROM commits_fts WHERE commits_fts MATCH 'telemetry'" --table

# Datasette JSON API (if server running)
curl "http://localhost:8001/archaeology/commits.json?_facet=repo&_sort=date"

# Python script
sqlite3.connect("narrative/data/archaeology.db").execute("SELECT ...")
```

### Key Tables
| Table | Rows | What it contains |
|-------|------|------------------|
| `commits` | 7,059 | All git commits (repo, date, time, message, author) |
| `eras` | 10 | Named developmental eras (name, dates, commits, frustration_category, dominant_intent) |
| `sessions` | 58 | Claude Code sessions (session_id, timestamp, messages, human_message_count) |
| `youtube_searches` | 5,300 | YouTube search history |
| `monthly_velocity` | 18 | Monthly commit counts across repos |
| `model_timeline` | 10 | LLM model adoption over time |
| `github_repos` | 50 | All GitHub repos with metrics |
| `yt_creators` | 50 | AI YouTube creator profiles |
| `lunar_phases` | 33 | Daily lunar phase data |
| `audit_*` | varies | Forensic audit verification data |
| Plus ~50 more | — | Telemetry, cross-repo, codebase growth, etc. |

### FTS-enabled Tables
Search with `WHERE {table}_fts MATCH 'query'`: `commits` (message), `sessions` (messages), `eras` (description, narrative_arc)

### Indexed Columns
Fast lookups on: commits (date, author, repo), eras (name), sessions (timestamp, session_id), lunar_phases (date)

### Rules
1. **Rebuild before use** if the DB doesn't exist or data may be stale
2. **Never commit the DB** — it's gitignored derived data
3. **Prefer SQL over file parsing** — one query replaces reading 48 files
4. **Prefer FTS over grep** — full-text search is indexed
5. **Prefer facets over manual counting** — `GROUP BY` with indexes is faster than iterating JSON

## Archaeology Workflow

Post-hoc forensic mining of development history. Transforms git commits, session data, hooks, and repo interactions into structured narrative deliverables.

**Full specification:** `narrative/ARCHAEOLOGY-WORKFLOW.md`

### When to Run

| Trigger | Scope | Depth |
|---------|-------|-------|
| Project milestone (v1.0, major refactor) | Full | All phases |
| Monthly retrospective | Incremental | New month only |
| Before blog/post publication | Targeted | Specific era or feature |
| Post-sprint reflection | Sprint window | Commit/session density |

### The 5 Phases

1. **Data Mining** (automated) — Extract commits, session JSONL, plans, hooks, memory, cross-repo data. Output to `narrative/data/`.
2. **Era Classification** (human + AI) — Detect era boundaries via commit gaps, velocity shifts, author changes, scope changes. Produce `era-chunks/*.json`.
3. **Analysis Vectors** (parallel agents) — Launch 6 independent analysis agents simultaneously.
4. **Deliverable Generation** — Produce visualization HTML, learning curriculum, reverse-engineering plan, blog outlines, video scripts.
5. **Integration** — PR to main, update MEMORY.md, tag release.

### The 6 Parallel Analysis Agents

Run in parallel during Phase 3. Never serialize.

| Agent | Purpose |
|-------|---------|
| SDLC Gap Finder | Missing practices ranked by ROI |
| ML/AI Pattern Mapper | Map intuitive code to formal terms, find reinvented algorithms |
| Agentic Workflow Analyzer | Session depth, autonomy evolution, hook effectiveness |
| Formal Terms Mapper | Code naming vs academic literature dictionary |
| Source Code Archaeologist | Line-level improvements ranked by effort-to-impact |
| YouTube Correlation Agent | Video watching vs commit themes (if watch history available) |

### Quality Gate: Forensic Audit

Mandatory before any deliverable is published:

1. Cross-reference dates across all source files
2. Verify counts sum correctly (commits, videos, tokens)
3. Check for hallucinated correlations (lunar phases, topic assignments)
4. Verify all named persons and attributions
5. Label unverified claims as `[UNVERIFIED]`

### Anti-Patterns

- **No speculative narrative** — Every claim traceable to a commit, message, or data point
- **Atomic tasks** — Break work into smallest units; chunk if >10 minutes
- **Parallel agents** — Independent analysis vectors must run concurrently
- **Verify before publishing** — Red team audit is mandatory
- **Data over narrative** — When data contradicts narrative, trust data
- **Living notes** — Respect `PENDING-DEEPER-ANALYSIS.md` as user scratchpad

### Scale Calibration

| Project Size | Commits | Estimated Time |
|-------------|---------|----------------|
| Micro | <100 | 2-4 hours |
| Small | 100-500 | 4-8 hours |
| Medium | 500-2000 | 8-16 hours |
| Large | 2000+ | 16-40 hours |
