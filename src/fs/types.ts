export type SinterObjectKind =
  | 'generated-code'
  | 'gallery-version'
  | 'organism'
  | 'seed'
  | 'compost-fragment'
  | 'run'
  | 'trace'
  | 'evaluation'
  | 'asset'
  | 'task-candidate'
  | 'task-attempt'
  | 'session-turn'
  | 'archive-entry'
  | 'preference-event';

export interface SinterObjectRef {
  uri: string;
  hash?: string;
  kind: SinterObjectKind;
  path?: string;
}

export interface WriteArtifactInput {
  kind: SinterObjectKind;
  content: string | Buffer;
  filename: string;
  metadata?: Record<string, unknown>;
}

export interface SinterRunRecord {
  runId: string;
  prompt: string;
  project?: string;
  status: 'started' | 'completed' | 'failed' | 'suspended';
  artifacts?: SinterObjectRef[];
  metadata?: Record<string, unknown>;
}
