import React from "react";
import { Box, Text, useInput } from "ink";
import type { Iteration } from "../types";

const COLORS = {
  primary: "cyan",
  muted: "gray",
  border: "gray",
  success: "green",
  highlight: "magenta",
};

interface IterationTimelineProps {
  iterations: Iteration[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  height?: number;
}

/**
 * Iteration timeline: list v1, v2, v3... with timestamp and score per iteration.
 * User can select one to drive preview and code panel (selectedIndex).
 */
export const IterationTimeline: React.FC<IterationTimelineProps> = ({
  iterations,
  selectedIndex,
  onSelectIndex,
  height = 20,
}) => {
  useInput((_input: string, key: any) => {
    if (key.upArrow) onSelectIndex(Math.max(0, selectedIndex - 1));
    else if (key.downArrow) onSelectIndex(Math.min(iterations.length - 1, selectedIndex + 1));
  });

  if (iterations.length === 0) {
    return (
      <Box flexDirection="column" borderStyle="single" borderColor={COLORS.border} width="22%" height={height} paddingX={1}>
        <Box marginBottom={1}>
          <Text bold color={COLORS.primary}>TIMELINE</Text>
          <Text color={COLORS.muted}> v1, v2…</Text>
        </Box>
        <Text color={COLORS.muted}>No iterations yet. Run to see timeline.</Text>
      </Box>
    );
  }

  const visible = iterations.slice(0, height - 4);
  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toTimeString().slice(0, 8);
  };

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={COLORS.border} width="22%" height={height} paddingX={1}>
      <Box marginBottom={1}>
        <Text bold color={COLORS.primary}>TIMELINE</Text>
        <Text color={COLORS.muted}> {iterations.length} iter · [↑↓] select</Text>
      </Box>
      <Box flexDirection="column" flexGrow={1} overflow="hidden">
        {visible.map((iter, idx) => {
          const isSelected = idx === selectedIndex;
          const score = iter.score ?? iter.quality;
          const scoreStr = score != null ? score.toFixed(2) : "—";
          const promiseTag = iter.promiseDetected ? " ✓" : "";
          return (
            <Box key={iter.id}>
              <Text color={isSelected ? COLORS.primary : COLORS.muted}>{isSelected ? "> " : "  "}</Text>
              <Text color={isSelected ? "white" : COLORS.muted} bold={isSelected}>
                v{iter.id}
              </Text>
              <Text color={COLORS.muted}> {formatTime(iter.timestamp)} </Text>
              <Text color={COLORS.success}>s:{scoreStr}{promiseTag}</Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
