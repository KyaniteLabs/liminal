export type LiminalObjectKind =
  | 'generated-code'
  | 'gallery-version'
  | 'seed'
  | 'compost-fragment'
  | 'run'
  | 'trace'
  | 'evaluation'
  | 'asset';

export interface LiminalObjectRef {
  uri: string;
  hash?: string;
  kind: LiminalObjectKind;
  path?: string;
}

export interface WriteArtifactInput {
  kind: LiminalObjectKind;
  content: string | Buffer;
  filename: string;
  metadata?: Record<string, unknown>;
}

export interface LiminalRunRecord {
  runId: string;
  prompt: string;
  project?: string;
  status: 'started' | 'completed' | 'failed' | 'suspended';
  artifacts?: LiminalObjectRef[];
  metadata?: Record<string, unknown>;
}
