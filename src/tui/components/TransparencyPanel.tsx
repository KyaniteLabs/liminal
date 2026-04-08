import React from "react";
import { Box, Text } from "ink";
import { EventType, type ProcessEvent } from "../../ui/TransparencyViewer.js";

const COLORS = {
  // Unified design tokens — matches Bubble Tea 256-color + GUI Atelier dark OLED palette
  primary: "#22C55E",
  muted: "#94A3B8",
  dim: "#475569",
  border: "#334155",
  success: "#22C55E",
  warning: "#EAB308",
  highlight: "#C084FC",
  error: "#EF4444",
  info: "#93C5FD",
};

interface TransparencyPanelProps {
  events: ProcessEvent[];
  height?: number;
  maxWidth?: number;
}

/**
 * Map event types to display colors and symbols
 */
const EVENT_STYLES: Record<EventType, { color: keyof typeof COLORS; symbol: string; label: string }> = {
  [EventType.PROMPT]: { color: "warning", symbol: "→", label: "PROMPT" },
  [EventType.OUTPUT]: { color: "success", symbol: "←", label: "OUTPUT" },
  [EventType.ANALYSIS]: { color: "highlight", symbol: "◆", label: "ANALYSIS" },
  [EventType.REFINEMENT]: { color: "info", symbol: "↻", label: "REFINE" },
  [EventType.INFO]: { color: "muted", symbol: "·", label: "INFO" },
};

/**
 * Group events by phase for better organization
 */
function groupEventsByPhase(events: ProcessEvent[]): Map<string, ProcessEvent[]> {
  const grouped = new Map<string, ProcessEvent[]>();

  for (const event of events) {
    const phase = event.phase || "general";
    if (!grouped.has(phase)) {
      grouped.set(phase, []);
    }
    grouped.get(phase)!.push(event);
  }

  return grouped;
}

/**
 * Truncate content to fit within max width
 */
function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) {
    return content;
  }
  return content.slice(0, maxLength - 3) + "...";
}

/**
 * Format timestamp for display
 */
function formatTimestamp(ts: string): string {
  // ts is already in HH:MM:SS format from TransparencyViewer
  return ts;
}

/**
 * TransparencyPanel - Display process events from TransparencyViewer
 *
 * Shows events grouped by phase with color-coding by event type.
 * Displays timestamps, model names, and truncated content.
 */
export const TransparencyPanel: React.FC<TransparencyPanelProps> = ({
  events,
  height = 20,
  maxWidth = 80,
}) => {
  if (events.length === 0) {
    return (
      <Box flexDirection="column" borderStyle="single" borderColor={COLORS.border} width="25%" height={height} paddingX={1}>
        <Box marginBottom={1}>
          <Text bold color={COLORS.primary}>TRANSPARENCY</Text>
          <Text color={COLORS.muted}> (Process Log)</Text>
        </Box>
        <Text color={COLORS.muted}>No events yet. Run with deep collab to see process transparency.</Text>
      </Box>
    );
  }

  const groupedEvents = groupEventsByPhase(events);
  const maxContentLength = Math.max(20, maxWidth - 30); // Reserve space for timestamp, model, etc.

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={COLORS.border} width="25%" height={height} paddingX={1}>
      <Box marginBottom={1}>
        <Text bold color={COLORS.primary}>TRANSPARENCY</Text>
        <Text color={COLORS.muted}> ({events.length} events)</Text>
      </Box>

      <Box flexDirection="column" flexGrow={1} overflow="hidden">
        {Array.from(groupedEvents.entries()).map(([phase, phaseEvents]) => (
          <Box key={phase} flexDirection="column" marginBottom={1}>
            <Box>
              <Text bold color={COLORS.info}>{phase.toUpperCase()}</Text>
              <Text color={COLORS.muted}> ({phaseEvents.length})</Text>
            </Box>

            {phaseEvents.slice(0, height - 4).map((event, idx) => {
              const style = EVENT_STYLES[event.eventType];
              const truncatedContent = event.content ? truncateContent(event.content, maxContentLength) : "";
              const modelDisplay = event.model ? `[${event.model}] ` : "";

              return (
                <Box key={`${phase}-${idx}`} flexDirection="column" marginBottom={idx < phaseEvents.length - 1 ? 1 : 0}>
                  <Box>
                    <Text color={COLORS.muted}>{formatTimestamp(event.timestamp)}</Text>
                    <Text color={COLORS[style.color]}> {style.symbol}</Text>
                    <Text bold color={COLORS[style.color]}> {style.label}</Text>
                    {event.model && <Text color={COLORS.muted}> {modelDisplay}</Text>}
                  </Box>
                  {event.title && (
                    <Box>
                      <Text color={COLORS.muted}>  </Text>
                      <Text color={COLORS.primary}>{event.title}</Text>
                    </Box>
                  )}
                  {truncatedContent && (
                    <Box>
                      <Text color={COLORS.muted}>  </Text>
                      <Text color={COLORS.muted}>{truncatedContent}</Text>
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>
    </Box>
  );
};
