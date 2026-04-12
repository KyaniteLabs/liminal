import type { LLMClient } from '../llm/LLMClient.js';
import { createLLMModeAgent, type LLMSession, type LLMTask } from '../harness/agent/index.js';
import { localizeBoundedSelfImprovement } from './RepoIndexLite.js';

export interface SelfImprovementRuntimeInput {
  llm: LLMClient;
  description: string;
}

interface TaskPacket {
  fileHint: string;
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

function formatWorkingSet(description: string, intro: string, workingSet: string[]): TaskPacket {
  return {
    fileHint: workingSet[0],
    description: `${description}\n\n## Deterministic Task Packet\n${intro}\n- ${workingSet.join('\n- ')}`,
  };
}

function buildTaskPacket(description: string): TaskPacket {
  const context = localizeBoundedSelfImprovement(description);
  return formatWorkingSet(description, context.intro, context.workingSet);
}

export class LLMModeSelfImprovementRuntime implements SelfImprovementRuntime {
  prepare(input: SelfImprovementRuntimeInput): PreparedSelfImprovementRun {
    const { llm, description } = input;
    const taskPacket = buildTaskPacket(description);
    const modelName = llm.getConfig().model || 'unknown';
    const maxSteps = Number(process.env.LIMINAL_TUI_AGENT_MAX_STEPS || 20);
    const taskId = `tui-self-${Date.now()}`;
    const task: LLMTask = {
      id: taskId,
      title: 'Bubble Tea TUI self-improvement request',
      description: taskPacket.description,
      fileHint: taskPacket.fileHint,
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
