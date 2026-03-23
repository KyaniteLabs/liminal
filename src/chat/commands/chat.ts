import { ConversationManager } from '../ConversationManager.js';

export interface ChatOptions {
  verbose?: boolean;
}

export async function chatCommand(options: ChatOptions = {}): Promise<void> {
  // Initialize ConversationManager
  const conversation = new ConversationManager();

  // Start new session
  conversation.startNewSession();

  if (options.verbose) {
    console.log('Started new conversation session');
  }

  // TODO: Phase 2 - wire up actual input handling and generation
  // For now, we'll just initialize the components
}
