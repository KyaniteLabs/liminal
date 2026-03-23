/**
 * ChatCLI - Split-view terminal UI for Liminal Chat
 * Phase 1: Foundation - Basic structure with Ink
 */

import { render, Box, Text, Spacer } from 'ink';
import React, { useState, useEffect } from 'react';
import type { ReactElement } from 'react';
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
}

/**
 * ChatCLI - Main CLI class for chat interface
 */
export class ChatCLI {
  conversation: ConversationManager;
  guidance: GuidanceEngineStub;

  // Internal state for UI
  private previewState: PreviewState | null = null;
  private parameterValues: Map<string, any> = new Map();
  private inkInstance: any = null;

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
              <Box>
                <Text color="gray">{this.previewState.domain}</Text>
                <Text> - </Text>
                <Text color="green">{this.previewState.code.slice(0, 50)}...</Text>
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
  }

  /**
   * Update the preview state with new code and domain
   */
  updatePreview(code: string, domain: Domain): void {
    this.previewState = {
      code,
      domain,
      timestamp: new Date()
    };
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
  handleParameterChange(param: string, value: any): void {
    this.parameterValues.set(param, value);
  }

}

/**
 * React components for the ChatCLI UI
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
          <Box>
            <Text color="gray">{previewState.domain}</Text>
            <Text> - </Text>
            <Text color="green">{previewState.code.slice(0, 50)}...</Text>
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
