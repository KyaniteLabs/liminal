# exp-arcane-collision: Phase 2 Design

**Date:** 2026-02-12  
**Decision:** Option (c) — Sprint prototype of top concept  
**Rationale:** Below  

## Option Analysis

| Option | Value | Cost | Risk |
|--------|-------|------|------|
| (a) Blind evaluation | Validates voting mechanism | High (need human judges) | May show swarm ≠ human taste, invalidating premise |
| (b) Cross-model comparison | Generalizability data | Medium (need multi-family runs) | Diminishing returns — we know Qwen/Phi/Gemma behave similarly |
| (c) Sprint prototype | Deployability test + data generation | Low (build on existing) | May overfit to Somnium Mirror |

## Decision: Prototype Somnium Mirror

**Why this concept:**
- Strongest P1 validation (3 sessions, consistent meta-metaphor emergence)
- Mechanic is clearest: output → reflection → next iteration
- Data collection hooks align with Priority 2 (frontier data on tool-choice-agency)

## Phase 2 Protocol

### Sprint Goal
Build working Somnium Mirror prototype that:
1. Takes user prompt
2. Generates initial response (Round 0)
3. Generates meta-commentary on that response (Mirror layer)
4. Uses meta-commentary as seed for Round 1
5. Continues for N rounds or until convergence
6. **Captures full telemetry for frontier analysis**

### Data Collection Requirements
For each session, capture:
- [ ] Prompt content + category (creative vs technical vs personal)
- [ ] Round count to convergence
- [ ] Tool choice pattern (which persona selected each round)
- [ ] Switching frequency (creative→technical, technical→creative)
- [ ] Final output quality rating (1-5, human)
- [ ] Time-to-convergence

### Success Criteria
- [ ] Prototype runs end-to-end without human intervention
- [ ] 10+ test sessions completed
- [ ] Data exports cleanly to frontier analysis pipeline
- [ ] Convergence pattern matches P1 (visual → auditory → timeless)

### Deliverables
1. `somnium-mirror.py` — working prototype
2. `PHASE2-RESULTS.md` — session log + analysis
3. Data export to `~/liminal/lab/frontier/tool-choice-agency/`

## Constraint Check
- No hallucinations: All claims backed by session logs
- Evidence standard: Tool call output = valid claim

## Timeline
- Prototype build: 1 session
- Test sessions: 2-3 sessions  
- Analysis + report: 1 session

---
*Ready for Liam review. Awaiting go/no-go.*
