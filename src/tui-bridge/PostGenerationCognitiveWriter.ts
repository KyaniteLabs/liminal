import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Logger } from '../utils/Logger.js';
import { harnessMemory } from '../harness/HarnessMemory.js';
import { DreamQueue, type DreamStrategy } from '../dreaming/DreamQueue.js';

export interface CognitiveOrganReceipt {
  organ: string;
  status: 'observed' | 'pending' | 'unavailable';
  detail: string;
}

interface MemoryStore {
  initialize(): Promise<void>;
  getRelevantEpisodesByDomain(query: string, domain: string, k?: number): Promise<unknown[]>;
  recordEpisode(episode: {
    type: 'generation';
    domain?: string;
    prompt?: string;
    code?: string;
    score?: number;
    comment?: string;
    tags?: string[];
  }): string;
  save(): Promise<{ isErr(): boolean; error?: { message?: string } }>;
}

interface CompostSink {
  add(inputPaths: string[]): Promise<void>;
}

interface DreamSink {
  enqueue(strategy: DreamStrategy, sources: Array<{ id: string; descriptor: number[]; quality: number }>, priority: number): string | undefined;
}

export interface PostGenerationCognitiveWriterOptions {
  memory?: MemoryStore;
  compost?: CompostSink;
  dreamQueue?: DreamSink;
  artifactRoot?: string;
}

export interface PrepareGenerationContext {
  sessionId: string;
  userText: string;
  domain: string;
}

export interface CompletedGenerationContext extends PrepareGenerationContext {
  code: string;
  finalScore: number;
  iterations: number;
  model: string;
  reason: string;
  executionMode: 'draft' | 'prove';
}

export interface CognitiveWriteBackResult {
  artifactPath: string;
  episodeId?: string;
  receipts: CognitiveOrganReceipt[];
}

const initializedMemories = new WeakMap<MemoryStore, Promise<void>>();
const inertCompostLlm = {
  generate(): Promise<{ code: string; success: boolean }> {
    return Promise.resolve({ code: '', success: false });
  },
};

export class PostGenerationCognitiveWriter {
  private readonly memory: MemoryStore;
  private readonly dreamQueue: DreamSink;
  private readonly artifactRoot: string;
  private compost?: CompostSink;

  constructor(options: PostGenerationCognitiveWriterOptions = {}) {
    this.memory = options.memory ?? harnessMemory;
    this.dreamQueue = options.dreamQueue ?? new DreamQueue();
    this.compost = options.compost;
    this.artifactRoot = options.artifactRoot ?? path.join(process.cwd(), '.omx', 'proof', 'live-cognition');
  }

  async prepareGeneration(context: PrepareGenerationContext): Promise<CognitiveOrganReceipt[]> {
    try {
      await this.ensureMemoryReady();
      const episodes = await this.memory.getRelevantEpisodesByDomain(context.userText, context.domain, 3);
      const noun = episodes.length === 1 ? 'episode' : 'episodes';
      return [{
        organ: 'memory',
        status: 'observed',
        detail: `Retrieved ${episodes.length} relevant prior generation ${noun} for ${context.domain}.`,
      }];
    } catch (error) {
      return [{
        organ: 'memory',
        status: 'unavailable',
        detail: `Memory retrieval failed: ${this.errorMessage(error)}`,
      }];
    }
  }

