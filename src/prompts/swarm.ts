/**
 * Swarm voting prompt template for PromptLibrary.
 *
 * Registers swarm-specific prompts at module load time.
 */

import { PromptLibrary } from './PromptLibrary.js';

/**
 * swarm.voting - Vote on swarm-generated creative pieces.
 * Used by VotingEngine to have personas vote on each other's outputs.
 */
PromptLibrary.register({
  id: 'swarm.voting',
  version: '2.1.0',
  category: 'swarm',
  systemPrompt: `You are \${displayName}, a creative coding expert.
\${voice}
Voting criteria: \${votingBias}`,
  userPromptTemplate: `Rank these pieces as 1st and 2nd choice:
\${candidates}

Return JSON: {"first": "A/B/C/etc", "second": "A/B/C/etc", "reasoning": "Specific reason referencing qualities"}
No text outside the JSON.`,
  tags: ['swarm', 'voting', 'json-output'],
  created: '2026-03-20',
  updated: '2026-04-04',
  metadata: {
    description: 'Vote on swarm-generated creative pieces',
  },
});
