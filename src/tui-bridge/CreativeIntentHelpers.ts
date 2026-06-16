/**
 * CreativeIntentHelpers — extracted from TuiBridgeService (F20 split)
 *
 * Creative intent analysis, clarification prompts, preference hints, and
 * domain-mismatch detection. Most functions are pure; the emit-dependent
 * ones receive an IntentEmitContext.
 */

import type { TuiBridgeEvent, TuiInputRequest } from './types.js';
import type { TuiSessionStatus } from './types.js';
import { Domain } from '../types/domains.js';
import type { Domain as ChatDomain } from '../chat/types.js';
import { AmbiguityDetector } from '../core/AmbiguityDetector.js';
import {
  buildCreativePreferencePromptHints,
  createCreativePreferenceSuggestion,
} from '../chat/CreativePreferenceGuide.js';
import { validateGeneratedDomainForRequest } from './CreativeDomainRouting.js';
import type { ConversationManager } from '../chat/ConversationManager.js';

// ── Types ──

export interface CreativeIntentBrief {
  userRequest: string;
  requirements: string[];
  missingDetails: string[];
  questions: string[];
  shouldClarify: boolean;
  reason: string;
}

export interface IntentEmitContext {
  emit(sessionId: string, event: TuiBridgeEvent): void;
  updateSession(sessionId: string, patch: Partial<TuiSessionStatus>): TuiSessionStatus;
}

// ── Pure functions ──

export function extractUserPrompt(userText: string): string {
  const match = userText.match(/(?:^|\n)User prompt:\s*([\s\S]+)$/i);
  return (match?.[1] ?? userText).trim();
}

export function toChatDomain(domain: Domain | string): ChatDomain {
  const value = String(domain);
  if (value === Domain.GLSL || value === Domain.WEBGL) return 'shader';
  if (value === Domain.TONE) return 'music';
  if (value === Domain.REVIDEO || value === Domain.HYPERFRAMES) return 'revideo';
  if (['p5', 'shader', 'three', 'music', 'hydra', 'strudel', 'revideo'].includes(value)) {
    return value as ChatDomain;
  }
  return 'p5';
}

export function cleanPreferenceAnswers(answers: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return {};
  return Object.fromEntries(
    Object.entries(answers)
      .filter(([key, value]) => key !== 'priorRunReceipt' && key !== 'revisionKind' && value != null && String(value).trim() !== ''),
  );
}

export function describeStrictDomainMismatch(code: string, requestedDomain: Domain, domainPlan: Domain[]): string | null {
  if (domainPlan.length !== 1) return null;
  const validation = validateGeneratedDomainForRequest(code, requestedDomain);
  return validation.ok ? null : validation.message ?? 'Generated artifact did not match the requested domain';
}

export function domainCorrectionPrompt(originalPrompt: string, requestedDomain: Domain, mismatch: string): string {
  return [
    originalPrompt,
    '',
    `Reject the previous answer: ${mismatch}.`,
    `The requested creative domain is locked to ${requestedDomain}; do not switch frameworks or languages.`,
    `Return only valid ${requestedDomain} artifact code with no prose or markdown.`,
  ].join('\n');
}

export function buildCreativePreferenceLines(
  userText: string,
  domain: Domain | string,
  options: Pick<TuiInputRequest, 'creativePreferences' | 'guidanceAnswers'>,
): string[] {
  const answers = {
    ...cleanPreferenceAnswers(options.creativePreferences),
    ...cleanPreferenceAnswers(options.guidanceAnswers),
  };
  if (Object.keys(answers).length === 0) return [];

  const hints = buildCreativePreferencePromptHints({
    domain: toChatDomain(domain),
    prompt: extractUserPrompt(userText),
    answers,
  });
  if (hints.length === 0) return [];

  return [
    '',
    'Creative preferences (user-confirmed, optional):',
    ...hints.map(hint => `- ${hint}`),
  ];
}

