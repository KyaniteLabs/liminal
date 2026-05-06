import type { TuiBridgeEvent } from '../../../src/tui-bridge/types';

export type WorkbenchLocalBridgeEvent =
  | {
      type: 'stream.disconnected';
      sessionId?: string;
      message: string;
      receivedAt?: number;
    }
  | {
      type: 'self_healing.proposal';
      sessionId?: string;
      proposalId?: string;
      id?: string;
      title?: string;
      category?: string;
      score?: number;
      confidence?: string;
      risk?: string;
      measurableTarget?: string;
      expectedVerification?: string[];
      receivedAt?: number;
    };

export type WorkbenchBridgeEvent = (TuiBridgeEvent | WorkbenchLocalBridgeEvent) & {
  receivedAt?: number;
} & Record<string, unknown>;

export type BridgeEvent = WorkbenchBridgeEvent;
export type BridgeEventType = WorkbenchBridgeEvent['type'];
export type BridgeEventByType<T extends BridgeEventType> = Extract<WorkbenchBridgeEvent, { type: T }>;
