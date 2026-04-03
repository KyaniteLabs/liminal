import readline from 'readline';
import { PromptHistory } from '../config/PromptHistory.js';
import { Provider } from '../types/providers.js';

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
    return [Provider.LMSTUDIO, Provider.MINIMAX, Provider.OLLAMA, Provider.OPENAI, 'hybrid'];
  }

  /**
   * Display recent prompts and let user select one
   */
  async selectPrompt(): Promise<string | null> {
    const recent = await this.history.getRecent(10);
    
    if (recent.length === 0) {
      return null;
    }

    console.log('');
    console.log('Recent Prompts:');
    recent.forEach((p, i) => {
      const display = p.slice(0, 60) + (p.length > 60 ? '...' : '');
      console.log('  ' + (i + 1) + '. ' + display);
    });
    console.log('  0. Enter custom prompt');
    console.log('');

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
    console.log('');
    console.log('Providers:');
    providers.forEach((p, i) => console.log('  ' + (i + 1) + '. ' + p));
    console.log('');

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
    console.log('');
    console.log('Liminal - Interactive Mode');
    console.log('==========================');
    console.log('');

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
