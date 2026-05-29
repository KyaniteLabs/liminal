# PostHog Sensorium Aesthetic Layer Design

**Date:** 2026-05-26
**Status:** Approved

---

## Goal

Reframe the Liminal × KyaniteLabs website integration from a literal PostHog A/B optimization loop into a mission-safe aesthetic sensorium: PostHog provides raw behavioral signals, Liminal transforms those signals into bounded decorative atmosphere, and the existing KyaniteLabs site analytics and conversion surfaces remain untouched.

---

## Core Principle

**PostHog is a sensorium, not a steering wheel.**

PostHog may influence mood, texture, rhythm, palette, atmosphere, and decorative motion. It must not directly control layout, copy, CTA placement, navigation, page hierarchy, link destinations, SEO metadata, existing analytics behavior, or conversion-critical interactions.

The Liminal layer must amplify the site's intent, never compete with it.

---

## What Changes From the Earlier Plan

The earlier implementation treated PostHog as an experiment platform:

```txt
PostHog results → engagement score → variant wins/loses → promote winner
```

That is too literal and depends on traffic volume that KyaniteLabs does not yet have. It also risks optimizing toward noisy metrics rather than preserving the site's mission.

The approved model is metabolic:

```txt
PostHog raw activity → signal extraction → aesthetic intent → mission guardrails → Liminal layer parameters/variants
```

A pageview is not a vote. A scroll is not a conversion mandate. A bounce is not automatically failure. These are raw gestures that can be transformed into restrained aesthetic material.

---

## Layer Separation

The existing KyaniteLabs PostHog setup remains the normal analytics layer. It continues to track traditional analytics, funnels, clicks, conversions, and session behavior.

The Liminal layer is added on top as a separate aesthetic system.

Rules:

- Do not remove or rewrite existing PostHog initialization.
- Do not change existing event names or dashboards.
- Prefix all new Liminal events with `liminal_`.
- Namespace Liminal properties with `liminal_*` keys.
- Use separate feature flag names if flags are needed, e.g. `liminal_aesthetic_home_hero`.
- The Liminal layer can read raw analytics data, but it must not become the canonical analytics taxonomy.

---

## Aesthetic Layer Scope

The Liminal layer is decorative and constrained.

Allowed surfaces:

- ambient hero background layer behind stable copy and CTAs
- decorative section divider
- subtle border/field effects
- background canvas with `pointer-events: none`
- sandboxed iframe layer
- low-intensity texture, shimmer, movement, palette modulation
- non-essential atmospheric visual motifs

Forbidden surfaces:

- replacing core page content
- changing copy
- moving CTAs
- altering navigation
- intercepting clicks by default
- modifying forms
- changing links
- changing SEO metadata
- breaking existing analytics
- obscuring text or project cards
- autoplay audio

Default CSS posture:

```css
.liminal-aesthetic-layer {
  pointer-events: none;
  position: absolute;
  inset: 0;
  z-index: 0;
}

.liminal-content-above-layer {
  position: relative;
  z-index: 1;
}
```

---

## Signal Model

Raw PostHog activity becomes a neutral signal vector. This vector is not design yet.

```ts
export interface SiteSignalVector {
  /** Current activity/session volume, normalized 0-1. */
  attention: number;
  /** CTA/contact/project interaction strength, normalized 0-1. */
  intent: number;
  /** Scroll/session depth, normalized 0-1. */
  depth: number;
  /** Rage clicks, fast exits, errors, or other confusion signals, normalized 0-1. */
  friction: number;
  /** Returning visitors and long dwell, normalized 0-1. */
  returnWarmth: number;
  /** Referrer/path diversity and uncommon journeys, normalized 0-1. */
  novelty: number;
  /** Inactivity or quiet periods, normalized 0-1. */
  silence: number;
}
```

---

## Aesthetic Intent Model

The signal vector maps into aesthetic intent. This is where mission logic enters.

```ts
export interface AestheticIntent {
  calmness: number;
  clarity: number;
  warmth: number;
  motion: number;
  complexity: number;
  contrast: number;
  experimentalism: number;
}
```

Example policy:

