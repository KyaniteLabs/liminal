/**
 * ChatCLI - Split-view terminal UI for Liminal Chat
 * Phase 2: Chat Integration - User Input Handling
 */

import { render, Box, Text, Spacer } from 'ink';
import React, { useState, useEffect } from 'react';
import type { ReactElement } from 'react';
import { createInterface } from 'readline';
import { Logger } from '../utils/Logger.js';
import { ConversationManager } from './ConversationManager.js';
import type { Parameter, Domain } from './types.js';

/**
 * Guidance Engine stub for Phase 1
 * Will be replaced with real implementation in Phase 2
 */
interface GuidanceEngineStub {}

/**
 * Preview state for the preview panel
 */
interface PreviewState {
  code: string;
  domain: Domain;
  timestamp: Date;
  iteration?: number;
  score?: number;
}

/**
 * ChatCLI - Main CLI class for chat interface
 */
export class ChatCLI {
  conversation: ConversationManager;
  guidance: GuidanceEngineStub;

  // Internal state for UI
  private previewState: PreviewState | null = null;
  private parameterValues: Map<string, number | string | boolean> = new Map();
  private inkInstance: unknown = null;
  private readlineInterface: ReturnType<typeof createInterface> | null = null;
  private isInputActive: boolean = false;

  constructor(conversation: ConversationManager) {
    this.conversation = conversation;
    this.guidance = {}; // Stub for Phase 1
  }

  /**
   * Render the full ChatCLI UI using Ink
   */
  render(): void {
    // Prevent multiple renders
    if (this.inkInstance) {
      return;
    }

    const App: React.FC = () => {
      const [, setTimestamp] = useState(new Date());

      // Force re-render on interval to show updates
      useEffect(() => {
        const interval = setInterval(() => setTimestamp(new Date()), 1000);
        return () => clearInterval(interval);
      }, []);

      return (
        <Box flexDirection="column" padding={1}>
          {/* Header */}
          <Box borderStyle="double" borderColor="cyan" paddingX={1} marginBottom={1}>
            <Text bold color="cyan">LIMINAL CHAT</Text>
            <Spacer />
            <Text color="gray">Phase 1: Foundation</Text>
          </Box>

          {/* Split View */}
          <Box flexDirection="row" gap={1}>
            {/* Chat Panel - 70 chars */}
            <Box width={70}>
              {this.renderChatPanel()}
            </Box>

            {/* Preview Panel - 80 chars */}
            <Box width={80}>
              {this.renderPreviewPanel()}
            </Box>
          </Box>
        </Box>
      );
    };

    this.inkInstance = render(<App />);
  }

  /**
   * Render the chat panel component
   */
  renderChatPanel(): ReactElement {
    const ChatPanel: React.FC = () => {
      const messages = this.conversation.sessionHistory[0]?.messages || [];

      return (
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor="blue"
          paddingX={1}
          height={20}
        >
          <Box marginBottom={1}>
            <Text bold color="blue">CHAT PANEL</Text>
            <Text color="gray"> ({messages.length} messages)</Text>
          </Box>

          <Box flexDirection="column" flexGrow={1}>
            {messages.length === 0 ? (
              <Text color="gray">No messages yet. Start a conversation!</Text>
            ) : (
              messages.slice(-10).map((msg) => (
                <Box key={msg.id} marginBottom={1}>
                  <Text
                    bold
                    color={msg.role === 'user' ? 'green' : msg.role === 'assistant' ? 'cyan' : 'gray'}
                  >
                    {msg.role}:
                  </Text>
                  <Text> {msg.content.slice(0, 60)}{msg.content.length > 60 ? '...' : ''}</Text>
                </Box>
              ))
            )}
          </Box>

          <Box marginTop={1}>
            <Text color="gray">Press Ctrl+C to exit</Text>
          </Box>
        </Box>
      );
    };

    return <ChatPanel />;
  }

