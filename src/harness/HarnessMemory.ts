/**
 * HarnessMemory - Persistent Memory for LIMINAL Meta-Harness
 * 
 * Stores across sessions:
 * - Tasks attempted (M1-M8 and beyond)
 * - Adaptations applied (what was fixed, when, outcome)
 * - Conversations and episodes (user interactions, generations)
 * - Pattern history (detected patterns, their frequency)
 * - Calibration data (scoring weights per domain)
 * 
 * Location: ~/.liminal/memory/
 */

import { promises as fs } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { Logger } from '../utils/Logger.js';
import { Status } from '../types/status.js';
import type { CalibrationWeights, CalibrationData } from '../calibration/CalibrationSuite.js';
import { getGlobalEmbeddingService } from '../embeddings/EmbeddingService.js';
import { findKNearestNeighbors } from '../utils/vectors.js';

// Task tracking
export interface HarnessTask {
  id: string;
  type: 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'M6' | 'M7' | 'M8' | 'M9' | 'M10' | 'M11' | 'custom';
  description: string;
  status: Status.PENDING | Status.IN_PROGRESS | Status.COMPLETED | Status.FAILED | Status.SKIPPED;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  outcome?: string;
  artifacts?: string[]; // Files created/modified
}

// Adaptation record
export interface AdaptationRecord {
  id: string;
  patternName: string;
  patternSeverity: 'low' | 'medium' | 'high' | 'critical';
  fixType: 'prompt' | 'template' | 'guardrail' | 'config' | 'code';
  targetFile?: string;
  description: string;
  appliedAt: string;
  success: boolean;
  error?: string;
  diff?: string; // What changed
}

// Episode for conversations/generations
export interface MemoryEpisode {
  id: string;
  type: 'conversation' | 'generation' | 'feedback' | 'command';
  timestamp: string;
  domain?: string;
  prompt?: string;
  code?: string;
  score?: number;
  comment?: string;
  tags?: string[];
  /** Embedding vector for semantic retrieval (set lazily) */
  embedding?: number[];
}

// Pattern occurrence tracking
export interface PatternHistory {
  patternName: string;
  firstSeen: string;
  lastSeen: string;
  occurrences: number;
  affectedDomains: string[];
  resolution?: string;
}

// Calibration data storage
export interface CalibrationRecord {
  domain: string;
  weights: CalibrationWeights;
  correlation: number;
  sampleCount: number;
  calibratedAt: string;
  version: number;
}

// Complete memory state
export interface HarnessMemoryState {
  version: number;
  lastUpdated: string;
  tasks: HarnessTask[];
  adaptations: AdaptationRecord[];
  episodes: MemoryEpisode[];
  patterns: PatternHistory[];
  calibration: CalibrationRecord[];
  stats: {
    totalGenerations: number;
    totalConversations: number;
    totalFailures: number;
    totalAdaptations: number;
    totalCalibrations: number;
  };
}

const MEMORY_VERSION = 2; // Incremented for calibration support
const DEFAULT_STATE: HarnessMemoryState = {
  version: MEMORY_VERSION,
  lastUpdated: new Date().toISOString(),
  tasks: [],
  adaptations: [],
  episodes: [],
  patterns: [],
  calibration: [],
  stats: {
    totalGenerations: 0,
    totalConversations: 0,
    totalFailures: 0,
    totalAdaptations: 0,
    totalCalibrations: 0,
  },
};

export class HarnessMemory {
  private state: HarnessMemoryState;
  private memoryDir: string;
  private memoryFile: string;
  // private calibrationFile: string; // Reserved for future use
  private dirty = false;
  private lastSaveFailed = false;
  private saveInterval?: NodeJS.Timeout;

  constructor() {
    this.memoryDir = join(homedir(), '.liminal', 'memory');
    this.memoryFile = join(this.memoryDir, 'harness-memory.json');
    // this.calibrationFile = join(this.memoryDir, 'calibration-data.json'); // Reserved for future use
    this.state = { ...DEFAULT_STATE };
  }

