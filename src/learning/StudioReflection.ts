/**
 * StudioReflection — the chat's feeder into the self-improvement flywheel.
 *
 * Mirrors the harness's `onGenerationComplete` pattern, but reflects on a whole
 * *conversation* instead of a single generation: the studio model distills a
 * finished Studio session (the human's words, the revisions, what they kept) into
 * a structured taste signal, which is written to HarnessMemory — the same sink the
 * harness writes to and that GuidanceEngine already reads forward into future
 * generations. That closes a second reflection loop, this one grounded in real
 * human preference rather than the evaluator's proxy.
 *
 * Runs from a user-invocable surface (`sinter chat reflect`, also added to the
 * self-improve daemon) over *persisted* sessions, so it works for a shipping user
 * — not only a dev with a background daemon. Studio persists sessions via
 * TuiBridgeService → SessionGraph → SinterFS, so the input is real.
 */
import type { SinterFS } from '../fs/SinterFS.js';
import { SessionGraph, type SessionTurnRecord } from '../agent/SessionGraph.js';
import { harnessMemory } from '../harness/HarnessMemory.js';
import { Logger } from '../utils/Logger.js';

/** Minimal LLM contract — matches LLMClient.generate(system, user, signal) → { code }. */
export interface ReflectionLLM {
  generate(system: string, user: string, signal?: AbortSignal): Promise<{ code?: string }>;
}

export interface SessionTasteSignal {
  sessionId: string;
  likes: string[];
  dislikes: string[];
  intentSummary: string;
  /** 0..1 — the user's inferred satisfaction with the session's outputs. */
  satisfaction: number;
}

const REFLECT_TIMEOUT_MS = 30000;

const SYSTEM_PROMPT =
  'You distill a creative chat session into the user\'s revealed taste. Output JSON only.';

function buildPrompt(turns: SessionTurnRecord[]): string {
  const transcript = turns
    .map((t, i) =>
      `Turn ${i + 1}:\n  user: ${t.input}\n  assistant: ${t.response}\n` +
      `  produced_artifact: ${(t.artifactRefs?.length ?? 0) > 0 ? 'yes' : 'no'}`,
    )
    .join('\n\n');
  return (
    `From this creative session, infer the user's revealed taste. Weigh outputs the user kept or ` +
    `celebrated as LIKES; outputs they revised away from or rejected as DISLIKES.\n\n` +
    `${transcript}\n\n` +
    `Output exactly this JSON shape:\n` +
    `{"likes":["..."],"dislikes":["..."],"intentSummary":"...","satisfaction":0.0}`
  );
}

/**
 * Core reflection: distill a session's turns into a taste signal. Pure w.r.t. the
 * LLM (injected) so it is unit-testable. Returns null on an empty session, an LLM
 * error, or unparseable output — reflection must never break the caller.
 */
export async function reflectOnSessionTurns(
  sessionId: string,
  turns: SessionTurnRecord[],
  llm: ReflectionLLM,
): Promise<SessionTasteSignal | null> {
  if (turns.length === 0) return null;

  let response: { code?: string };
  try {
    response = await llm.generate(SYSTEM_PROMPT, buildPrompt(turns), AbortSignal.timeout(REFLECT_TIMEOUT_MS));
  } catch (err) {
    Logger.debug('StudioReflection', `reflection LLM failed for ${sessionId}: ${(err as Error)?.message ?? err}`);
    return null;
  }

  const text = response?.code;
  if (!text) return null;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return null;
  }

  return {
    sessionId,
    likes: Array.isArray(parsed.likes) ? parsed.likes.map(String) : [],
    dislikes: Array.isArray(parsed.dislikes) ? parsed.dislikes.map(String) : [],
    intentSummary: typeof parsed.intentSummary === 'string' ? parsed.intentSummary : '',
    satisfaction:
      typeof parsed.satisfaction === 'number' ? Math.max(0, Math.min(1, parsed.satisfaction)) : 0.5,
  };
}

/**
 * Persist a taste signal to HarnessMemory as a `feedback` episode tagged
 * `session-taste`/`studio-reflection`. GuidanceEngine reads these forward; the
 * source tags keep this distinguishable from (and subordinate to) real human pins.
 */
export function recordTasteSignal(signal: SessionTasteSignal): void {
  harnessMemory.recordEpisode({
    type: 'feedback',
    domain: 'session-taste',
    prompt: `Studio session ${signal.sessionId} taste reflection`,
    comment: signal.intentSummary,
    score: signal.satisfaction,
    tags: ['session-taste', 'studio-reflection', ...signal.likes.slice(0, 3)],
  });
}

export interface ReflectSessionsResult {
  reflected: number;
  skipped: number;
  signals: SessionTasteSignal[];
}

/**
 * Enumerate persisted sessions, reflect on the un-reflected ones, and record the
 * signal. Idempotent: a per-session `reflected` marker prevents re-reflection.
 * This is what the CLI command and the daemon call.
 */
export async function reflectUnreflectedSessions(
  fs: SinterFS,
  llm: ReflectionLLM,
  opts: { limit?: number } = {},
): Promise<ReflectSessionsResult> {
  await harnessMemory.initialize();
  const limit = opts.limit ?? 10;

  const sessionIds = [
    ...new Set(
      fs
        .listManifests('session')
        .map((name) => /^session\/([^/]+)\/manifest$/.exec(name)?.[1])
        .filter((id): id is string => !!id),
    ),
  ];

  let reflected = 0;
  let skipped = 0;
  const signals: SessionTasteSignal[] = [];

  for (const id of sessionIds) {
    if (reflected >= limit) break;
    if (fs.readManifest(`session/${id}/reflected`)) {
      skipped++;
      continue;
    }
    const graph = SessionGraph.load(fs, id);
    const signal = graph ? await reflectOnSessionTurns(id, graph.getTurns(), llm) : null;
    if (signal) {
      recordTasteSignal(signal);
      signals.push(signal);
      reflected++;
    } else {
      skipped++;
    }
    // Mark even null reflections so an empty/failed session is not retried forever.
    fs.writeManifest(`session/${id}/reflected`, { reflectedAt: new Date().toISOString() });
  }

  if (reflected > 0) await harnessMemory.save();
  return { reflected, skipped, signals };
}