  async writeBackGeneration(context: CompletedGenerationContext): Promise<CognitiveWriteBackResult> {
    const artifactPath = await this.writeArtifact(context);
    const receipts: CognitiveOrganReceipt[] = [];
    let episodeId: string | undefined;

    try {
      await this.ensureMemoryReady();
      episodeId = this.memory.recordEpisode({
        type: 'generation',
        domain: context.domain,
        prompt: context.userText,
        code: context.code,
        score: context.finalScore,
        comment: `${context.reason} (${context.iterations} iteration(s))`,
        tags: ['studio', 'tui-bridge', `execution:${context.executionMode}`, `model:${context.model}`],
      });
      const saveResult = await this.memory.save();
      if (saveResult.isErr()) throw new Error(saveResult.error?.message ?? 'memory save failed');
      receipts.push({ organ: 'memory', status: 'observed', detail: `Stored generation episode ${episodeId} for future retrieval.` });
    } catch (error) {
      receipts.push({ organ: 'memory', status: 'unavailable', detail: `Memory write-back failed: ${this.errorMessage(error)}` });
    }

    try {
      await (await this.getCompostSink()).add([artifactPath]);
      receipts.push({ organ: 'compost', status: 'observed', detail: `Added generated artifact to compost heap: ${artifactPath}` });
    } catch (error) {
      receipts.push({ organ: 'compost', status: 'unavailable', detail: `Compost write-back failed: ${this.errorMessage(error)}` });
    }

    try {
      const sourceId = episodeId ?? path.basename(artifactPath);
      const dreamId = this.dreamQueue.enqueue('elite-x-compost', [{
        id: sourceId,
        descriptor: this.estimateDescriptor(context),
        quality: context.finalScore,
      }], Math.max(0, Math.min(1, context.finalScore)));
      const detail = dreamId
        ? `Queued dream recombination task ${dreamId} from episode ${sourceId}.`
        : 'Dream queue is full; no recombination task was queued.';
      receipts.push({ organ: 'dreaming', status: dreamId ? 'observed' : 'pending', detail });
    } catch (error) {
      receipts.push({ organ: 'dreaming', status: 'unavailable', detail: `Dream enqueue failed: ${this.errorMessage(error)}` });
    }

    return { artifactPath, episodeId, receipts };
  }

  private async ensureMemoryReady(): Promise<void> {
    let init = initializedMemories.get(this.memory);
    if (!init) {
      init = this.memory.initialize().catch((error) => {
        initializedMemories.delete(this.memory);
        throw error;
      });
      initializedMemories.set(this.memory, init);
    }
    await init;
  }

  private async getCompostSink(): Promise<CompostSink> {
    if (!this.compost) {
      const { CompostMill } = await import('../compost/CompostMill.js');
      this.compost = new CompostMill(inertCompostLlm, {
        soupEnabled: false,
        heapDir: path.join(process.cwd(), '.omx', 'compost', 'heap'),
        digestDir: path.join(process.cwd(), '.omx', 'compost', 'digest'),
        seedDir: path.join(process.cwd(), '.omx', 'compost', 'seeds'),
      });
    }
    return this.compost;
  }

  private async writeArtifact(context: CompletedGenerationContext): Promise<string> {
    const safeSession = context.sessionId.replace(/[^a-zA-Z0-9_-]/g, '-');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const ext = this.extensionForDomain(context.domain, context.code);
    const dir = path.join(this.artifactRoot, safeSession);
    const filePath = path.join(dir, `${context.domain}-${stamp}${ext}`);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, context.code, 'utf8');
    return filePath;
  }

  private extensionForDomain(domain: string, code: string): string {
    if (domain === 'svg') return '.svg';
    if (/^\s*</.test(code)) return '.html';
    if (domain === 'glsl' || domain === 'shader' || domain === 'webgl') return '.glsl';
    if (domain === 'strudel') return '.strudel';
    if (domain === 'tone' || domain === 'p5' || domain === 'three' || domain === 'hydra') return '.js';
    return '.txt';
  }

  private estimateDescriptor(context: CompletedGenerationContext): number[] {
    const normalizedLength = Math.min(1, context.code.length / 12000);
    const motion = /\b(draw|animate|requestAnimationFrame|osc\(|rotate|loop)\b/i.test(context.code) ? 0.8 : 0.25;
    const density = Math.min(1, (context.code.match(/[{}();,<>=]/g)?.length ?? 0) / 800);
    return [context.finalScore, normalizedLength, motion, density];
  }

  private errorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    Logger.warn('PostGenerationCognitiveWriter', message);
    return message;
  }
}
