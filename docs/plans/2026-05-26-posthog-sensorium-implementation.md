# PostHog Sensorium Implementation Plan

**Goal:** Convert the existing literal PostHog engagement loop into a mission-safe aesthetic sensorium where PostHog raw data drives bounded decorative Liminal output without disturbing existing KyaniteLabs analytics or conversion surfaces.

**Architecture:** Keep the current PostHog client, slot manager, daemon, and HTML injection work, but introduce a separate signal-to-aesthetic pipeline. Raw PostHog data becomes `SiteSignalVector`, then `AestheticIntent`, then bounded `AestheticLayerConfig`, then optional generation/deployment. `EngagementFitness` remains available for experiments but is no longer the core behavior.

**Tech Stack:** TypeScript, Vitest, existing Liminal evolution/render systems, `posthog-node`, existing CLI/daemon structure.

---

## Design Source

Read first:

- `docs/plans/2026-05-26-posthog-sensorium-design.md`
- `docs/plans/kyanitelabs-wiring-plan.md`

The newer `posthog-sensorium-design.md` overrides the earlier engagement/A-B framing.

---

## Implementation Rules

- Follow TDD for each component.
- Do not remove existing PostHog analytics behavior.
- Do not rename existing traditional analytics events.
- Prefix new Liminal analytics events with `liminal_`.
- Keep changes surgical; do not rewrite unrelated evolution systems.
- Prefer deterministic pure functions for signal mapping and guardrails.
- Generated aesthetic parameters must be bounded and mission-safe.

---

## Task 1: Add Sensorium Types

**Files:**
- Create: `src/site/SensoriumTypes.ts`
- Test: `test/unit/site/SensoriumTypes.test.ts`

**Step 1: Write failing tests**

Create `test/unit/site/SensoriumTypes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { clampSignalVector, DEFAULT_AESTHETIC_LAYER_CONFIG } from "../../../src/site/SensoriumTypes";

describe("SensoriumTypes", () => {
  it("clamps signal vector values to 0-1", () => {
    const result = clampSignalVector({
      attention: 2,
      intent: -1,
      depth: 0.5,
      friction: 0.25,
      returnWarmth: 1.5,
      novelty: -0.2,
      silence: 0.75,
    });

    expect(result).toEqual({
      attention: 1,
      intent: 0,
      depth: 0.5,
      friction: 0.25,
      returnWarmth: 1,
      novelty: 0,
      silence: 0.75,
    });
  });

  it("uses conservative production defaults", () => {
    expect(DEFAULT_AESTHETIC_LAYER_CONFIG.motionIntensity).toBeLessThanOrEqual(0.2);
    expect(DEFAULT_AESTHETIC_LAYER_CONFIG.visualDensity).toBeLessThanOrEqual(0.3);
    expect(DEFAULT_AESTHETIC_LAYER_CONFIG.contrastSupport).toBeGreaterThanOrEqual(0.75);
    expect(DEFAULT_AESTHETIC_LAYER_CONFIG.pointerEvents).toBe("none");
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run test/unit/site/SensoriumTypes.test.ts
```

Expected: FAIL because `SensoriumTypes` does not exist.

**Step 3: Implement minimal types**

Create `src/site/SensoriumTypes.ts`:

```ts
export interface SiteSignalVector {
  attention: number;
  intent: number;
  depth: number;
  friction: number;
  returnWarmth: number;
  novelty: number;
  silence: number;
}

export interface AestheticIntent {
  calmness: number;
  clarity: number;
  warmth: number;
  motion: number;
  complexity: number;
  contrast: number;
  experimentalism: number;
}

export interface AestheticLayerConfig {
  paletteTemperature: number;
  motionIntensity: number;
  visualDensity: number;
  textureStrength: number;
  contrastSupport: number;
  experimentalBias: number;
  reducedMotion: boolean;
  pointerEvents: "none" | "auto";
}

export const DEFAULT_AESTHETIC_LAYER_CONFIG: AestheticLayerConfig = {
  paletteTemperature: 0.5,
  motionIntensity: 0.15,
  visualDensity: 0.25,
  textureStrength: 0.12,
  contrastSupport: 0.85,
  experimentalBias: 0.15,
  reducedMotion: false,
  pointerEvents: "none",
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function clampSignalVector(vector: SiteSignalVector): SiteSignalVector {
  return {
    attention: clamp01(vector.attention),
    intent: clamp01(vector.intent),
    depth: clamp01(vector.depth),
    friction: clamp01(vector.friction),
    returnWarmth: clamp01(vector.returnWarmth),
    novelty: clamp01(vector.novelty),
    silence: clamp01(vector.silence),
  };
}

export function clampAestheticIntent(intent: AestheticIntent): AestheticIntent {
  return {
    calmness: clamp01(intent.calmness),
    clarity: clamp01(intent.clarity),
    warmth: clamp01(intent.warmth),
    motion: clamp01(intent.motion),
    complexity: clamp01(intent.complexity),
    contrast: clamp01(intent.contrast),
    experimentalism: clamp01(intent.experimentalism),
  };
}
```