export function buildCreativeIntentBrief(userText: string): CreativeIntentBrief {
  const userRequest = extractUserPrompt(userText);
  const detector = new AmbiguityDetector();
  const issues = detector.detect(userRequest);
  const words = userRequest.split(/\s+/).filter(Boolean);
  const lower = userRequest.toLowerCase();
  const hasColor = /\b(red|orange|yellow|green|blue|purple|violet|pink|white|black|gold|silver|cyan|magenta|monochrome|neon|pastel)\b/.test(lower);
  const hasMotion = /\b(dance|dancing|move|moving|rotate|spinning|pulse|breath|breathes|breathing|flow|grow|morph|animate|animated|kinetic)\b/.test(lower);
  const hasStyle = /\b(glass|metal|organic|alien|soft|hard|minimal|detailed|surreal|realistic|abstract|luminous|dark|bright|noir|retro|cyberpunk)\b/.test(lower);
  const subjectStopWords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'create', 'draw', 'for', 'from', 'generate',
    'in', 'into', 'make', 'of', 'on', 'or', 'sketch', 'the', 'to', 'with',
  ]);
  const vagueSubjectWords = new Set(['better', 'cooler', 'interesting', 'it', 'nice', 'nicer', 'something', 'stuff', 'that', 'things', 'this']);
  const hasNamedVisualObject = /\b(aurora|bird|boat|building|butterfly|castle|city|cloud|comet|creature|crystal|diagram|dragon|fish|flower|forest|galaxy|iceberg|icebergs|icon|island|landscape|logo|machine|moon|mountain|ocean|organism|pattern|planet|portrait|river|robot|scene|shader|ship|sky|star|stars|storm|tree|wave|waves)\b/.test(lower);
  const hasConcreteNounHint = words.some((word) => {
    const cleaned = word.replace(/[^a-zA-Z]/g, '').toLowerCase();
    return cleaned.length >= 4 && !subjectStopWords.has(cleaned) && !vagueSubjectWords.has(cleaned);
  });
  const hasSubject = hasNamedVisualObject || hasConcreteNounHint;
  const highIssues = issues.filter((issue) => (
    issue.severity === 'high' &&
    !(issue.type === 'missing_context' && (words.length >= 10 || hasSubject))
  ));
  const requirements = [
    `Primary request: ${userRequest}`,
    hasSubject ? 'Preserve the named subject and objects from the prompt.' : 'User has not named a concrete subject yet.',
    hasColor ? 'Preserve explicit color and palette cues.' : 'No explicit palette was provided.',
    hasMotion ? 'Preserve explicit motion or behavior cues.' : 'No explicit motion/behavior was provided.',
    hasStyle ? 'Preserve explicit style/material/mood cues.' : 'No explicit style/material/mood was provided.',
  ];
  const missingDetails = [
    !hasSubject ? 'subject' : '',
    !hasColor ? 'palette' : '',
    !hasMotion ? 'motion' : '',
    !hasStyle ? 'style/material' : '',
  ].filter(Boolean);
  const questions = [
    ...highIssues.map((issue) => issue.suggestedQuestion),
    !hasSubject ? 'What is the main subject or object that must be recognizable?' : '',
    !hasColor ? 'What palette or color mood should dominate?' : '',
    !hasMotion ? 'Should it be still, looping, breathing, dancing, morphing, or interactive?' : '',
    !hasStyle ? 'What material or aesthetic should it feel like?' : '',
  ].filter(Boolean).slice(0, 4);
  const shouldClarify = highIssues.length > 0 || (!hasSubject && (words.length < 3 || (!hasColor && !hasMotion && !hasStyle)));
  const reason = highIssues[0]?.description || (words.length < 3 ? 'Prompt is too short to preserve intent reliably.' : 'Prompt is missing a concrete subject.');

  return {
    userRequest,
    requirements,
    missingDetails,
    questions,
    shouldClarify,
    reason,
  };
}

export function promptForCreativeDomain(
  userText: string,
  domain: Domain,
  fallback: boolean,
  intentBrief?: CreativeIntentBrief,
  options: Pick<TuiInputRequest, 'creativePreferences' | 'guidanceAnswers'> = {},
): string {
  const prefix = fallback
    ? `Previous generation route failed. Retry the original request as ${domain}.`
    : `Target creative domain: ${domain}.`;
  const domainInstruction = domain === Domain.THREE
    ? 'Return raw Three.js scene code only. Do not return SVG, p5, prose, or markdown. Expose an audio-reactive object by reading window.__liminalAudio each animation frame; map rms/energy to scale/brightness and centroid/brightness to hue/material intensity.'
    : domain === Domain.P5
      ? 'Return raw p5.js sketch code only. Do not return any other framework, markup, prose, or markdown. Read window.__liminalAudio inside draw(); map rms/energy to scale/brightness and centroid/brightness to hue/motion.'
      : domain === Domain.GLSL || domain === Domain.SHADER || domain === Domain.WEBGL
        ? 'Return raw GLSL fragment shader code only. Do not return SVG, p5, prose, or markdown.'
        : domain === Domain.HYDRA
          ? 'Return raw Hydra video-synth code only. Do not return SVG, p5, prose, or markdown.'
          : domain === Domain.KINETIC
            ? 'Return a complete raw HTML/CSS kinetic typography artifact only. Include visible animated text or letter elements and CSS @keyframes. Do not return p5, SVG-only output, prose, or markdown.'
            : `Return raw ${domain} artifact code only. Do not return SVG unless the target domain is SVG.`;
  const briefLines = intentBrief
    ? [
        'Intent brief:',
        `- User request: ${intentBrief.userRequest}`,
        ...intentBrief.requirements.map((requirement) => `- ${requirement}`),
        intentBrief.missingDetails.length > 0
          ? `- Unknown details: ${intentBrief.missingDetails.join(', ')}. Make conservative choices, but do not ignore explicit requirements.`
          : '- Unknown details: none significant.',
      ]
    : [];
  const preferenceHints = buildCreativePreferenceLines(userText, domain, options);
  return [userText, '', ...briefLines, ...preferenceHints, '', prefix, domainInstruction].join('\n');
}

