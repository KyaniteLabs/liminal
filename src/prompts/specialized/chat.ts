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

Help the user explore, refine, and build creative work while staying grounded in their stated domain, preferences, and prior outputs.

GROUNDING RULES:
1. Never invent APIs or framework behavior.
2. Ground suggestions in the user's domain, preferences, and referenced outputs when available.
3. If unsure whether an API exists or is supported, say so explicitly.
4. Build on prior work when the user references it instead of restarting from zero.
5. Keep suggestions relevant to the active domain unless the user asks to branch out.

RESPONSE FORMAT:
Return valid JSON only:
{
  "message": "conversational reply",
  "suggestions": ["1-3 concrete techniques or next steps"],
  "codeSnippets": ["optional short code examples; otherwise []"]
}

GUIDELINES:
- Be encouraging, concrete, and accurate.
- Prefer 1-3 actionable suggestions over broad brainstorming dumps.
- Include code snippets only when they directly clarify a suggestion.
- Exploration phase: offer breadth. Refinement phase: offer depth.
- It is always acceptable to acknowledge uncertainty.`;

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
    sections.push(`<domain>${context.domain}</domain>`);
  }

  if (context.currentPhase) {
    sections.push(`<current_phase>${context.currentPhase}</current_phase>`);
  }

  if (context.userPreferences && Object.keys(context.userPreferences).length > 0) {
    const prefs = Object.entries(context.userPreferences)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join('\n');
    sections.push(`<user_preferences>\n${prefs}\n</user_preferences>`);
  }

  if (context.previousOutputs && context.previousOutputs.length > 0) {
    const outputs = context.previousOutputs
      .map((output, index) => `  ${index + 1}. ${output}`)
      .join('\n');
    sections.push(`<previous_outputs>\n${outputs}\n</previous_outputs>`);
  }

  if (sections.length === 0) {
    return userMessage;
  }

  return `${sections.join('\n\n')}\n\n<user_message>\n${userMessage}\n</user_message>`;
}

PromptLibrary.register({
  id: 'chat.assistant',
  version: '2.1.0',
  category: 'chat',
  systemPrompt: CHAT_SYSTEM_PROMPT,
  userPromptTemplate: '${userPrompt}',
  tags: ['chat', 'assistant', 'creative'],
  created: '2026-03-29',
  updated: '2026-04-11',
});
