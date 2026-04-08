import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useApp } from 'ink';
import type { Iteration } from '../types';

interface XRayPanelProps {
  iterations: Iteration[];
  currentIndex: number;
  rawOutput?: string[];
  isStreaming?: boolean;
}

interface StreamToken {
  id: string;
  text: string;
  timestamp: number;
  type: 'raw' | 'parsed' | 'metadata';
}

export const XRayPanel: React.FC<XRayPanelProps> = ({
  iterations,
  currentIndex,
  rawOutput = [],
  isStreaming = false,
}) => {
  const [tokens, setTokens] = useState<StreamToken[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const { exit } = useApp();

  // Process raw output into displayable tokens
  useEffect(() => {
    if (rawOutput.length > 0) {
      const newTokens: StreamToken[] = rawOutput.map((text, idx) => ({
        id: `token-${Date.now()}-${idx}`,
        text,
        timestamp: Date.now(),
        type: 'raw',
      }));
      
      setTokens(prev => [...prev, ...newTokens]);
    }
  }, [rawOutput]);

  // Auto-scroll when streaming
  useEffect(() => {
    if (isStreaming && containerRef.current) {
      void 0; // placeholder for scroll-into-view when needed
    }
  }, [isStreaming]);

  // Keyboard controls
  useEffect(() => {
    const handleInput = (_data: string, key?: { escape?: boolean }) => {
      if (key?.escape) {
        exit();
      }
    };

    const { stdin } = process;
    stdin.setRawMode(true);
    stdin.on('data', handleInput);

    return () => {
      stdin.setRawMode(false);
      stdin.off('data', handleInput);
    };
  }, [exit]);

  if (iterations.length === 0) {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" height={20}>
        <Text color="#94A3B8">No LLM output yet</Text>
        <Text color="#94A3B8" dimColor>Generate some code to see x-ray view</Text>
      </Box>
    );
  }

  const currentIteration = iterations[currentIndex];

  return (
    <Box flexDirection="column" height={20} borderStyle="round" borderColor="#C084FC">
      {/* Header */}
      <Box paddingX={1} paddingY={0}>
        <Text bold color="#C084FC">X-RAY</Text>
        <Text color="#94A3B8">  Iteration {currentIndex + 1} / {iterations.length}</Text>
        <Text color={isStreaming ? "#22C55E" : "#EAB308"}>
          {' '}[{isStreaming ? "STREAMING" : "IDLE"}]
        </Text>
      </Box>

      {/* Raw Output Stream */}
      <Box
        flexDirection="column"
        flexGrow={1}
        overflow="hidden"
        paddingX={1}
      >
        {tokens.length === 0 && !currentIteration ? (
          <Text color="#94A3B8" dimColor>Waiting for LLM response...</Text>
        ) : (
          <>
            {/* Current iteration code preview */}
            {currentIteration && (
              <Box flexDirection="column" marginBottom={1}>
                <Text color="#22C55E" bold>Current Code:</Text>
                <Text color="#F8FAFC">{currentIteration.code.slice(0, 200)}</Text>
                {currentIteration.code.length > 200 && <Text color="#94A3B8">...</Text>}
              </Box>
            )}

            {/* Streaming tokens */}
            <Box flexDirection="column">
              <Text color="#C084FC" dimColor>Raw LLM Output:</Text>
              {tokens.slice(-10).map((token) => (
                <Text key={token.id} color="#94A3B8" dimColor>
                  {token.text}
                </Text>
              ))}
            </Box>
          </>
        )}
      </Box>

      {/* Footer */}
      <Box paddingX={1} paddingY={0} borderStyle="single" borderColor="#334155">
        <Text dimColor>[ESC] Exit  Real-time LLM output stream</Text>
      </Box>
    </Box>
  );
};
