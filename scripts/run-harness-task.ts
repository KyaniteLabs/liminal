#!/usr/bin/env node
/**
 * Run Harness Task - Execute a self-improvement task
 * 
 * Usage: npx tsx scripts/run-harness-task.ts <task-id>
 * Example: npx tsx scripts/run-harness-task.ts M1
 */

import { createHarnessAgent, type AgentTask } from '../src/harness/index.js';
import { metaHarness } from '../src/harness/index.js';
import fs from 'node:fs/promises';
import path from 'node:path';

async function loadTask(taskId: string): Promise<AgentTask | null> {
  const taskPath = path.join(process.cwd(), 'harness-tasks', `${taskId}.json`);
  
  try {
    const content = await fs.readFile(taskPath, 'utf-8');
    const task = JSON.parse(content);
    return {
      ...task,
      approved: true, // Auto-approve for now
    };
  } catch (error) {
    console.error(`Failed to load task ${taskId}:`, error);
    return null;
  }
}

async function main() {
  const taskId = process.argv[2];
  
  if (!taskId) {
    console.log('Usage: npx tsx scripts/run-harness-task.ts <task-id>');
    console.log('Example: npx tsx scripts/run-harness-task.ts M1');
    console.log('\nAvailable tasks:');
    
    // List available tasks
    try {
      const tasksDir = path.join(process.cwd(), 'harness-tasks');
      const files = await fs.readdir(tasksDir);
      files.filter(f => f.endsWith('.json')).forEach(f => {
        console.log(`  - ${f.replace('.json', '')}`);
      });
    } catch {
      console.log('  (No tasks found)');
    }
    
    process.exit(1);
  }
  
  // Initialize meta-harness
  metaHarness.initialize();
  
  const llmClient = metaHarness.getLLMClient();
  if (!llmClient) {
    console.error('No LLM configured. Set LIMINAL_LLM_BASE_URL or provider API key.');
    process.exit(1);
  }
  
  // Load task
  const task = await loadTask(taskId);
  if (!task) {
    console.error(`Task ${taskId} not found`);
    process.exit(1);
  }
  
  console.log(`\n========================================`);
  console.log(`Running Harness Task: ${task.title}`);
  console.log(`========================================\n`);
  
  // Create agent and execute
  const agent = createHarnessAgent(llmClient);
  const session = await agent.executeTask(task, {
    maxSteps: 10,
    timeoutMs: 300000,
    autoRollback: true,
  });
  
  console.log(`\n========================================`);
  console.log(`Task ${taskId}: ${session.status.toUpperCase()}`);
  console.log(`========================================`);
  console.log(`Steps executed: ${session.steps.length}`);
  
  if (session.endTime && session.startTime) {
    const duration = new Date(session.endTime).getTime() - new Date(session.startTime).getTime();
    console.log(`Duration: ${duration}ms`);
  }
  
  // Print step details
  if (session.steps.length > 0) {
    console.log('\nExecution log:');
    for (const step of session.steps) {
      const icon = step.result.success ? '✓' : '✗';
      console.log(`  ${icon} ${step.tool} (${step.result.duration || 0}ms)`);
      if (step.result.error) {
        console.log(`    Error: ${step.result.error.slice(0, 100)}...`);
      }
    }
  }
  
  // Exit with appropriate code
  process.exit(session.status === 'success' ? 0 : 1);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