  /**
   * Render the preview panel component
   */
  renderPreviewPanel(): ReactElement {
    const PreviewPanel: React.FC = () => {
      return (
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor="magenta"
          paddingX={1}
          height={20}
        >
          <Box marginBottom={1}>
            <Text bold color="magenta">PREVIEW + CONTROLS PANEL</Text>
          </Box>

          {/* Live Preview Section */}
          <Box flexDirection="column" marginBottom={1}>
            <Text bold color="yellow">LIVE PREVIEW</Text>
            {this.previewState ? (
              <Box flexDirection="column">
                <Box>
                  <Text color="gray">{this.previewState.domain}</Text>
                  {this.previewState.iteration !== undefined && (
                    <>
                      <Text> - </Text>
                      <Text color="cyan">v{this.previewState.iteration}</Text>
                    </>
                  )}
                  {this.previewState.score !== undefined && (
                    <>
                      <Text> - </Text>
                      <Text color={this.previewState.score >= 0.7 ? 'green' : 'red'}>
                        ({this.previewState.score.toFixed(2)})
                      </Text>
                    </>
                  )}
                </Box>
                <Box marginTop={1}>
                  <Text color="green" dimColor>{this.previewState.code.slice(0, 60)}...</Text>
                </Box>
                <Box marginTop={1}>
                  <Text color="gray" dimColor>URL: {this.getPreviewUrl()}</Text>
                </Box>
              </Box>
            ) : (
              <Text color="gray">No preview available (Phase 1)</Text>
            )}
          </Box>

          {/* Parameters Section */}
          <Box flexDirection="column" marginBottom={1}>
            <Text bold color="yellow">PARAMETERS</Text>
            <Text color="gray">Use parameter controls to adjust values</Text>
          </Box>

          {/* Iteration History Section */}
          <Box flexDirection="column" marginBottom={1}>
            <Text bold color="yellow">ITERATION HISTORY</Text>
            <Text color="gray">No iterations yet (Phase 1)</Text>
          </Box>

          {/* Actions Section */}
          <Box flexDirection="column">
            <Text bold color="yellow">ACTIONS</Text>
            <Text color="gray">[S]ave   [C]ompost   [N]ew</Text>
          </Box>
        </Box>
      );
    };

    return <PreviewPanel />;
  }

  /**
   * Handle user input from the chat interface
   */
  async handleUserInput(input: string): Promise<void> {
    if (!this.conversation.currentSession) {
      this.conversation.startNewSession();
    }

    await this.conversation.processUserMessage(input);

    // Trigger UI update by forcing a re-render
    // In a real implementation, this would update React state
    // For now, the messages are stored in the conversation manager
    // and will be displayed on next render cycle
  }

  /**
   * Start the interactive input loop
   * This sets up readline to capture user input
   */
  startInputLoop(): void {
    if (this.isInputActive) {
      return; // Already running
    }

    this.isInputActive = true;
    this.readlineInterface = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    // Set up the prompt
    this.readlineInterface.on('line', (input: string) => {
      void (async () => {
        // Trim and skip empty input
        const trimmed = input.trim();
        if (trimmed.length === 0) {
          this.showPrompt();
          return;
        }

        // Handle exit commands
        if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
          this.stopInputLoop();
          return;
        }

        // Process the input
        try {
          await this.handleUserInput(trimmed);

          // Show the response
          const session = this.conversation.sessionHistory[0];
          if (session && session.messages.length > 0) {
            const lastMessage = session.messages[session.messages.length - 1];
            if (lastMessage.role === 'assistant') {
              // eslint-disable-next-line no-console
              console.log(`\nAgent: ${lastMessage.content}\n`);
            }
          }
        } catch (error) {
          Logger.error('ChatCLI', 'Error processing input:', error instanceof Error ? error.message : error);
        }

        // Show prompt again
        this.showPrompt();
      })();
    });

    // Handle Ctrl+C
    this.readlineInterface.on('SIGINT', () => {
      this.stopInputLoop();
      process.exit(0);
    });

