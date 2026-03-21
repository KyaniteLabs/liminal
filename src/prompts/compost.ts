/**
 * Compost prompt templates — registered with PromptLibrary.
 *
 * Centralizes all compost pipeline prompts (extraction, collision, scoring, digest)
 * into the PromptLibrary registry for consistent management.
 */

import { PromptLibrary } from './PromptLibrary.js';

// ---------------------------------------------------------------------------
// Semantic extraction prompts
// ---------------------------------------------------------------------------

PromptLibrary.register({
  id: 'compost.extract-code',
  version: '1.0.0',
  category: 'compost',
  systemPrompt: 'You are a code analyst. Summarize what this code does in 1-2 sentences. Focus on core logic, patterns, and creative concepts.',
  userPromptTemplate: 'File: ${filename} (${extension})\n\n${content}',
  tags: ['extraction', 'code', 'semantic'],
});

PromptLibrary.register({
  id: 'compost.extract-image',
  version: '1.0.0',
  category: 'compost',
  systemPrompt: 'Describe what is in this image. Extract any ideas, techniques, patterns, or creative concepts visible.',
  userPromptTemplate: '[Image file: ${filename}]',
  tags: ['extraction', 'image', 'semantic'],
});

// ---------------------------------------------------------------------------
// Collision prompts
// ---------------------------------------------------------------------------

PromptLibrary.register({
  id: 'compost.collision-merge',
  version: '1.0.0',
  category: 'compost',
  systemPrompt: 'You are a creative cross-domain collision engine. Combine fragments from unrelated domains into surprising new ideas.',
  userPromptTemplate: '[Fragment A — domain: ${domainA}]\n${contentA}\n\n[Fragment B — domain: ${domainB}]\n${contentB}\n\nWhat ideas emerge from this intersection? Be specific and surprising.',
  tags: ['collision', 'merge', 'cross-domain'],
});

// ---------------------------------------------------------------------------
// Scoring prompts
// ---------------------------------------------------------------------------

PromptLibrary.register({
  id: 'compost.offspring-scoring',
  version: '1.0.0',
  category: 'compost',
  systemPrompt: 'You are a creative quality evaluator. Rate this fragment 0-10 based on novelty, creative potential, and cross-domain value.',
  userPromptTemplate: 'Domain: ${domain}\nLayer: ${layer}\nTags: ${tags}\n\nContent:\n${content}\n\nRespond with JSON: {"score": N, "reasoning": "..."}',
  tags: ['scoring', 'quality', 'evaluation'],
});

// ---------------------------------------------------------------------------
// Digest prompts
// ---------------------------------------------------------------------------

PromptLibrary.register({
  id: 'compost.digest-narrative',
  version: '1.0.0',
  category: 'compost',
  systemPrompt: 'You are a creative digest writer. Synthesize the week\'s compost activity into an engaging narrative.',
  userPromptTemplate: 'Stats: ${stats}\nTop Seeds: ${seeds}\nHighlights: ${highlights}\n\nWrite a narrative synthesis of this week\'s creative compost activity.',
  tags: ['digest', 'narrative', 'summary'],
});

PromptLibrary.register({
  id: 'compost.seed-extraction',
  version: '1.0.0',
  category: 'compost',
  systemPrompt: 'You are a seed extractor. Identify the most valuable creative ideas in this content.',
  userPromptTemplate: 'Content:\n${content}\n\nExtract the top creative seed ideas. Format as JSON array: [{"content": "...", "score": N}]',
  tags: ['seed', 'extraction', 'creative'],
});

// ---------------------------------------------------------------------------
// Synthesis prompt (from DeepCollaboration)
// ---------------------------------------------------------------------------

PromptLibrary.register({
  id: 'compost.synthesis',
  version: '1.0.0',
  category: 'compost',
  systemPrompt: 'You are a creative synthesizer. Combine the best elements from multiple creative outputs into something better than any individual contribution.',
  userPromptTemplate: 'Synthesize the best elements from these two outputs:\n\nCREATOR (Practical, technical):\n${creatorOutput}\n\nVISIONARY (Creative, artistic):\n${visionaryOutput}\n\nOriginal request: ${prompt}\n\nCreate a synthesis that combines:\n- The technical soundness and practicality of the Creator\n- The creativity and artistry of the Visionary\n\nThe synthesis should be better than either alone.',
  tags: ['synthesis', 'collaboration', 'creative'],
});
