export interface TraceSummary {
  summary: string;
  details: string[];
}

const STOP_PREFIX = /^(?:i\s+(?:will|need|should|am|can|must)|let(?:'s| me)|we\s+(?:need|should|can|will|must)|the\s+model|this\s+means)\s+/i;

function compact(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function cleanSentence(sentence: string): string {
  return compact(sentence)
    .replace(STOP_PREFIX, '')
    .replace(/\b(?:maybe|perhaps|probably)\b/gi, 'possibly')
    .replace(/\s+([,.;:!?])/g, '$1');
}

function splitSentences(trace: string): string[] {
  return compact(trace)
    .split(/(?<=[.!?])\s+|\n+/)
    .map(cleanSentence)
    .filter((sentence) => sentence.length > 12);
}

function firstMatch(sentences: string[], patterns: RegExp[]): string | undefined {
  return sentences.find((sentence) => patterns.some((pattern) => pattern.test(sentence)));
}

function truncate(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, Math.max(0, limit - 3))}...` : value;
}

export function summarizeReasoningTrace(
  trace: string,
  source: 'harness' | 'generator' | 'evaluator' = 'generator',
): TraceSummary {
  const sentences = splitSentences(trace);
  if (sentences.length === 0) {
    return { summary: 'No usable reasoning was captured.', details: [] };
  }

  const sourcePatterns: Record<typeof source, RegExp[]> = {
    harness: [/route|domain|requirement|missing|candidate|timeout|iteration|tool|verify|repair/i],
    generator: [/choose|use|draw|render|animate|map|because|subject|color|motion|shape|scene|shader|svg|p5|three/i],
    evaluator: [/score|visible|matches|missing|weak|strong|repair|issue|fix|constraint|quality|render/i],
  };
  const uncertainty = firstMatch(sentences, [/unclear|ambiguous|not sure|missing|unknown|confus|risk|failed|cannot|can't/i]);
  const decision = firstMatch(sentences, sourcePatterns[source]);
  const constraint = firstMatch(sentences, [/must|should|avoid|constraint|require|preserve|do not|don't/i]);
  const action = firstMatch(sentences, [/fix|repair|change|add|remove|increase|reduce|simplify|reroute|retry|validate/i]);
  const picked = [decision, uncertainty, constraint, action]
    .filter((item): item is string => Boolean(item))
    .filter((item, index, array) => array.indexOf(item) === index);
  const summary = truncate(picked[0] || sentences[0], 180);
  const details = picked.slice(1, 4).map((item) => truncate(item, 160));

  return { summary, details };
}
