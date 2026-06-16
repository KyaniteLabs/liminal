/**
 * CommandDispatcher — extracted from TuiBridgeService (F20 split)
 *
 * All slash-command parsing and handling lives here. The dispatch function
 * receives a CommandContext that provides access to managers, state, and
 * streaming callbacks. Returns null when no command matches, signaling the
 * caller to fall through to intent classification.
 */

import type { LLMClient } from '../llm/LLMClient.js';
import type { TuiBridgeEvent, TuiInputRequest, TuiPendingAction } from './types.js';
import { ConversationManager } from '../chat/ConversationManager.js';
import { PRODUCT_MODES } from '../agent/ProductMode.js';
import type { ProductMode, ModeConfig } from '../agent/ProductMode.js';
import type { SkillRunner } from '../agent/SkillRunner.js';
import type { SkillCatalog } from '../agent/SkillCatalog.js';
import type { ReviewManager } from '../agent/ReviewManager.js';
import type { DiffRenderer } from '../agent/DiffRenderer.js';
import type { OnboardingWizard } from '../agent/OnboardingWizard.js';
import type { EnvironmentValidator } from '../agent/EnvironmentValidator.js';
import type { SessionResumer } from '../agent/SessionResumer.js';
import type { ReportGenerator } from '../agent/ReportGenerator.js';
import type { WorkspaceManager } from '../agent/WorkspaceManager.js';
import type { AutonomyController } from '../agent/AutonomyController.js';
import type { ModeRegistry } from '../agent/ModeRegistry.js';
import type { SessionGraph } from '../agent/SessionGraph.js';
import type { TuiSessionStore } from './TuiSessionStore.js';
import type { GoalStore } from '../cortex/GoalStore.js';
import type { SinterCortex } from '../cortex/SinterCortex.js';
import type { CortexPerceptionBus } from '../cortex/CortexPerceptionBus.js';
import type { CortexConfig } from '../cortex/types.js';
import { CortexExplainer } from '../cortex/CortexExplainer.js';
import { STUDIO_SYSTEM_PROMPT } from '../agent/StudioAgent.js';
import { Logger } from '../utils/Logger.js';

// ── Context interface ──

export interface CommandContext {
  emit(sessionId: string, event: TuiBridgeEvent): void;
  emitCommandResponse(sessionId: string, content: string): void;

  skillRunner: SkillRunner;
  skillCatalog: SkillCatalog;
  reviewManager: ReviewManager;
  diffRenderer: DiffRenderer;
  onboardingWizard: OnboardingWizard;
  envValidator: EnvironmentValidator;
  sessionResumer: SessionResumer;
  reportGenerator: ReportGenerator;
  workspaceManager: WorkspaceManager;
  autonomyController: AutonomyController;
  modeRegistry: ModeRegistry;

  conversations: Map<string, ConversationManager>;
  sessionGraphs: Map<string, SessionGraph>;
  sessions: TuiSessionStore;
  cortexLoop: SinterCortex | null;
  cortexBus: CortexPerceptionBus;

  setProductMode(sessionId: string, mode: ProductMode): ModeConfig;
  ensureSessionsHydrated(): void;
  recordReviewPreference(sessionId: string, action: 'pin' | 'reject', artifactId: string): Promise<boolean>;
  getGoalStore(): GoalStore | null;

  streamRalphGeneration: (
    sessionId: string,
    userText: string,
    conversation: ConversationManager,
    llm: LLMClient,
    options?: Pick<TuiInputRequest, 'maxIterations' | 'candidateCount' | 'timeoutMinutes' | 'creativePreferences' | 'guidanceAnswers'>,
  ) => Promise<void>;
  streamEngineeringTask: (
    sessionId: string,
    userText: string,
    conversation: ConversationManager,
    llm: LLMClient,
  ) => Promise<void>;
  streamChatResponse: (
    sessionId: string,
    userText: string,
    conversation: ConversationManager,
    llm: LLMClient,
    systemPrompt?: string,
  ) => Promise<void>;

