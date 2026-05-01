# Launch Candidate Preflight

> Current status: historical preflight artifact, not a live launch-readiness claim.
> For current verification policy, use `docs/launch/test-ci-truth-matrix-2026-05-01.md`; for current launch proof, rerun the proof commands rather than trusting this historical preflight.
> As of 2026-04-19, Liminal is a launch candidate with proof slices complete, but full launch readiness still depends on the remaining manual/live gates and documentation truth pass.

**Historical pre-flight package for Liminal Meta-Harness**

---

## 📦 What You Have

### Documentation Created
| File | Purpose |
|------|---------|
| `docs/HARNESS_PREFLIGHT.md` | Manual checklist before starting |
| `docs/WHAT_TO_EXPECT.md` | User experience walkthrough |
| `docs/AUDIT_PROMPT.md` | **Full audit prompt for AI agent** |
| `docs/AUDIT_QUICK.sh` | **Quick shell audit script** |
| `docs/ARCHITECTURE_QUICKREF.md` | Architecture reference |
| `docs/architecture*.html` | Visual architecture diagrams |

### Code Complete
- ✅ Harness wired to RalphLoop
- ✅ Harness wired to E2E tests
- ✅ TUI with all commands
- ✅ 8 task files ready (M1, M4, M6-8 + M9-11 planned)
- ✅ Build passes
- ✅ All safety systems in place

---

## 🎯 Three Ways to Verify

### Option 1: Quick Shell Script (30 seconds)

```bash
cd /Users/simongonzalezdecruz/workspaces/liminal
./docs/AUDIT_QUICK.sh
```

**Output:**
```
✅ GO - Harness is ready
# or
❌ NO-GO - Fix N critical issues first
```

### Option 2: AI Agent Audit (5 minutes)

**Give this prompt to your auditing agent:**

> You are a Pre-Flight Auditing Agent for the Liminal Meta-Harness. Perform a comprehensive audit of /Users/simongonzalezdecruz/workspaces/liminal before activation. Check: 1) Build passes, 2) Dependencies present, 3) Harness wiring (RalphLoop→metaHarness, TUI→HarnessAgent), 4) Task files valid JSON, 5) Safety systems exist, 6) LLM configured. Provide GO/NO-GO decision with detailed report.

**Or copy the full prompt from:** `docs/AUDIT_PROMPT.md`

### Option 3: Manual Checklist (2 minutes)

```bash
# 1. Build
cd /Users/simongonzalezdecruz/workspaces/liminal
npm run build
# Expected: No errors

# 2. Check tasks
ls harness-tasks/*.json
# Expected: M1.json M4.json M6.json M7.json M8.json

# 3. Check wiring
grep -l "metaHarness" src/core/RalphLoop.ts src/index.ts
# Expected: Both files listed

# 4. Check TUI
ls src/tui/HarnessTUI.tsx
# Expected: File exists
```

---

## 🎬 Launch Sequence

### Step 1: Verify (Pick one method above)
```bash
./docs/AUDIT_QUICK.sh
# Should output: ✅ GO - Harness is ready
```

### Step 2: Start Harness
```bash
npm run tui
```

### Step 3: Check Status
```
/status
```
**Expected:**
```
Harness: 🟢 Online
Provider: [your-provider]
Failures: 0
Patterns: 0
```

### Step 4: List Tasks
```
/tasks
```
**Expected:** M1, M4, M6, M7, M8

### Step 5: Execute First Task
```
/run M1
```

---

## 🛡️ Safety Features (Active)

| Feature | How It Protects You |
|---------|---------------------|
| **Auto-Backup** | Every edit backed up to `.liminal/backups/` |
| **Auto-Rollback** | If build fails, original restored automatically |
| **Rate Limiting** | Max 5 LLM calls/min, can't burn through API quota |
| **Path Validation** | Can only edit `src/`, `test/`, `docs/`, `scripts/` |
| **Change Limits** | Max 50 lines per edit, prevents massive changes |
| **Build Gate** | Changes only committed if `npm run build` passes |

---

## 🚨 Emergency Procedures

| Situation | Action |
|-----------|--------|
| Task stuck | `Ctrl+C` to kill TUI |
| Wrong change applied | Check `.liminal/backups/`, manually restore |
| TUI crashes | Re-run `npm run tui`, state is preserved |
| Need to stop everything | `touch .stop` in project root |
| Build fails after change | Automatic rollback happens, check output |

---

## 📊 Expected Results

### After Running M1:
```
Task M1: SUCCESS
Steps: 4
Duration: 2.3s
```

### Verification:
```bash
# In separate terminal:
npm run build          # ✅ Passes
git diff               # Shows 1 line changed
grep "music.*unknown" src/core/CodeValidator.ts  # Shows fix
```

### All Tasks Complete (M1, M4, M6-8):
- **Files modified:** 5
- **Lines changed:** ~10 total
- **Build status:** ✅ Passes
- **Tests:** ✅ Pass

---

## 🎯 Success Criteria

You've successfully activated the harness when:

- [ ] Audit passes (GO)
- [ ] TUI starts without errors
- [ ] `/status` shows 🟢 Online
- [ ] `/tasks` shows available tasks
- [ ] `/run M1` succeeds
- [ ] Build passes after M1
- [ ] You see the change in `git diff`

---

## 💬 Quick Reference

```
START:     npm run tui
STATUS:    /status
TASKS:     /tasks
RUN:       /run M1
HELP:      /help
EXIT:      /exit

EMERGENCY: Ctrl+C
```

---

## Candidate Status

This historical checklist shows the harness activation path, but it is not sufficient by itself to claim launch readiness. Current proof evidence must be checked first:

- `.omx/proof/launch-readiness-scorecard-2026-04-19.md`
- `.omx/proof/operator-trust-proof-2026-04-19.md`
- `.omx/proof/audio-input/`
- `.omx/proof/creative-copilot/`
- `.omx/proof/emergence-garden/`
- `.omx/proof/self-improvement/`

Historically, this package expected:
- ✅ Code written and tested
- ✅ Wiring verified
- ✅ Documentation complete
- ✅ Safety systems active
- ✅ Audit tools ready

Before launch/demo use, choose your audit method, verify current proof gates, then run:

```bash
npm run tui
/run M1
```

**Good luck. Treat this as an activation checklist, not a final launch certificate.**

---

## Need Help?

| Issue | Solution |
|-------|----------|
| Build fails | Check `npm install` ran correctly |
| LLM not found | Set `LIMINAL_LLM_BASE_URL` |
| Task not found | Run `/tasks` to see available IDs |
| TUI looks broken | Try `export TERM=xterm-256color` |
| Rollback confusion | Read `docs/WHAT_TO_EXPECT.md` |

---

**Launch gates pending. Verify proof gates before go.**
