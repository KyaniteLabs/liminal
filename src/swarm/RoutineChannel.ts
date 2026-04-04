/**
 * RoutineChannel — Inter-agent communication channel using the Agora protocol.
 *
 * Manages structured message exchange between expert personas across rounds.
 * Supports broadcast, direct messaging, history retrieval, and compression
 * of exchanges that exceed a configurable threshold.
 */
import {
  type RoutineStage,
  type AgoraMessage,
  type AgoraResult,
  createMessage,
  summarizeExchange,
} from './AgoraProtocol.js';

/** Configuration for a RoutineChannel instance. */
export interface ChannelConfig {
  /** Maximum number of rounds kept in history. Default: 50. */
  maxHistory?: number;
  /** Minimum messages in a round before compression is offered. Default: 3. */
  compressThreshold?: number;
}

/** Record of all messages exchanged in a single round. */
export interface ExchangeRecord {
  round: number;
  messages: AgoraMessage[];
  result?: AgoraResult;
}

/** Summary statistics for the channel. */
export interface ChannelStats {
  totalMessages: number;
  roundsTracked: number;
  compressionRatio: number;
}

const DEFAULT_CHANNEL_CONFIG: Required<ChannelConfig> = {
  maxHistory: 50,
  compressThreshold: 3,
};

export class RoutineChannel {
  private readonly maxHistory: number;
  private readonly compressThreshold: number;
  private readonly history = new Map<number, ExchangeRecord>();
  private compressedCount = 0;

  constructor(config?: ChannelConfig) {
    const resolved = { ...DEFAULT_CHANNEL_CONFIG, ...config };
    this.maxHistory = resolved.maxHistory;
    this.compressThreshold = resolved.compressThreshold;
  }

  /**
   * Broadcast a message from one expert to all others.
   * Creates a single AgoraMessage addressed to every expert except the sender.
   * The caller must supply the recipient IDs explicitly.
   */
  broadcast(
    fromId: string,
    stage: RoutineStage,
    content: string,
    round: number,
    recipientIds: string[] = [],
  ): AgoraMessage {
    const msg = createMessage(fromId, recipientIds, stage, content, round);
    this.storeMessage(round, msg);
    return msg;
  }

  /** Send a message from one expert directly to another. */
  directMessage(
    fromId: string,
    toId: string,
    stage: RoutineStage,
    content: string,
    round: number,
  ): AgoraMessage {
    const msg = createMessage(fromId, [toId], stage, content, round);
    this.storeMessage(round, msg);
    return msg;
  }

  /** Get exchange records, optionally filtered to a single round. */
  getHistory(round?: number): ExchangeRecord[] {
    if (round !== undefined) {
      const record = this.history.get(round);
      return record ? [record] : [];
    }
    return [...this.history.values()].sort((a, b) => a.round - b.round);
  }

  /**
   * Get a compressed summary for a round if it meets the compression threshold.
   * Returns undefined if the round has fewer messages than compressThreshold.
   */
  getCompressedExchange(round: number): AgoraResult | undefined {
    const record = this.history.get(round);
    if (!record || record.messages.length < this.compressThreshold) {
      return undefined;
    }
    return summarizeExchange(record.messages);
  }

  /** Reset all history and counters. */
  clear(): void {
    this.history.clear();
    this.compressedCount = 0;
  }

  /** Compute summary statistics for the channel. */
  stats(): ChannelStats {
    let totalMessages = 0;
    let roundsWithCompression = 0;

    for (const record of this.history.values()) {
      totalMessages += record.messages.length;
      if (record.messages.length >= this.compressThreshold) {
        roundsWithCompression++;
      }
    }

    // compressionRatio = totalMessages / compressed summaries produced
    // (or totalMessages if no compression has occurred, to avoid division by zero)
    const compressionRatio =
      roundsWithCompression > 0
        ? totalMessages / roundsWithCompression
        : totalMessages;

    return {
      totalMessages,
      roundsTracked: this.history.size,
      compressionRatio,
    };
  }

  /** Store a message in the round's exchange record, evicting old rounds if needed. */
  private storeMessage(round: number, msg: AgoraMessage): void {
    let record = this.history.get(round);
    if (!record) {
      record = { round, messages: [] };
      this.history.set(round, record);
    }
    record.messages.push(msg);

    this.evictIfNeeded();
  }

  /** Evict oldest rounds when maxHistory is exceeded. */
  private evictIfNeeded(): void {
    while (this.history.size > this.maxHistory) {
      const oldestRound = Math.min(...this.history.keys());
      const evicted = this.history.get(oldestRound);
      if (evicted && evicted.messages.length >= this.compressThreshold) {
        this.compressedCount++;
      }
      this.history.delete(oldestRound);
    }
  }
}
