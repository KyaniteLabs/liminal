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

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: string;
  metadata?: {
    toolCalls?: string[];
    commandExecuted?: string;
  };
}

export interface ConversationSession {
  id: string;
  messages: ConversationMessage[];
  soul: string;
  createdAt: string;
  updatedAt: string;
}

export interface NaturalInputResult {
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
  help: [/\bhelp\b/i, /what can you do/i, /commands/i, /\?$/],
  exit: [/\b(exit|quit|bye|goodbye)\b/i, /^q$/i],
  clear: [/\bclear\b/i, /clean (?:the )?screen/i],
};

/**
 * Agent patterns - indicate user wants code changes
 */
const AGENT_PATTERNS = [
  /^(?:can\s+you|could\s+you|please)?\s*(?:fix|repair|correct)\b/i,
  /^(?:can\s+you|could\s+you|please)?\s*(?:add|implement|create|build)\s+(?:a|an|the|\w+)/i,
  /^(?:can\s+you|could\s+you|please)?\s*(?:change|modify|update|refactor|rewrite)\b/i,
  /^(?:can\s+you|could\s+you|please)?\s*(?:remove|delete|clean\s+up)\b/i,
  /^(?:can\s+you|could\s+you|please)?\s*(?:improve|optimize|enhance|polish)\b/i,
  /\b(bug|issue|error|broken|failing)\b.*\b(fix|repair|solve)\b/i,
  /\bis\s+(?:there\s+a\s+)?(?:way\s+to|method\s+to)\s+(?:fix|add|change)/i,
  /\b(the|a|an)\s+\w+\s+(?:should|needs?|must)\s+(?:be\s+)?\w+/i,
];

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
    this.loadSoul();
  }

  private async loadSoul(): Promise<void> {
    try {
      this.session.soul = await loadSoul();
    } catch {
      this.session.soul = 'You are Liminal, a creative coding partner.';
    }
  }

  /**
   * Process natural language input
   * This is the main entry point - like Claude Code's input handling
   */
  async processInput(input: string): Promise<NaturalInputResult> {
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
    
    // 3. Check for agent patterns (code changes)
    if (this.isAgentRequest(trimmed)) {
      return this.handleAgentRequest(trimmed);
    }
    
    // 4. Default: chat mode with personality
    return this.handleChat(trimmed);
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
   * Check if input is an agent request (code changes)
   */
  private isAgentRequest(input: string): boolean {
    return AGENT_PATTERNS.some(pattern => pattern.test(input));
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
        return { type: 'command', response: 'Goodbye! 👋', shouldContinue: false };
      
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
          this.onLog(`→ ${msg.toolCall.tool}`);
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
      const msg = error instanceof Error ? error.message : String(error);
      return { 
        type: 'agent', 
        response: `❌ Error: ${msg}`, 
        shouldContinue: true,
      };
    }
  }

  /**
   * Handle chat (conversational mode with SOUL personality)
   */
  private async handleChat(input: string): Promise<NaturalInputResult> {
    this.onStatus('Thinking...');

    try {
      // Build conversation context
      const recentHistory = this.session.messages
        .slice(-10)
        .map(m => `${m.role}: ${m.content}`)
        .join('\n\n');

      const prompt = `${this.session.soul}

CONVERSATION HISTORY:
${recentHistory}

USER: ${input}

Respond naturally as your personality. If the user asks you to modify code (fix, add, change, etc.) OR says words like "do", "make", "create", "implement" — immediately invoke the agent without asking for confirmation. Only ask "Should I...?" if the request is ambiguous or destructive (delete, overwrite).`;

      const result = await this.llmClient.complete({
        prompt,
        maxTokens: 1000,
        temperature: 0.7,
      });

      if (!result.success) {
        throw new Error(result.error || 'LLM failed');
      }

      const response = result.text.trim();
      this.addMessage('assistant', response);

      return { type: 'chat', response, shouldContinue: true };
      
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { 
        type: 'chat', 
        response: `I'm having trouble thinking right now: ${msg}`, 
        shouldContinue: true,
      };
    }
  }

  // Command handlers
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
      response: `🌐 Opened in browser: ${url}`,
      shouldContinue: true,
    };
  }

  private handleHelp(): NaturalInputResult {
    const response = [
      'I\'m Liminal, your creative coding partner.',
      '',
      'You can talk to me naturally:',
      '  • "Fix the Tone.js validation" - I\'ll make code changes',
      '  • "What\'s the status?" - I\'ll show system status',
      '  • "Generate a particle system" - I\'ll help you create',
      '',
      'Or use explicit commands:',
      '  • status - Show harness status',
      '  • tasks  - List pending tasks',
      '  • run <id> - Execute a task',
      '  • preview <file> - Preview a file',
      '  • test   - Run diagnostic tests',
      '  • clear  - Clear screen',
      '  • exit   - Quit',
    ].join('\n');

    return { type: 'command', response, shouldContinue: true };
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
