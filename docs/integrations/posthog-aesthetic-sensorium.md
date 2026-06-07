# PostHog As Aesthetic Sensorium

Status: Phase 1 integration note

## Purpose

PostHog may be used by Sinter Sites only as an optional source of aesthetic
telemetry. It can help identify which visual directions feel resonant, confusing,
too busy, too slow, or uncomfortable.

PostHog must not become the objective function for Sinter Sites.

```text
PostHog = optional aesthetic sensorium
Sinter Sites = aesthetic interpreter and generator
human = curator and approver
```

## Non-Goals

Do not optimize Sinter Sites for:

- conversion rate
- revenue
- SEO
- lead capture
- funnel completion
- click-through
- growth
- retention as the primary objective
- addictive engagement

These signals may exist in a host website's normal analytics, but they are not
the goal of the Sinter Sites aesthetic loop.

## Useful PostHog Primitives

| PostHog primitive | Sinter Sites use |
| --- | --- |
| Feature flags | Safely show aesthetic variants |
| Multivariate flags | Compare aesthetic directions |
| Remote config | Tune motion, palette, or variant exposure |
| Experiments | Compare responses to aesthetic variants |
| Session replay | Understand qualitative friction or resonance |
| Surveys | Collect feeling, vibe, or aesthetic feedback |
| Custom events | Record aesthetic interactions |

## Event Names

### Variant Exposure

```json
{
  "event": "liminal_site_variant_viewed",
  "properties": {
    "site_id": "moon-garden",
    "variant_id": "blue-green-firefly-v3",
    "skin_id": "skin_20260525_001",
    "aesthetic_tags": ["luminous", "quiet", "organic", "slow-motion"],
    "palette_id": "cyan-moss-night",
    "motion_profile": "subtle",
    "generated_by": "liminal-sites",
    "human_approved": true
  }
}
```

### Aesthetic Linger

```json
{
  "event": "liminal_site_aesthetic_linger",
  "properties": {
    "site_id": "moon-garden",
    "variant_id": "blue-green-firefly-v3",
    "duration_ms": 42100,
    "interaction": "hovered_fireflies",
    "motion_reduced": false,
    "sound_enabled": false
  }
}
```

### Feedback

```json
{
  "event": "liminal_site_feedback_submitted",
  "properties": {
    "site_id": "moon-garden",
    "variant_id": "blue-green-firefly-v3",
    "feeling": "calm",
    "freeform": "beautiful but slightly too busy",
    "visitor_opted_in": true
  }
}
```

### Motion Control

```json
{
  "event": "liminal_site_motion_toggled",
  "properties": {
    "site_id": "moon-garden",
    "variant_id": "blue-green-firefly-v3",
    "motion_state": "reduced",
    "reason": "visitor_control"
  }
}
```

## Privacy Rules

- Default to no PII.
- Do not capture secret tokens, session tokens, authentication data, or raw
  credentials.
- Do not collect full freeform feedback unless the visitor opts in.
- Keep session replay disabled by default.
- Enable replay only with owner approval, documented purpose, and a sampling rate.
- Mask text and input content by default.
- Redact URLs, query parameters, and route segments that may contain identifiers.
- Do not enable replay on authenticated, admin, checkout, private, or client
  work surfaces.
- Limit autocapture to aesthetic controls and explicitly named events.
- Require visitor consent where applicable before recording replay or freeform
  feedback.
- Keep owner-controlled telemetry exports.
- Treat replay and survey data as qualitative evidence, not automatic publish
  authority.

## Digest Flow

```text
Sinter Sites artifact
-> variant id, skin id, and aesthetic tags
-> PostHog event capture
-> aesthetic telemetry export
-> Sinter Sites digest
-> proposed aesthetic direction
-> human review action
```

```ts
export interface AestheticTelemetryDigest {
  siteId: string;
  windowStart: string;
  windowEnd: string;
  variants: AestheticVariantTelemetry[];
  qualitativeSignals: AestheticFeedbackSignal[];
  generatedInsights: AestheticInsight[];
}

export interface AestheticVariantTelemetry {
  variantId: string;
  aestheticTags: string[];
  views: number;
  lingerSamples: number;
  medianLingerMs?: number;
  motionReducedRate?: number;
  feedbackSummary?: string;
}

export interface AestheticFeedbackSignal {
  variantId: string;
  feeling?: string;
  summary: string;
  optedIn: boolean;
}

export interface AestheticInsight {
  id: string;
  type:
    | "resonance"
    | "confusion"
    | "motion_discomfort"
    | "palette_preference"
    | "density_preference"
    | "sound_preference"
    | "unknown";
  confidence: number;
  description: string;
  evidence: string[];
  proposedDirection?: string;
}
```

## Human Review Rule

Telemetry can seed a generation prompt or propose a direction. It cannot
auto-publish, auto-open a site PR, auto-deploy, or mutate a canonical site skin
without a `ReviewAction` from
`docs/contracts/liminal-shared-artifact-contracts.md`.

## Feature Flag Naming

```text
liminal-site-<site-id>-skin-<skin-id>
liminal-site-<site-id>-motion-profile
liminal-site-<site-id>-palette-variant
```

## Acceptance Checks

- Objective language stays aesthetic-first.
- SEO, conversion, revenue, funnel, and growth terms appear only as non-goals or
  warnings.
- Events describe aesthetic exposure, interaction, feedback, and visitor control.
- Privacy boundaries are explicit.
- Every mutation path leads to human review.