    // Show initial prompt
    this.showPrompt();
  }

  /**
   * Stop the input loop
   */
  stopInputLoop(): void {
    if (this.readlineInterface) {
      this.readlineInterface.close();
      this.readlineInterface = null;
    }
    this.isInputActive = false;
  }

  /**
   * Show the input prompt
   */
  private showPrompt(): void {
    if (this.readlineInterface) {
      const phase = this.conversation.interviewPhase;
      const phaseLabel = phase.charAt(0).toUpperCase() + phase.slice(1);
      this.readlineInterface.setPrompt(`[${phaseLabel}] You: `);
      this.readlineInterface.prompt();
    }
  }

  /**
   * Get the current interview question
   */
  getCurrentQuestion(): string | null {
    const question = this.conversation.getInterviewQuestion();
    return question ? question.question : null;
  }

  /**
   * Render a preview of the given code and domain
   * This updates the preview state and optionally serves it via PreviewServer
   */
  renderPreview(code: string, domain: Domain, iteration?: number, score?: number): void {
    // Escape code for safe display (prevent XSS)
    const safeCode = this.escapeCode(code);

    this.previewState = {
      code: safeCode,
      domain,
      timestamp: new Date(),
      iteration,
      score
    };
  }

  /**
   * Escape code for safe display in the preview
   * Prevents script injection while preserving code functionality
   */
  private escapeCode(code: string): string {
    // Escape </script> to prevent breaking out of script tags
    // but keep other code intact for execution
    return code.replace(/\u003c\/script\u003e/gi, '<\\/script>');
  }

  /**
   * Get the current preview state
   */
  getPreviewState(): PreviewState | null {
    return this.previewState;
  }

  /**
   * Get the current iteration number
   */
  getCurrentIteration(): number | undefined {
    return this.previewState?.iteration;
  }

  /**
   * Get the current iteration score
   */
  getCurrentScore(): number | undefined {
    return this.previewState?.score;
  }

  /**
   * Get the preview URL for the current preview
   * Returns a localhost URL pointing to the preview server
   */
  getPreviewUrl(): string {
    const port = 3000; // Default preview server port
    return `http://localhost:${port}/preview`;
  }

  /**
   * Update the preview state with new code and domain
   * @deprecated Use renderPreview instead
   */
  updatePreview(code: string, domain: Domain): void {
    this.renderPreview(code, domain);
  }

  /**
   * Render parameter controls UI
   */
  renderParameterControls(params: Parameter[]): ReactElement {
    const ParameterControls: React.FC = () => {
      return (
        <Box flexDirection="column" paddingX={1}>
          <Text bold color="yellow">PARAMETER CONTROLS</Text>
          {params.map((param) => (
            <Box key={param.name} marginTop={1}>
              <Text color="cyan">{param.name}:</Text>
              <Text> </Text>
              <Text color="white">
                {param.type === 'slider' && typeof param.value === 'number'
                  ? `${param.value.toFixed(2)}`
                  : String(param.value)}
              </Text>
              <Text color="gray">
                {param.type === 'slider' && param.min !== undefined && param.max !== undefined
                  ? ` [${param.min} - ${param.max}]`
                  : ` (${param.type})`}
              </Text>
            </Box>
          ))}
        </Box>
      );
    };

    return <ParameterControls />;
  }

  /**
   * Handle parameter value changes
   */
  handleParameterChange(param: string, value: number | string | boolean): void {
    this.parameterValues.set(param, value);
  }

}

/**
 * React components for the ChatCLI UI
 *
 * NOTE: These exported components duplicate some functionality from the class methods above.
 * This is intentional for Phase 1 to provide flexibility in how components can be used.
 * The class methods (renderChatPanel, renderPreviewPanel, etc.) are used internally by
 * ChatCLI.render(), while these exported components can be used standalone or composed
 * differently. In Phase 2, we may refactor to eliminate duplication.
 */