  cortexConfig: CortexConfig;
}

function logBridge(event: string, fields: Record<string, unknown>): void {
  Logger.info('CommandDispatcher', `${event} ${JSON.stringify(fields)}`);
}

// ── Dispatch ──

export async function dispatchCommand(
  ctx: CommandContext,
  sessionId: string,
  input: string,
  llm?: LLMClient,
): Promise<{ reviewRequired: boolean } | null> {
  const text = input.trim();

  // /modes
  if (text === '/modes') {
    const modes = Object.entries(PRODUCT_MODES).map(([mode, info]) => ({
      mode,
      label: info.label,
      description: info.description,
    }));
    ctx.emit(sessionId, { type: 'mode.list', sessionId, modes });
    const content = modes.map(m => `  ${m.mode.padEnd(8)} ${m.label} — ${m.description}`).join('\n');
    ctx.emitCommandResponse(sessionId, `Available modes:\n${content}`);
    return { reviewRequired: false };
  }

  // /mode <name>
  if (input.startsWith('/mode')) {
    return handleMode(ctx, sessionId, input);
  }

  // /skills
  if (text === '/skills') {
    const modeConfig = ctx.modeRegistry.getMode(sessionId);
    const entries = await ctx.skillCatalog.list({ mode: modeConfig?.mode });
    ctx.emit(sessionId, {
      type: 'skill.list',
      sessionId,
      skills: entries.map(e => ({ name: e.name, description: e.description, mode: e.mode })),
    });
    if (entries.length === 0) {
      ctx.emitCommandResponse(sessionId, 'No skills available. Add .skills/<name>/SKILL.md files.');
    } else {
      const lines = entries.map(e => {
        const modeTag = e.mode ? ` [${e.mode}]` : '';
        return `  ${e.name.padEnd(20)} ${e.description}${modeTag}`;
      });
      ctx.emitCommandResponse(sessionId, `Available skills:\n${lines.join('\n')}`);
    }
    return { reviewRequired: false };
  }

  // /skill <name>
  if (input.startsWith('/skill ')) {
    return handleSkill(ctx, sessionId, input, llm);
  }

  // Review commands
  if (input.startsWith('/accept') || input.startsWith('/reject') ||
      input.startsWith('/pin') || input.startsWith('/diff') ||
      input.startsWith('/taste') ||
      text === '/candidates') {
    return handleReview(ctx, sessionId, input);
  }

  // /setup
  if (text === '/setup') {
    return handleSetup(ctx, sessionId);
  }

  // /diagnostics
  if (text === '/diagnostics') {
    return handleDiagnostics(ctx, sessionId);
  }

  // /sessions
  if (text === '/sessions') {
    return handleSessions(ctx, sessionId);
  }

  // /report [json|markdown]
  if (text === '/report' || text === '/report markdown' || text === '/report json') {
    return handleReport(ctx, sessionId, text);
  }

  // /workspace
  if (input.startsWith('/workspace')) {
    return handleWorkspace(ctx, sessionId, text);
  }

  // /autonomy
  if (input.startsWith('/autonomy')) {
    return handleAutonomy(ctx, sessionId, text);
  }

  // /goal
  if (input.startsWith('/goal')) {
    return handleGoal(ctx, sessionId, text);
  }

  // /cortex
  if (text === '/cortex' || text.startsWith('/cortex ')) {
    return handleCortex(ctx, sessionId, text);
  }

  return null;
}

// ── Handlers ──

function handleMode(ctx: CommandContext, sessionId: string, input: string): { reviewRequired: boolean } {
  const parts = input.trim().split(/\s+/);
  const modeName = parts[1]?.toLowerCase();

  if (!modeName || !Object.hasOwn(PRODUCT_MODES, modeName)) {
    const available = Object.keys(PRODUCT_MODES).join(', ');
    ctx.emitCommandResponse(sessionId, `Unknown mode. Available: ${available}`);
    return { reviewRequired: false };
  }

  const config = ctx.setProductMode(sessionId, modeName as ProductMode);
  const modeInfo = PRODUCT_MODES[config.mode];
  ctx.emitCommandResponse(sessionId, `Mode switched to ${modeInfo.label} — ${modeInfo.description}`);
  return { reviewRequired: false };
}

