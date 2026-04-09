/**
 * TransparencyViewer - Real-time process transparency for generation.
 *
 * Logs every event in the generation process (prompts sent, outputs received,
 * critiques, scores) with timestamps and metadata.
 *
 * This is a data layer only — no terminal UI rendering. The existing TUI
 * handles rendering.
 *
 * Ported from Hydra's `chat/dashboard.py`.
 */

/**
 * Event types in the generation process.
 */
export enum EventType {
  /** Prompt sent to a model */
  PROMPT = 'prompt',
  /** Output received from a model */
  OUTPUT = 'output',
  /** Analysis or critique of output */
  ANALYSIS = 'analysis',
  /** Refinement iteration */
  REFINEMENT = 'refinement',
  /** Informational message */
  INFO = 'info',
}

/**
 * A single event in the generation process.
 */
export interface ProcessEvent {
  /** HH:MM:SS timestamp */
  timestamp: string;
  /** Phase identifier (e.g., 'creator', 'critic', 'refiner') */
  phase: string;
  /** Model name (e.g., 'Local', 'Cloud', 'Hybrid') */
  model: string;
  /** Type of event */
  eventType: EventType;
  /** Title/heading for the event */
  title: string;
  /** Event content (prompt text, output, analysis, etc.) */
  content: string;
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * Summary statistics for a generation session.
 */
export interface SessionSummary {
  /** Total duration in seconds */
  duration: number;
  /** Number of events logged */
  totalEvents: number;
  /** Events by type */
  eventsByType: Record<EventType, number>;
  /** Events by model */
  eventsByModel: Record<string, number>;
  /** Final quality score if available */
  qualityScore?: number;
  /** Number of refinement iterations */
  refinementCount: number;
}

/**
 * TransparencyViewer logs all generation process events.
 *
 * - Records prompts, outputs, analyses, refinements
 * - Stores events with timestamps and metadata
 * - Can render summaries of all events
 * - Data layer only (no UI rendering)
 */
export class TransparencyViewer {
  private events: ProcessEvent[] = [];
  private startTime: number;
  private mode: string;

  /**
   * Create a new TransparencyViewer.
   * @param mode - Generation mode (e.g., 'local', 'cloud', 'collab')
   */
  constructor(mode: string) {
    this.mode = mode;
    this.startTime = Date.now();
  }

  /**
   * Get the current elapsed time in seconds.
   * @returns Elapsed seconds since creation
   */
  getElapsedTime(): number {
    return (Date.now() - this.startTime) / 1000;
  }

  /**
   * Add an event to the process log.
   * @param event - The event to add
   */
  addEvent(event: Omit<ProcessEvent, 'timestamp'>): void {
    const fullEvent: ProcessEvent = {
      timestamp: this.formatTimestamp(Date.now()),
      ...event,
    };
    this.events.push(fullEvent);
  }

  /**
   * Log a prompt being sent to a model.
   * @param model - Model name
   * @param phase - Phase identifier
   * @param promptText - The prompt text
   * @param title - Optional title
   */
  prompt(model: string, phase: string, promptText: string, title = ''): void {
    this.addEvent({
      phase,
      model,
      eventType: EventType.PROMPT,
      title: title || `${model} - ${phase} Prompt`,
      content: promptText,
      metadata: {},
    });
  }

  /**
   * Log an output received from a model.
   * @param model - Model name
   * @param phase - Phase identifier
   * @param outputText - The output text
   * @param title - Optional title
   */
  output(model: string, phase: string, outputText: string, title = ''): void {
    this.addEvent({
      phase,
      model,
      eventType: EventType.OUTPUT,
      title: title || `${model} - ${phase} Output`,
      content: outputText,
      metadata: {},
    });
  }

  /**
   * Log an analysis or critique.
   * @param model - Model name
   * @param phase - Phase identifier
   * @param analysisText - The analysis text
   * @param title - Optional title
   */
  analysis(model: string, phase: string, analysisText: string, title = ''): void {
    this.addEvent({
      phase,
      model,
      eventType: EventType.ANALYSIS,
      title: title || `${model} - ${phase} Analysis`,
      content: analysisText,
      metadata: {},
    });
  }

  /**
   * Log a refinement iteration.
   * @param model - Model name
   * @param phase - Phase identifier
   * @param refinementText - The refinement text
   * @param title - Optional title
   */
  refinement(model: string, phase: string, refinementText: string, title = ''): void {
    this.addEvent({
      phase,
      model,
      eventType: EventType.REFINEMENT,
      title: title || `${model} - ${phase} Refinement`,
      content: refinementText,
      metadata: {},
    });
  }