**Step 4: Run test**

```bash
npx vitest run test/unit/site/SensoriumTypes.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/site/SensoriumTypes.ts test/unit/site/SensoriumTypes.test.ts
git commit -m "feat: add posthog sensorium types"
git push
```

---

## Task 2: Add Aesthetic Intent Mapper

**Files:**
- Create: `src/site/AestheticIntentMapper.ts`
- Test: `test/unit/site/AestheticIntentMapper.test.ts`

**Step 1: Write failing tests**

Create `test/unit/site/AestheticIntentMapper.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { AestheticIntentMapper } from "../../../src/site/AestheticIntentMapper";

describe("AestheticIntentMapper", () => {
  const mapper = new AestheticIntentMapper();

  it("maps high attention to calmer clearer output, not chaos", () => {
    const intent = mapper.mapSignalToIntent({
      attention: 1,
      intent: 0.4,
      depth: 0.5,
      friction: 0,
      returnWarmth: 0.3,
      novelty: 0.5,
      silence: 0,
    });

    expect(intent.clarity).toBeGreaterThanOrEqual(0.7);
    expect(intent.calmness).toBeGreaterThanOrEqual(0.6);
    expect(intent.motion).toBeLessThanOrEqual(0.45);
    expect(intent.complexity).toBeLessThanOrEqual(0.45);
  });

  it("maps high friction to reduced motion and complexity", () => {
    const intent = mapper.mapSignalToIntent({
      attention: 0.4,
      intent: 0.2,
      depth: 0.2,
      friction: 1,
      returnWarmth: 0,
      novelty: 0.3,
      silence: 0,
    });

    expect(intent.calmness).toBeGreaterThanOrEqual(0.75);
    expect(intent.motion).toBeLessThanOrEqual(0.2);
    expect(intent.complexity).toBeLessThanOrEqual(0.25);
  });

  it("allows quiet experimentation during silence", () => {
    const intent = mapper.mapSignalToIntent({
      attention: 0,
      intent: 0,
      depth: 0,
      friction: 0,
      returnWarmth: 0,
      novelty: 0.2,
      silence: 1,
    });

    expect(intent.experimentalism).toBeGreaterThan(0.25);
    expect(intent.motion).toBeLessThanOrEqual(0.35);
    expect(intent.clarity).toBeGreaterThanOrEqual(0.6);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run test/unit/site/AestheticIntentMapper.test.ts
```

Expected: FAIL because mapper does not exist.

**Step 3: Implement mapper**

Create `src/site/AestheticIntentMapper.ts`:

```ts
import { AestheticIntent, SiteSignalVector, clampAestheticIntent, clampSignalVector } from "./SensoriumTypes";

export class AestheticIntentMapper {
  mapSignalToIntent(input: SiteSignalVector): AestheticIntent {
    const signal = clampSignalVector(input);

    const calmness = 0.45
      + signal.attention * 0.25
      + signal.intent * 0.15
      + signal.friction * 0.35
      + signal.silence * 0.15
      - signal.novelty * 0.08;

    const clarity = 0.6
      + signal.attention * 0.2
      + signal.intent * 0.25
      + signal.friction * 0.15;

    const warmth = 0.35
      + signal.returnWarmth * 0.35
      + signal.depth * 0.15
      + signal.silence * 0.08;

    const motion = 0.28
      + signal.depth * 0.12
      + signal.novelty * 0.08
      - signal.attention * 0.12
      - signal.intent * 0.18
      - signal.friction * 0.35
      - signal.silence * 0.05;

    const complexity = 0.3
      + signal.novelty * 0.2
      + signal.depth * 0.08
      - signal.attention * 0.18
      - signal.intent * 0.15
      - signal.friction * 0.3;

    const contrast = 0.72
      + signal.intent * 0.2
      + signal.attention * 0.1
      + signal.friction * 0.08;

    const experimentalism = 0.12
      + signal.novelty * 0.25
      + signal.silence * 0.22
      - signal.intent * 0.18
      - signal.friction * 0.12;

    return clampAestheticIntent({
      calmness,
      clarity,
      warmth,
      motion,
      complexity,
      contrast,
      experimentalism,
    });
  }
}
```

