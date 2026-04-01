/**
 * HarnessMemory - Persistent Memory for LIMINAL Meta-Harness
 * 
 * Stores across sessions:
 * - Tasks attempted (M1-M8 and beyond)
 * - Adaptations applied (what was fixed, when, outcome)
 * - Conversations and episodes (user interactions, generations)
 * - Pattern history (detected patterns, their frequency)
 * 
 * Location: ~/.liminal/memory/
 */

import { promises as fs } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// Task tracking
export interface HarnessTask {
  id: string;
  type: 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'M6' | 'M7' | 'M8' | 'M9' | 'M10' | 'M11' | 'custom';
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
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

// Complete memory state
export interface HarnessMemoryState {
  version: number;
  lastUpdated: string;
  tasks: HarnessTask[];
  adaptations: AdaptationRecord[];
  episodes: MemoryEpisode[];
  patterns: PatternHistory[];
  stats: {
    totalGenerations: number;
    totalConversations: number;
    totalFailures: number;
    totalAdaptations: number;
  };
}

const MEMORY_VERSION = 1;
const DEFAULT_STATE: HarnessMemoryState = {
  version: MEMORY_VERSION,
  lastUpdated: new Date().toISOString(),
  tasks: [],
  adaptations: [],
  episodes: [],
  patterns: [],
  stats: {
    totalGenerations: 0,
    totalConversations: 0,
    totalFailures: 0,
    totalAdaptations: 0,
  },
};

export class HarnessMemory {
  private state: HarnessMemoryState;
  private memoryDir: string;
  private memoryFile: string;
  private dirty = false;
  private saveInterval?: NodeJS.Timeout;

  constructor() {
    this.memoryDir = join(homedir(), '.liminal', 'memory');
    this.memoryFile = join(this.memoryDir, 'harness-memory.json');
    this.state = { ...DEFAULT_STATE };
  }

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
        console.log(`[HarnessMemory] Loaded ${this.state.tasks.length} tasks, ${this.state.adaptations.length} adaptations, ${this.state.episodes.length} episodes`);
      } catch (err) {
        // File doesn't exist, use defaults
        console.log('[HarnessMemory] No previous memory found, starting fresh');
        this.state = { ...DEFAULT_STATE };
        await this.save();
      }

      // Auto-save every 30 seconds if dirty
      this.saveInterval = setInterval(() => {
        if (this.dirty) {
          this.save().catch(console.error);
        }
      }, 30000);

    } catch (err) {
      console.error('[HarnessMemory] Initialization failed:', err);
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
      this.state.lastUpdated = new Date().toISOString();
      await fs.writeFile(
        this.memoryFile,
        JSON.stringify(this.state, null, 2),
        'utf-8'
      );
      this.dirty = false;
    } catch (err) {
      console.error('[HarnessMemory] Save failed:', err);
    }
  }

  /**
   * Migrate old memory formats
   */
  private migrate(loaded: any): HarnessMemoryState {
    if (!loaded.version || loaded.version < MEMORY_VERSION) {
      // Migration logic for future versions
      loaded.version = MEMORY_VERSION;
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
      status: 'in_progress',
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
    return this.state.tasks.filter(t => t.status === 'pending');
  }

  /**
   * Get incomplete tasks (pending or in_progress)
   */
  getIncompleteTasks(): HarnessTask[] {
    return this.state.tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');
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
    lastUpdated: string;
  } {
    return {
      initialized: true,
      tasksTotal: this.state.tasks.length,
      tasksPending: this.state.tasks.filter(t => t.status === 'pending').length,
      tasksInProgress: this.state.tasks.filter(t => t.status === 'in_progress').length,
      tasksCompleted: this.state.tasks.filter(t => t.status === 'completed').length,
      adaptationsTotal: this.state.adaptations.length,
      adaptationsSuccessful: this.state.adaptations.filter(a => a.success).length,
      episodesTotal: this.state.episodes.length,
      patternsTracked: this.state.patterns.length,
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
