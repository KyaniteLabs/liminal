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
  private async handleAgentRequest(input: string): Promise<NaturalInputResult> {
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
      '  \u2022 provider [list|<name>|<url> <model>] - Switch LLM provider',
      '  \u2022 preview <file> - Preview a file',
      '  \u2022 test   - Run diagnostic tests',
      '  \u2022 clear  - Clear screen',
      '  \u2022 exit   - Quit',
      '',
      'Note: this command surface does not support /agent, /confirm, /cancel, /play, or /browser.',
    ].join('\n');

    return { type: 'command', response, shouldContinue: true };
  }

  private async handleProvider(args: string[]): Promise<NaturalInputResult> {
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
        const marker = isCurrent ? ' <-- active' : '';
        const status = isConfigured ? '[ok]' : '[--]';
        lines.push(`  ${status} ${key.padEnd(12)} ${tmpl.name.padEnd(14)} ${tmpl.model}${marker}`);
      }
      lines.push('');
      lines.push('Usage: /provider <name>       -- switch to a configured provider');
      lines.push('       /provider <url> <model> -- switch to custom endpoint');
      return { type: 'command', response: lines.join('\n'), shouldContinue: true };
    }

    // /provider <name> — switch to a known provider
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

    // /provider <url> <model> — custom endpoint
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
}
