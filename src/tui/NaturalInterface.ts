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
import { AmbiguityDetector } from '../core/AmbiguityDetector.js';
import { loadSoul } from './IntentRouter.js';
import type { HarnessAgent, AgentTask } from '../harness/index.js';
import type { LLMModeAgent, LLMTask } from '../harness/agent/LLMModeAgent.js';
import { formatError } from '../utils/errors.js';
import { Logger } from '../utils/Logger.js';
import { commands } from './commands.js';
import { handleProviderCommand } from './ProviderCommand.js';
import { PendingActionStore, type PendingActionRecord } from './PendingActionStore.js';
import { isSuccessfulStatus } from '../types/status.js';

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
  clarifyingQuestions?: Array<{
    question: string;
    options: string[] | null;
    default: string;
  }>;
  suggestions?: string[];
}

/**
 * Everything is agent mode. No separate chat.
 * Conversational input just hits tool: "complete" on step 1.
 */

/**
 * Natural Interface - Main entry point
 *
 * Pattern from claw-code/Claude Code:
 * - Take raw user input
 * - Route to appropriate handler
 * - Maintain conversation context
 */
export class NaturalInterface {
  private session: ConversationSession;
  private harnessAgent: HarnessAgent;
  private llmAgent: LLMModeAgent;
  private llmClient: LLMClient;
  private tasks: AgentTask[];
  // Callbacks for UI updates
  private onStatus: (msg: string) => void;
  private onLog: (msg: string) => void;
  // SOUL loading promise to avoid fire-and-forget
  private soulLoadPromise: Promise<void>;
  private ambiguityDetector: AmbiguityDetector;
  private pendingActions = new PendingActionStore();

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

