# Liminal Shared Artifact Contracts

## Purpose

Studio, Sites, and Instrument need shared contracts so they do not become
incompatible product islands.

## Product Flow

```text
Studio artifact
-> Site artifact
-> human-reviewed site change
```

```text
Studio artifact
-> Instrument preset
-> performance session
-> Studio ingestion
```

## Shared Provenance

```ts
export interface LiminalProvenance {
  artifactId: string;
  parentArtifactId?: string;
  repo?: string;
  commit?: string;
  prompt: string;
  modelProvider?: string;
  modelName?: string;
  generatedAt: string;
  generatedBy: "studio" | "sites" | "instrument" | "codex" | "manual";
  receipts: LiminalReceipt[];
}

export interface LiminalReceipt {
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
export interface LiminalArtifact {
  id: string;
  title: string;
  domain: LiminalDomain;
  files: LiminalFile[];
  preview?: PreviewTarget;
  controls?: LiminalControlPort[];
  provenance: LiminalProvenance;
  createdAt: string;
  updatedAt: string;
}
```

## Control Ports

Control ports are the common surface for Sites skins and Instrument mappings.

```ts
export interface LiminalControlPort {
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
export interface LiminalSiteArtifact {
  id: string;
  baseArtifactId?: string;
  siteProfileId: string;
  skinSpec?: SkinSpec;
  patchPlan?: SitePatchPlan;
  aestheticTags: string[];
  previewReceipt?: LiminalReceipt;
  provenance: LiminalProvenance;
}
```

## Instrument Preset

```ts
export interface LiminalInstrumentPreset {
  id: string;
  baseArtifactId?: string;
  name: string;
  renderer: "glsl" | "p5" | "three" | "hydra" | "canvas";
  files: LiminalFile[];
  controls: LiminalControlPort[];
  mappings: InstrumentMapping[];
  lyricSidecar?: LyricSidecarConfig;
  provenance: LiminalProvenance;
}
```

## Performance Session

```ts
export interface InstrumentSession {
  id: string;
  presetIds: string[];
  startedAt: string;
  endedAt?: string;
  audioFile?: string;
  videoFile?: string;
  telemetryFile: string;
  phraseEventsFile?: string;
  performerNotes?: string;
  provenance: LiminalProvenance;
}
```

## Review Action Rule

Any mutation to a user repo, deployed site, or saved canonical artifact requires
a review action.

```ts
export interface ReviewAction {
  id: string;
  kind:
    | "apply_site_skin"
    | "open_site_pr"
    | "export_instrument_preset"
    | "ingest_session"
    | "promote_phrase"
    | "discard_variant";
  summary: string;
  risk: "low" | "medium" | "high";
  requiresConfirmation: boolean;
}
```

No silent mutation.
