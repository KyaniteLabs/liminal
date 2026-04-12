import type { LLMClient } from '../llm/LLMClient.js';
import { createLLMModeAgent, type LLMSession, type LLMTask } from '../harness/agent/index.js';
import { localizeBoundedSelfImprovement, type VerificationTarget } from './RepoIndexLite.js';

export interface SelfImprovementRuntimeInput {
  llm: LLMClient;
  description: string;
}

interface TaskPacket {
  fileHint: string;
  workingSet: string[];
  primaryFiles: string[];
  secondaryFiles: string[];
  deferredSecondaryFiles: string[];
  expansionBudget: number;
  expansionStatus: 'allowed' | 'exhausted';
  localizationConfidence: 'high' | 'medium' | 'low';
  verificationTargets: VerificationTarget[];
  domain: string;
  description: string;
}

export interface PreparedSelfImprovementRun {
  task: LLMTask;
  taskId: string;
  modelName: string;
  maxSteps: number;
  execute: () => Promise<LLMSession>;
}

export interface SelfImprovementRuntimeResult {
  taskId: string;
  modelName: string;
  maxSteps: number;
  session: LLMSession;
}

export interface SelfImprovementRuntime {
  prepare(input: SelfImprovementRuntimeInput): PreparedSelfImprovementRun;
  run(input: SelfImprovementRuntimeInput): Promise<SelfImprovementRuntimeResult>;
}

function buildTaskPacket(description: string): TaskPacket {
  const context = localizeBoundedSelfImprovement(description);

  return {
    fileHint: context.fileHint,
    workingSet: context.workingSet,
    primaryFiles: context.primaryFiles,
    secondaryFiles: context.secondaryFiles,
    deferredSecondaryFiles: context.deferredSecondaryFiles,
    expansionBudget: context.expansionBudget,
    expansionStatus: context.expansionStatus,
    localizationConfidence: context.localizationConfidence,
    verificationTargets: context.verificationTargets,
    domain: context.domain,
    description: `${description}\n\n## Deterministic Task Packet\n${context.intro}\nPrimary files:\n- ${context.primaryFiles.join('\n- ')}\nSecondary files:\n- ${context.secondaryFiles.join('\n- ')}${context.deferredSecondaryFiles.length > 0 ? `\nDeferred secondary files:\n- ${context.deferredSecondaryFiles.join('\n- ')}` : ''}\nVerification targets:\n- ${context.verificationTargets.map((target) => `${target.tool}${target.pattern ? ` (${target.pattern})` : ''}: ${target.reason}`).join('\n- ')}\nExpansion budget: ${context.expansionBudget} additional files before broadening beyond this packet\nExpansion status: ${context.expansionStatus}\nLocalization confidence: ${context.localizationConfidence}\nDomain: ${context.domain}${context.fileHint ? `\nHint: ${context.fileHint}` : ''}\n\nCurrent active focus file: ${context.fileHint}\n${context.primaryFiles.length > 1 ? `Do not jump to ${context.primaryFiles[1]} until you finish the current focus or explicitly reject it.\n` : ''}You are in LLM-driven mode. Plan your own steps. Your first explicit tool call should stay on the current active focus file unless you are editing or verifying.\nIf readFile returns truncated=true with startLine/endLine, continue that file with offset=endLine rather than rereading from the top.\nIf you need a specific method, symbol, or error location inside a large file, use search with the current file path before reading more pages.\n\nPreferred verification targets after a mutation:\n- ${context.verificationTargets.map((target) => `${target.tool}${target.pattern ? ` (${target.pattern})` : ''}: ${target.reason}`).join('\n- ')}\nPrefer the first applicable verification target before broader verification discovery.`,
  };
}

export class LLMModeSelfImprovementRuntime implements SelfImprovementRuntime {
  prepare(input: SelfImprovementRuntimeInput): PreparedSelfImprovementRun {
    const { llm, description } = input;
    const taskPacket = buildTaskPacket(description);
    const modelName = llm.getConfig().model || 'unknown';
    const _maxStepsEnv = parseInt(process.env.LIMINAL_TUI_AGENT_MAX_STEPS ?? '', 10);
    const maxSteps = Number.isFinite(_maxStepsEnv) && _maxStepsEnv > 0 ? _maxStepsEnv : 20;
    const taskId = `tui-self-${Date.now()}`;
    const task: LLMTask = {
      id: taskId,
      title: 'Bubble Tea TUI self-improvement request',
      description: taskPacket.description,
      fileHint: taskPacket.fileHint,
      workingSet: taskPacket.workingSet,
      primaryFiles: taskPacket.primaryFiles,
      secondaryFiles: taskPacket.secondaryFiles,
      deferredSecondaryFiles: taskPacket.deferredSecondaryFiles,
      expansionBudget: taskPacket.expansionBudget,
      expansionStatus: taskPacket.expansionStatus,
      localizationConfidence: taskPacket.localizationConfidence,
      verificationTargets: taskPacket.verificationTargets,
      domain: taskPacket.domain,
      maxSteps,
      approved: true,
      completionPolicy: 'stop_after_verification',
    };

    return {
      task,
      taskId,
      modelName,
      maxSteps,
      execute: async () => {
        const agent = createLLMModeAgent(llm);
        return agent.executeTask(task);
      },
    };
  }

  async run(input: SelfImprovementRuntimeInput): Promise<SelfImprovementRuntimeResult> {
    const prepared = this.prepare(input);
    const session = await prepared.execute();
    return {
      taskId: prepared.taskId,
      modelName: prepared.modelName,
      maxSteps: prepared.maxSteps,
      session,
    };
  }
}