**Step 4: Run tests**

```bash
npx vitest run test/unit/site/AestheticIntentMapper.test.ts test/unit/site/SensoriumTypes.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/site/AestheticIntentMapper.ts test/unit/site/AestheticIntentMapper.test.ts
git commit -m "feat: map posthog signals to aesthetic intent"
git push
```

---

## Task 3: Add Mission Guardrails / Config Bounds

**Files:**
- Create: `src/site/MissionGuardrails.ts`
- Test: `test/unit/site/MissionGuardrails.test.ts`

**Step 1: Write failing tests**

Create `test/unit/site/MissionGuardrails.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MissionGuardrails } from "../../../src/site/MissionGuardrails";

describe("MissionGuardrails", () => {
  const guardrails = new MissionGuardrails();

  it("turns aesthetic intent into bounded production-safe config", () => {
    const config = guardrails.toLayerConfig({
      calmness: 0,
      clarity: 0,
      warmth: 1,
      motion: 1,
      complexity: 1,
      contrast: 0,
      experimentalism: 1,
    });

    expect(config.motionIntensity).toBeLessThanOrEqual(0.35);
    expect(config.visualDensity).toBeLessThanOrEqual(0.45);
    expect(config.textureStrength).toBeLessThanOrEqual(0.3);
    expect(config.experimentalBias).toBeLessThanOrEqual(0.4);
    expect(config.contrastSupport).toBeGreaterThanOrEqual(0.6);
    expect(config.pointerEvents).toBe("none");
  });

  it("suppresses effects in high-intent contexts", () => {
    const config = guardrails.toLayerConfig({
      calmness: 0.5,
      clarity: 1,
      warmth: 0.5,
      motion: 1,
      complexity: 1,
      contrast: 1,
      experimentalism: 1,
    }, { highIntentSurface: true });

    expect(config.motionIntensity).toBeLessThanOrEqual(0.16);
    expect(config.visualDensity).toBeLessThanOrEqual(0.25);
    expect(config.experimentalBias).toBeLessThanOrEqual(0.12);
    expect(config.contrastSupport).toBeGreaterThanOrEqual(0.85);
  });

  it("honors reduced motion", () => {
    const config = guardrails.toLayerConfig({
      calmness: 0.2,
      clarity: 0.8,
      warmth: 0.5,
      motion: 1,
      complexity: 0.5,
      contrast: 0.8,
      experimentalism: 0.5,
    }, { reducedMotion: true });

    expect(config.reducedMotion).toBe(true);
    expect(config.motionIntensity).toBe(0);
  });
});
```

**Step 2: Run test to verify failure**

```bash
npx vitest run test/unit/site/MissionGuardrails.test.ts
```

Expected: FAIL because guardrails do not exist.

**Step 3: Implement guardrails**

Create `src/site/MissionGuardrails.ts`:

```ts
import { AestheticIntent, AestheticLayerConfig, clampAestheticIntent } from "./SensoriumTypes";

export interface MissionGuardrailContext {
  highIntentSurface?: boolean;
  reducedMotion?: boolean;
}

function clampRange(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export class MissionGuardrails {
  toLayerConfig(input: AestheticIntent, context: MissionGuardrailContext = {}): AestheticLayerConfig {
    const intent = clampAestheticIntent(input);

    const maxMotion = context.highIntentSurface ? 0.16 : 0.35;
    const maxDensity = context.highIntentSurface ? 0.25 : 0.45;
    const maxExperimental = context.highIntentSurface ? 0.12 : 0.4;
    const minContrast = context.highIntentSurface ? 0.85 : 0.6;

    const motionIntensity = context.reducedMotion
      ? 0
      : clampRange(intent.motion * (1 - intent.calmness * 0.35), 0, maxMotion);

    return {
      paletteTemperature: clampRange(0.35 + intent.warmth * 0.3, 0.25, 0.75),
      motionIntensity,
      visualDensity: clampRange(0.12 + intent.complexity * 0.33, 0.1, maxDensity),
      textureStrength: clampRange(0.06 + intent.experimentalism * 0.24, 0, 0.3),
      contrastSupport: clampRange(0.65 + intent.contrast * 0.35, minContrast, 1),
      experimentalBias: clampRange(intent.experimentalism, 0, maxExperimental),
      reducedMotion: Boolean(context.reducedMotion),
      pointerEvents: "none",
    };
  }
}
```

