import readline from 'readline';
import { PromptHistory } from '../config/PromptHistory.js';
import { Provider } from '../types/providers.js';
import { PROVIDER_ORDER } from '../config/ProviderRuntime.js';
import { Logger } from '../utils/Logger.js';

interface InteractiveOptions {
  provider?: string;
  model?: string;
  maxIterations?: number;
}

export class InteractiveMode {
  private history: PromptHistory;
  private rl: readline.Interface;

  constructor(history: PromptHistory) {
    this.history = history;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  /**
   * Get list of available providers
   */
  getProviders(): string[] {
    return [...PROVIDER_ORDER, 'hybrid'];
  }

  /**
   * Display recent prompts and let user select one
   */
  async selectPrompt(): Promise<string | null> {
    const recent = await this.history.getRecent(10);
    
    if (recent.length === 0) {
      return null;
    }

    Logger.info('InteractiveMode', '');
    Logger.info('InteractiveMode', 'Recent Prompts:');
    recent.forEach((p, i) => {
      const display = p.slice(0, 60) + (p.length > 60 ? '...' : '');
      Logger.info('InteractiveMode', '  ' + (i + 1) + '. ' + display);
    });
    Logger.info('InteractiveMode', '  0. Enter custom prompt');
    Logger.info('InteractiveMode', '');

    return new Promise((resolve) => {
      this.rl.question('Select (0-10): ', (answer) => {
        const num = parseInt(answer.trim());
        if (num >= 1 && num <= recent.length) {
          resolve(recent[num - 1]);
        } else {
          resolve(null);
        }
      });
    });
  }

  /**
   * Enter a custom prompt
   */
  async enterCustomPrompt(defaultText: string = ''): Promise<string> {
    return new Promise((resolve) => {
      const promptText = defaultText ? 'Prompt (' + defaultText + '): ' : 'Prompt: ';
      this.rl.question(promptText, (answer) => {
        resolve(answer.trim() || defaultText);
      });
    });
  }

  /**
   * Select provider
   */
  async selectProvider(): Promise<string> {
    const providers = this.getProviders();
    Logger.info('InteractiveMode', '');
    Logger.info('InteractiveMode', 'Providers:');
    providers.forEach((p, i) => Logger.info('InteractiveMode', '  ' + (i + 1) + '. ' + p));
    Logger.info('InteractiveMode', '');

    return new Promise((resolve) => {
      this.rl.question('Select provider (1-' + providers.length + '): ', (answer) => {
        const num = parseInt(answer.trim()) - 1;
        resolve(providers[num] || Provider.LMSTUDIO);
      });
    });
  }

  /**
   * Run full interactive session
   */
  async run(): Promise<{ prompt: string; options: InteractiveOptions }> {
    Logger.info('InteractiveMode', '');
    Logger.info('InteractiveMode', 'Sinter - Interactive Mode');
    Logger.info('InteractiveMode', '==========================');
    Logger.info('InteractiveMode', '');

    // Get prompt
    let prompt = await this.selectPrompt();
    if (!prompt) {
      prompt = await this.enterCustomPrompt();
    }

    if (!prompt) {
      throw new Error('No prompt provided');
    }

    // Get provider
    const provider = await this.selectProvider();

    this.rl.close();

    return {
      prompt,
      options: { provider }
    };
  }

  close(): void {
    this.rl.close();
  }
}
