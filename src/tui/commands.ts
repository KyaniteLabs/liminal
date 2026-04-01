/**
 * TUI Commands - Command palette for Meta-Harness
 * 
 * Pattern: Claw Code command inventory
 * Commands are discoverable, documented, and executable
 */

import type { HarnessAgent, AgentTask } from '../harness/index.js';

export interface CommandContext {
  agent: HarnessAgent;
  tasks: AgentTask[];
  logs: string[];
  addLog: (msg: string) => void;
  setStatusMessage: (msg: string) => void;
}

export interface Command {
  name: string;
  description: string;
  usage: string;
  aliases?: string[];
  execute: (args: string[], ctx: CommandContext) => Promise<string>;
}

export const commands: Record<string, Command> = {
  help: {
    name: 'help',
    description: 'Show available commands',
    usage: '/help [command]',
    execute: async (args) => {
      if (args[0] && commands[args[0]]) {
        const cmd = commands[args[0]];
        return `${cmd.name}: ${cmd.description}\nUsage: ${cmd.usage}`;
      }
      return Object.values(commands)
        .map(c => `  /${c.name.padEnd(12)} ${c.description}`)
        .join('\n');
    }
  },

  status: {
    name: 'status',
    description: 'Show harness status',
    usage: '/status',
    execute: async (_args, _ctx) => {
      const { metaHarness } = await import('../harness/index.js');
      const status = metaHarness.getStatus();
      return [
        `Harness: ${status.initialized ? 'Online' : 'Offline'}`,
        `Provider: ${status.activeProvider}`,
        `Failures: ${status.recentFailures}`,
        `Patterns: ${status.detectedPatterns.length}`,
        `Adaptations: ${status.appliedAdaptations.length}`,
      ].join('\n');
    }
  },

  tasks: {
    name: 'tasks',
    description: 'List pending tasks',
    usage: '/tasks',
    execute: async (_args, ctx) => {
      if (ctx.tasks.length === 0) return 'No pending tasks';
      return ctx.tasks.map(t => 
        `  ${t.id.padEnd(8)} ${t.title.slice(0, 40)}${t.title.length > 40 ? '...' : ''}`
      ).join('\n');
    }
  },

  run: {
    name: 'run',
    description: 'Execute a task by ID',
    usage: '/run <task-id>',
    execute: async (args, ctx) => {
      const taskId = args[0];
      if (!taskId) return 'Error: Task ID required. Usage: /run <task-id>';
      
      const task = ctx.tasks.find((t: AgentTask) => t.id === taskId);
      if (!task) return `Error: Task ${taskId} not found`;
      
      ctx.setStatusMessage(`Running ${taskId}...`);
      ctx.addLog(`Starting task ${taskId}`);
      
      const session = await ctx.agent.executeTask(task);
      
      ctx.addLog(`Task ${taskId}: ${session.status}`);
      ctx.setStatusMessage('Ready');
      
      return `Task ${taskId}: ${session.status.toUpperCase()}\nSteps: ${session.steps.length}\nDuration: ${session.endTime ? new Date(session.endTime).getTime() - new Date(session.startTime).getTime() : 0}ms`;
    }
  },

  clear: {
    name: 'clear',
    description: 'Clear the screen',
    usage: '/clear',
    execute: async () => {
      return '\x1Bc';
    }
  },

  exit: {
    name: 'exit',
    description: 'Exit the TUI',
    usage: '/exit',
    aliases: ['quit', 'q'],
    execute: async () => {
      process.exit(0);
      return '';
    }
  }
};

export function resolveCommand(input: string): Command | null {
  const name = input.toLowerCase();
  return commands[name] || 
    Object.values(commands).find(c => c.aliases?.includes(name)) ||
    null;
}
