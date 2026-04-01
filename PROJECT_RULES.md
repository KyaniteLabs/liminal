# Liminal Project Rules & Memory

**Last Updated:** April 1, 2026  
**Status:** ACTIVE - These rules govern all future work

---

## 🎯 RULE 1: Documentation Site is the Bible

### The Golden Rule
**The documentation site at `/docs` is the single source of truth for the project.**

### Requirements
- [ ] **ALWAYS** update the docs site when making changes
- [ ] **NEVER** let code and docs diverge
- [ ] **ALWAYS** expand docs to include new features/discussions
- [ ] **NEVER** commit code without updating relevant doc pages

### Specific Instructions
1. **New feature?** → Add to `features.html` and `dashboard.html`
2. **Architecture change?** → Update `architecture*.html` pages
3. **New CLI command?** → Update `cli-reference.html`
4. **API change?** → Update `api-reference.html` (or create it)
5. **New task/harness work?** → Update `harness-tasks.html` and `dashboard.html`
6. **Status change?** → Update all status badges on all pages

---

## 🎯 RULE 2: Dashboard Must Always Reflect Reality

### The Dashboard is the Project Heartbeat
**`dashboard.html` must be checked and updated on EVERY commit.**

### Dashboard Maintenance Checklist
- [ ] Feature status table matches code reality
- [ ] Task board reflects current work
- [ ] "What's Missing" section is accurate
- [ ] Recent commits are logged
- [ ] Next steps are current
- [ ] Progress bars show true percentages

---

## 🎯 RULE 3: How to Make Changes (The Process)

### Before Coding
1. Check docs-site branch status
2. Review dashboard.html for current state
3. Identify which doc pages need updates

### While Coding
1. Make code changes in main or feature branch
2. **Simultaneously** update docs in docs-site worktree

### Before Committing
1. Verify docs match code changes
2. Update dashboard status if needed
3. Cross-check all linked pages

### After Committing
1. Update dashboard "Recent Commits" section
2. Adjust "Next Steps" if priorities changed

---

## 🎯 RULE 4: Documentation Site Structure

### Current Pages (12 total)
```
docs/
├── index.html                      # Homepage, entry point
├── features.html                   # Feature documentation
├── cli-reference.html              # CLI commands & config
├── soul-system.html                # SOUL.md documentation
├── harness-tasks.html              # Self-improvement tasks
├── architecture.html               # System overview
├── architecture-deep-dive.html     # Technical details
├── architecture-all-guardrails.html # 18-type guardrails
├── architecture-guardrails.html    # Guardrail architecture
├── architecture-v2.html            # V2 architecture
├── dashboard.html                  # ⚠️ STATUS DASHBOARD
├── IMPACT_REPORT.html              # Impact analysis
└── styles/docs.css                 # Shared stylesheet
```

### Navigation Must Include
```
Home | Features | Architecture | CLI | SOUL | Dashboard
```

---

## 🎯 RULE 5: Status Badge Standards

### Use Consistent Badges
| Badge | Meaning | HTML |
|-------|---------|------|
| ✅ Complete | Fully implemented | `<span class="badge badge-success">✅ Complete</span>` |
| 🟡 Partial | Partially implemented | `<span class="badge badge-warning">🟡 Partial</span>` |
| 🆕 Planned | Planned for future | `<span class="badge badge-error">🆕 Planned</span>` |
| 🔵 Active | Currently running | `<span class="badge badge-info">🔵 Active</span>` |

---

## 🎯 RULE 6: When Adding New Pages

### Steps
1. Create page with shared navigation
2. Add to all other page navbars
3. Link from relevant pages
4. Add to dashboard "Documentation" section
5. Update this rules file if new page type

---

## 🎯 RULE 7: Architecture Decisions

### Claude Code / claw-code Pattern
**"How did Claude Code do it?"**
- Check claw-code (instructkr) for implementation patterns
- Reference Claude Code for tool design
- Study instructkr for natural language patterns

### Self-Improvement Pattern
**The Meta-Harness principle:**
- Generators are "dumb" (no self-improvement)
- Harness improves generators
- Observe → Detect → Fix

---

## 🎯 RULE 8: Project Structure Standards

### Repository Root (Should be <20 files)
- Keep root clean
- Move audit files to docs/internal/
- Move screenshots to docs/assets/
- Log files in .gitignore

