import { ConversationManager } from '../ConversationManager.js';
import { ChatCLI } from '../ChatCLI.js';
import { RalphLoop } from '../../core/RalphLoop.js';

export interface ChatOptions {
  verbose?: boolean;
}

export function chatCommand(options: ChatOptions = {}): void {
  // Initialize ConversationManager
  const conversation = new ConversationManager();

  // Start new session
  conversation.startNewSession();

  // Initialize ChatCLI and render the UI
  const cli = new ChatCLI(conversation);
  cli.render();

  // RalphLoop is available for Phase 2 integration
  void RalphLoop;
  void options;
}
