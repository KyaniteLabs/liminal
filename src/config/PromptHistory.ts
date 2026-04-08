import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { Logger } from '../utils/Logger.js';

interface HistoryEntry {
  prompt: string;
  timestamp: number;
}

interface HistoryData {
  recent: HistoryEntry[];
  favorites: string[];
}

const DEFAULT_HISTORY_PATH = path.join(os.homedir(), '.liminal', 'history.json');
const MAX_RECENT = 50;

export class PromptHistory {
  private filePath: string;

  constructor(filePath: string = DEFAULT_HISTORY_PATH) {
    this.filePath = filePath;
  }

  /**
   * Validate that data conforms to HistoryData structure
   */
  private isValidHistoryData(data: unknown): data is HistoryData {
    if (typeof data !== 'object' || data === null) return false;
    const obj = data as Record<string, unknown>;
    
    // Check recent array
    if (!Array.isArray(obj.recent)) return false;
    for (const entry of obj.recent) {
      if (typeof entry !== 'object' || entry === null) return false;
      const entryObj = entry as Record<string, unknown>;
      if (typeof entryObj.prompt !== 'string') return false;
      if (typeof entryObj.timestamp !== 'number') return false;
    }
    
    // Check favorites array
    if (!Array.isArray(obj.favorites)) return false;
    for (const fav of obj.favorites) {
      if (typeof fav !== 'string') return false;
    }
    
    return true;
  }

  /**
   * Load history from file
   */
  private async loadData(): Promise<HistoryData> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(content) as unknown;
      
      if (!this.isValidHistoryData(parsed)) {
        Logger.warn('PromptHistory', 'Invalid history data structure, using defaults');
        return { recent: [], favorites: [] };
      }
      
      return parsed;
    } catch (err) {
      Logger.warn('PromptHistory', 'Failed to load history, using defaults:', err);
      return { recent: [], favorites: [] };
    }
  }

  /**
   * Save history to file
   * @throws Error if save fails
   */
  private async saveData(data: HistoryData): Promise<void> {
    try {
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(this.filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to save prompt history: ${message}`, { cause: error });
    }
  }

  /**
   * Add a prompt to recent history
   */
  async add(prompt: string): Promise<void> {
    const data = await this.loadData();
    
    // Remove if already exists (will re-add at top)
    data.recent = data.recent.filter(e => e.prompt !== prompt);
    
    // Add to top
    data.recent.unshift({
      prompt,
      timestamp: Date.now()
    });
    
    // Trim to max
    if (data.recent.length > MAX_RECENT) {
      data.recent = data.recent.slice(0, MAX_RECENT);
    }
    
    await this.saveData(data);
  }

  /**
   * Get recent prompts (just strings)
   */
  async getRecent(limit: number = 10): Promise<string[]> {
    const data = await this.loadData();
    return data.recent.slice(0, limit).map(e => e.prompt);
  }

  /**
   * Get recent history entries with timestamps
   */
  async getEntries(limit: number = 10): Promise<HistoryEntry[]> {
    const data = await this.loadData();
    return data.recent.slice(0, limit);
  }

  /**
   * Add a prompt to favorites
   */
  async addFavorite(prompt: string): Promise<void> {
    const data = await this.loadData();
    if (!data.favorites.includes(prompt)) {
      data.favorites.push(prompt);
      await this.saveData(data);
    }
  }

  /**
   * Get all favorite prompts
   */
  async getFavorites(): Promise<string[]> {
    const data = await this.loadData();
    return data.favorites;
  }

  /**
   * Remove a prompt from favorites
   */
  async removeFavorite(prompt: string): Promise<void> {
    const data = await this.loadData();
    data.favorites = data.favorites.filter(f => f !== prompt);
    await this.saveData(data);
  }

}
