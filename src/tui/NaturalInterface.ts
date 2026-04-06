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

/**
 * Command registry for natural language matching
 */
const COMMAND_PATTERNS: Record<string, RegExp[]> = {
  status: [/\b(status|health|state)\b/i, /how are you/i, /what's (?:the )?status/i],
  tasks: [/\b(tasks?|todo|pending)\b/i, /what (?:needs|remains) to be done/i],
  run: [/\brun\s+(\w+)/i, /execute\s+(?:task\s+)?(\w+)/i],
  preview: [/\bpreview\s+(\S+)/i, /show\s+(?:me\s+)?(?:the\s+)?(?:file\s+)?(\S+)/i],
  help: [/\bhelp\b/i, /what can you do/i, /commands/i, /^\?$/],
  exit: [/\b(exit|quit|bye|goodbye)\b/i, /^q$/i],
  clear: [/\bclear\b/i, /clean (?:the )?screen/i],
};

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

    // Load SOUL.md
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

  /**
   * Process natural language input
   * This is the main entry point - like Claude Code's input handling
   */
  async processInput(
    input: string,
    onStream?: (chunk: string, meta?: { type: 'thinking' | 'content'; length?: number }) => void
  ): Promise<NaturalInputResult> {
    const trimmed = input.trim();

    // Add user message to history
    this.addMessage('user', trimmed);

    // 1. Check for exact slash commands first (habit from other systems)
    if (trimmed.startsWith('/')) {
      return this.handleSlashCommand(trimmed.slice(1));
    }

    // 2. Check for explicit command patterns
    const commandMatch = this.matchCommand(trimmed);
    if (commandMatch) {
      return this.executeCommand(commandMatch.command, commandMatch.args);
    }

    // 3. Everything else → agent mode.
    // The agent handles greetings, questions, AND task execution.
    // No separate chat mode — prevents hallucinated execution output.
    return this.handleAgentRequest(trimmed, onStream);
  }

  /**
   * Match input against command patterns
   */
  private matchCommand(input: string): { command: string; args: string[] } | null {
    for (const [command, patterns] of Object.entries(COMMAND_PATTERNS)) {
      for (const pattern of patterns) {
        const match = input.match(pattern);
        if (match) {
          // Extract args from capture groups
          const args = match.slice(1).filter(Boolean) as string[];
          return { command, args };
        }
      }
    }
    return null;
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

      case 'test':
      case 'diagnostic':
        return this.handleDiagnostic();

      case 'debug': {
        const action = args[0]?.toLowerCase();
        if (action === 'on') {
          const { tuiDebugger } = await import('./TuiDebugger.js');
          tuiDebugger.enable();
          const path = tuiDebugger.logFilePath ?? '~/.liminal/debug/';
          return { type: 'command', response: `Debug mode ON. Log: ${path}\nUse Ctrl+D to show panel. tail -f ${path}`, shouldContinue: true };
        }
        if (action === 'off') {
          const { tuiDebugger } = await import('./TuiDebugger.js');
          tuiDebugger.disable();
          return { type: 'command', response: 'Debug mode OFF.', shouldContinue: true };
        }
        return {
          type: 'command',
          response: 'Usage: /debug on|off\nEnables verbose file logging to ~/.liminal/debug/\nUse Ctrl+D to toggle the debug panel in TUI.',
          shouldContinue: true,
        };
      }

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
  private async handleAgentRequest(
    input: string,
    _onStream?: (chunk: string, meta?: { type: 'thinking' | 'content'; length?: number }) => void
  ): Promise<NaturalInputResult> {
    this.onStatus('Thinking...');
    this.onLog(`Agent task: ${input.slice(0, 60)}...`);

    try {
      const task: LLMTask = {
        id: `agent-${Date.now()}`,
        title: input.slice(0, 50),
        description: input,
        maxSteps: 15,
        approved: true,
      };

      const session = await this.llmAgent.executeTask(task);

      // Add to conversation history
      for (const msg of session.messages) {
        if (msg.role === 'assistant' && msg.toolCall) {
          this.onLog(`\u2192 ${msg.toolCall.tool}`);
        }
      }

      const statusEmoji = session.status === 'success' ? '\u2705' :
                         session.status === 'rolled_back' ? '\u23EE\uFE0F' : '\u274C';

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
        response: `\u274C ${msg}`,
        shouldContinue: true,
      };
    }
  }


  // Command handlers
  private async handleStatus(): Promise<NaturalInputResult> {
    const { metaHarness } = await import('../harness/index.js');
    const status = metaHarness.getStatus();

    const response = [
      `Harness: ${status.initialized ? '\uD83D\uDFE2 Online' : '\uD83D\uDD34 Offline'}`,
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

    this.onStatus(`Running ${taskId}...`);
    const session = await this.harnessAgent.executeTask(task);

    return {
      type: 'command',
      response: `Task ${taskId}: ${session.status.toUpperCase()}`,
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
      '  \u2022 preview <file> - Preview a file',
      '  \u2022 test   - Run diagnostic tests',
      '  \u2022 clear  - Clear screen',
      '  \u2022 exit   - Quit',
    ].join('\n');

    return { type: 'command', response, shouldContinue: true };
  }

  private async handleDiagnostic(): Promise<NaturalInputResult> {
    this.onStatus('Testing LLM connectivity...');

    const tests: string[] = [];

    // Test 1: LLM Connection
    try {
      const result = await this.llmClient.complete({
        prompt: 'Say "PASS" and nothing else.',
        maxTokens: 10,
      });
      const llmOk = result.success && result.text.includes('PASS');
      tests.push(`1. LLM Connection: ${llmOk ? 'PASS' : 'FAIL'}`);
      this.onLog(`\u2713 LLM connectivity: ${llmOk ? 'OK' : 'FAIL'}`);
    } catch (e) {
      tests.push(`1. LLM Connection: FAIL (${e instanceof Error ? e.message : String(e)})`);
      this.onLog(`\u2717 LLM connectivity: ${e instanceof Error ? e.message : String(e)}`);
    }

    // Test 2: JSON Parsing
    try {
      const json = '{"test": true, "number": 42}';
      const parsed = JSON.parse(json);
      const jsonOk = parsed.test === true && parsed.number === 42;
      tests.push(`2. JSON Parsing: ${jsonOk ? 'PASS' : 'FAIL'}`);
      this.onLog(`\u2713 JSON parsing: ${jsonOk ? 'OK' : 'FAIL'}`);
    } catch {
      tests.push('2. JSON Parsing: FAIL');
      this.onLog('\u2717 JSON parsing: FAIL');
    }

    // Test 3: Harness Status
    const { metaHarness } = await import('../harness/index.js');
    const status = metaHarness.getStatus();
    tests.push(`3. Harness Online: ${status.initialized ? 'PASS' : 'FAIL'}`);
    this.onLog(`\u2713 Harness: ${status.initialized ? 'OK' : 'OFFLINE'}`);

    // Test 4: Context Retention
    this.onStatus('LLM connected. Testing context retention...');
    const contextTest = await this.llmClient.complete({
      prompt: 'Remember this word: "banana". Confirm you remember it.',
      maxTokens: 20,
    });
    const contextOk = contextTest.success && contextTest.text.toLowerCase().includes('banana');
    tests.push(`4. Context Retention: ${contextOk ? 'PASS' : 'FAIL'}`);
    this.onLog(`\u2713 Context retention: ${contextOk ? 'OK' : 'FAIL'}`);

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
}
