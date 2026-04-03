# Public GitHub Repository Audit Report

**Date:** 2026-04-01  
**Repository:** `liminal-ai`  
**Audit Type:** Forward-facing public readiness review  
**Scope:** Repository hygiene, public exposure, engineering conventions, presentation quality  
**Overall Status:** **Conditional Go** (publish after critical/high remediation)

---

## Executive Assessment

The codebase quality is strong, but the repository currently exposes too many internal and transient artifacts at the root level for a polished public OSS presentation.  

From an April 2026 engineering-conventions standpoint, the main blockers are:

1. missing legal/distribution essentials (`LICENSE` mismatch with declared MIT),
2. incomplete package metadata for public discoverability and trust,
3. root-level clutter with internal audit logs/reports/screenshots/results.

If those are remediated, the repository should meet professional public-release standards.

---

## What Is Working Well

- TypeScript + ESM setup is modern and appropriate for 2026 Node ecosystems.
- Security posture appears thoughtful (`.env` handling, security documentation, defensive patterns).
- Test and CI footprint is present and mature (Vitest + workflow automation).
- Documentation depth is high and technically meaningful.
- Architecture appears intentionally modular (`src/`, `docs/`, `test/`, `scripts/` are logically separated).

---

## Findings By Severity

## Critical (must fix before broad public promotion)

### C1. License declaration mismatch
- `package.json` declares `"license": "MIT"` but no `LICENSE` file is present.
- This creates legal ambiguity for adopters and enterprise compliance scanners.
- **Required action:** Add canonical MIT `LICENSE` file at repo root.

### C2. Missing public package metadata fields
- `package.json` is missing key OSS metadata expected by npm and GitHub consumers:
  - `repository`
  - `homepage`
  - `bugs`
  - meaningful `author` value (currently empty)
- **Required action:** complete metadata to establish provenance, support path, and project ownership clarity.

---

## High (should fix before announcing/publicizing)

### H1. Root-level repository clutter
- Public-first repositories are expected to keep root focused and scannable.
- Root currently includes many operational/internal files that reduce trust and readability.
- **Expected standard:** keep root primarily to canonical entrypoints (`README.md`, `LICENSE`, `CHANGELOG.md`, key configs, source/test/docs directories).

### H2. Internal audit and dogfood artifacts are publicly mixed with product docs
- Multiple files appear internal-process oriented (audit reports, remediation logs, dogfood summaries).
- These may be useful historically, but are not ideal root-level public artifacts.
- **Recommended action:** move to `docs/internal/` or `docs/archive/internal-audits/`.

### H3. Screenshot and generated evidence artifacts at root
- Root-level `landing-*.png` and other media files create a non-curated first impression.
- **Recommended action:** consolidate into `docs/assets/screenshots/` (or `artifacts/screenshots/`).

### H4. Runtime logs and generated JSON reports tracked in root
- Logs/results are not typically versioned in root for public OSS unless part of intentional benchmark datasets.
- **Recommended action:** either:
  - move versioned benchmark artifacts to an explicit dataset folder (`test-results/` with README), or
  - ignore transient artifacts via `.gitignore`.

---

## Medium (quality uplift)

### M1. README size and navigability
- README is comprehensive but long for first-time visitors.
- **Recommendation:** add a table of contents and split deep-dive sections into `docs/`.

### M2. Community onboarding docs
- Consider adding:
  - `CONTRIBUTING.md`
  - `CODE_OF_CONDUCT.md`
  - optional `SECURITY.md` link prominence in root docs table

### M3. Changelog conventions
- Consider aligning with [Keep a Changelog](https://keepachangelog.com/) and SemVer release tags.

---

## Public Exposure Risk Review

### Secrets and sensitive material
- Spot checks did **not** reveal obvious committed secrets in source/docs.
- `.env` appears ignored and `.env.example` exists, which is good baseline hygiene.
- Residual risk remains unless full secret scanning is enforced in CI (recommended).

### “Only contains what it should”
- Current state is **not yet strict-minimal** for a public-facing root.
- Repository appears to contain extra operational artifacts that should be archived, relocated, or ignored.

---

## April 2026 Convention Alignment

### Aligned
- Typed codebase and modern module format.
- Test tooling and CI usage.
- Security-aware documentation.
- Clear domain architecture and subsystem boundaries.

### Not yet aligned
- OSS metadata completeness.
- Legal file consistency.
- Public repo curation/organization standards.
- Artifact governance (what gets committed vs generated locally).

---

## Recommended Target Structure

```text
liminal/
  README.md
  LICENSE
  CHANGELOG.md
  CONTRIBUTING.md                  # recommended
  CODE_OF_CONDUCT.md               # recommended
  package.json
  src/
  test/
  docs/
    assets/screenshots/
    internal/                      # internal audits, dogfood notes
    archive/
  test-results/                    # if intentionally versioned
  scripts/
  .github/
```

---

## Remediation Checklist (Prioritized)

1. Add `LICENSE` matching declared MIT.
2. Complete `package.json` public metadata (`author`, `repository`, `homepage`, `bugs`).
3. Curate root: move internal audit/dogfood files under `docs/internal/` or `docs/archive/`.
4. Relocate screenshots to `docs/assets/screenshots/`.
5. Define artifact policy:
   - versioned outputs only in explicit directories,
   - transient logs/results ignored.
6. Improve README navigation and move deep sections to `docs/`.
7. Add contributor/community docs (`CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`).

---

## Final Recommendation

**Decision:** **Conditional Go**  
**Rationale:** Core engineering quality is solid, but repository presentation and public hygiene need cleanup before broad external visibility.

Once critical and high items are closed, this repo should be publicly presentable and professionally aligned with 2026 open-source norms.