    // Load SOUL.md - store promise to avoid fire-and-forget
    this.soulLoadPromise = this.loadSoul();
    this.ambiguityDetector = new AmbiguityDetector();
  }

  private async loadSoul(): Promise<void> {
    try {
      this.session.soul = await loadSoul();
    } catch (err) {
      Logger.debug('NaturalInterface', 'Failed to load SOUL.md, using default:', err);
      this.session.soul = 'You are Liminal, a creative coding partner.';
    }
  }

  /**
   * Process natural language input
   * This is the main entry point - like Claude Code's input handling
   */
  async processInput(
    input: string,
    _onStream?: (chunk: string, meta?: { type: 'thinking' | 'content'; length?: number }) => void
  ): Promise<NaturalInputResult> {
    // Ensure SOUL is loaded before processing
    await this.soulLoadPromise;

    const trimmed = input.trim();

    // Add user message to history
    this.addMessage('user', trimmed);

    // 1. Check for exact slash commands
    if (trimmed.startsWith('/')) {
      return this.handleSlashCommand(trimmed.slice(1));
    }

    // 2. Everything else goes through the agent (with tools)
    return this.handleAgentRequest(trimmed);
  }

  /**
   * Handle slash commands (explicit syntax)
   */
  private async handleSlashCommand(input: string): Promise<NaturalInputResult> {
    const [command, ...args] = input.split(' ');
    return this.executeCommand(command, args);
  }

  /**
   * Execute a command
   */
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
        return { type: 'command', response: 'Goodbye! \uD83D\uDC4B', shouldContinue: false };

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

  /**
   * Handle agent request (LLM-driven code changes)
   */
  private handleAgentRequest(input: string): NaturalInputResult {
    this.onStatus('Thinking...');
    this.onLog(`Agent task: ${input.slice(0, 60)}...`);

    // ── Disambiguation gate ──────────────────────────────────────
    const issues = this.ambiguityDetector.detect(input);

    if (issues.length > 0) {
      const hints = this.ambiguityDetector.getDomainHints(input);
      const questions: Array<{ question: string; options: string[] | null; default: string }> = issues.slice(0, 4).map((issue: { suggestedQuestion: string }) => ({
        question: issue.suggestedQuestion,
        options: null, // free-text answer
        default: '',
      }));

      const lines = ['\uD83D\uDD0A Clarifying questions:'];
      for (let i = 0; i < questions.length; i++) {
        lines.push(`\n${i + 1}. ${questions[i].question}`);
        const opts = questions[i].options;
        if (opts) {
          lines.push(`   Options: ${opts.join(', ')}`);
        }
      }
      if (hints.length > 0) {
        lines.push(`\n   Detected intent: ${hints.join(', ')}`);
      }
      lines.push('\nType your answer(s) to continue, or rephrase your request.');

      return {
        type: 'ambiguous',
        response: lines.join('\n'),
        actionTaken: `${questions.length} question(s) asked`,
        shouldContinue: true,
        clarifyingQuestions: questions,
        suggestions: hints,
      };
    }
    // ── End disambiguation gate ─────────────────────────────────

    try {
      const task: LLMTask = {
        id: `agent-${Date.now()}`,
        title: input.slice(0, 50),
        description: input,
        maxSteps: 15,
        approved: false,
      };

      const pending = this.createPendingAction('llm', task);
      const response = `Task "${task.title}" created and awaiting approval.\nConfirm with /confirm ${pending.id} or cancel with /cancel ${pending.id}.`;

      this.addMessage('assistant', response, {
        commandExecuted: 'pending-action-created',
      });

      return {
        type: 'agent',
        response,
        actionTaken: `Queued ${pending.id}`,
        shouldContinue: true,
      };

    } catch (error) {
      const msg = formatError('Agent', error);
      return {
        type: 'agent',
        response: `\u274C ${msg}`,
        shouldContinue: true,
      };
    }
  }

  // Command handlers
  private async handleStatus(): Promise<NaturalInputResult> {
    const response = await commands.status.execute([], {
      agent: this.harnessAgent,
      tasks: this.tasks,
      logs: [],
      addLog: this.onLog,
      setStatusMessage: this.onStatus,
      addOutput: (_type, content) => {
        this.addMessage('assistant', content);
      },
    });

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

  private handleRun(taskId: string): NaturalInputResult {
    if (!taskId) {
      return { type: 'command', response: 'Please specify a task ID. Usage: run <task-id>', shouldContinue: true };
    }

    const task = this.tasks.find(t => t.id === taskId);
    if (!task) {
      return { type: 'command', response: `Task ${taskId} not found`, shouldContinue: true };
    }

    const pending = this.createPendingAction('structured', task);
    this.onStatus('Task awaiting approval');

    return {
      type: 'command',
      response: `Task "${task.title}" created and awaiting approval.\nConfirm with /confirm ${pending.id} or cancel with /cancel ${pending.id}.`,
      shouldContinue: true,
    };
  }

  private async handleConfirm(actionId: string): Promise<NaturalInputResult> {
    if (!actionId) {
      return { type: 'command', response: 'Error: Pending action ID required. Usage: /confirm <pending-id>', shouldContinue: true };
    }
    const response = await this.confirmPendingAction(actionId);
    return { type: 'command', response, shouldContinue: true };
  }

  private handleCancel(actionId: string): NaturalInputResult {
    if (!actionId) {
      return { type: 'command', response: 'Error: Pending action ID required. Usage: /cancel <pending-id>', shouldContinue: true };
    }
    const cancelled = this.cancelPendingAction(actionId);
    return {
      type: 'command',
      response: cancelled ? `Pending action ${actionId} cancelled.` : `Pending action ${actionId} not found.`,
      shouldContinue: true,
    };
  }

  private async handlePreview(filePath: string): Promise<NaturalInputResult> {
    if (!filePath) {
      return { type: 'command', response: 'Please specify a file path. Usage: preview <file>', shouldContinue: true };
    }

    // Route to preview system
    const { browserLauncher } = await import('./preview/BrowserLauncher.js');
    const url = await browserLauncher.previewFile(filePath);

    return {
      type: 'command',
      response: `\uD83C\uDF10 Opened in browser: ${url}`,
      shouldContinue: true,
    };
  }

  private handleHelp(): NaturalInputResult {
    const response = [
      'I\'m Liminal, your creative coding partner.',
      '',
      'You can talk to me naturally:',
      '  \u2022 "Fix the Tone.js validation" - I\'ll make code changes',
      '  \u2022 "What\'s the status?" - I\'ll show system status',
      '  \u2022 "Generate a particle system" - I\'ll help you create',
      '',
      'Or use explicit commands:',
      '  \u2022 status - Show harness status',
      '  \u2022 tasks  - List pending tasks',
      '  \u2022 run <id> - Execute a task',
      '  \u2022 confirm <id> - Approve a pending action',
      '  \u2022 cancel <id> - Cancel a pending action',
      '  \u2022 provider [list|<name>|<url> <model>] - Switch LLM provider',
      '  \u2022 preview <file> - Preview a file',
      '  \u2022 test   - Run diagnostic tests',
      '  \u2022 clear  - Clear screen',
      '  \u2022 exit   - Quit',
    ].join('\n');

    return { type: 'command', response, shouldContinue: true };
  }

  private async handleProvider(args: string[]): Promise<NaturalInputResult> {
    const result = await handleProviderCommand(args, 'plain');
    if (result.logMessage) this.onLog(result.logMessage);
    return {
      type: 'command',
      response: result.response,
      shouldContinue: true,
    };
  }

  private async handleDiagnostic(): Promise<NaturalInputResult> {
    this.onStatus('Running diagnostics...');

    const tests: string[] = [];

    // Test 1: LLM Connection
    try {
      const result = await this.llmClient.complete({
        prompt: 'Say "PASS" and nothing else.',
        maxTokens: 10,
      });
      tests.push(`1. LLM Connection: ${result.success && result.text.includes('PASS') ? 'PASS' : 'FAIL'}`);
    } catch (e) {
      tests.push(`1. LLM Connection: FAIL (${e instanceof Error ? e.message : String(e)})`);
    }

    // Test 2: JSON Parsing
    try {
      const json = '{"test": true, "number": 42}';
      const parsed = JSON.parse(json);
      tests.push(`2. JSON Parsing: ${parsed.test === true && parsed.number === 42 ? 'PASS' : 'FAIL'}`);
    } catch {
      tests.push('2. JSON Parsing: FAIL');
    }

    // Test 3: Harness Status
    const { metaHarness } = await import('../harness/index.js');
    const status = metaHarness.getStatus();
    tests.push(`3. Harness Online: ${status.initialized ? 'PASS' : 'FAIL'}`);

    // Test 4: Context Retention
    const contextTest = await this.llmClient.complete({
      prompt: 'Remember this word: "banana". Confirm you remember it.',
      maxTokens: 20,
    });
    tests.push(`4. Context Retention: ${contextTest.success && contextTest.text.toLowerCase().includes('banana') ? 'PASS' : 'FAIL'}`);

    const response = [
      '\uD83D\uDCCA HARNESS DIAGNOSTIC RESULTS',
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

  getPendingActions(): PendingActionRecord[] {
    return this.pendingActions.list();
  }

  private createPendingAction(kind: PendingActionRecord['kind'], task: AgentTask | LLMTask): PendingActionRecord {
    return this.pendingActions.create(kind, task);
  }

  private cancelPendingAction(id: string): boolean {
    return this.pendingActions.cancel(id);
  }

  private async confirmPendingAction(id: string): Promise<string> {
    const record = this.pendingActions.get(id);
    if (!record) return `Pending action ${id} not found.`;

    try {
      if (record.kind === 'structured') {
        const task = { ...(record.task as AgentTask), approved: true };
        const session = await this.harnessAgent.executeTask(task);
        if (isSuccessfulStatus(session.status)) this.pendingActions.cancel(id);
        return `Task ${task.id}: ${session.status.toUpperCase()}`;
      }

      const task = { ...(record.task as LLMTask), approved: true };
      const session = await this.llmAgent.executeTask(task);
      if (isSuccessfulStatus(session.status)) this.pendingActions.cancel(id);
      for (const msg of session.messages) {
        if (msg.role === 'assistant' && msg.toolCall) {
          this.onLog(`\u2192 ${msg.toolCall.tool}`);
        }
      }
      const statusEmoji = session.status === 'success' ? '\u2705' :
                          session.status === 'rolled_back' ? '\u23EE\uFE0F' : '\u274C';
      return [
        `${statusEmoji} Task ${session.status}`,
        session.status === 'success'
          ? 'The changes have been applied and verified.'
          : session.status === 'rolled_back'
            ? 'Changes were rolled back due to errors.'
            : 'The task could not be completed.',
      ].join('\n');
    } catch (error) {
      const msg = formatError('Agent', error);
      return `\u274C ${msg}`;
    }
  }
}