async function handleSkill(
  ctx: CommandContext,
  sessionId: string,
  input: string,
  llm?: LLMClient,
): Promise<{ reviewRequired: boolean }> {
  const parts = input.trim().split(/\s+/);
  const skillName = parts[1];

  if (!skillName) {
    ctx.emitCommandResponse(sessionId, 'Usage: /skill <name> [input text]');
    return { reviewRequired: false };
  }

  const userInput = parts.slice(2).join(' ');
  const result = await ctx.skillRunner.resolve(skillName, { input: userInput });

  if (!result) {
    ctx.emitCommandResponse(sessionId, `Unknown skill: ${skillName}. Use /skills to list available skills.`);
    return { reviewRequired: false };
  }

  logBridge('skill.started', { sessionId, skillName, target: result.target, durationMs: result.durationMs });
  ctx.emit(sessionId, { type: 'skill.started', sessionId, skillName });

  let conversation = ctx.conversations.get(sessionId);
  if (!conversation) {
    conversation = new ConversationManager();
    conversation.startNewSession();
    ctx.conversations.set(sessionId, conversation);
  }
  conversation.appendMessage('user', input);

  if (!llm) {
    ctx.emitCommandResponse(sessionId, result.prompt);
    ctx.emit(sessionId, { type: 'skill.completed', sessionId, skillName, durationMs: result.durationMs });
    return { reviewRequired: false };
  }

  const routeStart = Date.now();
  const handleError = (err: unknown) => {
    ctx.emit(sessionId, { type: 'error', sessionId, message: err instanceof Error ? err.message : String(err) });
  };

  const emitCompletion = () => {
    ctx.emit(sessionId, {
      type: 'skill.completed',
      sessionId,
      skillName,
      durationMs: Date.now() - routeStart,
    });
  };

  if (result.target !== 'chat') {
    const skillActionKind = result.target === 'creative' ? 'creative' as const : 'engineering' as const;
    if (ctx.autonomyController.requiresReview(skillActionKind, sessionId)) {
      const pendingAction: TuiPendingAction = {
        id: `skill-${skillName}-${Date.now()}`,
        title: `Skill: ${skillName}`,
        description: result.prompt.slice(0, 100),
        prompt: result.prompt,
        route: result.target === 'creative' ? 'creative' : result.target === 'engineering' ? 'engineering' : 'hybrid',
        kind: 'llm',
        requiresConfirmation: true,
        createdAt: new Date().toISOString(),
      };
      const status = ctx.sessions.update(sessionId, {
        mode: 'action',
        trust: { level: 'review-required', label: `Autonomy: ${ctx.autonomyController.getConfig(sessionId).label} — skill "${skillName}" needs review` },
        pendingAction,
      });
      ctx.emit(sessionId, { type: 'action.review_required', sessionId, action: pendingAction });
      ctx.emit(sessionId, { type: 'status.updated', sessionId, status });
      return { reviewRequired: true };
    }
  }

  switch (result.target) {
    case 'creative':
      ctx.streamRalphGeneration(sessionId, result.prompt, conversation, llm)
        .then(() => emitCompletion())
        .catch(handleError);
      break;
    case 'engineering':
      ctx.streamEngineeringTask(sessionId, result.prompt, conversation, llm)
        .then(() => emitCompletion())
        .catch(handleError);
      break;
    default:
      ctx.streamChatResponse(sessionId, result.prompt, conversation, llm, STUDIO_SYSTEM_PROMPT)
        .then(() => emitCompletion())
        .catch(handleError);
      break;
  }

  return { reviewRequired: false };
}

