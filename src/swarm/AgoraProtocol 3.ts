/**
 * AgoraProtocol — Structured routine communication for creative agents.
 * Agents exchange creative instructions via compressed notation instead of
 * verbose natural language. Stages: propose, critique, vote, merge, refine.
 */
import { compressToNotation, expandNotation } from './CreativeNotation.js';

/** Stages of an Agora exchange. */
export type RoutineStage = 'propose' | 'critique' | 'vote' | 'merge' | 'refine';

/** A single message in the Agora protocol. */
export interface AgoraMessage {
  id: string;
  from: string;
  to: string[];
  stage: RoutineStage;
  notation: string;
  payload: string;
  round: number;
  timestamp: number;
}

/** Summary result of a completed Agora exchange. */
export interface AgoraResult {
  winner: string;
  consensus: number;
  messages: AgoraMessage[];
  notationUsed: string[];
}

/** Compress NL into routine notation. Prefixes [NL] if no tokens match. */
export function compileToRoutine(naturalLanguage: string): string {
  const notation = compressToNotation(naturalLanguage);
  return notation.length > 0 ? notation : `[NL] ${naturalLanguage}`;
}

/** Expand a compiled routine back to NL, stripping | stage | round:N suffix. */
export function expandRoutine(routine: string): string {
  const parts = routine.split('|').map((s) => s.trim());
  const notationPart = parts[0];
  const stageInfo = parts.slice(1).join(', ');
  const expanded = expandNotation(notationPart);
  return stageInfo ? `${expanded} (${stageInfo})` : expanded;
}

/** Factory: compile content, generate deterministic ID, return full AgoraMessage. */
export function createMessage(
  from: string,
  to: string[],
  stage: RoutineStage,
  content: string,
  round: number,
): AgoraMessage {
  const id = `${from}-${stage}-r${round}`;
  return {
    id,
    from,
    to,
    stage,
    notation: compileToRoutine(content),
    payload: content,
    round,
    timestamp: Date.now(),
  };
}

/**
 * Summarize a completed Agora exchange. Counts per stage, extracts unique
 * notation tokens, picks winner (most-targeted recipient), computes consensus.
 */
export function summarizeExchange(messages: AgoraMessage[]): AgoraResult {
  if (messages.length === 0) {
    return { winner: '', consensus: 0, messages: [], notationUsed: [] };
  }

  // Collect unique notation tokens from all messages
  const notationUsed = [...new Set(
    messages.flatMap((m) => m.notation.split(/\s+/).filter((t) => t.startsWith('~'))),
  )];

  // Tally how often each agent is targeted as a recipient
  const targetCounts = new Map<string, number>();
  for (const msg of messages) {
    for (const recipient of msg.to) {
      targetCounts.set(recipient, (targetCounts.get(recipient) ?? 0) + 1);
    }
  }

  // Winner = most-targeted recipient
  let winner = '';
  let maxCount = 0;
  for (const [agent, count] of targetCounts) {
    if (count > maxCount) {
      maxCount = count;
      winner = agent;
    }
  }

  // Consensus = fraction of messages targeting the winner
  const totalTargets = messages.reduce((sum, m) => sum + m.to.length, 0);
  const consensus = totalTargets > 0 ? maxCount / totalTargets : 0;

  return { winner, consensus, messages, notationUsed };
}
