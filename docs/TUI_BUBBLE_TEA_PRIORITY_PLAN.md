# TUI Bubble Tea Priority Plan

## Purpose

This is the shortest practical Bubble Tea plan for the Sinter TUI.

It is organized into:
- Now
- Next
- Later

It assumes:
- the current Ink TUI still exists
- immediate Ink safety remediation is still required
- Bubble Tea is the long-term TUI direction

---

## NOW

These items should happen immediately.

### 1. Finish Ink containment work
Do not skip this just because Bubble Tea is coming.

Required now:
- remove silent auto-action escalation
- remove blanket approval overrides
- remove cwd-based prompt/personality loading
- sanitize terminal output
- harden risky subprocess/audio execution
- redact sensitive debug logging

### 2. Freeze major aesthetic investment in Ink
Only do:
- safety
- minimal trust clarity
- minimal usability stabilization

Do **not** do deep long-term shell polish in Ink.

### 3. Define Bubble Tea MVP
Lock the MVP to:
- shell layout
- explicit modes
- conversation history pane
- active response pane
- input bar
- action review + confirmation flow
- status pane
- activity pane
- bridge-backed happy path

### 4. Define the backend bridge contract
Choose and specify one bridge path:
- local HTTP
- websocket
- stdio JSON-RPC

Preferred:
- local HTTP or websocket

### 5. Build a Bubble Tea shell prototype
Before deep integration, build a static/semi-static shell proving:
- pane layout
- mode identity
- visual direction
- footer/header structure

---

## NEXT

These items come after the prototype and bridge contract are clear.

### 1. Build conversation flow
- committed history pane
- active response streaming pane
- commit stream to history only after completion

### 2. Build action review flow
- move action-like requests into Action mode
- show review card
- require Confirm mode approval before mutation

### 3. Build status/activity pane
- provider/model
- current mode
- current task
- trust state
- tool activity
- warnings/errors

### 4. Apply trust-state aesthetics
Implement:
- mode badges
- trust badges
- provenance labels
- confirmation cards
- semantic palette

### 5. Integrate Bubble Tea with the TS backend
Support first:
- chat
- inspect/status
- action review
- confirmation
- activity/status updates

---

## LATER

These items should wait until the MVP is real and stable.

### 1. Full parity with Ink
- debug features
- secondary commands
- all auxiliary flows

### 2. Ink deprecation plan
- define parity checklist
- define retirement threshold
- freeze new feature work in Ink

### 3. Richer terminal operator features
- advanced log console
- compact/expanded layouts
- overlays/help system
- richer task dashboards

### 4. Documentation alignment
Once implementation lands:
- update TUI architecture docs
- update Visual Bible if relevant
- document trust-state shell and migration status

---

## Recommendation summary

### Now
Patch Ink for safety and define/build the Bubble Tea shell + bridge contract.

### Next
Make Bubble Tea useful for the critical happy path.

### Later
Chase parity and retire Ink.

---

## Hard rule

Do not let Bubble Tea planning become an excuse to leave the current Ink TUI unsafe.

Patch Ink for safety now.
Build Bubble Tea for quality and permanence.
