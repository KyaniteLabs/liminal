# Saturation Pass B - After FQA-035/FQA-036

Date: 2026-05-06

Lens: Customer Fury, Agentic Reality, launch/product truth.

Result: new material finding found.

## Finding

FQA-038: `docs/README.md` linked to `docs/ARCHITECTURE_QUICKREF.md`, but that document did not exist. The public docs validation workflow only printed package version, so this customer-visible broken-link class was not gated.

Evidence:
- `docs/README.md:21`
- `.github/workflows/doc-validation.yml:24`

## Remediation

Status: verified.

`docs/ARCHITECTURE_QUICKREF.md` now exists, `scripts/ci/check-doc-links.mjs` checks README, docs index, features page, and launch docs for broken local links, `pnpm check:doc-links` is wired in package scripts, and the `validate-docs` workflow runs the link checker.