### Source Organization
```
src/
├── core/           # RalphLoop, GenerationOrchestrator
├── harness/        # Meta-Harness, Agents, Tools
├── tui/            # NaturalInterface, HarnessTUI
├── llm/            # LLMClient, providers
├── generators/     # p5, Three.js, GLSL, etc.
└── prompts/        # System prompts, templates
```

---

## 🎯 RULE 9: Commit Message Standards

### Documentation Commits
```
docs: Brief description

- What changed in docs
- Why it changed
- Which pages affected
```

### Feature Commits (MUST include docs)
```
feat: New feature

Description of feature.

docs: Updated features.html and dashboard.html
```

---

## 🎯 RULE 10: Worktree Workflow

### docs-site Branch
- **Purpose:** Documentation development
- **Location:** `../liminal-docs-site`
- **Merge to main:** When docs are complete AND main is stable

### Main Branch
- **Purpose:** Active development
- **Docs:** Update simultaneously in worktree

---

## 📋 ACTIVE PROJECT STATE

### Branch Status
| Branch | Purpose | Status |
|--------|---------|--------|
| main | Active development | Agent working on audit |
| docs-site | Documentation site | Complete, ready to merge |

### Current Metrics
- **Features:** 12/15 complete (80%)
- **Guardrails:** 5/18 complete (28%)
- **Harness Tasks:** 5/8 ready (62%)
- **Documentation:** 12 pages (100%)

### Critical Items
- [ ] Merge docs-site to main
- [ ] Repository cleanup (141 → <20 root files)
- [ ] Implement M9-M11 (critical guardrails)

---

## 🔗 Quick Links

- **Documentation Site:** `http://localhost:3456/`
- **Dashboard:** `http://localhost:3456/dashboard.html`
- **GitHub:** https://github.com/Pastorsimon1798/liminal

---

## 📝 CHANGE LOG

| Date | Change |
|------|--------|
| 2026-04-01 | Created PROJECT_RULES.md |
| 2026-04-01 | Established docs-site as bible |
| 2026-04-01 | Created dashboard.html as status center |

---

**These rules are BINDING for all future work on Liminal.**

*Violating these rules requires explicit justification and immediate correction.*

---

## 🚫 RULE 11: NO DUPLICATION - Prevention of Wheel Reinvention

### CRITICAL: Only ONE Documentation Site Exists

**There is ONLY ONE documentation site:**
- **Location:** `docs/` directory (in docs-site branch)
- **Dashboard:** `docs/dashboard.html`
- **NO other dashboards allowed**
- **NO other landing pages allowed**
- **NO competing HTML documentation sites allowed**

### Forbidden Actions
❌ Creating new `dashboard.html` anywhere else  
❌ Creating new `landing.html` anywhere else  
❌ Creating new documentation HTML sites  
❌ Creating "status pages" outside of docs/  
❌ Creating "project overview" HTML files  

### If You See Another Agent Trying to Create:
1. **STOP THEM IMMEDIATELY**
2. Point them to the existing docs-site in worktree
3. Tell them to update `docs/dashboard.html` instead
4. Quote: "The docs-site is the single source of truth - no duplicates allowed"

### Existing Files That Were Removed (DO NOT RECREATE):
- ~~`./landing.html`~~ (REMOVED - use docs-site)
- ~~`./output-samples/dashboard.html`~~ (REMOVED - use docs-site)
- ~~`./output-samples/landing.html`~~ (REMOVED - use docs-site)
- ~~`./output-samples/portfolio.html`~~ (REMOVED - use docs-site)

### If New HTML Documentation is Needed:
1. Add it to `docs/` in the docs-site worktree
2. Link it from existing pages
3. Update dashboard.html to reference it
4. Cross-link with navigation bar

### Violation Consequences
- Any new dashboard/landing HTML files will be **DELETED**
- Agent must be informed of the rules
- Work must be redone in the docs-site

---

## 📍 QUICK REFERENCE

### Where to Find Things
| What | Where |
|------|-------|
| Documentation Site | `../liminal-docs-site/docs/` (worktree) |
| Dashboard | `../liminal-docs-site/docs/dashboard.html` |
| Homepage | `../liminal-docs-site/docs/index.html` |
| Feature Docs | `../liminal-docs-site/docs/features.html` |
| CLI Reference | `../liminal-docs-site/docs/cli-reference.html` |
| Architecture | `../liminal-docs-site/docs/architecture*.html` |

### To Update Documentation
```bash
cd ../liminal-docs-site/docs
# Edit files
git add -A
git commit -m "docs: Description of changes"
```

---

**REMEMBER: The docs-site is the BIBLE. No exceptions. No duplicates. No reinventions.**
