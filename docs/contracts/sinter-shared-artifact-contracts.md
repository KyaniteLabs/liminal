# Sinter Shared Artifact Contracts

Status: Phase 1 baseline
Schema: `sinter.shared-artifact`
Schema version: `2026-05-25.phase1`

## Purpose

Sinter Core/Studio, Sinter Sites, and Sinter Instrument need a shared contract
so they do not drift into incompatible systems. Core/Studio authors aesthetic
artifacts. Sites specializes them for aesthetic webpage evolution. Instrument
specializes them for live performance and can send session evidence back to
Core/Studio.

## Enforcement

Run the Phase 1 validator:

```bash
pnpm check:sinter-contracts
```

The validator checks the fixtures in `docs/contracts/fixtures/`, compares the
domain map against the current runtime unions in `src/composition/types.ts` and
`src/core/validators/types.ts`, and writes proof to
`.omx/proof/sinter-shared-artifact-contracts.json`.

This contract is not yet a generated TypeScript package. It is still a merge gate
for imports that claim shared artifact compatibility.

## Versioning Rules

- `2026-05-25.phase1` is fixture-validated but not yet generated into runtime
  types.
- Additive fields are allowed when old artifacts still validate conceptually.
- Required-field changes need a new schema version and migration note.
- Product-specific extensions belong in product-specific objects, not in the
  base artifact unless both sibling products need them.
- Executable validators must keep at least one fixture for each product surface:
  Core/Studio, Sites, and Instrument.

## Domain Mapping

Shared contract domains deliberately map to the current runtime vocabulary rather
than pretending the vocabularies already match.

| Shared domain | Composition domain | Validator domain | Scope | Notes |
| --- | --- | --- | --- | --- |
| `p5` | `p5` | `p5` | artifact | Direct match. |
| `svg` | `html` | `svg` | artifact | Composition currently renders standalone SVG through HTML-like surface. |
| `glsl` | `shader` | `glsl` | artifact | Generator/validator name is GLSL; composition name is shader. |
| `three` | `three` | `three` | artifact | Direct match. |
| `hydra` | `hydra` | `hydra` | artifact | Direct match. |
| `strudel` | `strudel` | `strudel` | artifact | Direct match. |
| `tone` | `tone` | `tone` | artifact | Direct match; `music` remains a broader runtime alias. |
| `revideo` | `video` | `revideo` | artifact | Composition treats Revideo as video. |
| `hyperframes` | `html` | `hyperframes` | artifact | Current runtime handles this as an HTML-ish preview surface. |
| `ascii` | `ascii` | `ascii` | artifact | Direct match. |
| `kinetic` | `html` | `kinetic` | artifact | Current runtime handles this as an HTML-ish preview surface. |
| `textgen` | `textgen` | `unknown` | artifact | Validator union has no textgen validator yet; importers must not invent one. |
| `site` | `html` | `html` | product-specialization | Site artifacts specialize web output. |
| `instrument` | `group` | `unknown` | product-specialization | Instrument presets are composite contracts, not a single current validator domain. |

## Shared Provenance

```ts
export interface SinterProvenance {
  artifactId: string;
  parentArtifactId?: string;
  repo?: string;
  commit?: string;
  prompt: string;
  modelProvider?: string;
  modelName?: string;
  generatedAt: string;
  generatedBy: "studio" | "sites" | "instrument" | "codex" | "manual";
  receipts: SinterReceipt[];
}

export interface SinterReceipt {
  id: string;
  kind:
    | "generation"
    | "evaluation"
    | "preview"
    | "export"
    | "safety"
    | "aesthetic"
    | "performance"
    | "telemetry";
  path?: string;
  summary: string;
  createdAt: string;
}
```

## Base Artifact

```ts
export interface SinterArtifact {
  schema: "sinter.shared-artifact";
  schemaVersion: "2026-05-25.phase1";
  id: string;
  title: string;
  domain: SinterDomain;
  files: SinterFile[];
  preview?: PreviewTarget;
  controls?: SinterControlPort[];
  provenance: SinterProvenance;
  createdAt: string;
  updatedAt: string;
}

export type SinterDomain =
  | "p5"
  | "svg"
  | "glsl"
  | "three"
  | "hydra"
  | "strudel"
  | "tone"
  | "revideo"
  | "hyperframes"
  | "ascii"
  | "kinetic"
  | "textgen"
  | "site"
  | "instrument";

export interface SinterFile {
  path: string;
  role: "source" | "style" | "script" | "asset" | "manifest" | "receipt";
  mimeType?: string;
  sha256?: string;
}

export interface PreviewTarget {
  kind: "html" | "image" | "video" | "audio" | "live";
  path?: string;
  url?: string;
}
```

## Control Ports

Control ports are shared because Sites and Instrument both need controllable
aesthetic systems.

