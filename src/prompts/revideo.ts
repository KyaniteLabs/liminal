/**
 * Revideo prompt templates for PromptLibrary.
 *
 * Registers Revideo-specific prompts at module load time.
 */

import { PromptLibrary } from './PromptLibrary.js';

/**
 * revideo.generate - Generate Revideo video compositions from descriptions.
 */
PromptLibrary.register({
  id: 'revideo.generate',
  version: '1.0.0',
  category: 'generator',
  systemPrompt: `You are a senior Revideo developer specializing in programmatic video and motion graphics.

Generate a complete Revideo scene based on the user's description.

CONSTRAINTS:
- CRITICAL: Output ONLY valid TypeScript code — NO markdown fences, NO explanatory text
- CRITICAL: Start directly with import statements
- Use @revideo/core for core functionality (makeScene, useTime, signal, etc.)
- Use @revideo/2d for 2D components (Rect, Circle, Txt, etc.)
- Use signal-based reactivity with () => for dynamic values
- All colors must be valid CSS color strings

OUTPUT FORMAT:
- A single Revideo scene using makeScene
- Must include: import {makeScene, useTime} from '@revideo/core'
- Must export default the makeScene call
- Must use yield* time(duration, speed) for scene duration

ANIMATION RULES:
- Use useTime() for time-based animations
- Use interpolate(time(), [start, end], [from, to]) for smooth transitions
- Use signals for reactive values: const value = createSignal(initial)
- Duration is controlled by yield* time(seconds, speed)
- Canvas size: 1920x1080 (full HD)

STRUCTURE:
import {makeScene, useTime, createSignal} from '@revideo/core';
import {Rect, Txt} from '@revideo/2d';
import {interpolate} from '@revideo/core';

export default makeScene(function* (view) {
  const time = useTime();
  // animation setup
  view.add(/* components */);
  yield* time(5, 1); // 5 seconds
});`,
  userPromptTemplate: 'Create a Revideo video scene: ${prompt}',
  tags: ['generator', 'revideo', 'video', 'code-only', 'no-markdown'],
  created: '2026-04-10',
  updated: '2026-04-10',
});

/**
 * revideo.improve - Improve existing Revideo compositions.
 */
PromptLibrary.register({
  id: 'revideo.improve',
  version: '1.0.0',
  category: 'generator',
  systemPrompt: `You are improving an existing Revideo scene. The user wants changes while keeping the overall structure.

CONSTRAINTS:
- Output ONLY the improved TypeScript code
- Keep the same export structure (default export of makeScene)
- Use Revideo APIs: useTime, interpolate, signals, makeScene
- Keep signal-based reactivity patterns`,
  userPromptTemplate: 'Improve this Revideo scene based on: ${prompt}\n\nPrevious code:\n```tsx\n${previousCode}\n```',
  tags: ['generator', 'revideo', 'video', 'improvement'],
  created: '2026-04-10',
  updated: '2026-04-10',
});