**Step 4: Run tests**

```bash
npx vitest run test/unit/site/MissionGuardrails.test.ts test/unit/site/AestheticIntentMapper.test.ts test/unit/site/SensoriumTypes.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/site/MissionGuardrails.ts test/unit/site/MissionGuardrails.test.ts
git commit -m "feat: bound sensorium output with mission guardrails"
git push
```

---

## Task 4: Add PostHog Signal Extractor

**Files:**
- Create: `src/analytics/PostHogSignalExtractor.ts`
- Test: `test/unit/analytics/PostHogSignalExtractor.test.ts`

**Step 1: Inspect current `PostHogClient`**

Read:

```bash
sed -n '1,220p' src/analytics/PostHogClient.ts
```

Use existing exported types/methods where possible. Do not rewrite the client unless required.

**Step 2: Write failing tests using simple raw event inputs**

Create `test/unit/analytics/PostHogSignalExtractor.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { PostHogSignalExtractor } from "../../../src/analytics/PostHogSignalExtractor";

describe("PostHogSignalExtractor", () => {
  const extractor = new PostHogSignalExtractor();

  it("extracts low traffic as silence without zeroing the creative signal", () => {
    const signal = extractor.fromEvents([], { windowMinutes: 60 });

    expect(signal.attention).toBe(0);
    expect(signal.silence).toBe(1);
    expect(signal.friction).toBe(0);
  });

  it("extracts intent from contact/project/cta events", () => {
    const signal = extractor.fromEvents([
      { event: "$pageview", timestamp: "2026-05-26T00:00:00Z", properties: { $pathname: "/" } },
      { event: "cta_clicked", timestamp: "2026-05-26T00:01:00Z", properties: { target: "contact" } },
      { event: "project_opened", timestamp: "2026-05-26T00:02:00Z", properties: { project: "liminal" } },
    ], { windowMinutes: 60 });

    expect(signal.attention).toBeGreaterThan(0);
    expect(signal.intent).toBeGreaterThanOrEqual(0.5);
    expect(signal.silence).toBeLessThan(1);
  });

  it("extracts friction from rage/error/quick-exit signals", () => {
    const signal = extractor.fromEvents([
      { event: "$pageview", timestamp: "2026-05-26T00:00:00Z", properties: {} },
      { event: "rage_click", timestamp: "2026-05-26T00:00:10Z", properties: {} },
      { event: "client_error", timestamp: "2026-05-26T00:00:12Z", properties: {} },
    ], { windowMinutes: 60 });

    expect(signal.friction).toBeGreaterThanOrEqual(0.5);
  });
});
```

**Step 3: Run test to verify failure**

```bash
npx vitest run test/unit/analytics/PostHogSignalExtractor.test.ts
```

Expected: FAIL because extractor does not exist.

**Step 4: Implement extractor**

Create `src/analytics/PostHogSignalExtractor.ts`:

