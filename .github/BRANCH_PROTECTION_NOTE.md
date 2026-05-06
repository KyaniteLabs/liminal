# Branch Protection Status

Status: configured for `main` on 2026-05-06.

Live readback command:

```bash
gh api repos/KyaniteLabs/liminal/branches/main/protection
```

Required status checks:
- `build-and-test`
- `browser-and-e2e-smoke`
- `validate-docs`

Required PR policy:
- 1 approving review before merge
- Stale approvals dismissed on new commits
- Conversation resolution required
- Administrators included

Repository safety policy:
- Strict status checks require branches to be up to date
- Linear history required
- Force pushes disabled
- Branch deletions disabled

Evidence snapshot:
`docs/audits/final-qa-2026-05-06/verification/github-main-protection.json`

The old placeholder PR-review workflow is informational only. Human review is enforced by branch protection, not by `.github/workflows/pr-review.yml`.