async function handleReview(ctx: CommandContext, sessionId: string, input: string): Promise<{ reviewRequired: boolean }> {
  const parts = input.trim().split(/\s+/);
  const cmd = parts[0];

  if (cmd === '/candidates') {
    const candidates = ctx.reviewManager.list({ sessionId });
    if (candidates.length === 0) {
      ctx.emitCommandResponse(sessionId, 'No review candidates for this session.');
    } else {
      const lines = candidates.map(c => {
        const statusTag = c.status === 'accepted' ? ' ✓' : c.status === 'rejected' ? ' ✗' : ' …';
        return `  ${c.id.slice(0, 20).padEnd(22)} ${c.score.toFixed(2)}  ${c.label}${statusTag}`;
      });
      ctx.emitCommandResponse(sessionId, `Review candidates:\n${lines.join('\n')}`);
    }
    return { reviewRequired: false };
  }

  if (cmd === '/accept') {
    const candidateId = parts[1];
    if (!candidateId) {
      ctx.emitCommandResponse(sessionId, 'Usage: /accept <candidate-id>');
      return { reviewRequired: false };
    }
    const candidate = ctx.reviewManager.accept(candidateId);
    if (!candidate) {
      ctx.emitCommandResponse(sessionId, `Candidate ${candidateId} not found.`);
    } else {
      ctx.emit(sessionId, { type: 'review.candidate_accepted', sessionId, candidateId });
      ctx.emitCommandResponse(sessionId, `Accepted: ${candidate.label} (score: ${candidate.score.toFixed(2)})`);
    }
    return { reviewRequired: false };
  }

  if (cmd === '/reject') {
    const candidateId = parts[1];
    if (!candidateId) {
      ctx.emitCommandResponse(sessionId, 'Usage: /reject <candidate-id>');
      return { reviewRequired: false };
    }
    const candidate = ctx.reviewManager.reject(candidateId);
    if (!candidate) {
      ctx.emitCommandResponse(sessionId, `Candidate ${candidateId} not found.`);
    } else {
      const saved = await ctx.recordReviewPreference(sessionId, 'reject', candidateId);
      ctx.emit(sessionId, { type: 'review.candidate_rejected', sessionId, candidateId });
      ctx.emitCommandResponse(sessionId, `Rejected: ${candidate.label}${saved ? '\nPreference saved.' : '\nPreference storage unavailable.'}`);
    }
    return { reviewRequired: false };
  }

  if (cmd === '/pin') {
    const candidateId = parts[1];
    if (!candidateId) {
      ctx.emitCommandResponse(sessionId, 'Usage: /pin <candidate-id>');
      return { reviewRequired: false };
    }
    const ok = ctx.reviewManager.pin(candidateId);
    if (!ok) {
      ctx.emitCommandResponse(sessionId, `Candidate ${candidateId} not found.`);
    } else {
      const saved = await ctx.recordReviewPreference(sessionId, 'pin', candidateId);
      ctx.emit(sessionId, { type: 'review.favorite_pinned', sessionId, candidateId });
      ctx.emitCommandResponse(sessionId, `Pinned: ${candidateId}${saved ? '\nPreference saved.' : '\nPreference storage unavailable.'}`);
    }
    return { reviewRequired: false };
  }

  if (cmd === '/taste') {
    const action = parts[1];
    const artifactId = parts[2];
    if (action !== 'pin' && action !== 'reject') {
      ctx.emitCommandResponse(sessionId, 'Usage: /taste <pin|reject> <artifact-id>');
      return { reviewRequired: false };
    }
    if (!artifactId || artifactId.trim() === '') {
      ctx.emitCommandResponse(sessionId, 'Usage: /taste <pin|reject> <artifact-id>');
      return { reviewRequired: false };
    }
    const saved = await ctx.recordReviewPreference(sessionId, action, artifactId);
    ctx.emit(sessionId, {
      type: 'review.preference_recorded',
      sessionId,
      action,
      artifactId,
      saved,
    } as unknown as TuiBridgeEvent);
    const label = action === 'pin' ? 'Pinned' : 'Rejected';
    ctx.emitCommandResponse(
      sessionId,
      `${label}: ${artifactId}${saved ? '\nPreference saved.' : '\nPreference storage unavailable.'}`,
    );
    return { reviewRequired: false };
  }

  if (cmd === '/diff') {
    const idA = parts[1];
    const idB = parts[2];
    if (!idA || !idB) {
      ctx.emitCommandResponse(sessionId, 'Usage: /diff <candidateA-id> <candidateB-id>');
      return { reviewRequired: false };
    }
    const candA = ctx.reviewManager.get(idA);
    const candB = ctx.reviewManager.get(idB);
    if (!candA || !candB) {
      ctx.emitCommandResponse(sessionId, 'One or both candidates not found.');
      return { reviewRequired: false };
    }
    const result = ctx.diffRenderer.diff(candA.content, candB.content);
    const rendered = ctx.diffRenderer.render(result);
    ctx.emit(sessionId, { type: 'review.diff_ready', sessionId, candidateA: idA, candidateB: idB, diff: rendered });
    ctx.emitCommandResponse(sessionId, `Diff (${idA} vs ${idB}):\n${rendered}`);
    return { reviewRequired: false };
  }

  return { reviewRequired: false };
}