```ts
import { SiteSignalVector, clampSignalVector } from "../site/SensoriumTypes";

export interface RawPostHogEvent {
  event: string;
  timestamp?: string;
  properties?: Record<string, unknown>;
}

export interface SignalExtractionOptions {
  windowMinutes: number;
  expectedEventsPerHour?: number;
}

const INTENT_PATTERNS = [/cta/i, /contact/i, /project/i, /hire/i, /book/i, /email/i];
const FRICTION_PATTERNS = [/rage/i, /error/i, /exception/i, /dead_click/i, /quick_exit/i];

function matchesAny(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function pathOf(event: RawPostHogEvent): string {
  const value = event.properties?.["$pathname"] ?? event.properties?.["pathname"] ?? event.properties?.["path"];
  return typeof value === "string" ? value : "";
}

function numberProp(event: RawPostHogEvent, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = event.properties?.[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return undefined;
}

export class PostHogSignalExtractor {
  fromEvents(events: RawPostHogEvent[], options: SignalExtractionOptions): SiteSignalVector {
    const expected = Math.max(1, options.expectedEventsPerHour ?? 20) * Math.max(1, options.windowMinutes) / 60;
    const count = events.length;

    const attention = Math.min(1, count / expected);
    const silence = 1 - attention;

    const intentEvents = events.filter((event) => {
      const haystack = `${event.event} ${pathOf(event)} ${JSON.stringify(event.properties ?? {})}`;
      return matchesAny(haystack, INTENT_PATTERNS);
    }).length;

    const frictionEvents = events.filter((event) => {
      const haystack = `${event.event} ${JSON.stringify(event.properties ?? {})}`;
      return matchesAny(haystack, FRICTION_PATTERNS);
    }).length;

    const scrollValues = events
      .map((event) => numberProp(event, ["scrollDepth", "scroll_depth", "$scroll_depth", "depth"]))
      .filter((value): value is number => typeof value === "number");

    const depth = scrollValues.length > 0
      ? scrollValues.reduce((sum, value) => sum + value, 0) / scrollValues.length
      : Math.min(1, events.filter((event) => event.event === "$pageview").length / Math.max(1, count));

    const returning = events.filter((event) => event.properties?.["$is_identified"] === true || event.properties?.["returning"] === true).length;
    const paths = new Set(events.map(pathOf).filter(Boolean));
    const referrers = new Set(events.map((event) => event.properties?.["$referring_domain"]).filter(Boolean));

    return clampSignalVector({
      attention,
      intent: count === 0 ? 0 : Math.min(1, intentEvents / Math.max(1, count * 0.4)),
      depth,
      friction: count === 0 ? 0 : Math.min(1, frictionEvents / Math.max(1, count * 0.3)),
      returnWarmth: count === 0 ? 0 : Math.min(1, returning / Math.max(1, count * 0.4)),
      novelty: Math.min(1, (paths.size + referrers.size) / 10),
      silence,
    });
  }
}
```

**Step 5: Run tests**

```bash
npx vitest run test/unit/analytics/PostHogSignalExtractor.test.ts test/unit/site/AestheticIntentMapper.test.ts test/unit/site/MissionGuardrails.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add src/analytics/PostHogSignalExtractor.ts test/unit/analytics/PostHogSignalExtractor.test.ts
git commit -m "feat: extract aesthetic signals from posthog events"
git push
```

---

## Task 5: Add End-to-End Sensorium Pipeline

**Files:**
- Create: `src/site/SensoriumPipeline.ts`
- Test: `test/unit/site/SensoriumPipeline.test.ts`

**Step 1: Write failing tests**

Create `test/unit/site/SensoriumPipeline.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SensoriumPipeline } from "../../../src/site/SensoriumPipeline";

describe("SensoriumPipeline", () => {
  it("turns raw events into mission-safe aesthetic config", () => {
    const pipeline = new SensoriumPipeline();
    const output = pipeline.fromEvents([
      { event: "$pageview", properties: { $pathname: "/" } },
      { event: "cta_clicked", properties: { target: "contact" } },
      { event: "project_opened", properties: { project: "liminal" } },
    ], { windowMinutes: 60, highIntentSurface: true });

    expect(output.signal.intent).toBeGreaterThan(0);
    expect(output.intent.clarity).toBeGreaterThanOrEqual(0.6);
    expect(output.config.pointerEvents).toBe("none");
    expect(output.config.motionIntensity).toBeLessThanOrEqual(0.16);
    expect(output.config.contrastSupport).toBeGreaterThanOrEqual(0.85);
  });
});
```

**Step 2: Run test to verify failure**

```bash
npx vitest run test/unit/site/SensoriumPipeline.test.ts
```

Expected: FAIL because pipeline does not exist.

**Step 3: Implement pipeline**

Create `src/site/SensoriumPipeline.ts`:

