# The Data Gold Mine: Everything Derivable from Liminal's Narrative Archaeology

**12 telemetry datasets. 7,059 commits across 50 repos. 1,148 human messages. 71 sessions. 32 days.**

This catalog lists every insight already extracted, every insight derivable but not yet extracted, and every potential product this data can produce.

---

## Already Extracted

### From Telemetry
- 9-era periodization with narrative arcs and key events
- Agent behavioral profiles (Kai/Cursor/Claude Code/Liam/Teo)
- Developer rhythm patterns: nocturnal (peak 9PM), binge (13/33 active days), domain-switching
- Frustration-to-infrastructure pipeline: 5 categories → 9 hooks → still active
- Emotional arc: Excitement → Frustration → Breakthrough → Crucible → Calm
- Intent analysis: 52% execution/verification, 22% creation, 18% integration, 8% planning
- Session deepening: 12 → 31 messages/session as collaboration matured
- Creative DNA across 50 repos: 12 recurring themes, 5 language stages, 9 domain stages
- Codebase growth: 2 → 3,463 files, 0 → 101,991 LOC, 0 → 228 test files
- Cross-repo concurrent activity: 18 repos active during Liminal build
- 50-repo classification: 8 domains, 6 relationship types to Liminal
- GitHub benchmarks: 32-65x pre-AI baselines

### From Analysis
- Developer profile merged with founder profile (DEVELOPER-PROFILE.md)
- 12 software engineering knowledge gaps diagnosed (GAP-ANALYSIS.md)
- 7-phase SE learning plan customized to learning patterns (LEARNING-PLAN.md)
- 10 ML technique correlations with research papers (ML-LEARNING-PLAN.md)
- Quiet period deep analysis: intentional consolidation, not burnout
- Three-agent OpenClaw origin: Liam (planner), Kai (builder), Teo (researcher)
- Original conception: agent playground for spare tokens, evolved to human-AI collaboration
- ICM methodology as the shipping unlock
- "Wiring" as the philosophical core (not just compost mill)

---

## Derivable But Not Yet Extracted

### Human-AI Collaboration Patterns
- **Optimal session structure**: Which session formats (exploratory, directive, mixed) produce best outcomes? Cross-reference session message patterns with commit quality.
- **AI-human feedback loops**: How does the developer's correction style affect subsequent agent behavior? Map correction messages → next-commit quality.
- **Context boundary learning curve**: How did the developer's ability to maintain context across compaction events improve over time? Measure: information density before vs. after compaction.
- **The trust trajectory**: How did verification frequency change as the developer gained confidence in specific subsystems? Per-module verification ratios.

### Methodology Frameworks
- **ICM as a teachable framework**: The Interpreted-Context-Methodology (38 commits, Feb 22-Mar 14) was the conceptual unlock. Generalize it into a framework other AI-native builders can use.
- **The "Wiring-First" development philosophy**: Formalize the pattern of: build module → wire immediately → verify end-to-end → iterate. This is anti-pattern to most agile workflows.
- **Frustration-to-Automation methodology**: Generalize the pattern of: feel frustration → encode lesson as hook → prevent recurrence. This is a learnable skill, not just a coping mechanism.

### Predictive Models
- **Frustration prediction**: What early signals (specific keyword patterns, session length, commit frequency drops) predict frustration blowups? The data has 11 labeled frustration events with timestamps.
- **Creative incubation patterns**: What happens during "quiet" periods? The March 24-27 data shows a specific sequence: deep technical work → rest → portfolio construction → return with new capabilities.
- **Project health indicators**: What telemetry signals predict project success vs. abandonment? 50 repos provide a dataset: some shipped (mcp-video, DialectOS), some stalled (TradesFlow, FlowCLI), some merged (Atelier, Hydra).

### Developer Science
- **ADHD-optimized development workflow**: What patterns work specifically for neurodivergent builders? The binge rhythm, domain switching, and burst-friendly phases are data-backed.
- **Multi-project portfolio optimization**: How many concurrent projects maximize total output? The data suggests 2-3 active projects in structured rotation, with domain switches as warm-up/cool-down.
- **AI co-authorship quality metrics**: What makes human-AI collaboration effective vs. frustrating? The 1,148 messages with intent classification provide a labeled dataset.
- **The learning-to-code-with-AI trajectory**: A complete 6-month arc from zero to 104K LOC. How did understanding evolve? What order did concepts emerge?

### Technical Analysis
- **Agent selection decision tree**: When to use which AI tool for which task. The developer tried Kai, Cursor, and Claude Code in 2 days and settled on Claude. What specific task properties determined the winner?
- **Prompt iteration patterns**: How did prompts evolve across 71 sessions? Are there identifiable stages (vague → specific → parameterized → optimized)?
- **Test quality trajectory**: 228 test files were written, but the core system remained broken. When did test quality diverge from test quantity?
- **Dependency selection patterns**: 28 production dependencies were chosen. What guided selection? How did the dependency graph evolve?

---

## Potential Products

### Content (Blog Posts, Talks, Presentations)

