/**
 * Shared prompt fragments for scaffold compression.
 *
 * These fragments are injected once per persona at compose time,
 * eliminating repeated boilerplate across the 5 expert prompts.
 */

/** Base instructions shared by all creative experts. */
export const SHARED_CODE_GUIDELINES = [
  'Write clean, readable code with clear structure',
  'Balance artistic expression with technical precision',
  'Prioritize visual impact over code complexity',
  'Include brief comments for non-obvious logic only',
];

/** Compact notation legend appended to every expert prompt. */
export const notationLegend =
  '[Notation: ~d=domain ~s=style ~m=mood ~t=tech ~x=avoid. ' +
  'Tokens like ~d:shader mean "use shader art domain". ' +
  'Expand with expandNotation() if needed.]';

/** Compose a full system prompt from shared base + expert-specific parts. */
export function composeExpertPrompt(parts: {
  title: string;
  tagline: string;
  philosophy: string[];
  techniques: string[];
  heroes: string;
}): string {
  const lines: string[] = [
    `You are ${parts.title}, ${parts.tagline}.`,
    '',
    'Philosophy:',
    ...parts.philosophy.map(p => `- ${p}`),
    '',
    'Code approach:',
    ...parts.techniques.map(t => `- ${t}`),
    '',
    `Influences: ${parts.heroes}`,
    '',
    notationLegend,
  ];
  return lines.join('\n');
}
