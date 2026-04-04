import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { AgentTask } from '../../src/harness/agent/HarnessAgent.js';

/**
 * Simulates the task loading logic from HarnessTUI.tsx
 */
async function loadTasksFromDirectory(): Promise<AgentTask[]> {
  try {
    const dir = path.join(process.cwd(), 'harness-tasks');
    const files = await fs.readdir(dir);
    const loaded: AgentTask[] = [];
    
    for (const f of files.filter(f => f.endsWith('.json'))) {
      const content = await fs.readFile(path.join(dir, f), 'utf-8');
      const parsed = JSON.parse(content);
      loaded.push({ ...parsed, approved: true });
    }
    
    return loaded;
  } catch (error) {
    return [];
  }
}

describe('TUI Integration - Task Loading', () => {
  it('should load all M1-M8 tasks from harness-tasks directory', async () => {
    const tasks = await loadTasksFromDirectory();
    
    // Verify we loaded at least 8 tasks
    expect(tasks.length).toBeGreaterThanOrEqual(8);
    
    // Verify M1-M8 all exist
    const taskIds = tasks.map(t => t.id);
    expect(taskIds).toContain('M1');
    expect(taskIds).toContain('M2');
    expect(taskIds).toContain('M3');
    expect(taskIds).toContain('M4');
    expect(taskIds).toContain('M5');
    expect(taskIds).toContain('M6');
    expect(taskIds).toContain('M7');
    expect(taskIds).toContain('M8');
  });
  
  it('should set approved flag to true for all loaded tasks', async () => {
    const tasks = await loadTasksFromDirectory();
    
    for (const task of tasks) {
      expect(task.approved).toBe(true);
    }
  });
  
  it('should load tasks with correct AgentTask structure', async () => {
    const tasks = await loadTasksFromDirectory();
    const mTasks = tasks.filter(t => t.id.match(/^M[1-8]$/));
    
    for (const task of mTasks) {
      // Required fields
      expect(task.id).toBeDefined();
      expect(typeof task.id).toBe('string');
      
      expect(task.title).toBeDefined();
      expect(typeof task.title).toBe('string');
      
      expect(task.description).toBeDefined();
      expect(typeof task.description).toBe('string');
      
      expect(task.approved).toBeDefined();
      expect(typeof task.approved).toBe('boolean');
      
      // Optional fields that should be present for harness tasks
      expect(task.targetFile).toBeDefined();
      expect(typeof task.targetFile).toBe('string');
      
      expect(task.search).toBeDefined();
      expect(typeof task.search).toBe('string');
      
      expect(task.replace).toBeDefined();
      expect(typeof task.replace).toBe('string');
      
      expect(task.verifyCommand).toBeDefined();
      expect(typeof task.verifyCommand).toBe('string');
    }
  });
  
  it('should load tasks that match their filenames', async () => {
    const tasks = await loadTasksFromDirectory();
    const mTasks = tasks.filter(t => t.id.match(/^M[1-8]$/));
    
    for (const task of mTasks) {
      // Task ID should match the filename pattern
      const expectedFileName = `${task.id}.json`;
      const taskPath = path.join(process.cwd(), 'harness-tasks', expectedFileName);
      
      // Verify file exists
      const stat = await fs.stat(taskPath);
      expect(stat.isFile()).toBe(true);
    }
  });
  
  it('should handle missing directory gracefully', async () => {
    // Save original cwd
    const originalCwd = process.cwd();
    
    // Temporarily change to a directory without harness-tasks
    process.chdir('/tmp');
    
    const tasks = await loadTasksFromDirectory();
    expect(tasks).toEqual([]);
    
    // Restore cwd
    process.chdir(originalCwd);
  });
});