async function handleSetup(ctx: CommandContext, sessionId: string): Promise<{ reviewRequired: boolean }> {
  ctx.emit(sessionId, { type: 'activity.updated', sessionId, message: 'Running setup wizard...' });

  const onStep = (step: { id: string; title: string; status: string; value?: string }) => {
    ctx.emit(sessionId, {
      type: 'onboarding.step',
      sessionId,
      stepId: step.id,
      title: step.title,
      stepStatus: step.status,
      value: step.value,
    });
  };

  const wizard = ctx.onboardingWizard;
  const result = await wizard.run();

  for (const step of result.steps) {
    onStep(step);
  }

  ctx.emit(sessionId, {
    type: 'onboarding.complete',
    sessionId,
    configWritten: result.configWritten,
    configPath: result.configPath,
  });

  if (result.configWritten) {
    ctx.emitCommandResponse(sessionId, `Setup complete. Config written to ${result.configPath}`);
  } else {
    const failed = result.steps.filter(s => s.status === 'failed').map(s => s.title);
    ctx.emitCommandResponse(sessionId, `Setup incomplete. Issues: ${failed.join(', ')}`);
  }

  return { reviewRequired: false };
}

async function handleDiagnostics(ctx: CommandContext, sessionId: string): Promise<{ reviewRequired: boolean }> {
  ctx.emit(sessionId, { type: 'activity.updated', sessionId, message: 'Running diagnostics...' });

  const validator = ctx.envValidator;
  const report = await validator.validate();

  ctx.emit(sessionId, {
    type: 'diagnostics.result',
    sessionId,
    checks: report.checks.map(c => ({ name: c.name, status: c.status, message: c.message })),
    allPassed: report.allPassed,
  });

  const statusIcons: Record<string, string> = { pass: '✓', fail: '✗', warn: '⚠' };
  const lines = report.checks.map(c => `  ${statusIcons[c.status] || '?'} ${c.name}: ${c.message}`);
  const summary = report.allPassed ? 'All checks passed.' : 'Some checks failed or need attention.';
  ctx.emitCommandResponse(sessionId, `Diagnostics:\n${lines.join('\n')}\n\n${summary}`);

  return { reviewRequired: false };
}

