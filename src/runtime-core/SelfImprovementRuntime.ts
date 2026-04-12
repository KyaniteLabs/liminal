import type { LLMClient } from '../llm/LLMClient.js';
import { createLLMModeAgent, type LLMSession } from '../harness/agent/index.js';

export interface SelfImprovementRuntimeInput {
  llm: LLMClient;
  description: string;
}

interface TaskPacket {
  fileHint: string;
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

const DEFAULT_WORKING_SET = [
  'src/runtime-core/SelfImprovementRuntime.ts',
  'src/harness/agent/LLMModeAgent.ts',
  'src/harness/RunStateStore.ts',
  'test/unit/LLMModeAgent.test.ts',
];

function formatWorkingSet(description: string, intro: string, workingSet: string[]): TaskPacket {
  return {
    fileHint: workingSet[0],
    description: `${description}\n\n## Deterministic Task Packet\n${intro}\n- ${workingSet.join('\n- ')}`,
  };
}

function buildTaskPacket(description: string): TaskPacket {
  const normalized = description.toLowerCase();

  if (/checkpoint|resume|fingerprint|workspace drift|suspend|run state/.test(normalized)) {
    return formatWorkingSet(
      description,
      'Work in these files first before exploring elsewhere:',
      [
        'src/harness/RunStateStore.ts',
        'src/harness/agent/LLMModeAgent.ts',
        'test/unit/LLMModeAgent.test.ts',
        'test/harness/RunStateStore.test.ts',
      ],
    );
  }

  return formatWorkingSet(
    description,
    'Start in these runtime-core files before any broader reconnaissance. Only expand beyond this working set if the requested fix cannot be completed there:',
    DEFAULT_WORKING_SET,
  );
}

export class LLMModeSelfImprovementRuntime implements SelfImprovementRuntime {
  prepare(input: SelfImprovementRuntimeInput): PreparedSelfImprovementRun {
    const { llm, description } = input;
    const taskPacket = buildTaskPacket(description);
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
          description: taskPacket.description,
          fileHint: taskPacket.fileHint,
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