```ts
export interface SinterControlPort {
  id: string;
  label: string;
  type: "number" | "boolean" | "trigger" | "color" | "vector2" | "vector3" | "text";
  min?: number;
  max?: number;
  defaultValue?: unknown;
  description?: string;
  smoothingMs?: number;
  exposedToSites?: boolean;
  exposedToInstrument?: boolean;
}
```

## Site Artifact

```ts
export interface SinterSiteArtifact {
  schema: "sinter.shared-site-artifact";
  schemaVersion: "2026-05-25.phase1";
  id: string;
  baseArtifactId?: string;
  siteProfileId: string;
  skinSpec?: SkinSpec;
  patchPlan?: SitePatchPlan;
  aestheticTags: string[];
  previewReceipt?: SinterReceipt;
  provenance: SinterProvenance;
}

export interface SkinSpec {
  id: string;
  name: string;
  paletteId?: string;
  motionProfile?: "still" | "subtle" | "expressive";
  cssFiles?: SinterFile[];
  scriptFiles?: SinterFile[];
}

export interface SitePatchPlan {
  id: string;
  repo: string;
  targetBranch?: string;
  summary: string;
  files: SinterFile[];
  reviewActionId: string;
}
```

## Instrument Preset

```ts
export interface SinterInstrumentPreset {
  schema: "sinter.shared-instrument-preset";
  schemaVersion: "2026-05-25.phase1";
  id: string;
  baseArtifactId?: string;
  name: string;
  renderer: "glsl" | "p5" | "three" | "hydra" | "canvas";
  files: SinterFile[];
  controls: SinterControlPort[];
  mappings: InstrumentMapping[];
  lyricSidecar?: LyricSidecarConfig;
  provenance: SinterProvenance;
}

export interface InstrumentMapping {
  id: string;
  input: "voice" | "pitch" | "amplitude" | "camera" | "movement" | "controller" | "clock";
  feature: string;
  controlPortId: string;
  transform?: "linear" | "log" | "curve" | "trigger";
}

export interface LyricSidecarConfig {
  enabled: boolean;
  sourcePath?: string;
  mode: "phrase" | "line" | "section";
}
```

## Performance Session

```ts
export interface InstrumentSession {
  schema: "sinter.shared-instrument-session";
  schemaVersion: "2026-05-25.phase1";
  id: string;
  presetIds: string[];
  startedAt: string;
  endedAt?: string;
  audioFile?: string;
  videoFile?: string;
  telemetryFile: string;
  phraseEventsFile?: string;
  performerNotes?: string;
  provenance: SinterProvenance;
}
```

## Review Actions

```ts
export interface ReviewAction {
  schema: "sinter.review-action";
  schemaVersion: "2026-05-25.phase1";
  id: string;
  kind:
    | "apply_site_skin"
    | "open_site_pr"
    | "export_instrument_preset"
    | "ingest_session"
    | "promote_phrase"
    | "discard_variant";
  status: "proposed" | "approved" | "rejected" | "applied" | "discarded";
  summary: string;
  target: ReviewActionTarget;
  risk: "low" | "medium" | "high";
  requiresConfirmation: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
  executionReceiptId?: string;
}

export interface ReviewActionTarget {
  kind: "repo" | "deployed_site" | "artifact" | "instrument_preset" | "session";
  id?: string;
  repo?: string;
  branch?: string;
  path?: string;
  artifactId?: string;
  url?: string;
}
```

Any mutation to a user repo, deployed site, or saved canonical artifact requires a
review action. No silent mutation.

Mutating actions require `requiresConfirmation: true` and `status: "approved"`
before execution. `executionReceiptId` should be attached after the action runs.

## Example Studio Artifact

```json
{
  "schema": "sinter.shared-artifact",
  "schemaVersion": "2026-05-25.phase1",
  "id": "artifact_studio_moon_garden_001",
  "title": "Moon Garden",
  "domain": "p5",
  "files": [
    {
      "path": "artifacts/moon-garden/sketch.js",
      "role": "source",
      "mimeType": "text/javascript"
    }
  ],
  "controls": [
    {
      "id": "firefly_density",
      "label": "Firefly density",
      "type": "number",
      "min": 0,
      "max": 1,
      "defaultValue": 0.4,
      "exposedToSites": true,
      "exposedToInstrument": true
    }
  ],
  "provenance": {
    "artifactId": "artifact_studio_moon_garden_001",
    "prompt": "Create a quiet moonlit garden with slow luminous motion.",
    "generatedAt": "2026-05-25T05:15:25Z",
    "generatedBy": "studio",
    "receipts": [
      {
        "id": "receipt_generation_001",
        "kind": "generation",
        "summary": "Generated p5 sketch and control surface.",
        "createdAt": "2026-05-25T05:15:25Z"
      }
    ]
  },
  "createdAt": "2026-05-25T05:15:25Z",
  "updatedAt": "2026-05-25T05:15:25Z"
}
```

