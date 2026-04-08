/**
 * Natural Language Interface - Claude Code style
 *
 * How Claude Code does it:
 * 1. User types naturally (no prefixes)
 * 2. System token-matches against available commands/tools
 * 3. Routes to chat, agent, or command based on intent
 * 4. Maintains conversation history
 */

import { LLMClient } from '../llm/LLMClient.js';
import { loadSoul } from './IntentRouter.js';
import type { HarnessAgent, AgentTask } from '../harness/index.js';
import type { LLMModeAgent, LLMTask } from '../harness/agent/LLMModeAgent.js';
import { formatError } from '../utils/errors.js';
import { Logger } from '../utils/Logger.js';
import { sanitizeTerminalText } from './sanitizeTerminalText.js';

/**
 * Re-export sanitizeTerminalText as sanitizeTerminalOutput for backwards compatibility.
 * Used by security regression tests and TUI components.
 */
export function sanitizeTerminalOutput(text: string): string {
  // Strip terminal reset sequences (ESC c)
  const terminalResetRegex = /\x1Bc/g;
  // Strip OSC sequences (ESC ] ... BEL or ESC \\)
  const oscRegex = /\x1B\][0-9]*;[^\x07\x1B]*(?:\x07|\x1B\\)/g;

  let sanitized = text
    .replace(terminalResetRegex, '')
    .replace(oscRegex, '');

  // Also apply basic terminal text sanitization
  sanitized = sanitizeTerminalText(sanitized, { maxLength: 10000, singleLine: false });

  return sanitized;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: string;
  metadata?: {
    toolCalls?: string[];
    commandExecuted?: string;
    thinking?: string;
  };
}

interface ConversationSession {
  id: string;
  messages: ConversationMessage[];
  soul: string;
  createdAt: string;
  updatedAt: string;
}

interface NaturalInputResult {
  type: 'chat' | 'agent' | 'command' | 'ambiguous';
  response: string;
  actionTaken?: string;
  shouldContinue: boolean;
}

interface PendingAction {
  id: string;
  type: 'agent' | 'task';
  task: AgentTask | LLMTask;
  createdAt: string;
}

export class NaturalInterface {
  private session: ConversationSession;
  private harnessAgent: HarnessAgent;
  private llmAgent: LLMModeAgent;
  private llmClient: LLMClient;
  private tasks: AgentTask[];
  private pendingActions: PendingAction[] = [];
  private onStatus: (msg: string) => void;
  private onLog: (msg: string) => void;

