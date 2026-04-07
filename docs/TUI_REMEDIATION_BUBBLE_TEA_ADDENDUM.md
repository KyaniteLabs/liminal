# How Bubble Tea Changes the TUI Remediation Strategy

## Summary

Bubble Tea does **not** replace the broader TUI/GUI remediation. It changes the **long-term implementation target** for the TUI portion.

## What still must happen immediately in the current Ink TUI

These safety fixes are still required now:

- remove silent auto-action escalation
- remove blanket approval overrides
- remove cwd-based prompt/personality loading
- sanitize terminal output
- harden risky subprocess/audio paths
- redact sensitive debug logging by default

## What should move to Bubble Tea instead of deeper Ink investment

These longer-term TUI improvements are better implemented in Bubble Tea:

- pane-first shell architecture
- explicit Chat / Inspect / Action / Confirm mode system
- active response pane instead of streaming directly into transcript history
- action review and confirmation cards
- stronger status/activity console
- trust badges, provenance labels, and execution-context labels
- full operator-grade visual system

## Revised recommendation

- Patch Ink for safety now.
- Build Bubble Tea for quality, trust UX, and permanence.
- Do not pour major aesthetic investment into Ink beyond interim usability.

## Revised phase interpretation

- Phase 0–2: unchanged; still apply to backend/GUI and immediate TUI safety.
- Phase 3: split into **Ink containment** and **Bubble Tea architecture/MVP**.
- Phase 4: move most TUI design / trust-state work into Bubble Tea.
- Phase 5: verify both the interim Ink state and the Bubble Tea migration state.