function handleSessions(ctx: CommandContext, sessionId: string): { reviewRequired: boolean } {
  ctx.ensureSessionsHydrated();
  const sessions = ctx.sessionResumer.listSessions();

  ctx.emit(sessionId, {
    type: 'session.list',
    sessionId,
    sessions: sessions.map(s => ({
      sessionId: s.sessionId,
      turnCount: s.turnCount,
      lastIntent: s.lastIntent,
      updatedAt: s.updatedAt,
    })),
  });

  if (sessions.length === 0) {
    ctx.emitCommandResponse(sessionId, 'No sessions recorded yet.');
  } else {
    const lines = sessions.map(s => {
      const turns = `${s.turnCount} turns`;
      const intent = s.lastIntent ? ` — ${s.lastIntent.slice(0, 40)}` : '';
      return `  ${s.sessionId.slice(0, 24).padEnd(26)} ${turns.padEnd(10)} ${s.updatedAt.slice(0, 19)}${intent}`;
    });
    ctx.emitCommandResponse(sessionId, `Sessions:\n${lines.join('\n')}`);
  }

  return { reviewRequired: false };
}

function handleReport(ctx: CommandContext, sessionId: string, input: string): { reviewRequired: boolean } {
  const graph = ctx.sessionGraphs.get(sessionId);
  if (!graph) {
    ctx.emitCommandResponse(sessionId, 'No session data available for this session.');
    return { reviewRequired: false };
  }

  const format = input.endsWith('json') ? 'json' as const : 'markdown' as const;
  const report = ctx.reportGenerator.generate(graph, format);
  const manifest = report.manifest;

  ctx.emit(sessionId, {
    type: 'report.generated',
    sessionId,
    format: report.format,
    content: report.content,
    turns: manifest.turnCount,
    durationMs: report.totalDurationMs,
  });

  ctx.emitCommandResponse(sessionId, report.content);
  return { reviewRequired: false };
}

function handleWorkspace(ctx: CommandContext, sessionId: string, input: string): { reviewRequired: boolean } {
  const parts = input.split(/\s+/);
  const subcmd = parts[1]?.toLowerCase();

  if (subcmd === 'create') {
    const name = parts[2];
    if (!name) {
      ctx.emitCommandResponse(sessionId, 'Usage: /workspace create <name>');
      return { reviewRequired: false };
    }
    const config = ctx.workspaceManager.create(name);
    if (!config) {
      ctx.emitCommandResponse(sessionId, `Workspace "${name}" already exists.`);
      return { reviewRequired: false };
    }
    ctx.workspaceManager.switchTo(name);
    ctx.emit(sessionId, { type: 'workspace.created', sessionId, workspaceName: name });
    ctx.emit(sessionId, { type: 'workspace.switched', sessionId, workspaceName: name });
    ctx.emitCommandResponse(sessionId, `Workspace "${name}" created and activated.`);
    return { reviewRequired: false };
  }

  if (subcmd === 'switch') {
    const name = parts[2];
    if (!name) {
      ctx.emitCommandResponse(sessionId, 'Usage: /workspace switch <name>');
      return { reviewRequired: false };
    }
    const config = ctx.workspaceManager.switchTo(name);
    if (!config) {
      ctx.emitCommandResponse(sessionId, `Workspace "${name}" not found.`);
      return { reviewRequired: false };
    }
    ctx.emit(sessionId, { type: 'workspace.switched', sessionId, workspaceName: name });
    ctx.emitCommandResponse(sessionId, `Switched to workspace "${name}".`);
    return { reviewRequired: false };
  }

  const names = ctx.workspaceManager.list();
  ctx.emit(sessionId, { type: 'workspace.list', sessionId, workspaces: names });
  if (names.length === 0) {
    ctx.emitCommandResponse(sessionId, 'No workspaces. Use /workspace create <name>.');
  } else {
    const active = ctx.workspaceManager.activeName;
    const lines = names.map(n => {
      const marker = n === active ? ' *' : '';
      return `  ${n}${marker}`;
    });
    ctx.emitCommandResponse(sessionId, `Workspaces:\n${lines.join('\n')}`);
  }
  return { reviewRequired: false };
}

