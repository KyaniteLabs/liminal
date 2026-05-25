# PostHog as Optional Aesthetic Sensorium

## Purpose

PostHog may support Liminal Sites only as an optional source of aesthetic
telemetry. It is not the objective function.

Correct framing:

```text
PostHog = optional aesthetic sensorium
Liminal Sites = aesthetic interpreter/generator
human = curator/approver
```

Incorrect framing:

```text
PostHog = metric optimizer
Liminal Sites = business-metric machine
```

## Non-Goals

Do not optimize Liminal Sites for:

- conversion rate
- revenue
- SEO
- lead capture
- funnel completion
- click-through
- growth
- addictive engagement

## Allowed Uses

| PostHog primitive | Liminal Sites use |
|---|---|
| Feature flags | Safely show aesthetic variants. |
| Multivariate flags | Compare aesthetic directions. |
| Remote config | Tune motion, palette, and variant exposure. |
| Experiments | Compare qualitative response to aesthetic variants. |
| Session replay | Understand qualitative friction or resonance when opted in. |
| Surveys | Collect feeling, vibe, and aesthetic feedback. |
| Custom events | Record aesthetic interactions. |

## Event Names

```text
liminal_site_variant_viewed
liminal_site_aesthetic_linger
liminal_site_feedback_submitted
liminal_site_motion_toggled
```

Example properties should stay aesthetic-first:

```json
{
  "site_id": "moon-garden",
  "variant_id": "blue-green-firefly-v3",
  "skin_id": "skin_20260524_001",
  "aesthetic_tags": ["luminous", "quiet", "organic"],
  "palette_id": "cyan-moss-night",
  "motion_profile": "subtle",
  "human_approved": true
}
```

## Privacy Rules

Default to:

- no PII
- no secret or session token capture
- no full freeform transcript unless opted in
- sampled session replay only
- owner-controlled telemetry
- clear event purpose in docs

## Digest Flow

```text
Liminal Sites artifact
-> variant id / skin id / aesthetic tags
-> PostHog event capture
-> aesthetic telemetry export
-> Liminal Sites digest
-> proposed aesthetic direction
-> human review
```

The digest may seed generation. It may not auto-publish.

## Feature Flag Naming

```text
liminal-site-<site-id>-skin-<skin-id>
liminal-site-<site-id>-motion-profile
liminal-site-<site-id>-palette-variant
```

## Human Review Rule

Every mutation path requires a human review action. Telemetry can inform a
proposal, but a person must approve applying a skin, opening a patch PR, or
publishing a change.

## Acceptance Checks

- Events are aesthetic-first.
- Privacy boundaries are explicit.
- PostHog is optional.
- Telemetry can seed generation but not auto-publish.
- Business-metric language appears only in non-goals or warnings.
