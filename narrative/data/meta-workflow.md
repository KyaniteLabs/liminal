# Repo Archaeology Workflow

## Overview

A repeatable process for mining any repository's complete development story — git history, agent traces, philosophical foundations, and narrative material — for blog posts, talks, or documentation.

---

## Phase 1: Three-Vector Parallel Mining

Launch 3 exploration agents simultaneously:

### Agent A: Git History Archaeology
- Full commit log: `git log --all --format="%H|%ai|%an|%s" --reverse`
- Branch topology: `git log --all --oneline --graph`
- Contributor stats: `git shortlog -sn --all`
- Daily frequency: `git log --all --format="%ai" | cut -d' ' -f1 | sort | uniq -c | sort -rn`
- Hourly distribution: extract hour from commit timestamps
- Codebase growth: sample file counts at commit milestones (every 50th commit)
- Tag/release history: `git tag -l`, `git tag -n99`
- Commit type breakdown (feat/fix/docs/chore/etc.)
- Era identification: group commits by theme/date bursts

### Agent B: Agent Trace Mining
- CLAUDE.md files at every level (global, project, subdirectories)
- Memory files in `~/.claude/projects/<project>/memory/`
- Settings and hooks in `~/.claude/settings.json`
- All hook scripts — read and annotate each one
- Session JSONL files in project `.claude/` directory
- Plan documents in `~/.claude/plans/`
- Progress snapshots in `~/.claude/progress/`
- Context dumps in `~/.claude/context-dumps/`
- Win/loss tracking, todo files
- GSD/gstack artifacts if present

### Agent C: Code Philosophy Mining
- All README, ARCHITECTURE, CHANGELOG, VERSION files
- Research docs in `docs/`
- Design documents in `docs/plans/`
- SOUL.md or equivalent personality files
- Source code naming patterns (directory structure as narrative)
- Creative persona definitions
- Prompt templates
- TODO/FIXME/HACK/NOTE comments
- Philosophical/poetic/personal code comments
- Key dependency choices and what they reveal

---

## Phase 2: Gap Analysis

After all three agents report back, perform a holistic cross-reference:

### Contradiction Check
- [ ] Do commit messages align with what session logs reveal?
- [ ] Do plan documents match what actually shipped?
- [ ] Do CLAUDE.md instructions match the developer's actual behavior?
- [ ] Are there naming inconsistencies (project renamed, modules renamed)?
- [ ] Do stated philosophies contradict implemented code?

### Gap Check
- [ ] Are there silent periods with NO commits but session logs exist? (work was done but not committed)
- [ ] Are there abandoned branches that tell an untold story?
- [ ] Are there plan documents for features that never shipped?
- [ ] Are there "wiring" moments where the developer's standards were invoked?
- [ ] Are there emotional inflection points (frustration → breakthrough)?

### Ambiguity Check
- [ ] Multiple git identities for the same person?
- [ ] Unclear attribution (human vs agent commits)?
- [ ] Vague commit messages that need session log context?
- [ ] Design decisions with no recorded reasoning?

### Blindspot Check
- [ ] What was the developer's emotional state during each era?
- [ ] What external events influenced the work (conferences, deadlines, life events)?
- [ ] What dependencies were considered but rejected, and why?
- [ ] What was the competitive landscape during development?
- [ ] What was the developer's prior experience with the tools chosen?

---

## Phase 3: Master Narrative Construction

Combine all mined material into a single chronological document:

### Structure
```
1. Day-by-day timeline
   - Commits made
   - Conversations had
   - Plans written
   - Decisions made
   - Emotional state (inferred from message tone)

2. Theme Extraction
   - Recurring ideas
   - Evolving philosophy
   - Technical breakthroughs
   - Moments of doubt

3. Quote Bank
   - Every quotable thing, attributed to source
   - Organized by theme (creativity, process, philosophy, honesty, humor)

4. Character Arcs
   - The Developer (who they are, what they value)
   - The Agent(s) (what tools, how they evolved)
   - The System (the project itself as a character)

5. Plot Points
   - Crisis moments
   - Breakthroughs
   - Pivots
   - Revelations
   - The "honesty" moments
```

### Output Directory
```
<project>/narrative/
├── data/
│   ├── raw-sessions.md        # Session log extractions
│   ├── raw-plans.md           # Plan document analysis
│   ├── raw-hooks.md           # Hook system analysis
│   ├── raw-philosophy.md      # Code/docs philosophy
│   └── commit-eras.json       # Development eras with commit ranges
├── raw-narrative.md           # The master narrative
└── blog-series/
    └── (created after narrative review)
```

---

## Phase 4: Blog Post Splitting

From the master narrative, identify natural breakpoints based on:
- **Era boundaries** (natural story arcs)
- **Thematic density** (where related material clusters)
- **Emotional peaks** (crisis → resolution moments)
- **Reader stamina** (each post should be digestible in one sitting)

Each blog outline includes:
- Hook (opening line)
- Thesis (one idea)
- Section headers with key paragraphs drafted
- Quotes placed in context
- Data points embedded
- Code excerpts to reference
- Personal angle

---

## Tools Required

- `git` — all history mining
- `jq` or Python — JSONL session parsing
- `wc`, `find` — file/codebase stats
- File reading — CLAUDE.md, memory, hooks, docs, source code

## Time Estimate

- Phase 1 (parallel mining): 3 agents, 5-10 min each
- Phase 2 (gap analysis): 10-15 min of cross-referencing
- Phase 3 (narrative construction): 15-20 min
- Phase 4 (blog splitting): 10-15 min per post

## Redaction Checklist (before any output is published)

- [ ] API keys, tokens, credentials → `[REDACTED]`
- [ ] Email addresses → `[REDACTED]`
- [ ] Personal addresses/phone numbers → `[REDACTED]`
- [ ] Internal server URLs → `[REDACTED]`
- [ ] Keep technical discussions, philosophical statements, emotional moments