  /** Check if the last save operation failed. */
  get hasSaveError(): boolean { return this.lastSaveFailed; }

  /**
   * Initialize memory - load from disk or create fresh
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.memoryDir, { recursive: true });
      
      try {
        const content = await fs.readFile(this.memoryFile, 'utf-8');
        const loaded = JSON.parse(content);
        
        // Migrate if needed
        this.state = this.migrate(loaded);
        Logger.debug('HarnessMemory', `Loaded ${this.state.tasks.length} tasks, ${this.state.adaptations.length} adaptations, ${this.state.episodes.length} episodes, ${this.state.calibration.length} calibrations`);
      } catch (err: any) {
        if (err?.code === 'ENOENT') {
          // File doesn't exist — expected on first run
          Logger.debug('HarnessMemory', 'No previous memory found, starting fresh');
        } else {
          // Corrupted or unreadable file — log as warning, start fresh
          Logger.warn('HarnessMemory', `Memory file unreadable, starting fresh: ${err instanceof Error ? err.message : err}`);
        }
        this.state = { ...DEFAULT_STATE };
        await this.save();
      }

      // Auto-save every 30 seconds if dirty
      this.saveInterval = setInterval(() => {
        if (this.dirty) {
          this.save().catch((err) => Logger.warn('HarnessMemory', `Auto-save failed: ${err}`));
        }
      }, 30000);

    } catch (err) {
      Logger.error('HarnessMemory', `Initialization failed: ${err}`);
      this.state = { ...DEFAULT_STATE };
    }
  }

  /**
   * Shutdown - ensure all data is saved
   */
  async shutdown(): Promise<void> {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
    }
    if (this.dirty) {
      await this.save();
    }
  }

  /**
   * Save state to disk
   */
  async save(): Promise<void> {
    try {
      this.lastSaveFailed = false;
      this.state.lastUpdated = new Date().toISOString();
      await fs.writeFile(
        this.memoryFile,
        JSON.stringify(this.state, null, 2),
        'utf-8'
      );
      this.dirty = false;
    } catch (err) {
      this.lastSaveFailed = true;
      Logger.error('HarnessMemory', `Save failed: ${err}`);
    }
  }

  /**
   * Migrate old memory formats
   */
  private migrate(loaded: any): HarnessMemoryState {
    if (!loaded.version || loaded.version < MEMORY_VERSION) {
      // Migration logic for future versions
      loaded.version = MEMORY_VERSION;
      
      // Ensure calibration array exists
      if (!loaded.calibration) {
        loaded.calibration = [];
      }
      
      // Ensure totalCalibrations stat exists
      if (!loaded.stats) {
        loaded.stats = { ...DEFAULT_STATE.stats };
      }
      if (loaded.stats.totalCalibrations === undefined) {
        loaded.stats.totalCalibrations = 0;
      }
    }
    return {
      ...DEFAULT_STATE,
      ...loaded,
    };
  }

  // ==================== Task Operations ====================

  /**
   * Record a task starting
   */
  startTask(task: Omit<HarnessTask, 'id' | 'status' | 'startedAt'>): string {
    const id = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newTask: HarnessTask = {
      ...task,
      id,
      status: Status.IN_PROGRESS,
      startedAt: new Date().toISOString(),
    };
    this.state.tasks.push(newTask);
    this.dirty = true;
    return id;
  }

  /**
   * Update task status
   */
  completeTask(id: string, outcome: { status: HarnessTask['status']; error?: string; outcome?: string; artifacts?: string[] }): void {
    const task = this.state.tasks.find(t => t.id === id);
    if (task) {
      task.status = outcome.status;
      task.completedAt = new Date().toISOString();
      if (outcome.error) task.error = outcome.error;
      if (outcome.outcome) task.outcome = outcome.outcome;
      if (outcome.artifacts) task.artifacts = outcome.artifacts;
      this.dirty = true;
    }
  }

  /**
   * Get all tasks
   */
  getTasks(): HarnessTask[] {
    return [...this.state.tasks];
  }

  /**
   * Get pending tasks
   */
  getPendingTasks(): HarnessTask[] {
    return this.state.tasks.filter(t => t.status === Status.PENDING);
  }

  /**
   * Get incomplete tasks (pending or in_progress)
   */
  getIncompleteTasks(): HarnessTask[] {
    return this.state.tasks.filter(t => t.status === Status.PENDING || t.status === Status.IN_PROGRESS);
  }

  /**
   * Get tasks by type
   */
  getTasksByType(type: HarnessTask['type']): HarnessTask[] {
    return this.state.tasks.filter(t => t.type === type);
  }

  // ==================== Adaptation Operations ====================

  /**
   * Record an adaptation
   */
  recordAdaptation(adaptation: Omit<AdaptationRecord, 'id' | 'appliedAt'>): string {
    const id = `adapt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const record: AdaptationRecord = {
      ...adaptation,
      id,
      appliedAt: new Date().toISOString(),
    };
    this.state.adaptations.push(record);
    this.state.stats.totalAdaptations++;
    this.dirty = true;
    return id;
  }

  /**
   * Get all adaptations
   */
  getAdaptations(): AdaptationRecord[] {
    return [...this.state.adaptations];
  }

  /**
   * Get successful adaptations
   */
  getSuccessfulAdaptations(): AdaptationRecord[] {
    return this.state.adaptations.filter(a => a.success);
  }

  /**
   * Get adaptations for a pattern
   */
  getAdaptationsForPattern(patternName: string): AdaptationRecord[] {
    return this.state.adaptations.filter(a => a.patternName === patternName);
  }

  // ==================== Episode Operations ====================

  /**
   * Record an episode
   */
  recordEpisode(episode: Omit<MemoryEpisode, 'id' | 'timestamp'>): string {
    const id = `ep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const record: MemoryEpisode = {
      ...episode,
      id,
      timestamp: new Date().toISOString(),
    };
    this.state.episodes.push(record);
    
    if (episode.type === 'generation') {
      this.state.stats.totalGenerations++;
    } else if (episode.type === 'conversation') {
      this.state.stats.totalConversations++;
    }
    
    this.dirty = true;
    return id;
  }

  /**
   * Get recent episodes
   */
  getRecentEpisodes(limit: number = 50): MemoryEpisode[] {
    return [...this.state.episodes]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  /**
   * Get episodes by type
   */
  getEpisodesByType(type: MemoryEpisode['type']): MemoryEpisode[] {
    return this.state.episodes.filter(e => e.type === type);
  }

  /**
   * Get episodes by domain
   */
  getEpisodesByDomain(domain: string): MemoryEpisode[] {
    return this.state.episodes.filter(e => e.domain === domain);
  }

  // ==================== Semantic Retrieval (Embedding-based RAG) ====================

  /**
   * Retrieve the most relevant past episodes for a given prompt using
   * embedding-based cosine similarity (semantic retrieval).
   *
   * This replaces chronological loading with meaning-based retrieval:
   * instead of "last 50 episodes", it returns the K episodes whose
   * prompts are most semantically similar to the current prompt.
   *
   * Falls back to chronological retrieval if embeddings are unavailable.
   */
  async getRelevantEpisodes(query: string, k: number = 5): Promise<MemoryEpisode[]> {
    const episodes = this.state.episodes.filter(e => e.prompt && e.prompt.length > 0);

    if (episodes.length === 0) {
      return [];
    }

    // Fewer episodes than k — return all
    if (episodes.length <= k) {
      return episodes;
    }

    try {
      const embeddingService = getGlobalEmbeddingService();
      await embeddingService.initialize();

      // Embed the query
      const queryResult = await embeddingService.embed(query);
      const queryVec = queryResult.vector;

      // Embed any episodes that don't have embeddings yet (lazy embedding)
      const unembedded = episodes.filter(e => !e.embedding);
      if (unembedded.length > 0) {
        // Batch embed (limit to most recent 100 to avoid huge batches)
        const toEmbed = unembedded.slice(-100);
        for (const episode of toEmbed) {
          if (episode.prompt) {
            const result = await embeddingService.embed(episode.prompt);
            episode.embedding = result.vector;
          }
        }
        this.dirty = true;
      }

      // Collect episodes with embeddings
      const embedded: Array<{ episode: MemoryEpisode; vector: number[] }> = [];
      for (const ep of episodes) {
        if (ep.embedding) {
          embedded.push({ episode: ep, vector: ep.embedding });
        }
      }

      if (embedded.length === 0) {
        // Fallback: no embeddings available
        return this.getRecentEpisodes(k);
      }

      // Find K nearest neighbors by cosine similarity
      const vectors = embedded.map(e => e.vector);
      const neighborIndices = findKNearestNeighbors(queryVec, vectors, k);

      return neighborIndices.map(idx => embedded[idx].episode);
    } catch (error) {
      // Embedding service unavailable — fall back to chronological
      Logger.warn('HarnessMemory', `Semantic retrieval failed, using chronological fallback: ${error}`);
      return this.getRecentEpisodes(k);
    }
  }

  /**
   * Get relevant episodes filtered by domain (semantic retrieval within a domain).
   */
  async getRelevantEpisodesByDomain(
    query: string,
    domain: string,
    k: number = 5,
  ): Promise<MemoryEpisode[]> {
    const domainEpisodes = this.getEpisodesByDomain(domain).filter(e => e.prompt && e.prompt.length > 0);

    if (domainEpisodes.length <= k) {
      return domainEpisodes;
    }

    try {
      const embeddingService = getGlobalEmbeddingService();
      await embeddingService.initialize();

      const queryResult = await embeddingService.embed(query);
      const queryVec = queryResult.vector;

      // Lazy embed
      const unembedded = domainEpisodes.filter(e => !e.embedding);
      if (unembedded.length > 0) {
        for (const episode of unembedded.slice(-50)) {
          if (episode.prompt) {
            const result = await embeddingService.embed(episode.prompt);
            episode.embedding = result.vector;
          }
        }
        this.dirty = true;
      }

      const embedded: Array<{ episode: MemoryEpisode; vector: number[] }> = [];
      for (const ep of domainEpisodes) {
        if (ep.embedding) {
          embedded.push({ episode: ep, vector: ep.embedding });
        }
      }

      if (embedded.length === 0) {
        return domainEpisodes.slice(-k);
      }

      const vectors = embedded.map(e => e.vector);
      const neighborIndices = findKNearestNeighbors(queryVec, vectors, k);

      return neighborIndices.map(idx => embedded[idx].episode);
    } catch (err) {
      Logger.warn('HarnessMemory', 'Embedding similarity failed, falling back to chronological order:', err);
      return domainEpisodes.slice(-k);
    }
  }

  // ==================== Pattern Operations ====================

  /**
   * Record a pattern occurrence
   */
  recordPatternOccurrence(patternName: string, domain: string): void {
    const existing = this.state.patterns.find(p => p.patternName === patternName);
    
    if (existing) {
      existing.lastSeen = new Date().toISOString();
      existing.occurrences++;
      if (!existing.affectedDomains.includes(domain)) {
        existing.affectedDomains.push(domain);
      }
    } else {
      this.state.patterns.push({
        patternName,
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        occurrences: 1,
        affectedDomains: [domain],
      });
    }
    
    this.dirty = true;
  }

  /**
   * Get pattern history
   */
  getPatternHistory(): PatternHistory[] {
    return [...this.state.patterns];
  }

  /**
   * Get frequent patterns
   */
  getFrequentPatterns(minOccurrences: number = 3): PatternHistory[] {
    return this.state.patterns
      .filter(p => p.occurrences >= minOccurrences)
      .sort((a, b) => b.occurrences - a.occurrences);
  }

  // ==================== Calibration Operations ====================

  /**
   * Store calibration data for a domain
   */
  recordCalibration(
    domain: string,
    weights: CalibrationWeights,
    correlation: number,
    sampleCount: number,
  ): void {
    const existingIndex = this.state.calibration.findIndex(c => c.domain === domain);
    const record: CalibrationRecord = {
      domain,
      weights,
      correlation,
      sampleCount,
      calibratedAt: new Date().toISOString(),
      version: 1,
    };

    if (existingIndex >= 0) {
      this.state.calibration[existingIndex] = record;
    } else {
      this.state.calibration.push(record);
      this.state.stats.totalCalibrations++;
    }

    this.dirty = true;
  }

  /**
   * Get calibration data for a domain
   */
  getCalibration(domain: string): CalibrationRecord | undefined {
    return this.state.calibration.find(c => c.domain === domain);
  }

  /**
   * Get all calibration data
   */
  getAllCalibrations(): CalibrationRecord[] {
    return [...this.state.calibration];
  }

  /**
   * Get calibrated domains
   */
  getCalibratedDomains(): string[] {
    return this.state.calibration.map(c => c.domain);
  }

  /**
   * Check if a domain has been calibrated
   */
  isCalibrated(domain: string): boolean {
    return this.state.calibration.some(c => c.domain === domain);
  }

  /**
   * Get calibration weights for a domain
   */
  getCalibrationWeights(domain: string): CalibrationWeights | undefined {
    const record = this.state.calibration.find(c => c.domain === domain);
    return record?.weights;
  }

  /**
   * Clear calibration for a domain (or all domains)
   */
  clearCalibration(domain?: string): void {
    if (domain) {
      this.state.calibration = this.state.calibration.filter(c => c.domain !== domain);
    } else {
      this.state.calibration = [];
      this.state.stats.totalCalibrations = 0;
    }
    this.dirty = true;
  }

  /**
   * Serialize calibration data for external storage
   */
  serializeCalibration(): CalibrationData {
    const weights: Record<string, CalibrationWeights> = {};
    const lastCalibrated: Record<string, number> = {};

    for (const record of this.state.calibration) {
      weights[record.domain] = record.weights;
      lastCalibrated[record.domain] = new Date(record.calibratedAt).getTime();
    }

    return {
      version: 1,
      sessions: [], // Sessions are stored separately
      currentWeights: weights,
      lastCalibrated,
    };
  }

  // ==================== Stats & Status ====================

  /**
   * Get memory stats
   */
  getStats(): HarnessMemoryState['stats'] {
    return { ...this.state.stats };
  }

  /**
   * Get full status
   */
  getStatus(): {
    initialized: boolean;
    tasksTotal: number;
    tasksPending: number;
    tasksInProgress: number;
    tasksCompleted: number;
    adaptationsTotal: number;
    adaptationsSuccessful: number;
    episodesTotal: number;
    patternsTracked: number;
    calibrationsTotal: number;
    calibratedDomains: number;
    lastUpdated: string;
  } {
    return {
      initialized: true,
      tasksTotal: this.state.tasks.length,
      tasksPending: this.state.tasks.filter(t => t.status === Status.PENDING).length,
      tasksInProgress: this.state.tasks.filter(t => t.status === Status.IN_PROGRESS).length,
      tasksCompleted: this.state.tasks.filter(t => t.status === Status.COMPLETED).length,
      adaptationsTotal: this.state.adaptations.length,
      adaptationsSuccessful: this.state.adaptations.filter(a => a.success).length,
      episodesTotal: this.state.episodes.length,
      patternsTracked: this.state.patterns.length,
      calibrationsTotal: this.state.stats.totalCalibrations,
      calibratedDomains: this.state.calibration.length,
      lastUpdated: this.state.lastUpdated,
    };
  }

  /**
   * Get full state (for debugging)
   */
  getState(): HarnessMemoryState {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Clear all memory (use with caution)
   */
  async clear(): Promise<void> {
    this.state = { ...DEFAULT_STATE };
    this.dirty = true;
    await this.save();
  }
}

// Singleton instance
export const harnessMemory = new HarnessMemory();