- High `attention` increases `clarity` and `calmness`; it does not increase chaos.
- High `intent` suppresses CTA-adjacent effects and increases readability protection.
- High `friction` reduces motion and complexity, possibly freezing the layer.
- High `silence` allows slow ambient experimentation, not a broken or empty page.
- High `novelty` can increase palette variation or structural asymmetry within safe bounds.
- High `returnWarmth` can increase warmth, continuity, and memory-like motifs.

The important inversion: high traffic means more people are trying to understand and evaluate the company, so the layer should become more composed and trustworthy, not louder.

---

## Parameter Bounds

Raw metrics must never map linearly into extreme visuals. All outputs pass through bounded parameters.

```ts
export interface AestheticLayerConfig {
  paletteTemperature: number; // 0.25-0.75
  motionIntensity: number;    // 0.00-0.35 normally, lower near CTAs
  visualDensity: number;      // 0.10-0.45 normally
  textureStrength: number;    // 0.00-0.30
  contrastSupport: number;    // 0.60-1.00
  experimentalBias: number;   // 0.00-0.40 on production pages
  reducedMotion: boolean;
}
```

Production defaults should be conservative. The system may be alive, but it should not be overwhelming.

---

## Two-Speed System

The approved system should support both continuous modulation and periodic regeneration.

### Fast Loop: Breathing

Runs every few minutes or on a lightweight schedule.

```txt
recent PostHog data → SiteSignalVector → AestheticIntent → AestheticLayerConfig JSON
```

The deployed visual layer reads this small config file and adjusts safely within predefined ranges.

This creates continuous aliveness without replacing the artifact.

### Slow Loop: Molting

Runs daily, weekly, or manually at first.

```txt
signal history → Liminal generation/mutation → guardrail checks → deploy approved aesthetic layer
```

This creates larger aesthetic evolution, but only after validation.

---

## Guardrails

### Hard Guardrails

Never alter:

- page layout
- page copy
- navigation
- CTA text/location
- project card content
- forms
- link destinations
- SEO metadata
- existing PostHog initialization
- existing analytics event names
- conversion-critical DOM behavior

### Visual Guardrails

Before deploying a generated layer, verify:

- text remains readable
- CTAs remain visible and clickable
- layer does not intercept pointer events
- no excessive flashing
- no autoplay audio
- no large layout shift
- animation intensity is below threshold
- reduced-motion mode works
- mobile viewport remains stable
- bundle/asset size stays within limits
- failure hides the layer, not the page

### Mission Guardrails

Near high-intent surfaces such as contact forms, project cards, service copy, and CTAs:

- reduce motion
- reduce density
- preserve contrast
- suppress glitch/distortion
- prefer subtle ambience over interaction

---

## Existing Implementation Reuse

Keep and adapt:

- `src/analytics/PostHogClient.ts`
- `src/site/SlotManager.ts`
- `src/daemon/LivingSiteDaemon.ts`
- `src/cli/SiteCommand.ts`
- `src/utils/htmlWrapper.ts` PostHog injection support

Reframe or de-emphasize:

- `src/evolution/EngagementFitness.ts`
- `FitnessCombiner` engagement-as-winner behavior

Add:

- `PostHogSignalExtractor`
- `AestheticIntentMapper`
- `MissionGuardrails`
- `AestheticLayerConfig` types
- tests covering mission-safe transformations

---

## Success Criteria

The system is successful when:

1. Existing KyaniteLabs PostHog behavior remains untouched.
2. Liminal events and properties are separately namespaced.
3. Low traffic still produces meaningful but quiet aesthetic motion.
4. High traffic produces more clarity/composure, not more noise.
5. High-intent or high-friction signals reduce distraction.
6. The layer cannot break navigation, CTAs, forms, or content readability.
7. If anything fails, the site falls back to the normal static site.

---

## Summary

The living website is not an optimizer that lets analytics redesign the business site. It is a mission-safe atmospheric system. PostHog senses the site's recent behavioral weather; Liminal translates that weather into bounded aesthetic expression; guardrails ensure the commercial purpose of KyaniteLabs remains stable and clear.