  constructor(options: {
    harnessAgent: HarnessAgent;
    llmAgent: LLMModeAgent;
    llmClient: LLMClient;
    tasks: AgentTask[];
    onStatus: (msg: string) => void;
    onLog: (msg: string) => void;
  }) {
    this.harnessAgent = options.harnessAgent;
    this.llmAgent = options.llmAgent;
    this.llmClient = options.llmClient;
    this.tasks = options.tasks;
    this.onStatus = options.onStatus;
    this.onLog = options.onLog;

    this.session = {
      id: `session-${Date.now()}`,
      messages: [],
      soul: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    void this.loadSoul();
  }

  private async loadSoul(): Promise<void> {
    try {
      this.session.soul = await loadSoul();
    } catch (err) {
      Logger.debug('NaturalInterface', 'Failed to load SOUL.md, using default:', err);
      this.session.soul = 'You are Liminal, a creative coding partner.';
    }
  }

  getPendingActions(): PendingAction[] {
    return [...this.pendingActions];
  }

  private createPendingAction(type: 'agent' | 'task', task: AgentTask | LLMTask): PendingAction {
    const action: PendingAction = {
      id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      task,
      createdAt: new Date().toISOString(),
    };
    this.pendingActions.push(action);
    return action;
  }

  private async confirmPendingAction(actionId: string): Promise<NaturalInputResult> {
    const index = this.pendingActions.findIndex(a => a.id === actionId);
    if (index === -1) {
      return {
        type: 'command',
        response: `Pending action ${actionId} not found`,
        shouldContinue: true,
      };
    }

    const action = this.pendingActions[index];
    this.pendingActions.splice(index, 1);

    if (action.type === 'agent') {
      return this.executeAgentTask(action.task as LLMTask);
    } else {
      return this.executeHarnessTask(action.task as AgentTask);
    }
  }

  private cancelPendingAction(actionId: string): NaturalInputResult {
    const index = this.pendingActions.findIndex(a => a.id === actionId);
    if (index === -1) {
      return {
        type: 'command',
        response: `Pending action ${actionId} not found`,
        shouldContinue: true,
      };
    }

    this.pendingActions.splice(index, 1);
    return {
      type: 'command',
      response: 'Action cancelled.',
      shouldContinue: true,
    };
  }

  async processInput(
    input: string,
    _onStream?: (chunk: string, meta?: { type: 'thinking' | 'content'; length?: number }) => void
  ): Promise<NaturalInputResult> {
    const trimmed = input.trim();
    this.addMessage('user', trimmed);

    if (trimmed.startsWith('/')) {
      return this.handleSlashCommand(trimmed.slice(1));
    }

    return this.handleAgentRequest(trimmed);
  }

  private async handleSlashCommand(input: string): Promise<NaturalInputResult> {
    const [command, ...args] = input.split(' ');
    return this.executeCommand(command, args);
  }

  private async executeCommand(command: string, args: string[]): Promise<NaturalInputResult> {
    this.onStatus(`Executing ${command}...`);

    switch (command) {
      case 'status':
        return this.handleStatus();
      case 'tasks':
        return this.handleTasks();
      case 'run':
        return this.handleRun(args[0] || '');
      case 'confirm':
        return this.handleConfirm(args[0] || '');
      case 'cancel':
        return this.handleCancel(args[0] || '');
      case 'preview':
        return this.handlePreview(args[0] || '');
      case 'help':
        return this.handleHelp();
      case 'clear':
        return { type: 'command', response: '\x1Bc', shouldContinue: true };
      case 'exit':
      case 'quit':
      case 'q':
        return { type: 'command', response: 'Goodbye! 👋', shouldContinue: false };
      case 'provider':
        return this.handleProvider(args);
      case 'test':
      case 'diagnostic':
        return this.handleDiagnostic();
      default:
        return {
          type: 'ambiguous',
          response: `Unknown command: ${command}. Try "help" for available commands.`,
          shouldContinue: true,
        };
    }
  }

  private async handleAgentRequest(input: string): Promise<NaturalInputResult> {
    this.onStatus('Thinking...');
    this.onLog(`Agent task queued: ${input.slice(0, 60)}...`);

    const task: LLMTask = {
      id: `agent-${Date.now()}`,
      title: input.slice(0, 50),
      description: input,
      maxSteps: 15,
      approved: false,
    };

    const action = this.createPendingAction('agent', task);

    return {
      type: 'agent',
      response: `⏳ Task queued awaiting approval.\nRun "/confirm ${action.id}" to execute or "/cancel ${action.id}" to abort.`,
      actionTaken: 'Queued for approval',
      shouldContinue: true,
    };
  }

  private async executeAgentTask(task: LLMTask): Promise<NaturalInputResult> {
    this.onStatus('Executing...');
    this.onLog(`Agent task: ${task.description.slice(0, 60)}...`);

    try {
      const approvedTask = { ...task, approved: true };
      const session = await this.llmAgent.executeTask(approvedTask);

      for (const msg of session.messages) {
        if (msg.role === 'assistant' && msg.toolCall) {
          this.onLog(`-> ${msg.toolCall.tool}`);
        }
      }

      const statusEmoji = session.status === 'success' ? '✅' :
                         session.status === 'rolled_back' ? '⏮️' : '❌';

      const response = [
        `${statusEmoji} Task ${session.status}`,
        session.status === 'success'
          ? 'The changes have been applied and verified.'
          : session.status === 'rolled_back'
          ? 'Changes were rolled back due to errors.'
          : 'The task could not be completed.',
      ].join('\n');

      this.addMessage('assistant', response, {
        toolCalls: session.messages
          .filter(m => m.role === 'assistant' && m.toolCall)
          .map(m => m.toolCall!.tool),
      });

      return {
        type: 'agent',
        response,
        actionTaken: `Executed ${session.stepCount} steps`,
        shouldContinue: true,
      };
    } catch (error) {
      const msg = formatError('Agent', error);
      return {
        type: 'agent',
        response: `❌ ${msg}`,
        shouldContinue: true,
      };
    }
  }

  private async executeHarnessTask(task: AgentTask): Promise<NaturalInputResult> {
    this.onStatus(`Running ${task.id}...`);
    const approvedTask = { ...task, approved: true };
    const session = await this.harnessAgent.executeTask(approvedTask);

    return {
      type: 'command',
      response: `✅ Task ${task.id}: ${session.status.toUpperCase()}`,
      shouldContinue: true,
    };
  }

  private async handleStatus(): Promise<NaturalInputResult> {
    const { metaHarness } = await import('../harness/index.js');
    const status = metaHarness.getStatus();

    const response = [
      `Harness: ${status.initialized ? '🟢 Online' : '🔴 Offline'}`,
      `Provider: ${status.activeProvider}`,
      `Recent failures: ${status.recentFailures}`,
      `Detected patterns: ${status.detectedPatterns.length}`,
    ].join('\n');

    return { type: 'command', response, shouldContinue: true };
  }

  private handleTasks(): NaturalInputResult {
    if (this.tasks.length === 0) {
      return { type: 'command', response: 'No pending tasks.', shouldContinue: true };
    }

    const response = this.tasks
      .map(t => `  ${t.id.padEnd(8)} ${t.title.slice(0, 40)}`)
      .join('\n');

    return { type: 'command', response: `Pending tasks:\n${response}`, shouldContinue: true };
  }

  private async handleRun(taskId: string): Promise<NaturalInputResult> {
    if (!taskId) {
      return { type: 'command', response: 'Please specify a task ID. Usage: run <task-id>', shouldContinue: true };
    }

    const task = this.tasks.find(t => t.id === taskId);
    if (!task) {
      return { type: 'command', response: `Task ${taskId} not found`, shouldContinue: true };
    }

    const action = this.createPendingAction('task', { ...task, approved: false });

    return {
      type: 'command',
      response: `⏳ Task ${taskId} queued awaiting approval.\nRun "/confirm ${action.id}" to execute or "/cancel ${action.id}" to abort.`,
      shouldContinue: true,
    };
  }

  private async handleConfirm(actionId: string): Promise<NaturalInputResult> {
    if (!actionId) {
      if (this.pendingActions.length === 0) {
        return { type: 'command', response: 'No pending actions awaiting confirmation.', shouldContinue: true };
      }

      const lines = this.pendingActions.map(a =>
        `  ${a.id} - ${a.type === 'agent' ? 'Agent task' : `Task ${(a.task as AgentTask).id}`}`
      );
      return { type: 'command', response: `Pending actions:\n${lines.join('\n')}`, shouldContinue: true };
    }

    return this.confirmPendingAction(actionId);
  }

  private handleCancel(actionId: string): NaturalInputResult {
    if (!actionId) {
      return { type: 'command', response: 'Please specify an action ID. Usage: cancel <action-id>', shouldContinue: true };
    }

    return this.cancelPendingAction(actionId);
  }

  private async handlePreview(filePath: string): Promise<NaturalInputResult> {
    if (!filePath) {
      return { type: 'command', response: 'Please specify a file path. Usage: preview <file>', shouldContinue: true };
    }

    const { browserLauncher } = await import('./preview/BrowserLauncher.js');
    const url = await browserLauncher.previewFile(filePath);

    return {
      type: 'command',
      response: `🌐 Opened in browser: ${url}`,
      shouldContinue: true,
    };
  }

  private handleHelp(): NaturalInputResult {
    const response = [
      "I'm Liminal, your creative coding partner.",
      '',
      'You can talk to me naturally:',
      '  • "Fix the Tone.js validation" - I\'ll make code changes',
      '  • "What\'s the status?" - I\'ll show system status',
      '  • "Generate a particle system" - I\'ll help you create',
      '',
      'Or use explicit commands:',
      '  • status - Show harness status',
      '  • tasks  - List pending tasks',
      '  • run <id> - Queue a task for execution',
      '  • confirm [id] - Confirm a pending action',
      '  • cancel <id> - Cancel a pending action',
      '  • provider [list|<name>|<url> <model>] - Switch LLM provider',
      '  • preview <file> - Preview a file',
      '  • test   - Run diagnostic tests',
      '  • clear  - Clear screen',
      '  • exit   - Quit',
    ].join('\n');

    return { type: 'command', response, shouldContinue: true };
  }

  private async handleProvider(args: string[]): Promise<NaturalInputResult> {
    const { PROVIDER_TEMPLATES, listConfiguredProviders, getProviderConfig } = await import('../harness/MultiProviderConfig.js');
    const { metaHarness } = await import('../harness/MetaHarnessIntegration.js');

    if (!args[0] || args[0] === 'list' || args[0] === 'ls') {
      const configured = listConfiguredProviders();
      const current = metaHarness.getStatus()?.activeProvider || 'unknown';
      const lines = ['Providers:'];
      for (const [key, tmpl] of Object.entries(PROVIDER_TEMPLATES)) {
        const isConfigured = configured.includes(key as any);
        const isCurrent = key === current;
        const marker = isCurrent ? ' <-- active' : '';
        const status = isConfigured ? '[ok]' : '[--]';
        lines.push(`  ${status} ${key.padEnd(12)} ${tmpl.name.padEnd(14)} ${tmpl.model}${marker}`);
      }
      lines.push('');
      lines.push('Usage: /provider <name>       -- switch to a configured provider');
      lines.push('       /provider <url> <model> -- switch to custom endpoint');
      return { type: 'command', response: lines.join('\n'), shouldContinue: true };
    }

    const template = PROVIDER_TEMPLATES[args[0] as keyof typeof PROVIDER_TEMPLATES];
    if (template) {
      const config = getProviderConfig(args[0] as any);
      if (!config?.apiKey && args[0] !== 'ollama' && args[0] !== 'lmstudio') {
        return {
          type: 'command',
          response: `Not configured. Set the API key first:\n  export ${args[0].toUpperCase()}_API_KEY=your-key`,
          shouldContinue: true,
        };
      }
      metaHarness.switchProvider(config!.baseUrl, config!.model, config!.apiKey);
      this.onLog(`Switched to ${template.name}: ${config!.model}`);
      return {
        type: 'command',
        response: `Switched to ${template.name}: ${config!.model} @ ${config!.baseUrl}`,
        shouldContinue: true,
      };
    }

    if (args[0]?.startsWith('http') && args[1]) {
      metaHarness.switchProvider(args[0], args[1], args[2]);
      return {
        type: 'command',
        response: `Switched to custom: ${args[1]} @ ${args[0]}`,
        shouldContinue: true,
      };
    }

    return {
      type: 'command',
      response: `Unknown provider "${args[0]}". Run /provider list to see options.`,
      shouldContinue: true,
    };
  }

  private async handleDiagnostic(): Promise<NaturalInputResult> {
    this.onStatus('Running diagnostics...');

    const tests: string[] = [];

    try {
      const result = await this.llmClient.complete({
        prompt: 'Say "PASS" and nothing else.',
        maxTokens: 10,
      });
      tests.push(`1. LLM Connection: ${result.success && result.text.includes('PASS') ? 'PASS' : 'FAIL'}`);
    } catch (e) {
      tests.push(`1. LLM Connection: FAIL (${e instanceof Error ? e.message : String(e)})`);
    }

    try {
      const json = '{"test": true, "number": 42}';
      const parsed = JSON.parse(json);
      tests.push(`2. JSON Parsing: ${parsed.test === true && parsed.number === 42 ? 'PASS' : 'FAIL'}`);
    } catch {
      tests.push('2. JSON Parsing: FAIL');
    }

    const { metaHarness } = await import('../harness/index.js');
    const status = metaHarness.getStatus();
    tests.push(`3. Harness Online: ${status.initialized ? 'PASS' : 'FAIL'}`);

    const contextTest = await this.llmClient.complete({
      prompt: 'Remember this word: "banana". Confirm you remember it.',
      maxTokens: 20,
    });
    tests.push(`4. Context Retention: ${contextTest.success && contextTest.text.toLowerCase().includes('banana') ? 'PASS' : 'FAIL'}`);

    const response = [
      '📊 HARNESS DIAGNOSTIC RESULTS',
      '',
      ...tests,
      '',
      `Provider: ${this.llmClient.getConfig().model}`,
      `Harness: ${status.activeProvider}`,
      `Failures loaded: ${status.recentFailures}`,
    ].join('\n');

    return { type: 'command', response, shouldContinue: true };
  }

  private addMessage(role: ConversationMessage['role'], content: string, metadata?: ConversationMessage['metadata']): void {
    this.session.messages.push({
      role,
      content,
      timestamp: new Date().toISOString(),
      metadata,
    });
    this.session.updatedAt = new Date().toISOString();
  }

  getHistory(): ConversationMessage[] {
    return this.session.messages;
  }

  getSession(): ConversationSession {
    return this.session;
  }

  setTasks(tasks: AgentTask[]): void {
    this.tasks = tasks;
  }
}
