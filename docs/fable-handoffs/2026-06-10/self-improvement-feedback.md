# Self-Improvement Feedback — 2026-06-10 Fable session

Each lesson, with the exact place it must live so future agents encounter it.

## 1. Merged ≠ live for long-running processes

**Lesson:** A bash `while true` daemon parses its loop body once; merged script edits are silently inert until restart. #698's `preferences train` step never ran for ~8h (FAB-009).
**Where it belongs:**
- **Workflow/guardrail:** Handoff 03 (daemon re-exec on script mtime change) — mechanical fix.
- **Ledger:** future daemon ledger lines should carry the script SHA + dist build stamp (proposed in fable-strategy.md §moves.2).
- **Memory:** recorded in this session's findings ledger FAB-009; investor-audit memory updated.
- **Doctrine:** any register/audit row claiming a *live-loop* fix is FIXED must cite runtime evidence (log line, mtime, ledger entry), not a merge SHA. Handoff 02 encodes this in the register's F7 row.

## 2. Forgejo is the source of truth; docs that gate claims must move in the same change unit as infra decisions

**Lesson:** The truth matrix, README badge, and AGENTS.md all asserted GitHub as the gate hours after it stopped being one. Agents consult exactly these files before making verification claims.
**Where it belongs:**
- **Docs:** Handoff 02 rewrites them with a dated transition section.
- **Memory:** `forgejo-source-of-truth` memory written this session.
- **Workflow:** migration checklist habit named in fable-strategy.md.

## 3. Legacy artifacts poison audits

**Lesson:** `~/.sinter/taste/taste-weights.json` (May 25) is referenced nowhere in src/ but nearly led this session to conclude training was broken; the live model persists via SinterFS `taste-model:` refs.
**Where it belongs:**
- **Docs:** Handoff 02 adds the warning to the register's F7 row.
- **Validator/cleanup (optional):** remove or README-stamp the legacy file in a hygiene pass.

## 4. Preflight leads decay fast in a multi-agent repo

**Lesson:** Every "current lead" from the preflight (dirty ThreeValidator files, failing focused test) was already merged/fixed by #696–#697 before this session started. Verified before acting; zero time lost chasing them (FAB-007).
**Where it belongs:**
- **Doctrine (this file):** treat handoff "leads" as hypotheses with a generation timestamp; re-verify against git log newer than that timestamp before investigating.

## 5. The score-gap auto-feed design is confirmed sound

**Lesson:** 130 archive entries → 244 inferred pairs with 0 human events, training agreement 100%, axis weights non-degenerate. The confidence-0.4 design (below every human signal) means pins will dominate the moment they exist — verified by reading, not just claimed.
**Where it belongs:**
- **Register:** F7 row evidence (Handoff 02).
- **No code change needed.**
