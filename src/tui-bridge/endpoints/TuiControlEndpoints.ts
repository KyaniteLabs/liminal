import type { LLMClient } from '../../llm/LLMClient.js';

interface ControlBridge {
  confirmAction(sessionId: string, actionId: string, llm?: LLMClient): Promise<void>;
  cancelAction(sessionId: string, actionId: string): void;
  cancelRun(sessionId: string): void;
}

export class TuiControlEndpoints {
  constructor(
    private readonly bridge: ControlBridge,
    private readonly llmProvider: () => LLMClient | undefined,
  ) {}

  async confirmAction(sessionId: string, actionId: string): Promise<{ ok: true }> {
    await this.bridge.confirmAction(sessionId, actionId, this.llmProvider());
    return { ok: true };
  }

  cancelAction(sessionId: string, actionId: string): { ok: true } {
    this.bridge.cancelAction(sessionId, actionId);
    return { ok: true };
  }

  cancelRun(sessionId: string): { ok: true } {
    this.bridge.cancelRun(sessionId);
    return { ok: true };
  }
}