```ts
import { PostHogSignalExtractor, RawPostHogEvent, SignalExtractionOptions } from "../analytics/PostHogSignalExtractor";
import { AestheticIntentMapper } from "./AestheticIntentMapper";
import { MissionGuardrailContext, MissionGuardrails } from "./MissionGuardrails";
import { AestheticIntent, AestheticLayerConfig, SiteSignalVector } from "./SensoriumTypes";

export interface SensoriumPipelineOptions extends SignalExtractionOptions, MissionGuardrailContext {}

export interface SensoriumPipelineOutput {
  signal: SiteSignalVector;
  intent: AestheticIntent;
  config: AestheticLayerConfig;
}

export class SensoriumPipeline {
  constructor(
    private readonly extractor = new PostHogSignalExtractor(),
    private readonly mapper = new AestheticIntentMapper(),
    private readonly guardrails = new MissionGuardrails(),
  ) {}

  fromEvents(events: RawPostHogEvent[], options: SensoriumPipelineOptions): SensoriumPipelineOutput {
    const signal = this.extractor.fromEvents(events, options);
    const intent = this.mapper.mapSignalToIntent(signal);
    const config = this.guardrails.toLayerConfig(intent, options);
    return { signal, intent, config };
  }
}
```

**Step 4: Run tests**

```bash
npx vitest run test/unit/site/SensoriumPipeline.test.ts test/unit/analytics/PostHogSignalExtractor.test.ts test/unit/site/AestheticIntentMapper.test.ts test/unit/site/MissionGuardrails.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/site/SensoriumPipeline.ts test/unit/site/SensoriumPipeline.test.ts
git commit -m "feat: compose posthog sensorium pipeline"
git push
```

---

## Task 6: Reframe Daemon Behavior Without Deleting Existing Work

**Files:**
- Modify: `src/daemon/LivingSiteDaemon.ts`
- Test: `test/unit/daemon/LivingSiteDaemon.test.ts`

**Step 1: Inspect daemon**

Read:

```bash
sed -n '1,340p' src/daemon/LivingSiteDaemon.ts
```

Identify where it currently treats engagement/A-B results as the main loop.

**Step 2: Add tests for sensorium-first behavior**

Add tests to `test/unit/daemon/LivingSiteDaemon.test.ts` asserting:

- daemon can produce/update an aesthetic config from raw events
- daemon does not require minimum sample size for fast-loop config generation
- daemon preserves existing slot active/challenger state unless explicitly running slow regeneration

Use the existing daemon test style and mocks.

**Step 3: Implement minimal integration**

Add a method to `LivingSiteDaemon` similar to:

```ts
async updateAestheticLayerConfig(slotId: string): Promise<AestheticLayerConfig>
```

It should:

1. fetch recent raw PostHog events through `PostHogClient` or a mocked method added to it
2. pass events through `SensoriumPipeline`
3. write or return an `AestheticLayerConfig`
4. emit `liminal_signal_sampled` / `liminal_aesthetic_config_updated` events using prefixed names only

Do not remove existing engagement/challenger methods yet. Mark them as optional/slow-loop behavior in comments.

**Step 4: Run focused tests**

```bash
npx vitest run test/unit/daemon/LivingSiteDaemon.test.ts test/unit/site/SensoriumPipeline.test.ts test/unit/analytics/PostHogClient.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/daemon/LivingSiteDaemon.ts test/unit/daemon/LivingSiteDaemon.test.ts
git commit -m "feat: make living site daemon sensorium-first"
git push
```

---

## Task 7: Protect Existing PostHog Analytics in HTML Wrapper

**Files:**
- Modify: `src/utils/htmlWrapper.ts`
- Test: `test/unit/generation/HTMLWrapper.test.ts`

**Step 1: Inspect current PostHog injection**

Read:

```bash
grep -n "PostHog\|posthog\|injectPostHog" -n src/utils/htmlWrapper.ts
sed -n '260,330p' src/utils/htmlWrapper.ts
```

**Step 2: Add/adjust tests**

Add tests asserting:

- Liminal injection only happens when Liminal PostHog env/config is present.
- Liminal events are prefixed with `liminal_`.
- The injected snippet does not overwrite an existing `window.posthog` initialization if one already exists in the page.
- Layer load/failure events use names like `liminal_layer_loaded` / `liminal_layer_failed_safe`.

**Step 3: Implement minimal wrapper changes**

Prefer these behaviors:

- If page already has `posthog.init`, do not add a second global init.
- If using existing global `posthog`, only call `posthog.capture("liminal_layer_loaded", ...)` after checking it exists.
- If initializing separately is necessary, use a named instance or separate namespace rather than disrupting `window.posthog`.

