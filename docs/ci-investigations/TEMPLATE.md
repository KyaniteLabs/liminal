# CI Packet: <short failure name>

Give to: <agent lane>
Repo: <owner/repo>
Run: <run id>
Commit: <sha>
Failing job: <job>
Failing command: `<command>`
Status: ready for repair

## What Failed

- <one-line failure>

## Evidence

```text
<small decisive log excerpt only>
```

## Likely Cause

<one paragraph; say if this is inference>

## Repair Brief

Fix the failure above. Stay scoped to the failing seam. Do not weaken guardrails unless the packet says the guardrail is wrong.

## Verify

```sh
<narrow command>
```

Then run the nearest CI-equivalent command if the narrow command passes.

## Done When

- Narrow repro passes.
- Relevant CI-equivalent check passes or remaining blocker is named.
- No unrelated files are changed.
- Root cause and verification command are included in the handoff/PR.
