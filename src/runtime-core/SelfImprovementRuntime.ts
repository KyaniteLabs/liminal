import type { LLMClient } from '../llm/LLMClient.js';
import { createLLMModeAgent, type LLMSession } from '../harness/agent/index.js';

export interface SelfImprovementRuntimeInput {
  llm: LLMClient;
  description: string;
}

export interface PreparedSelfImprovementRun {
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

export class LLMModeSelfImprovementRuntime implements SelfImprovementRuntime {
  prepare(input: SelfImprovementRuntimeInput): PreparedSelfImprovementRun {
    const { llm, description } = input;
    const modelName = llm.getConfig().model || 'unknown';
    const maxSteps = Number(process.env.LIMINAL_TUI_AGENT_MAX_STEPS || 20);
    const taskId = `tui-self-${Date.now()}`;

    return {
      taskId,
      modelName,
      maxSteps,
      execute: async () => {
        const agent = createLLMModeAgent(llm);
        return agent.executeTask({
          id: taskId,
          title: 'Bubble Tea TUI self-improvement request',
          description,
          maxSteps,
          approved: true,
          completionPolicy: 'stop_after_verification',
        });
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