1. **"How a Non-Programmer Built 104K LOC in 32 Days with AI"** — The core story. 303 commits, 3 AI agents, zero prior coding experience. The numbers speak.
2. **"The Frustration-to-Automation Pipeline"** — How every frustration became enforcement infrastructure. 26 hooks from 8 frustration categories. Conference talk material.
3. **"Three Agents, One Night: Kai, Cursor, and Claude"** — The tool evolution story. Assembly-line worker, landscaper, architect. A parable for AI tool selection.
4. **"The Compost Mill: Creative Waste as Fuel"** — Dead projects as code donors. 50 repos → 32 repos mined → Liminal. The creative case for not deleting old work.
5. **"The Quiet Period: Why Stepping Back is Shipping Forward"** — March 24-27 analysis. Zero Liminal commits, maximum portfolio construction. Counterintuitive productivity.
6. **"32x Your Output: What Pre-AI Benchmarks Reveal About AI-Native Development"** — The benchmark comparison. 3,250 LOC/day vs. 80 normal. What it means.

### Methodology Documents

7. **ICM for AI-Native Builders** — The Interpreted-Context-Methodology generalized as a teachable framework. Folder structure as agent architecture.
8. **The ADHD Builder Playbook** — Data-backed patterns for neurodivergent developers. Burst rhythms, domain switching, verification-dominant learning.
9. **Wiring-First Development** — Anti-pattern to agile: build module → wire immediately → verify end-to-end. When scaffolding without function is the enemy.
10. **Agent Selection Guide** — Data-driven comparison of Kai/Cursor/Claude Code for different development tasks. When to use which, and why.

### Tools and Libraries

11. **Hook Library** — Generalized versions of the 26 enforcement hooks. Any developer using Claude Code can benefit from: wiring-checklist, review-checklist, context-dump, session-restore.
12. **Narrative Archaeology Toolkit** — The process used here (git mining → session extraction → telemetry generation → cross-tabulation → synthesis) is repeatable for any project.
13. **Prompt Engineering Patterns** — 27 PromptLibrary templates analyzed and rewritten with structured specifications. A catalog of what works and what doesn't for creative AI.

### Business Assets

14. **Founder Narrative** — For investors, clients, or collaborators. "In 6 months, I went from zero coding experience to building production AI tools used by real developers."
15. **PuenteWorks Case Study** — "We practice what we preach. Our founder built a 104K LOC creative AI system using the same AI-native development methods we teach our clients."
16. **LACMA Grant Enhancement** — The voice-to-sculpture installation can now reference a fully built audio pipeline (AudioAnalyzer, AudioToVisualMapper) with real telemetry data.

### Research

17. **AI-Native Development Trajectory Study** — The complete 6-month arc is a unique dataset: a non-programmer learning to build production software entirely through AI collaboration.
18. **Human-AI Creative Collaboration Patterns** — 1,148 messages with intent classification, frustration markers, and emotional arc. A labeled dataset for studying human-AI interaction.
19. **Neurodivergent Development Workflow Study** — ADHD-specific patterns (burst rhythm, domain switching, verification-dominance) with quantitative backing.

---

## Data Inventory

| Dataset | Records | Key Dimensions | File |
|---------|---------|---------------|------|
| Commit history | 303 Liminal, 7,059 total | date, author, message, diff | telemetry-git.json, github-commits.csv |
| Session logs | 71 sessions, 1,148 messages | session_id, role, content, timestamp | telemetry-sessions.json, human-messages.json |
| Agent profiles | 5 agents | velocity, quality, breadth, depth | telemetry-agents.json |
| Codebase growth | 10 era boundaries | files, LOC, modules, languages, deps | telemetry-codebase.json |
| Cross-repo activity | 18 active repos, 25 quiet-period | per-day commits, era overlays | telemetry-cross-repo.json |
| Repo classification | 50 repos | domain, language, relationship, creative_dna | telemetry-repo-depth.json |
| Era structure | 9 eras | dates, commits, narrative arc, key events | commit-eras.json |
| Visualization specs | 9 charts | type, data, labels | telemetry-visualizations.json |
| Frustration analysis | 5 categories, 9 hooks | keywords, mapping, latency | frustration-analysis.md, telemetry-sessions.json |
| GitHub benchmarks | Pre-AI vs. AI-native | LOC/day, commits/day, repos | DEVELOPER-PROFILE.md |
| Developer profile | Merged telemetry + founder | behavioral, psychological, learning | DEVELOPER-PROFILE.md |
| Gap analysis | 12 gaps | classification, evidence, prevention | GAP-ANALYSIS.md |

---

## Priority: What to Do First

1. **Blog post #1** (highest impact, lowest effort) — "How a Non-Programmer Built 104K LOC in 32 Days with AI." The numbers are extraordinary. Write it.
2. **Archaeology visualization** (Tasks 2-10 from the plan) — Make the data visible. The charts tell a story that text cannot.
3. **ICM methodology document** — Generalize the framework. This has commercial value for PuenteWorks.
4. **Hook library** — Package the 26 hooks for other Claude Code users. Open-source credibility.
5. **Agent selection guide** — Data-driven, with specific task recommendations. Useful for any AI-native builder.

---

*This data is a gold mine because it captures something unprecedented: a complete 6-month trajectory from zero coding experience to production AI systems, with every message, every commit, every frustration, and every breakthrough recorded. No textbook provides this. No bootcamp captures this. This IS the curriculum — mined from the process itself.*