**Step 4: Run focused tests**

```bash
npx vitest run test/unit/generation/HTMLWrapper.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/utils/htmlWrapper.ts test/unit/generation/HTMLWrapper.test.ts
git commit -m "fix: isolate liminal posthog layer analytics"
git push
```

---

## Task 8: Add Config File Writer for Fast Loop

**Files:**
- Create: `src/site/AestheticConfigWriter.ts`
- Test: `test/unit/site/AestheticConfigWriter.test.ts`

**Step 1: Write failing tests**

Test that writing a config:

- produces JSON with `signal`, `intent`, `config`, and `generatedAt`
- writes to a caller-provided path
- does not write outside the configured output directory

**Step 2: Implement writer**

Use existing filesystem helpers if present. Keep it simple:

```ts
export interface AestheticConfigDocument {
  generatedAt: string;
  slotId: string;
  signal: SiteSignalVector;
  intent: AestheticIntent;
  config: AestheticLayerConfig;
}
```

Add path containment validation to prevent accidental writes outside the asset/config directory.

**Step 3: Run tests**

```bash
npx vitest run test/unit/site/AestheticConfigWriter.test.ts
```

Expected: PASS.

**Step 4: Commit**

```bash
git add src/site/AestheticConfigWriter.ts test/unit/site/AestheticConfigWriter.test.ts
git commit -m "feat: write bounded aesthetic layer config"
git push
```

---

## Task 9: Update Documentation

**Files:**
- Modify: `docs/plans/kyanitelabs-wiring-plan.md`
- Create or Modify: `docs/kyanitelabs-liminal-sensorium.md`

**Step 1: Update old plan status**

At the top of `docs/plans/kyanitelabs-wiring-plan.md`, add a note:

```md
> Superseded direction: the literal A/B engagement-fitness loop has been reframed. See `docs/plans/2026-05-26-posthog-sensorium-design.md` and `docs/plans/2026-05-26-posthog-sensorium-implementation.md`. Engagement fitness remains optional slow-loop input, not the core model.
```

**Step 2: Add concise operator docs**

Create `docs/kyanitelabs-liminal-sensorium.md` explaining:

- the separation from existing PostHog analytics
- event naming rules
- signal → intent → config pipeline
- fast loop vs slow loop
- guardrails
- how to run focused tests

**Step 3: Run docs-adjacent tests/build**

```bash
npx tsc --noEmit
```

Expected: PASS.

**Step 4: Commit**

```bash
git add docs/plans/kyanitelabs-wiring-plan.md docs/kyanitelabs-liminal-sensorium.md docs/plans/2026-05-26-posthog-sensorium-design.md docs/plans/2026-05-26-posthog-sensorium-implementation.md
git commit -m "docs: document posthog sensorium architecture"
git push
```

---

## Task 10: Final Verification

**Files:**
- No new files unless fixes are required.

**Step 1: Run focused sensorium suite**

```bash
npx vitest run \
  test/unit/site/SensoriumTypes.test.ts \
  test/unit/site/AestheticIntentMapper.test.ts \
  test/unit/site/MissionGuardrails.test.ts \
  test/unit/site/SensoriumPipeline.test.ts \
  test/unit/site/AestheticConfigWriter.test.ts \
  test/unit/analytics/PostHogSignalExtractor.test.ts \
  test/unit/daemon/LivingSiteDaemon.test.ts \
  test/unit/generation/HTMLWrapper.test.ts
```

Expected: PASS.

**Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no output and exit code 0.

**Step 3: Run full test suite if time allows**

```bash
npx vitest run
```

Expected: all tests pass.

**Step 4: Review diff**

```bash
git diff --stat origin/main...HEAD
git diff --name-only origin/main...HEAD
```

Expected: only sensorium-related files and existing Liminal/PostHog integration files changed.

**Step 5: Final commit if any fixes remain**

```bash
git add <changed-files>
git commit -m "test: verify posthog sensorium pipeline"
git push
```

---

## Execution Notes

The first implementation pass should avoid live PostHog API complexity. Build the pure transformation pipeline first and test it with raw event fixtures. Only then wire daemon fetching/writing.

Do not chase a perfect autonomous website in this pass. The goal is to make the architecture safe, explicit, and testable so future Liminal generation can use it without becoming counterproductive.
