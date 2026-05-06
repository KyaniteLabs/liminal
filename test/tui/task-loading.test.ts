import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('TUI Task Loading', () => {
  const tasksDir = path.join(process.cwd(), 'harness-tasks');
  
  it('should load all M1-M8 tasks', () => {
    const taskFiles = fs.readdirSync(tasksDir)
      .filter(f => f.match(/^M[1-8]\.json$/));
    
    expect(taskFiles).toHaveLength(8);
    expect(taskFiles).toContain('M1.json');
    expect(taskFiles).toContain('M8.json');
  });
  
  it('should have valid task structure for each task', () => {
    for (let i = 1; i <= 8; i++) {
      const taskPath = path.join(tasksDir, `M${i}.json`);
      const task = JSON.parse(fs.readFileSync(taskPath, 'utf-8'));
      
      expect(task.id).toBe(`M${i}`);
      expect(task.title).not.toBeNull();
      expect(task.targetFile).not.toBeNull();
      expect(task.search).not.toBeNull();
      expect(task.replace).not.toBeNull();
      expect(task.verifyCommand).not.toBeNull();
    }
  });
  
  it('should reference existing target files', () => {
    for (let i = 1; i <= 8; i++) {
      const taskPath = path.join(tasksDir, `M${i}.json`);
      const task = JSON.parse(fs.readFileSync(taskPath, 'utf-8'));
      
      expect(fs.existsSync(task.targetFile)).toBe(true);
    }
  });
  
  it('should have valid risk levels', () => {
    const validRisks = ['low', 'medium', 'high'];
    
    for (let i = 1; i <= 8; i++) {
      const taskPath = path.join(tasksDir, `M${i}.json`);
      const task = JSON.parse(fs.readFileSync(taskPath, 'utf-8'));
      
      expect(validRisks).toContain(task.risk);
    }
  });
  
  it('should have approved flag set correctly', () => {
    for (let i = 1; i <= 8; i++) {
      const taskPath = path.join(tasksDir, `M${i}.json`);
      const task = JSON.parse(fs.readFileSync(taskPath, 'utf-8'));
      
      expect(task.approved === true || task.approved === false).toBe(true);
    }
  });
});
