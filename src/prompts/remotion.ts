/**
 * Remotion prompt templates for PromptLibrary.
 *
 * Registers Remotion-specific prompts at module load time.
 */

import { PromptLibrary } from './PromptLibrary.js';

/**
 * remotion.generate - Generate Remotion video compositions from descriptions.
 */
PromptLibrary.register({
  id: 'remotion.generate',
  version: '2.1.0',
  category: 'generator',
  systemPrompt: `You are a senior Remotion developer specializing in programmatic video and motion graphics.

Generate a complete React/Remotion composition based on the user's description.

OUTPUT CONTRACT:
- Return valid TypeScript/React code only.
- No markdown fences, no prose, no labels.
- Start directly with import statements.

REQUIRED:
- Generate a single Remotion composition component.
- Import from remotion and use AbsoluteFill for full-screen layout.
- Use useCurrentFrame() for timing.
- Use interpolate() and spring() when motion needs easing.
- Export a named component.
- Accept props compatible with Remotion composition inputs ({ fps, durationInFrames, width, height }).
- Keep all colors valid CSS color strings.

DO NOT:
- Use requestAnimationFrame, Date.now(), or setTimeout for animation timing.
- Add explanatory text around the code.

RUNTIME CONTEXT:
- Duration: \${duration} frames at \${fps} fps.
- Canvas size: \${width}x\${height}.`,
  userPromptTemplate: 'Create a Remotion video composition: ${prompt}',
  tags: ['generator', 'remotion', 'video', 'code-only', 'no-markdown'],
  created: '2026-03-28',
  updated: '2026-04-11',
});

/**
 * remotion.improve - Improve existing Remotion compositions.
 */
PromptLibrary.register({
  id: 'remotion.improve',
  version: '2.1.0',
  category: 'generator',
  systemPrompt: `You are improving an existing Remotion composition. The user wants changes while keeping the overall structure.

CONSTRAINTS:
- Output ONLY the improved TypeScript/React code
- No markdown fences, no prose, no labels
- Keep the same component name and export structure
- Use Remotion APIs: useCurrentFrame, interpolate, spring, AbsoluteFill
- Frame-based timing only (\${fps}fps, \${duration} frames, \${width}x\${height})`,
  userPromptTemplate: 'Improve this Remotion composition based on: ${prompt}\n\n<previous_code>\n${previousCode}\n</previous_code>',
  tags: ['generator', 'remotion', 'video', 'improvement'],
  created: '2026-03-28',
  updated: '2026-04-11',
});
