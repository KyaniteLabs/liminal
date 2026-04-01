# 🚀 Harness Pre-Flight Checklist

**READ THIS BEFORE RUNNING THE HARNESS FOR THE FIRST TIME**

---

## ✅ Prerequisites Check

### 1. Build Status
```bash
cd /Users/simongonzalezdecruz/workspaces/liminal
npm run build
```
**Expected:** No errors, clean exit

### 2. Node Modules
```bash
ls node_modules/ink
```
**Expected:** Directory exists (TUI dependency)

### 3. Task Files Valid
```bash
ls harness-tasks/*.json
cat harness-tasks/M1.json | head -5
```
**Expected:** Valid JSON files with `id`, `title`, `approved` fields

---

## ⚙️ Configuration Check

### LLM Provider (REQUIRED)

The harness needs an LLM to execute tasks. Check your setup:

```bash
# Option 1: LM Studio (Recommended for local)
export LIMINAL_LLM_PROVIDER=lmstudio
export LIMINAL_LLM_BASE_URL=http://localhost:1234/v1
export LIMINAL_LLM_MODEL=qwen2.5-coder-7b-instruct

# Option 2: Ollama
export LIMINAL_LLM_PROVIDER=ollama
export LIMINAL_LLM_BASE_URL=http://localhost:11434
export LIMINAL_LLM_MODEL=llama3.2

# Option 3: MiniMax (Cloud)
export MINIMAX_API_KEY=your_key_here
```

**Verify it's working:**
```bash
curl $LIMINAL_LLM_BASE_URL/models 2>/dev/null | head -5
```
**Expected:** Should return model list (or 200 OK)

---

## 💾 Persistent Memory (Auto-Enabled)

The harness now remembers everything across restarts:

```
~/.liminal/memory/harness-memory.json
├── Tasks (M1-M11 status, outcomes)
├── Adaptations (fixes applied, success/failure)
├── Episodes (conversations, generations)
└── Patterns (failure patterns detected)
```

**What this means:**
- ✅ Tasks completed in previous sessions are remembered
- ✅ Adaptations (fixes) are tracked with outcomes
- ✅ User preferences are learned over time
- ✅ Pattern detection improves with history
- ✅ Auto-saves every 30 seconds + on graceful shutdown

**View memory status:**
```bash
# In TUI
/status
# Shows: Memory loaded, tasks total/completed, adaptations count
```

---

## 🛡️ Safety Features (Auto-Enabled)

### What Happens Automatically

1. **Auto-Backup**: Before any edit, file is backed up
   - Location: `.liminal/backups/`
   - Kept: Last 50 backups

2. **Auto-Rollback**: If build fails after edit
   - Original file restored automatically
   - Task marked as "rolled_back"

3. **Rate Limiting**: Prevents runaway execution
   - Max 5 LLM calls/minute
   - Max 10 file writes/minute
   - Max 12 builds/minute

4. **Path Validation**: Can only edit allowed directories
   - Allowed: `src/`, `test/`, `docs/`, `scripts/`
   - BLOCKED: `node_modules/`, `.git/`, system files

5. **Change Size Limits**
   - Max 50 lines changed per edit
   - Max 1000 lines per file

---

## 🚨 Emergency Procedures

### If Something Goes Wrong

**Scenario 1: Task stuck/running too long**
```bash
Ctrl+C  # Kill the TUI
```
Task will timeout after 5 minutes automatically.

**Scenario 2: Wrong edit applied**
```bash
# Check backups
ls -la .liminal/backups/

# Manual restore
cp .liminal/backups/M1-timestamp.ts src/core/CodeValidator.ts
npm run build
```

**Scenario 3: TUI crashes**
```bash
# Restart
cd /Users/simongonzalezdecruz/workspaces/liminal
npm run tui
```
Harness state is preserved via HarnessMemory.

**Scenario 4: Need to stop ALL operations**
```bash
# Create stop file
touch .stop
```
Harness checks for this file and stops gracefully.

---

## 📋 First-Time Walkthrough

### Step 1: Verify Status
```bash
npm run tui
# In TUI:
/status
```
**Look for:**
- ✅ Harness: Online
- 🟢 Provider: [your-provider]
- ⚪ Browser: Stopped (OK)
- ⚪ Audio: Stopped (OK)

### Step 2: List Tasks
```
/tasks
```
**Expected:** M1-M11 (all approved and ready)

### Step 3: Dry Run (Read task first)
```bash
# In separate terminal, read the task:
cat harness-tasks/M1.json
```
**Verify:**
- `approved: true`
- `targetFile` exists
- `search` text is in the file

### Step 4: Execute First Task
```
/run M1
```
**Expected Output:**
```
[HarnessAgent] Starting task: Fix Tone.js Validation Gate
[HarnessAgent] Reading src/core/CodeValidator.ts
[HarnessAgent] Applying edit to src/core/CodeValidator.ts
[HarnessAgent] Running build...
[HarnessAgent] Build passed
Task M1: SUCCESS
```

### Step 5: Verify
```bash
# In separate terminal:
npm run build
# Should pass
grep -n "music.*unknown" src/core/CodeValidator.ts
# Should show the fix
```

---

## ⚠️ Known Limitations

1. **No Auto-Execute**: Tasks require manual `/run` command
   - This is by design for safety
   - Future: May add auto-approval for low-risk tasks

2. **Single File Per Task**: Most tasks edit one file
   - For multi-file changes, run tasks sequentially

3. **Build Must Pass**: Task fails if `npm run build` fails
   - Even if the edit was "correct"
   - Fix: Adjust task to be more conservative

4. **LLM Dependency**: Harness needs working LLM
   - If LLM is down, tasks can't execute
   - Harness will report error, not hang

---

## 🔍 Debugging Failed Tasks

### Check Logs
```bash
# Recent failures
tail -20 logs/failures-*.jsonl

# Specific task session
ls -la .liminal/sessions/
cat .liminal/sessions/M1-*.json
```

### Check Backups
```bash
ls -lt .liminal/backups/ | head -10
```

### Manual Build
```bash
npm run build 2>&1 | head -30
```

---

## 🎯 Recommended First Task Order

1. **M1** - Tone.js validation (safe, single line)
2. **M4** - Regex fix (safe, single line)
3. **M6** - Logger fix (safe, logging only)
4. **M7** - Logger fix (safe)
5. **M8** - Logger fix (safe)

**M9-M11** are now implemented and safe to run.

---

## 📞 Quick Reference Card

```
┌─────────────────────────────────────────────┐
│  HARNESS TUI COMMANDS                       │
├─────────────────────────────────────────────┤
│  /help              Show all commands       │
│  /status            Check system status     │
│  /tasks             List available tasks    │
│  /run <id>          Execute task            │
│  /preview <file>    Preview output          │
│  /clear             Clear screen            │
│  /exit              Exit TUI                │
├─────────────────────────────────────────────┤
│  EMERGENCY: Ctrl+C  Kill TUI                │
│  STOP FILE: touch .stop                     │
└─────────────────────────────────────────────┘
```

---

## ✅ Final Checklist

Before you run `/run M1`, confirm:

- [ ] `npm run build` passes
- [ ] LLM provider is configured and reachable
- [ ] You can see tasks with `/tasks`
- [ ] You understand auto-rollback happens on failure
- [ ] You know where backups are (`.liminal/backups/`)
- [ ] You have a second terminal open for verification

---

**You're ready! Start with:**
```bash
npm run tui
/status
/run M1
```

Good luck! 🚀