function handleAutonomy(ctx: CommandContext, sessionId: string, input: string): { reviewRequired: boolean } {
  const parts = input.split(/\s+/);
  const level = parts[1]?.toLowerCase();

  if (!level) {
    const current = ctx.autonomyController.getConfig(sessionId);
    const all = ctx.autonomyController.listLevels();
    const lines = all.map(l => {
      const marker = l.level === current.level ? ' ← current' : '';
      return `  ${l.level.padEnd(12)} ${l.label} — ${l.description}${marker}`;
    });
    ctx.emitCommandResponse(sessionId, `Autonomy levels:\n${lines.join('\n')}`);
    return { reviewRequired: false };
  }

  const config = ctx.autonomyController.setLevel(level, sessionId);
  if (!config) {
    const available = ctx.autonomyController.listLevels().map(l => l.level).join(', ');
    ctx.emitCommandResponse(sessionId, `Unknown autonomy level. Available: ${available}`);
    return { reviewRequired: false };
  }

  ctx.emit(sessionId, {
    type: 'autonomy.changed',
    sessionId,
    level: config.level,
    label: config.label,
    description: config.description,
  });
  ctx.emitCommandResponse(sessionId, `Autonomy set to ${config.label} — ${config.description}`);
  return { reviewRequired: false };
}

function handleGoal(ctx: CommandContext, sessionId: string, input: string): { reviewRequired: boolean } {
  const parts = input.split(/\s+/);
  const subcmd = parts[1]?.toLowerCase();

  if (subcmd === 'add') {
    const text = parts.slice(2).join(' ').trim();
    if (!text) {
      ctx.emitCommandResponse(sessionId, 'Usage: /goal add <text>');
      return { reviewRequired: false };
    }
    const store = ctx.getGoalStore();
    if (!store) {
      ctx.emitCommandResponse(sessionId, 'Goal store unavailable. Run from a project directory.');
      return { reviewRequired: false };
    }

    let priority: import('../cortex/types.js').GoalPriority = 'normal';
    let category: import('../cortex/types.js').GoalCategory = 'maintenance';
    let goalText = text;

    const priorityMatch = goalText.match(/\[priority:(critical|high|normal|low)\]\s*/i);
    if (priorityMatch) {
      priority = priorityMatch[1].toLowerCase() as import('../cortex/types.js').GoalPriority;
      goalText = goalText.replace(priorityMatch[0], '').trim();
    }

    const categoryMatch = goalText.match(/\[category:(coverage|performance|reliability|feature|maintenance)\]\s*/i);
    if (categoryMatch) {
      category = categoryMatch[1].toLowerCase() as import('../cortex/types.js').GoalCategory;
      goalText = goalText.replace(categoryMatch[0], '').trim();
    }

    if (!goalText) {
      ctx.emitCommandResponse(sessionId, 'Goal text is required. Usage: /goal add [priority:X] [category:Y] <text>');
      return { reviewRequired: false };
    }

    const goal = store.addGoal({ text: goalText, priority, category });
    ctx.emit(sessionId, { type: 'cortex.goal_added', sessionId, goal });
    ctx.emitCommandResponse(sessionId, `Goal added: "${goal.text}" [${goal.priority}/${goal.category}]`);
    return { reviewRequired: false };
  }

  if (subcmd === 'list') {
    const store = ctx.getGoalStore();
    if (!store) {
      ctx.emitCommandResponse(sessionId, 'Goal store unavailable. Run from a project directory.');
      return { reviewRequired: false };
    }

    const goals = store.getActiveGoals();
    ctx.emit(sessionId, { type: 'cortex.goal_list', sessionId, goals });
    if (goals.length === 0) {
      ctx.emitCommandResponse(sessionId, 'No active goals. Use /goal add <text>.');
    } else {
      const lines = goals.map(g => {
        const marker = g.priority === 'critical' ? '!!' : g.priority === 'high' ? ' !' : '  ';
        return ` ${marker} ${g.id} ${g.text}`;
      });
      ctx.emitCommandResponse(sessionId, `Cortex Goals (${goals.length}):\n${lines.join('\n')}`);
    }
    return { reviewRequired: false };
  }

  if (subcmd === 'remove') {
    const goalId = parts[2];
    if (!goalId) {
      ctx.emitCommandResponse(sessionId, 'Usage: /goal remove <id>');
      return { reviewRequired: false };
    }
    const store = ctx.getGoalStore();
    if (!store) {
      ctx.emitCommandResponse(sessionId, 'Goal store unavailable.');
      return { reviewRequired: false };
    }

    const removed = store.removeGoal(goalId);
    if (!removed) {
      ctx.emitCommandResponse(sessionId, `Goal "${goalId}" not found.`);
    } else {
      ctx.emit(sessionId, { type: 'cortex.goal_removed', sessionId, goalId });
      ctx.emitCommandResponse(sessionId, `Goal "${goalId}" removed.`);
    }
    return { reviewRequired: false };
  }

  if (subcmd === 'done') {
    const goalId = parts[2];
    if (!goalId) {
      ctx.emitCommandResponse(sessionId, 'Usage: /goal done <id>');
      return { reviewRequired: false };
    }
    const store = ctx.getGoalStore();
    if (!store) {
      ctx.emitCommandResponse(sessionId, 'Goal store unavailable.');
      return { reviewRequired: false };
    }

    const completed = store.completeGoal(goalId);
    if (!completed) {
      ctx.emitCommandResponse(sessionId, `Goal "${goalId}" not found.`);
    } else {
      ctx.emit(sessionId, { type: 'cortex.goal_completed', sessionId, goalId });
      ctx.emitCommandResponse(sessionId, `Goal completed: "${completed.text}"`);
    }
    return { reviewRequired: false };
  }

  ctx.emitCommandResponse(sessionId, 'Usage: /goal add <text> | list | remove <id> | done <id>\nOptions: [priority:high] [category:coverage] before text');
  return { reviewRequired: false };
}

