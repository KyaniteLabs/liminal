/**
 * TUI Commands - Command palette for Meta-Harness
 */

import type { HarnessAgent, AgentTask } from '../harness/index.js';
import { audioPlayer } from './preview/AudioPlayer.js';
import { browserLauncher } from './preview/BrowserLauncher.js';
import { previewRouter } from './preview/PreviewRouter.js';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface CommandContext {
  agent: HarnessAgent;
  tasks: AgentTask[];
  logs: string[];
  addLog: (msg: string) => void;
  setStatusMessage: (msg: string) => void;
  addOutput: (type: string, content: string) => void;
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
      return [
        'Commands:',
        ...Object.values(commands).map(c => `  /${c.name.padEnd(12)} ${c.description}`),
        '',
        'Task commands:',
        '  /run <task-id>   - Execute structured task (from harness-tasks/)',
        '  /agent <desc>    - Execute LLM-driven task (autonomous mode)',
        '',
        'Preview commands:',
        '  /preview <file>  - Preview file (auto-routes to terminal/browser)',
        '  /play <audio>    - Play audio file',
        '  /stop            - Stop audio playback',
        '  /browser         - Open last preview in browser',
      ].join('\n');
    }
  },

  status: {
    name: 'status',
    description: 'Show harness status',
    usage: '/status',
    execute: async () => {
      const { metaHarness } = await import('../harness/index.js');
      const status = metaHarness.getStatus();
      const browserInfo = browserLauncher.getInfo();
      
      return [
        `Harness: ${status.initialized ? '🟢 Online' : '🔴 Offline'}`,
        `Provider: ${status.activeProvider}`,
        `Failures: ${status.recentFailures}`,
        `Patterns: ${status.detectedPatterns.length}`,
        `Browser: ${browserInfo.running ? `🟢 Port ${browserInfo.port}` : '⚪ Stopped'}`,
        `Audio: ${audioPlayer.isPlaying() ? '🔊 Playing' : '⚪ Stopped'}`,
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
      
      const task = ctx.tasks.find(t => t.id === taskId);
      if (!task) return `Error: Task ${taskId} not found`;
      
      ctx.setStatusMessage(`Running ${taskId}...`);
      ctx.addLog(`Starting task ${taskId}`);
      
      const session = await ctx.agent.executeTask(task);
      
      ctx.addLog(`Task ${taskId}: ${session.status}`);
      ctx.setStatusMessage('Ready');
      
      // Auto-preview on success
      if (session.status === 'success' && task.targetFile) {
        ctx.addLog(`Run /preview ${task.targetFile} to see result`);
      }
      
      return `Task ${taskId}: ${session.status.toUpperCase()}\nSteps: ${session.steps.length}`;
    }
  },

  agent: {
    name: 'agent',
    description: 'Execute LLM-driven task (autonomous mode)',
    usage: '/agent <task description>',
    execute: async (args, ctx) => {
      const description = args.join(' ');
      if (!description) {
        return 'Error: Task description required. Usage: /agent <description>\n\nExample: /agent "Fix the Tone.js validation to also check music domain"';
      }

      // Check if LLM is configured
      const { LLMClient } = await import('../llm/LLMClient.js');
      if (!LLMClient.isConfigured()) {
        return 'Error: No LLM configured. Set LIMINAL_LLM_BASE_URL, LIMINAL_LLM_API_KEY, or OPENAI_API_KEY. Or ensure a local LLM server is running at localhost:1234.';
      }

      ctx.setStatusMessage('Starting LLM agent...');
      ctx.addLog(`LLM Task: ${description.slice(0, 60)}...`);

      try {
        const { LLMModeAgent } = await import('../harness/agent/LLMModeAgent.js');
        const { metaHarness } = await import('../harness/index.js');
        
        const llmClient = metaHarness.getLLMClient();
        if (!llmClient) {
          return 'Error: LLM client not initialized. Run /status to check.';
        }

        const llmAgent = new LLMModeAgent(llmClient);
        
        const task = {
          id: `llm-${Date.now()}`,
          title: description.slice(0, 50),
          description,
          maxSteps: 15,
          approved: true,
        };

        const session = await llmAgent.executeTask(task);
        
        // Add step details to log
        for (const msg of session.messages) {
          if (msg.role === 'assistant' && msg.toolCall) {
            ctx.addLog(`→ ${msg.toolCall.tool}: ${msg.toolCall.thought.slice(0, 60)}...`);
          } else if (msg.role === 'tool' && msg.toolResult) {
            const status = msg.toolResult.success ? '✅' : '❌';
            ctx.addLog(`  ${status} ${msg.toolResult.error || 'OK'}`);
          }
        }

        ctx.setStatusMessage('Ready');
        
        const statusEmoji = session.status === 'success' ? '✅' : 
                           session.status === 'rolled_back' ? '⏮️' : '❌';
        
        return [
          `${statusEmoji} LLM Task: ${session.status.toUpperCase()}`,
          `Steps: ${session.stepCount}`,
          `LLM Calls: ${session.messages.filter(m => m.role === 'assistant').length}`,
          session.status === 'rolled_back' ? 'Changes were rolled back due to failure' : '',
        ].filter(Boolean).join('\n');
        
      } catch (error) {
        ctx.setStatusMessage('Error');
        const msg = error instanceof Error ? error.message : String(error);
        return `❌ Error: ${msg}`;
      }
    }
  },

  preview: {
    name: 'preview',
    description: 'Preview file (auto-routes to best viewer)',
    usage: '/preview <file>',
    execute: async (args, ctx) => {
      const filePath = args[0];
      if (!filePath) return 'Error: File path required. Usage: /preview <file>';
      
      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        return `Error: File not found: ${filePath}`;
      }
      
      // Route to appropriate viewer
      const decision = await previewRouter.route(filePath);
      
      switch (decision.target) {
        case 'terminal': {
          // Show in terminal
          const content = await fs.readFile(filePath, 'utf-8');
          const lines = content.split('\n').slice(0, 50);
          ctx.addOutput('code', lines.join('\n'));
          return `Showing ${path.basename(filePath)} in terminal (${lines.length} lines)`;
        }
        
        case 'browser': {
          // Open browser
          ctx.setStatusMessage('Opening browser...');
          const url = await browserLauncher.previewFile(filePath);
          ctx.setStatusMessage('Ready');
          return `🌐 Opened in browser: ${url}`;
        }
        
        case 'both': {
          // Play audio + open browser
          const result = await audioPlayer.play(filePath);
          if (!result.success) {
            return `Error playing audio: ${result.error}`;
          }
          
          // Show waveform in terminal
          const info = await audioPlayer.getAudioInfo(filePath);
          ctx.addOutput('audio', [
            `🔊 Playing: ${info.name}`,
            `Format: ${info.format}`,
            audioPlayer.getWaveform(),
            '',
            'Use /stop to stop playback',
          ].join('\n'));
          
          return `🔊 Playing audio (visualizer in terminal)`;
        }
        
        case 'none':
        default:
          return `Cannot preview: ${decision.reason}`;
      }
    }
  },

  play: {
    name: 'play',
    description: 'Play audio file',
    usage: '/play <audio-file>',
    execute: async (args, ctx) => {
      const filePath = args[0];
      if (!filePath) return 'Error: Audio file required';
      
      const result = await audioPlayer.play(filePath);
      if (!result.success) {
        return `Error: ${result.error}`;
      }
      
      const info = await audioPlayer.getAudioInfo(filePath);
      ctx.addOutput('audio', [
        `🔊 ${info.name}`,
        audioPlayer.getWaveform(),
      ].join('\n'));
      
      return `Playing ${info.format} audio...`;
    }
  },

  stop: {
    name: 'stop',
    description: 'Stop audio playback',
    usage: '/stop',
    execute: async () => {
      if (!audioPlayer.isPlaying()) {
        return 'No audio playing';
      }
      audioPlayer.stop();
      return '⏹️ Audio stopped';
    }
  },

  browser: {
    name: 'browser',
    description: 'Open/reopen browser preview',
    usage: '/browser [file]',
    execute: async (args) => {
      if (args[0]) {
        const url = await browserLauncher.previewFile(args[0]);
        return `🌐 Opened: ${url}`;
      }
      
      const url = await browserLauncher.reopenLast();
      if (url) {
        return `🌐 Reopened: ${url}`;
      }
      return 'No previous preview. Use /preview <file> first.';
    }
  },

  clear: {
    name: 'clear',
    description: 'Clear the screen',
    usage: '/clear',
    execute: async () => '\x1Bc',
  },

  exit: {
    name: 'exit',
    description: 'Exit the TUI',
    usage: '/exit',
    aliases: ['quit', 'q'],
    execute: async () => {
      // Cleanup
      audioPlayer.stop();
      await browserLauncher.stopServer();
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
