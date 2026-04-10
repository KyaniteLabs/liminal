/**
 * TUI Commands - Command palette for Meta-Harness
 */

import type { HarnessAgent, AgentTask } from '../harness/index.js';
import { audioPlayer } from './preview/AudioPlayer.js';
import { browserLauncher } from './preview/BrowserLauncher.js';
import { previewRouter } from './preview/PreviewRouter.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { formatError } from '../utils/errors.js';

interface CommandContext {
  agent: HarnessAgent;
  tasks: AgentTask[];
  logs: string[];
  addLog: (msg: string) => void;
  setStatusMessage: (msg: string) => void;
  addOutput: (type: string, content: string) => void;
  createPendingAction?: (kind: 'structured' | 'llm', task: AgentTask | {
    id: string;
    title: string;
    description: string;
    maxSteps?: number;
    approved: boolean;
  }) => { id: string };
  confirmPendingAction?: (id: string) => Promise<string>;
  cancelPendingAction?: (id: string) => boolean;
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
    // eslint-disable-next-line @typescript-eslint/require-await
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
        '  /confirm <id>    - Confirm a pending action',
        '  /cancel <id>     - Cancel a pending action',
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
    // eslint-disable-next-line @typescript-eslint/require-await
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

  provider: {
    name: 'provider',
    description: 'Switch LLM provider at runtime',
    usage: '/provider [list|minimax|glm|kimi|ollama|<baseUrl> <model>]',
    // eslint-disable-next-line @typescript-eslint/require-await
    execute: async (args, _ctx) => {
      const { PROVIDER_TEMPLATES, listConfiguredProviders, getProviderConfig } = await import('../harness/MultiProviderConfig.js');
      const { metaHarness } = await import('../harness/MetaHarnessIntegration.js');

      // /provider list — show all providers
      if (!args[0] || args[0] === 'list' || args[0] === 'ls') {
        const configured = listConfiguredProviders();
        const current = metaHarness.getStatus()?.activeProvider || 'unknown';
        const lines = ['Providers:'];
        for (const [key, tmpl] of Object.entries(PROVIDER_TEMPLATES)) {
          const isConfigured = configured.includes(key as any);
          const isCurrent = key === current;
          const marker = isCurrent ? ' ← active' : '';
          const status = isConfigured ? '✅' : '⚪';
          lines.push(`  ${status} ${key.padEnd(12)} ${tmpl.name.padEnd(14)} ${tmpl.model}${marker}`);
        }
        lines.push('');
        lines.push('Usage: /provider <name>       — switch to a configured provider');
        lines.push('       /provider <url> <model> — switch to custom endpoint');
        return lines.join('\n');
      }

      // /provider <name> — switch to a known provider
      const template = PROVIDER_TEMPLATES[args[0] as keyof typeof PROVIDER_TEMPLATES];
      if (template) {
        const config = getProviderConfig(args[0] as any);
        if (!config?.apiKey && args[0] !== 'ollama' && args[0] !== 'lmstudio') {
          return `⚠️  ${template.name} not configured. Set the API key first:\n  export ${args[0].toUpperCase()}_API_KEY=your-key`;
        }
        metaHarness.switchProvider(config!.baseUrl, config!.model, config!.apiKey);
        return `✅ Switched to ${template.name}: ${config!.model} @ ${config!.baseUrl}`;
      }

      // /provider <url> <model> — custom endpoint
      if (args[0]?.startsWith('http') && args[1]) {
        const url = args[0];
        const model = args[1];
        const apiKey = args[2];
        metaHarness.switchProvider(url, model, apiKey);
        return `✅ Switched to custom: ${model} @ ${url}`;
      }

      return `Unknown provider "${args[0]}". Run /provider list to see options.`;
    }
  },

  tasks: {
    name: 'tasks',
    description: 'List pending tasks',
    usage: '/tasks',
    // eslint-disable-next-line @typescript-eslint/require-await
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
    // eslint-disable-next-line @typescript-eslint/require-await
    execute: async (args, ctx) => {
      const taskId = args[0];
      if (!taskId) return 'Error: Task ID required. Usage: /run <task-id>';
      
      const task = ctx.tasks.find(t => t.id === taskId);
      if (!task) return `Error: Task ${taskId} not found`;

      if (ctx.createPendingAction) {
        const pending = ctx.createPendingAction('structured', task);
        ctx.setStatusMessage('Task awaiting approval');
        return `Task "${task.title}" created and awaiting approval.\nConfirm with /confirm ${pending.id} or cancel with /cancel ${pending.id}.`;
      }

      ctx.setStatusMessage('Approval flow unavailable');
      return 'Error: pending action review is not configured for this command surface.';
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
        const { metaHarness } = await import('../harness/index.js');
        
        const llmClient = metaHarness.getLLMClient();
        if (!llmClient) {
          return 'Error: LLM client not initialized. Run /status to check.';
        }

        const task = {
          id: `llm-${Date.now()}`,
          title: description.slice(0, 50),
          description,
          maxSteps: 15,
          approved: false, // Wave 1 containment: require explicit confirmation
        };

        if (ctx.createPendingAction) {
          const pending = ctx.createPendingAction('llm', task);
          ctx.setStatusMessage('Task awaiting approval');
          return `Task "${task.title}" created but not auto-approved.\nThis is a safety containment measure.\nUse /confirm ${pending.id} to approve execution or /cancel ${pending.id} to cancel.`;
        }

        return 'Error: pending action review is not configured for this command surface.';
      } catch (error) {
        ctx.setStatusMessage('Error');
        return `❌ ${formatError('Command', error)}`;
      }
    }
  },

  confirm: {
    name: 'confirm',
    description: 'Confirm a pending action',
    usage: '/confirm <pending-id>',
    execute: async (args, ctx) => {
      const actionId = args[0];
      if (!actionId) return 'Error: Pending action ID required. Usage: /confirm <pending-id>';
      if (!ctx.confirmPendingAction) return 'Error: pending action review is not configured for this command surface.';
      return ctx.confirmPendingAction(actionId);
    }
  },

  cancel: {
    name: 'cancel',
    description: 'Cancel a pending action',
    usage: '/cancel <pending-id>',
    // eslint-disable-next-line @typescript-eslint/require-await
    execute: async (args, ctx) => {
      const actionId = args[0];
      if (!actionId) return 'Error: Pending action ID required. Usage: /cancel <pending-id>';
      if (!ctx.cancelPendingAction) return 'Error: pending action review is not configured for this command surface.';
      return ctx.cancelPendingAction(actionId)
        ? `Pending action ${actionId} cancelled.`
        : `Pending action ${actionId} not found.`;
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
          const info = audioPlayer.getAudioInfo(filePath);
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
      
      const info = audioPlayer.getAudioInfo(filePath);
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
    // eslint-disable-next-line @typescript-eslint/require-await
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
    // eslint-disable-next-line @typescript-eslint/require-await
    execute: async () => '\x1B[2J\x1B[H',  // CSI clear screen + cursor home only
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