export const ChatPanel: React.FC<{
  messages: Array<{ role: string; content: string; id: string }>;
}> = ({ messages }) => {
  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="blue"
      paddingX={1}
      height={20}
    >
      <Box marginBottom={1}>
        <Text bold color="blue">CHAT PANEL</Text>
        <Text color="gray"> ({messages.length} messages)</Text>
      </Box>

      <Box flexDirection="column" flexGrow={1}>
        {messages.length === 0 ? (
          <Text color="gray">No messages yet. Start a conversation!</Text>
        ) : (
          messages.slice(-10).map((msg) => (
            <Box key={msg.id} marginBottom={1}>
              <Text
                bold
                color={msg.role === 'user' ? 'green' : msg.role === 'assistant' ? 'cyan' : 'gray'}
              >
                {msg.role}:
              </Text>
              <Text> {msg.content.slice(0, 60)}{msg.content.length > 60 ? '...' : ''}</Text>
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
};

export const PreviewPanel: React.FC<{
  previewState: PreviewState | null;
}> = ({ previewState }) => {
  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="magenta"
      paddingX={1}
      height={20}
    >
      <Box marginBottom={1}>
        <Text bold color="magenta">PREVIEW + CONTROLS PANEL</Text>
      </Box>

      {/* Live Preview Section */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="yellow">LIVE PREVIEW</Text>
        {previewState ? (
          <Box flexDirection="column">
            <Box>
              <Text color="gray">{previewState.domain}</Text>
              {previewState.iteration !== undefined && (
                <>
                  <Text> - </Text>
                  <Text color="cyan">v{previewState.iteration}</Text>
                </>
              )}
              {previewState.score !== undefined && (
                <>
                  <Text> - </Text>
                  <Text color={previewState.score >= 0.7 ? 'green' : 'red'}>
                    ({previewState.score.toFixed(2)})
                  </Text>
                </>
              )}
            </Box>
            <Box marginTop={1}>
              <Text color="green" dimColor>{previewState.code.slice(0, 60)}...</Text>
            </Box>
          </Box>
        ) : (
          <Text color="gray">No preview available (Phase 1)</Text>
        )}
      </Box>

      {/* Parameters Section */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="yellow">PARAMETERS</Text>
        <Text color="gray">Use parameter controls to adjust values</Text>
      </Box>

      {/* Iteration History Section */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="yellow">ITERATION HISTORY</Text>
        <Text color="gray">No iterations yet (Phase 1)</Text>
      </Box>

      {/* Actions Section */}
      <Box flexDirection="column">
        <Text bold color="yellow">ACTIONS</Text>
        <Text color="gray">[S]ave   [C]ompost   [N]ew</Text>
      </Box>
    </Box>
  );
};

export const ParameterControls: React.FC<{
  params: Parameter[];
}> = ({ params }) => {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold color="yellow">PARAMETER CONTROLS</Text>
      {params.map((param) => (
        <Box key={param.name} marginTop={1}>
          <Text color="cyan">{param.name}:</Text>
          <Text> </Text>
          <Text color="white">
            {param.type === 'slider' && typeof param.value === 'number'
              ? `${param.value.toFixed(2)}`
              : String(param.value)}
          </Text>
          <Text color="gray">
            {param.type === 'slider' && param.min !== undefined && param.max !== undefined
              ? ` [${param.min} - ${param.max}]`
              : ` (${param.type})`}
          </Text>
        </Box>
      ))}
    </Box>
  );
};

export const IterationHistory: React.FC<{
  iterations: Array<{ version: number; timestamp: Date; score?: number }>;
}> = ({ iterations }) => {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold color="yellow">ITERATION HISTORY</Text>
      {iterations.length === 0 ? (
        <Text color="gray">No iterations yet (Phase 1)</Text>
      ) : (
        iterations.slice(-5).map((iter) => (
          <Box key={iter.version}>
            <Text color="cyan">v{iter.version}</Text>
            <Text> </Text>
            {iter.score !== undefined && (
              <Text color={iter.score >= 0.7 ? 'green' : 'red'}>
                ({iter.score.toFixed(2)})
              </Text>
            )}
          </Box>
        ))
      )}
    </Box>
  );
};

export const ActionButtons: React.FC = () => {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold color="yellow">ACTIONS</Text>
      <Text color="gray">[S]ave   [C]ompost   [N]ew</Text>
    </Box>
  );
};
