import {
  buildWorkbenchPrompt,
  buildWorkbenchRunOptionsForMode,
  detectPromptCreateMode,
  type CreateModeId,
  type WorkbenchExecutionMode,
} from './createModes';
import type { WorkbenchRunReceipt } from './workbenchTelemetry';

export type StudioComposerIntent = 'generate' | 'revise' | 'variant' | 'inspect' | 'export';

export type StudioComposerRoute =
  | { intent: 'generate' }
  | { intent: 'revise'; revisionKind: 'revise' }
  | { intent: 'variant'; revisionKind: 'variation' }
  | { intent: 'inspect' }
  | { intent: 'export' };

type StudioComposerSubmitOptions = ReturnType<typeof buildWorkbenchRunOptionsForMode> & {
  clientIntent: 'creative';
  creativePreferences?: Record<string, unknown>;
};

export type StudioComposerSubmission =
  | { kind: 'submit'; prompt: string; mode: CreateModeId; options: StudioComposerSubmitOptions }
  | { kind: 'inspect'; notice: string }
  | { kind: 'export'; notice: string };

export function routeStudioComposerMessage(
  message: string,
  context: { hasCurrentArtifact: boolean },
): StudioComposerRoute {
  if (!context.hasCurrentArtifact) return { intent: 'generate' };

  const lower = message.toLowerCase();
  if (/\b(receipt|details?|explain|inspect|what happened|show me)\b/.test(lower)) return { intent: 'inspect' };
  if (/\b(export|save|download|write out)\b/.test(lower)) return { intent: 'export' };
  if (/\b(variation|variant|another version|different composition|fresh variation)\b/.test(lower)) {
    return { intent: 'variant', revisionKind: 'variation' };
  }
  if (/\b(new artifact|start over|from scratch)\b/.test(lower)) return { intent: 'generate' };
  return { intent: 'revise', revisionKind: 'revise' };
}

export function buildStudioComposerSubmission(input: {
  message: string;
  mode: CreateModeId;
  executionMode: WorkbenchExecutionMode;
  maxIterations: number;
  timeoutMinutes: number;
  hasCurrentArtifact: boolean;
  priorRunReceipt: WorkbenchRunReceipt | null;
}): StudioComposerSubmission {
  const route = routeStudioComposerMessage(input.message, { hasCurrentArtifact: input.hasCurrentArtifact });
  if (route.intent === 'inspect') {
    return { kind: 'inspect', notice: 'Latest run details are available in Info and Work log. No new generation was started.' };
  }
  if (route.intent === 'export') {
    return { kind: 'export', notice: 'Use the artifact export controls for the current preview. No new generation was started.' };
  }

  const mode = detectPromptCreateMode(input.message) ?? input.mode;
  const options: StudioComposerSubmitOptions = {
    clientIntent: 'creative',
    ...buildWorkbenchRunOptionsForMode(input.executionMode, input.maxIterations, mode, input.timeoutMinutes),
  };
  if (route.intent === 'revise' || route.intent === 'variant') {
    if (input.priorRunReceipt) {
      options.creativePreferences = {
        priorRunReceipt: input.priorRunReceipt,
        revisionKind: route.revisionKind,
      };
    }
  }

  return {
    kind: 'submit',
    prompt: buildWorkbenchPrompt(mode, input.message),
    mode,
    options,
  };
}