  /**
   * Log an informational message.
   * @param phase - Phase identifier
   * @param message - The message
   */
  info(phase: string, message: string): void {
    this.addEvent({
      phase,
      model: '',
      eventType: EventType.INFO,
      title: message,
      content: '',
      metadata: {},
    });
  }

  /**
   * Get all logged events.
   * @returns Copy of events array
   */
  getEvents(): ProcessEvent[] {
    return [...this.events];
  }

  /**
   * Get events filtered by type.
   * @param eventType - Type to filter by
   * @returns Filtered events
   */
  getEventsByType(eventType: EventType): ProcessEvent[] {
    return this.events.filter(e => e.eventType === eventType);
  }

  /**
   * Get events filtered by model.
   * @param model - Model name to filter by
   * @returns Filtered events
   */
  getEventsByModel(model: string): ProcessEvent[] {
    return this.events.filter(e => e.model === model);
  }

  /**
   * Get events filtered by phase.
   * @param phase - Phase identifier to filter by
   * @returns Filtered events
   */
  getEventsByPhase(phase: string): ProcessEvent[] {
    return this.events.filter(e => e.phase === phase);
  }

  /**
   * Generate a summary of the session.
   * @param metadata - Optional additional metadata (e.g., quality score)
   * @returns Session summary
   */
  getSummary(metadata?: Record<string, unknown>): SessionSummary {
    // Count events by type
    const eventsByType: Record<EventType, number> = {
      [EventType.PROMPT]: 0,
      [EventType.OUTPUT]: 0,
      [EventType.ANALYSIS]: 0,
      [EventType.REFINEMENT]: 0,
      [EventType.INFO]: 0,
    };

    // Count events by model
    const eventsByModel: Record<string, number> = {};

    for (const event of this.events) {
      eventsByType[event.eventType]++;
      if (event.model) {
        eventsByModel[event.model] = (eventsByModel[event.model] ?? 0) + 1;
      }
    }

    return {
      duration: this.getElapsedTime(),
      totalEvents: this.events.length,
      eventsByType,
      eventsByModel,
      qualityScore: metadata?.qualityScore as number | undefined,
      refinementCount: eventsByType[EventType.REFINEMENT],
    };
  }

  /**
   * Generate a human-readable summary of the session.
   * @param metadata - Optional additional metadata
   * @returns Formatted summary string
   */
  formatSummary(metadata?: Record<string, unknown>): string {
    const summary = this.getSummary(metadata);
    const lines: string[] = [];

    lines.push('Generation Complete');
    lines.push('');
    lines.push(`Mode: ${this.mode}`);
    lines.push(`Duration: ${summary.duration.toFixed(1)}s`);
    lines.push(`Total events: ${summary.totalEvents}`);

    if (summary.qualityScore !== undefined) {
      lines.push(`Quality score: ${summary.qualityScore.toFixed(2)}`);
    }

    if (summary.refinementCount > 0) {
      lines.push(`Refinements: ${summary.refinementCount}`);
    }

    lines.push('');
    lines.push('Events by type:');
    for (const [type, count] of Object.entries(summary.eventsByType)) {
      if (count > 0) {
        lines.push(`  ${type}: ${count}`);
      }
    }

    if (Object.keys(summary.eventsByModel).length > 0) {
      lines.push('');
      lines.push('Events by model:');
      for (const [model, count] of Object.entries(summary.eventsByModel)) {
        lines.push(`  ${model}: ${count}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Export events as JSON.
   * @param pretty - Whether to pretty-print (default: true)
   * @returns JSON string
   */
  exportToJson(pretty = true): string {
    const data = {
      mode: this.mode,
      startTime: new Date(this.startTime).toISOString(),
      endTime: new Date().toISOString(),
      duration: this.getElapsedTime(),
      events: this.events,
    };
    return JSON.stringify(data, null, pretty ? 2 : 0);
  }

  /**
   * Clear all events.
   */
  clear(): void {
    this.events = [];
    this.startTime = Date.now();
  }

  /**
   * Format a timestamp as HH:MM:SS.
   * @param timestamp - Unix timestamp in milliseconds
   * @returns Formatted timestamp string
   */
  private formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  /**
   * Create a new viewer with the same mode.
   * @returns New TransparencyViewer instance
   */
  clone(): TransparencyViewer {
    const viewer = new TransparencyViewer(this.mode);
    viewer.events = [...this.events];
    viewer.startTime = this.startTime;
    return viewer;
  }
}
