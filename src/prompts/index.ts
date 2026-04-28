export { PromptLibrary } from './PromptLibrary.js';
export type { PromptTemplate, LibraryStats, TemplateValidation } from './PromptLibrary.js';

// Side-effect imports to register all prompts
import './collaboration.js';
import './collab-internal.js';
import './personas.js';
import './p5.js';
import './three.js';
import './glsl.js';
import './music.js';
import './hydra.js';
import './swarm.js';
import './compost.js';
import './audio.js';
import './aesthetic.js';

// Specialized prompt modules (Phase 4)
export { EVALUATION_SYSTEM_PROMPT, EVALUATION_TEMPERATURE, buildEvaluationPrompt } from './specialized/evaluation.js';
export type { EvaluationCriteria } from './specialized/evaluation.js';
export { CHAT_SYSTEM_PROMPT, CHAT_TEMPERATURE, buildChatPrompt } from './specialized/chat.js';
export type { ChatContext } from './specialized/chat.js';
export { DESIGN_SYSTEM_PROMPT, DESIGN_TEMPERATURE, buildDesignPrompt } from './specialized/design.js';
export type { DesignConstraints } from './specialized/design.js';
