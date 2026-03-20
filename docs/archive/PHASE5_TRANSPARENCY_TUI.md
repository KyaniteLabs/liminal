# Phase 5 Implementation: Transparency Panel Integration

## Overview

This document describes the integration of the TransparencyViewer into the Liminal TUI, providing real-time process visibility during deep collaboration runs.

## Files Created

### 1. `/Users/simongonzalezdecruz/workspaces/liminal/src/tui/components/TransparencyPanel.tsx`

A React component that renders process events from TransparencyViewer in the terminal UI.

**Features:**
- Groups events by phase (Divergence, Analysis, Synthesis, Iteration)
- Color-codes events by type:
  - PROMPT: Yellow (→)
  - OUTPUT: Green (←)
  - ANALYSIS: Magenta (◆)
  - REFINEMENT: Blue (↻)
  - INFO: Gray (·)
- Shows timestamps, model names, and titles
- Truncates long content to fit terminal width
- Displays event count per phase

**Props:**
- `events: ProcessEvent[]` - Array of process events to display
- `height?: number` - Panel height (default: 20)
- `maxWidth?: number` - Maximum width for content truncation (default: 80)

### 2. `/Users/simongonzalezdecruz/workspaces/liminal/test/tui/TransparencyPanel.test.tsx`

React component tests using @testing-library/react.

**Test coverage:**
- Empty state rendering
- Event count display
- Phase grouping
- Timestamp display
- Model name display
- Event title display
- Content truncation
- Edge cases (empty content, no model, no title)
- Multiple phase ordering

### 3. `/Users/simongonzalezdecruz/workspaces/liminal/test/tui/TransparencyPanel.test.js`

Pure JavaScript unit tests for core rendering logic (no React dependencies).

**Test coverage:**
- Event type style mapping
- Content truncation logic
- Event grouping by phase
- Event display priority
- Phase display formatting
- Edge cases (empty content, very long content, special characters)

## Files Modified

### `/Users/simongonzalezdecruz/workspaces/liminal/src/tui/index.tsx`

**Changes:**
1. Added imports:
   - `TransparencyPanel` component
   - `TransparencyViewer` class
   - `ProcessEvent` type

2. Added state:
   - `showTransparency: boolean` - Toggle transparency panel visibility
   - `transparencyEvents: ProcessEvent[]` - Store process events
   - `transparencyViewerRef: useRef<TransparencyViewer>` - Reference to viewer instance

3. Updated `handleGenerate`:
   - Initialize `TransparencyViewer` for each run
   - Pass `onProgress` callback to `collabConfig`
   - Map `PhaseUpdate` from DeepCollaboration to `ProcessEvent`
   - Update transparency events state during generation
   - Log collaboration events to main logs panel

4. Added keyboard input:
   - `t` key toggles transparency panel

5. Updated layout:
   - Added `TransparencyPanel` to flex row (conditional on `showTransparency`)
   - Updated status bar to show `[T]ransparency` shortcut

## Integration Flow

```
User runs prompt
    ↓
RalphLoop.run() with useDeepCollab=true
    ↓
DeepCollaboration.generate() called
    ↓
Phase updates via phaseCallback
    ↓
onProgress in TUI receives PhaseUpdate
    ↓
Maps to ProcessEvent and adds to TransparencyViewer
    ↓
setTransparencyEvents updates TUI state
    ↓
TransparencyPanel re-renders with new events
```

## Event Mapping

The TUI maps DeepCollaboration's `PhaseUpdate` to TransparencyViewer's `ProcessEvent`:

```typescript
const eventType = update.action?.toLowerCase().includes('generating') ? 'prompt' :
                 update.action?.toLowerCase().includes('output') ? 'output' :
                 update.action?.toLowerCase().includes('analysis') ? 'analysis' :
                 update.action?.toLowerCase().includes('refining') ? 'refinement' : 'info';

viewer.addEvent({
  phase: update.phaseName || 'general',
  model: update.model || 'unknown',
  eventType: eventType,
  title: update.action || `${update.model} - ${update.phaseName}`,
  content: update.output || '',
  metadata: {},
});
```

## Usage

1. Start the Liminal TUI
2. Enter a prompt and press Enter
3. During generation (with deep collab enabled), press `t` to toggle the Transparency panel
4. View real-time process events grouped by phase
5. Press `t` again to hide the panel

## Key Design Decisions

1. **Pure String Rendering**: The TransparencyPanel uses Ink's Text and Box components for terminal rendering, following the existing TUI pattern.

2. **Event Grouping**: Events are grouped by phase to provide better organization and readability.

3. **Content Truncation**: Long content is truncated to fit within the terminal width, preventing overflow.

4. **Toggle Visibility**: The panel is optional and can be toggled via keyboard shortcut to save screen space.

5. **Color-Coding**: Each event type has a distinct color and symbol for quick visual identification.

6. **Minimal Changes**: The integration makes minimal changes to the existing TUI, preserving all existing functionality.

## Testing

Run the tests with:

```bash
# Unit tests (JavaScript)
npm test -- test/tui/TransparencyPanel.test.js

# Component tests (TypeScript/React)
npm test -- test/tui/TransparencyPanel.test.tsx
```

## Future Enhancements

1. Add filtering by event type
2. Add filtering by model
3. Add search within events
4. Export events to file
5. Show event details on selection
6. Scroll through event history
7. Show performance metrics per phase

## Dependencies

- React (already in use by TUI)
- Ink (already in use by TUI)
- TransparencyViewer (Phase 2)
- DeepCollaboration (Phase 3)

## Compatibility

- Works with existing TUI components
- Compatible with all TUI features (PlayerPiano, XRay, VoiceInput, Gallery)
- No breaking changes to existing functionality
- TypeScript with strict type checking
