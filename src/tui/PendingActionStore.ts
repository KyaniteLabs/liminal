import type { AgentTask } from '../harness/index.js';
import type { LLMTask } from '../harness/agent/LLMModeAgent.js';

export interface PendingActionRecord {
  id: string;
  kind: 'structured' | 'llm';
  title: string;
  createdAt: string;
  task: AgentTask | LLMTask;
}

export class PendingActionStore {
  private actions = new Map<string, PendingActionRecord>();

  create(kind: PendingActionRecord['kind'], task: AgentTask | LLMTask): PendingActionRecord {
    const id = `pending-${Date.now()}-${this.actions.size + 1}`;
    const record: PendingActionRecord = {
      id,
      kind,
      title: task.title,
      createdAt: new Date().toISOString(),
      task,
    };
    this.actions.set(id, record);
    return record;
  }

  get(id: string): PendingActionRecord | undefined {
    return this.actions.get(id);
  }

  cancel(id: string): boolean {
    return this.actions.delete(id);
  }

  confirm(id: string): PendingActionRecord | undefined {
    const record = this.actions.get(id);
    if (record) {
      this.actions.delete(id);
    }
    return record;
  }

  list(): PendingActionRecord[] {
    return Array.from(this.actions.values());
  }
}