// ── Emit-dependent functions ──

export function emitIntentBrief(ctx: IntentEmitContext, sessionId: string, intentBrief: CreativeIntentBrief): void {
  ctx.emit(sessionId, {
    type: 'generation.intent_brief',
    sessionId,
    userRequest: intentBrief.userRequest,
    requirements: intentBrief.requirements,
    missingDetails: intentBrief.missingDetails,
    questions: intentBrief.questions,
    willClarify: intentBrief.shouldClarify,
  });
}

export function emitReasoningTrace(
  ctx: IntentEmitContext,
  sessionId: string,
  trace: { phase: string; thought: string; model?: string; detail?: string; source?: 'harness' | 'generator' | 'evaluator' },
): void {
  ctx.emit(sessionId, {
    type: 'generation.reasoning_trace',
    sessionId,
    ...trace,
  });
}

export function emitCreativeClarification(
  ctx: IntentEmitContext,
  sessionId: string,
  intentBrief: CreativeIntentBrief,
  conversation: ConversationManager,
): void {
  const content = [
    'I need to clarify this before generating so I do not guess wrong.',
    '',
    ...intentBrief.questions.map((question, index) => `${index + 1}. ${question}`),
  ].join('\n');
  ctx.emit(sessionId, {
    type: 'generation.clarification_needed',
    sessionId,
    questions: intentBrief.questions,
    reason: intentBrief.reason,
  });
  ctx.emit(sessionId, { type: 'response.delta', sessionId, delta: content });
  ctx.emit(sessionId, { type: 'response.completed', sessionId, content });
  ctx.emit(sessionId, { type: 'response.committed', sessionId, content });
  conversation.appendMessage('assistant', content);
  ctx.emit(sessionId, {
    type: 'status.updated',
    sessionId,
    status: ctx.updateSession(sessionId, {
      mode: 'chat',
      activeTask: 'Clarifying generation intent',
    }),
  });
}

export function emitCreativePreferenceGuidance(
  ctx: IntentEmitContext,
  sessionId: string,
  userText: string,
  domain: Domain | string,
): boolean {
  const prompt = extractUserPrompt(userText);
  const suggestion = createCreativePreferenceSuggestion({
    prompt,
    domain: toChatDomain(domain),
    techniques: [],
    constraints: [],
    references: [],
    iteration: 0,
    currentScore: 0,
  });
  if (!suggestion) return false;

  const questions = suggestion.description
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('- '))
    .map(line => line.slice(2).trim())
    .filter(Boolean);

  ctx.emit(sessionId, {
    type: 'guidance.suggestion',
    sessionId,
    category: 'creative-preferences',
    title: suggestion.title,
    description: suggestion.description,
    priority: suggestion.priority,
    optional: true,
    questions,
  });
  return true;
}

export function emitPriorRunReceiptLink(
  ctx: IntentEmitContext,
  sessionId: string,
  options: Pick<TuiInputRequest, 'creativePreferences'>,
): void {
  const preferences = options.creativePreferences;
  if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) return;
  const prior = preferences.priorRunReceipt;
  if (!prior || typeof prior !== 'object' || Array.isArray(prior)) return;
  const priorRecord = prior as {
    phase?: unknown;
    creativeDomain?: unknown;
    artifact?: { label?: unknown; path?: unknown };
    preview?: { type?: unknown };
  };
  const revisionKindValue = String(preferences.revisionKind || 'revision');
  const revisionKind = ['revise', 'variation', 'polish', 'revision'].includes(revisionKindValue)
    ? revisionKindValue as 'revise' | 'variation' | 'polish' | 'revision'
    : 'revision';
  const artifact = priorRecord.artifact && typeof priorRecord.artifact === 'object'
    ? priorRecord.artifact
    : undefined;
  const previewType = priorRecord.preview?.type;
  ctx.emit(sessionId, {
    type: 'generation.receipt.linked',
    sessionId,
    revisionKind,
    priorPhase: typeof priorRecord.phase === 'string' ? priorRecord.phase : undefined,
    priorDomain: typeof priorRecord.creativeDomain === 'string' ? priorRecord.creativeDomain : undefined,
    priorArtifactLabel: typeof artifact?.label === 'string' ? artifact.label : undefined,
    priorArtifactPath: typeof artifact?.path === 'string' ? artifact.path : undefined,
    priorPreviewType: typeof previewType === 'string' && ['code', 'image', 'html', 'music'].includes(previewType)
      ? previewType as 'code' | 'image' | 'html' | 'music'
      : undefined,
  });
}
