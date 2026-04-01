# What to Expect When Running the Harness

**First-Time User Guide**

---

## 🎬 The Experience

### Starting the TUI

```bash
npm run tui
```

**You'll see:**
```
╔═══════════════════════════════════════════════════════════════╗
║  🎨 LIMINAL                                    Hybrid TUI     ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  Hybrid TUI initialized.                                      ║
║  Type /help for commands. /preview <file> to view content.    ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
❯ █
```

**Type:** `/status`

**Expected:**
```
Harness: 🟢 Online
Provider: lmstudio (or your provider)
Failures: 0
Patterns: 0
Browser: ⚪ Stopped
Audio: ⚪ Stopped
```

---

## 🏃 Running Your First Task (M1)

### Step-by-Step

**1. Type the command:**
```
/run M1
```

**2. You'll see execution:**
```
❯ /run M1

[HarnessAgent] Starting task: Fix Tone.js Validation Gate
[HarnessAgent] Budget: 10 steps, 300000ms timeout
[HarnessAgent] Reading src/core/CodeValidator.ts
[HarnessAgent] Applied edit to src/core/CodeValidator.ts
[HarnessAgent] Running build...
[HarnessAgent] Build passed
[HarnessAgent] Task completed successfully!
[HarnessAgent] Steps executed: 4
```

**3. Result appears:**
```
Task M1: SUCCESS
Steps: 4
Duration: 2.3s
```

---

## ✅ Success Scenario

### What Success Looks Like

```
┌─────────────────────────────────────────────┐
│  Task M1: SUCCESS                           │
│                                             │
│  ✓ File read                                │
│  ✓ Edit applied                             │
│  ✓ Build passed                             │
│  ✓ Verification complete                    │
│                                             │
│  Changes: 1 file modified                   │
│  Lines changed: 1                           │
└─────────────────────────────────────────────┘
```

### Verify It Worked

In a **separate terminal**:
```bash
cd /Users/simongonzalezdecruz/workspaces/liminal
npm run build          # Should pass
git diff               # Should show the change
```

---

## ❌ Failure Scenario (And What Happens)

### If Build Fails

```
[HarnessAgent] Running build...
[HarnessAgent] Build failed: src/core/CodeValidator.ts(45,10): error TS2345
[HarnessAgent] Rolling back changes...
[HarnessAgent] Restored from backup: .liminal/backups/M1-20260401-120304.ts
[HarnessAgent] Rollback complete

Task M1: ROLLED_BACK
Reason: Build failed after edit
```

**What you should do:**
1. Check the error message
2. Look at the task file: `cat harness-tasks/M1.json`
3. The task might need adjustment
4. Try again: `/run M1`

---

## 🔄 Rollback Details

### How Auto-Rollback Works

```
1. Task starts
   ↓
2. Backup created automatically (.liminal/backups/)
   ↓
3. Edit applied
   ↓
4. Build runs
   ↓
5a. Build PASS → Keep changes → SUCCESS
   ↓
5b. Build FAIL → Restore backup → ROLLED_BACK
```

### Manual Rollback (if needed)

```bash
# List backups
ls -lt .liminal/backups/ | head -5

# Restore specific backup
cp .liminal/backups/M1-[timestamp].ts src/core/CodeValidator.ts

# Rebuild
npm run build
```

---

## ⏱️ Timing Expectations

| Task | Estimated Time | What Happens |
|------|----------------|--------------|
| M1 | 2-3 seconds | Read → Edit → Build → Done |
| M4 | 2-3 seconds | Same pattern |
| M6 | 2-3 seconds | Logger fix |
| Complex tasks | 5-10 seconds | More verification |

**Timeout:** 5 minutes per task (automatic)

---

## 📊 What Gets Modified

### After Running M1-M8

**Files that will change:**
```
src/core/CodeValidator.ts          (M1)
src/llm/LLMClient.ts               (M4)
src/harness/FailureLogger.ts       (M6)
src/harness/PatternDetector.ts     (M7)
src/harness/HarnessUpdater.ts      (M8)
```

**Each change:**
- ~1-3 lines modified
- Single purpose
- Build must pass
- Backed up before change

---

## 🎯 Verification Checklist

After each task, verify:

```bash
# In separate terminal:
cd /Users/simongonzalezdecruz/workspaces/liminal

# 1. Build passes
npm run build

# 2. Change is present
git diff --stat

# 3. Tests still pass
npm test 2>&1 | tail -5
```

---

## 🚨 Common Issues & Solutions

### Issue 1: "Task not found"
```
/run M99
Error: Task M99 not found
```
**Solution:** Use `/tasks` to see available IDs

### Issue 2: "LLM not configured"
```
[MetaHarness] No LLM provider configured
```
**Solution:** Set environment variables (see HARNESS_PREFLIGHT.md)

### Issue 3: "Build failed"
```
Task M1: ROLLED_BACK
Build failed after edit
```
**Solution:** 
- Check the search/replace in task file
- May need to update task if code changed

### Issue 4: TUI looks broken
```
# Characters not rendering
```
**Solution:** Your terminal might not support Unicode. Try:
```bash
export TERM=xterm-256color
npm run tui
```

---

## 🎓 Pro Tips

### 1. Keep a Terminal Open for Verification
Always have a second terminal ready to:
- Check git diff
- Run npm build
- View logs

### 2. Run Tasks in Order
```
M1 → M4 → M6 → M7 → M8
```
Each is independent, but this order builds confidence.

### 3. Check Backups After Success
```bash
ls .liminal/backups/
```
You should see backup files - this means the system is working.

### 4. Don't Panic on Rollback
Rollback is a **feature**, not a bug. It means the harness is protecting your codebase.

---

## 📈 Expected Outcomes

### After All 5 Tasks (M1, M4, M6-8)

**Code Quality:**
- Tone.js validation works on 'music' domain ✅
- Thinking regex is non-greedy ✅
- Logger calls are proper ✅

**Files Modified:** 5 files
**Lines Changed:** ~10 lines total
**Build Status:** ✅ Passes
**Tests:** ✅ Still pass

---

## 🎉 Success Criteria

You've successfully used the harness when:

- [ ] You ran `/run M1` and it succeeded
- [ ] You verified the change with `git diff`
- [ ] Build passes: `npm run build`
- [ ] You understand that rollback = safety
- [ ] You're ready to queue up M4, M6, M7, M8

---

## 💬 Quick Commands Reference

```
START:    npm run tui
CHECK:    /status
LIST:     /tasks
RUN:      /run M1
PREVIEW:  /preview output/file.js
CLEAR:    /clear
EXIT:     /exit

EMERGENCY: Ctrl+C
```

---

**You're ready. Go run that first task! 🚀**

```bash
npm run tui
/run M1
```
