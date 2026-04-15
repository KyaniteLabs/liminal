/**
 * Swarm persona prompt templates for PromptLibrary.
 *
 * Registers the 5 swarm persona system prompts at module load time.
 * The swarm/personas.ts data file references these for canonical systemPrompt content.
 */

import { PromptLibrary } from './PromptLibrary.js';
import { SWARM_PERSONA_PROMPTS } from './personaCatalog.js';

PromptLibrary.register({
  id: 'swarm.persona.kai',
  version: '2.0.0',
  category: 'swarm',
  systemPrompt: SWARM_PERSONA_PROMPTS.kai,
  tags: ['persona', 'swarm', 'structural'],
  created: '2026-03-20',
  updated: '2026-03-20',
  metadata: {
    personaId: 'kai',
    displayName: 'The Architect',
    thinkingStyle: 'Top-down. Identify the frame, then fill it.',
  },
});

PromptLibrary.register({
  id: 'swarm.persona.nova',
  version: '2.0.0',
  category: 'swarm',
  systemPrompt: SWARM_PERSONA_PROMPTS.nova,
  tags: ['persona', 'swarm', 'integrative'],
  created: '2026-03-20',
  updated: '2026-03-20',
  metadata: {
    personaId: 'nova',
    displayName: 'The Synthesizer',
    thinkingStyle: 'Convergent. Pull disparate threads into one coherent vision.',
  },
});

PromptLibrary.register({
  id: 'swarm.persona.rex',
  version: '2.0.0',
  category: 'swarm',
  systemPrompt: SWARM_PERSONA_PROMPTS.rex,
  tags: ['persona', 'swarm', 'exploratory'],
  created: '2026-03-20',
  updated: '2026-03-20',
  metadata: {
    personaId: 'rex',
    displayName: 'The Explorer',
    thinkingStyle: 'Lateral. Invert assumptions. Find the blind spot.',
  },
});

PromptLibrary.register({
  id: 'swarm.persona.sam',
  version: '2.0.0',
  category: 'swarm',
  systemPrompt: SWARM_PERSONA_PROMPTS.sam,
  tags: ['persona', 'swarm', 'emotional'],
  created: '2026-03-20',
  updated: '2026-03-20',
  metadata: {
    personaId: 'sam',
    displayName: 'The Muse',
    thinkingStyle: 'Experiential. Start from feeling, build outward.',
  },
});

PromptLibrary.register({
  id: 'swarm.persona.max',
  version: '2.0.0',
  category: 'swarm',
  systemPrompt: SWARM_PERSONA_PROMPTS.max,
  tags: ['persona', 'swarm', 'precise'],
  created: '2026-03-20',
  updated: '2026-03-20',
  metadata: {
    personaId: 'max',
    displayName: 'The Distiller',
    thinkingStyle: 'Reductive. Strip to essence. What remains when everything else is removed?',
  },
});