## Example Site Specialization

```json
{
  "schema": "sinter.shared-site-artifact",
  "schemaVersion": "2026-05-25.phase1",
  "id": "site_artifact_moon_garden_skin_001",
  "baseArtifactId": "artifact_studio_moon_garden_001",
  "siteProfileId": "moon-garden-site",
  "aestheticTags": ["luminous", "quiet", "organic", "slow-motion"],
  "patchPlan": {
    "id": "patch_plan_moon_garden_001",
    "repo": "KyaniteLabs/liminal-sites",
    "summary": "Apply approved moon garden skin after preview review.",
    "files": [
      {
        "path": "sites/moon-garden/skin.css",
        "role": "style",
        "mimeType": "text/css"
      }
    ],
    "reviewActionId": "review_open_site_pr_001"
  },
  "provenance": {
    "artifactId": "site_artifact_moon_garden_skin_001",
    "parentArtifactId": "artifact_studio_moon_garden_001",
    "prompt": "Adapt Moon Garden into a living website skin.",
    "generatedAt": "2026-05-25T05:15:25Z",
    "generatedBy": "sites",
    "receipts": []
  }
}
```

## Example Instrument Preset

```json
{
  "schema": "sinter.shared-instrument-preset",
  "schemaVersion": "2026-05-25.phase1",
  "id": "instrument_preset_moon_garden_001",
  "baseArtifactId": "artifact_studio_moon_garden_001",
  "name": "Moon Garden Voice Field",
  "renderer": "p5",
  "files": [
    {
      "path": "presets/moon-garden/sketch.js",
      "role": "source",
      "mimeType": "text/javascript"
    }
  ],
  "controls": [
    {
      "id": "firefly_density",
      "label": "Firefly density",
      "type": "number",
      "min": 0,
      "max": 1,
      "defaultValue": 0.4,
      "smoothingMs": 80,
      "exposedToInstrument": true
    }
  ],
  "mappings": [
    {
      "id": "mapping_voice_amplitude_density",
      "input": "amplitude",
      "feature": "rms",
      "controlPortId": "firefly_density",
      "transform": "linear"
    }
  ],
  "provenance": {
    "artifactId": "instrument_preset_moon_garden_001",
    "parentArtifactId": "artifact_studio_moon_garden_001",
    "prompt": "Turn Moon Garden into a voice-reactive performance preset.",
    "generatedAt": "2026-05-25T05:15:25Z",
    "generatedBy": "instrument",
    "receipts": []
  }
}
```

## Example Review Actions

```json
[
  {
    "schema": "sinter.review-action",
    "schemaVersion": "2026-05-25.phase1",
    "id": "review_open_site_pr_001",
    "kind": "open_site_pr",
    "status": "approved",
    "summary": "Open a reviewed PR that applies the Moon Garden skin to the site.",
    "target": {
      "kind": "repo",
      "repo": "KyaniteLabs/liminal-sites",
      "branch": "codex/moon-garden-skin"
    },
    "risk": "medium",
    "requiresConfirmation": true,
    "reviewedBy": "owner",
    "reviewedAt": "2026-05-25T05:50:25Z"
  },
  {
    "schema": "sinter.review-action",
    "schemaVersion": "2026-05-25.phase1",
    "id": "review_export_instrument_preset_001",
    "kind": "export_instrument_preset",
    "status": "approved",
    "summary": "Export the Moon Garden Voice Field preset after preview rehearsal.",
    "target": {
      "kind": "instrument_preset",
      "artifactId": "instrument_preset_moon_garden_001"
    },
    "risk": "low",
    "requiresConfirmation": true,
    "reviewedBy": "owner",
    "reviewedAt": "2026-05-25T05:51:25Z"
  },
  {
    "schema": "sinter.review-action",
    "schemaVersion": "2026-05-25.phase1",
    "id": "review_ingest_session_001",
    "kind": "ingest_session",
    "status": "approved",
    "summary": "Ingest performance telemetry into Studio memory after performer review.",
    "target": {
      "kind": "session",
      "id": "instrument_session_moon_garden_001"
    },
    "risk": "medium",
    "requiresConfirmation": true,
    "reviewedBy": "owner",
    "reviewedAt": "2026-05-25T05:52:25Z"
  }
]
```

## Acceptance Checks

- Every artifact has provenance.
- Every generated or evaluated step can attach receipts.
- Site mutation paths point to review actions.
- Instrument session ingestion points to review actions when it changes canonical
  memory or artifacts.
- Mutating review actions have `requiresConfirmation: true` and `status:
  "approved"` before execution.
- Realtime Instrument loops can ignore provenance and AI sidecars during the live
  frame loop, then attach receipts after the session.
