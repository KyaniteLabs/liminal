import React, { useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Iteration } from '../types';

interface PlayerPianoProps {
  iterations: Iteration[];
  currentIndex: number;
  isPlaying: boolean;
  speed?: number;
  onIndexChange?: (index: number) => void;
  onTogglePlay?: () => void;
  height?: number;
}

export const PlayerPiano: React.FC<PlayerPianoProps> = ({
  iterations,
  currentIndex,
  isPlaying,
  speed = 100,
  onIndexChange,
  onTogglePlay,
  height = 20,
}) => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const containerHeight = height;

  // Auto-scroll when playing
  useEffect(() => {
    if (isPlaying && iterations.length > 0) {
      intervalRef.current = setInterval(() => {
        const newIndex = Math.min(currentIndex + 1, iterations.length - 1);
        if (newIndex !== currentIndex && onIndexChange) {
          onIndexChange(newIndex);
        }
      }, speed);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, iterations.length, speed, currentIndex, onIndexChange]);

  // Handle keyboard input
  useInput((_input, key) => {
    if (key.return) {
      onTogglePlay?.();
    }
    if (key.upArrow) {
      onIndexChange?.(Math.max(0, currentIndex - 1));
    }
    if (key.downArrow) {
      onIndexChange?.(Math.min(iterations.length - 1, currentIndex + 1));
    }
  });

  if (iterations.length === 0) {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" height={containerHeight}>
        <Text color="#94A3B8">No iterations yet</Text>
        <Text color="#94A3B8" dimColor>Generate some code to see the player piano</Text>
      </Box>
    );
  }

  const visibleIterations = iterations.slice(
    Math.max(0, currentIndex - 5),
    Math.min(iterations.length, currentIndex + 10)
  );

  return (
    <Box flexDirection="column" height={containerHeight} borderStyle="round" borderColor="#22C55E">
      {/* Header */}
      <Box paddingX={1} paddingY={0}>
        <Text bold color="#22C55E">PLAYER PIANO</Text>
        <Text color="#94A3B8">  {currentIndex + 1} / {iterations.length}</Text>
        <Text color={isPlaying ? "#22C55E" : "#EAB308"}>  [{isPlaying ? "PLAYING" : "PAUSED"}]</Text>
      </Box>

      {/* Piano Roll - Code Lines */}
      <Box 
        flexDirection="column" 
        flexGrow={1} 
        overflow="hidden"
        data-testid="piano-roll"
      >
        {visibleIterations.map((iteration, idx) => {
          const actualIndex = Math.max(0, currentIndex - 5) + idx;
          const isCurrent = actualIndex === currentIndex;
          
          return (
            <Box 
              key={iteration.id}
              data-current={isCurrent ? 'true' : 'false'}
              flexDirection="row"
              paddingX={1}
            >
              <Text color={isCurrent ? '#22C55E' : '#94A3B8'} dimColor={!isCurrent}>
                {String(actualIndex + 1).padStart(3, '0')} │
              </Text>
              <Text 
                color={isCurrent ? '#F8FAFC' : '#94A3B8'}
                dimColor={!isCurrent}
                wrap="truncate-end"
              >
                {iteration.code.split('\n')[0].slice(0, 60)}
              </Text>
            </Box>
          );
        })}
      </Box>

      {/* Footer / Controls */}
      <Box paddingX={1} paddingY={0} borderStyle="single" borderColor="#334155">
        <Text dimColor>[RETURN] Play/Pause  [Up/Dn] Navigate  [ESC] Exit</Text>
      </Box>
    </Box>
  );
};