function handleCortex(ctx: CommandContext, sessionId: string, input: string): { reviewRequired: boolean } {
  const parts = input.split(/\s+/);
  const subcmd = parts[1]?.toLowerCase();

  if (subcmd === 'start') {
    if (ctx.cortexLoop && !ctx.cortexLoop.isRunning()) {
      ctx.cortexLoop.start();
      ctx.emitCommandResponse(sessionId, 'Cortex loop started.');
    } else if (ctx.cortexLoop?.isRunning()) {
      ctx.emitCommandResponse(sessionId, 'Cortex loop is already running.');
    } else {
      ctx.emitCommandResponse(sessionId, 'Cortex loop not available.');
    }
    return { reviewRequired: false };
  }

  if (subcmd === 'stop') {
    if (ctx.cortexLoop?.isRunning()) {
      ctx.cortexLoop.stop();
      ctx.emitCommandResponse(sessionId, 'Cortex loop stopped.');
    } else {
      ctx.emitCommandResponse(sessionId, 'Cortex loop is not running.');
    }
    return { reviewRequired: false };
  }

  const snapshot = ctx.cortexBus.getSnapshot();
  const goals = ctx.getGoalStore()?.getActiveGoals() ?? [];
  const budget = ctx.cortexLoop?.getBudgetUsage() ?? { actionsTaken: 0, actionsLimit: 0, tokenEstimate: 0, tokenLimit: 0 };
  const cortexState = ctx.cortexLoop?.getState() ?? { tickNumber: 0, decisions: [], stuckWorkers: [] };
  const explainer = new CortexExplainer();
  const dashboard = explainer.formatDashboard({
    snapshot,
    goals,
    budget,
    stuckWorkers: cortexState.stuckWorkers ?? [],
    latestDecisions: cortexState.decisions ?? [],
    tickNumber: cortexState.tickNumber ?? 0,
    autonomyLevel: ctx.cortexConfig.autonomyLevel,
  });

  ctx.emit(sessionId, {
    type: 'cortex.dashboard',
    sessionId,
    content: dashboard,
  });
  ctx.emitCommandResponse(sessionId, dashboard);
  return { reviewRequired: false };
}
