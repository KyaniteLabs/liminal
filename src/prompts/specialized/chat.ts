/**
 * @module prompts/specialized/chat
 *
 * Specialized prompt definitions for creative assistant chat interactions.
 *
 * Inspired by Print-OS's assistant system prompt with telemetry grounding
 * rules. Provides a collaborative creative coding assistant that proactively
 * suggests techniques while staying grounded in the user's stated preferences
 * and past outputs.
 *
 * All responses are structured as JSON to enable programmatic consumption
 * by the chat pipeline.
 */

import { PromptLibrary } from '../PromptLibrary.js';

/**
 * Context provided to the chat prompt builder to ground the assistant's
 * responses in the user's creative history and current workflow state.
 */
export interface ChatContext {
  /** The creative domain the user is working in (e.g. "visual", "audio", "3d"). */
  domain?: string;

  /** Prior generated outputs referenced by the user in this conversation. */
  previousOutputs?: string[];

  /** Key-value pairs of user preferences discovered through conversation. */
  userPreferences?: Record<string, string>;

  /** The current phase of the creative workflow (e.g. "exploration", "refinement"). */
  currentPhase?: string;
}

/** Temperature for chat completions — warm enough for creative suggestions, cool enough for accuracy. */
export const CHAT_TEMPERATURE = 0.7;

/**
 * System prompt for the creative coding assistant.
 *
 * Defines the assistant's persona, capabilities, grounding rules, and
 * response format. The assistant acts as a collaborative partner that
 * proactively suggests creative techniques while never fabricating APIs.
 */
export const CHAT_SYSTEM_PROMPT = `You are a collaborative creative coding partner for generative art and creative technology.

Your role is to help users explore, ideate, and build generative artworks. You proactively suggest techniques, patterns, and creative approaches — but always grounded in what you know about the user's preferences and past work.

CAPABILITIES:
- Creative coding across p5.js, Three.js, GLSL shaders, Hydra, Strudel, and Remotion
- Generative art techniques: noise, particle systems, flocking, L-systems, cellular automata, fractals
- Audio-reactive visuals and live coding
- Color theory, composition, and aesthetic guidance

GROUNDING RULES — VIOLATION OF THESE IS A CRITICAL ERROR:
1. Never fabricate or hallucinate API methods — only suggest real, documented functions
2. Ground every suggestion in the user's stated preferences and past outputs when available
3. If you are uncertain whether a function exists, say so explicitly rather than guessing
4. Reference specific past outputs by name when making connections or suggesting iterations
5. Respect the user's domain — do not suggest Three.js techniques when they are working in p5.js unless they ask

RESPONSE FORMAT — you MUST respond with valid JSON matching this structure:
{
  "message": "Your conversational response to the user",
  "suggestions": ["Technique or approach suggestion 1", "Suggestion 2"],
  "codeSnippets": ["// Optional code example when relevant"]
}

GUIDELINES:
- Be enthusiastic and encouraging — creative work thrives on positive energy
- Suggest 1-3 concrete techniques or approaches per response
- Include code snippets only when they directly illustrate a suggestion
- When the user references a past output, build on it rather than starting from scratch
- If the user is in an exploration phase, offer breadth; if in refinement, offer depth
- Acknowledge uncertainty — "I'm not sure if this works in version X" is always acceptable`;

/**
 * Builds the user-facing prompt for a chat message, enriching it with
 * conversation context so the assistant can ground its response.
 *
 * @param userMessage - The raw message from the user.
 * @param context     - Optional context containing domain, preferences,
 *                      previous outputs, and workflow phase.
 * @returns A formatted user prompt string ready for the LLM.
 */
export function buildChatPrompt(userMessage: string, context?: ChatContext): string {
  if (!context) {
    return userMessage;
  }

  const sections: string[] = [];

  if (context.domain) {
    sections.push(`[Domain: ${context.domain}]`);
  }

  if (context.currentPhase) {
    sections.push(`[Current phase: ${context.currentPhase}]`);
  }

  if (context.userPreferences && Object.keys(context.userPreferences).length > 0) {
    const prefs = Object.entries(context.userPreferences)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join('\n');
    sections.push(`[User preferences]\n${prefs}`);
  }

  if (context.previousOutputs && context.previousOutputs.length > 0) {
    const outputs = context.previousOutputs
      .map((output, index) => `  ${index + 1}. ${output}`)
      .join('\n');
    sections.push(`[Previous outputs referenced]\n${outputs}`);
  }

  if (sections.length === 0) {
    return userMessage;
  }

  return `${sections.join('\n\n')}\n\n---\n\n${userMessage}`;
}

PromptLibrary.register({
  id: 'chat.assistant',
  version: '1.0.0',
  category: 'chat',
  systemPrompt: CHAT_SYSTEM_PROMPT,
  userPromptTemplate: '{{userPrompt}}',
  tags: ['chat', 'assistant', 'creative'],
  created: '2026-03-29',
  updated: '2026-03-29',
});
