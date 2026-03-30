/**
 * CreativeWorkflow — A four-stage creative pipeline state machine.
 *
 * Stages: gather → plan → create → refine.
 * The workflow tracks completion, accumulated artefacts, and arbitrary metadata.
 */

/** The four canonical stages of the creative workflow. */
export type WorkflowStage = 'gather' | 'plan' | 'create' | 'refine';

/** Ordered stages for sequential advancement. */
const STAGE_ORDER: WorkflowStage[] = ['gather', 'plan', 'create', 'refine'];

/** Snapshot of the workflow at a point in time. */
export interface WorkflowState {
  /** Currently active stage. */
  currentStage: WorkflowStage;
  /** Stages that have been completed. */
  completedStages: WorkflowStage[];
  /** Key-value artefacts produced during the workflow. */
  artifacts: Record<string, string>;
  /** Arbitrary metadata attached by the consumer. */
  metadata: Record<string, unknown>;
}

/**
 * Manages progression through a four-stage creative pipeline.
 *
 * Typical usage:
 * ```ts
 * const wf = new CreativeWorkflow();
 * wf.addArtifact('brief', 'A calming generative landscape');
 * wf.advance(); // gather → plan
 * wf.addArtifact('palette', '#2d5a3f,#8fb996');
 * wf.advance(); // plan → create
 * wf.advance(); // create → refine
 * wf.addArtifact('final', generatedCode);
 * wf.advance(); // refine → done (workflow complete)
 * ```
 */
export class CreativeWorkflow {
  private state: WorkflowState;

  constructor() {
    this.state = {
      currentStage: 'gather',
      completedStages: [],
      artifacts: {},
      metadata: {},
    };
  }

  /**
   * Advance to the next stage in the pipeline.
   *
   * If the workflow is already past the final stage, this is a no-op and
   * returns the current (final) stage.
   *
   * @returns The new current stage after advancement.
   */
  advance(): WorkflowStage {
    const currentIdx = STAGE_ORDER.indexOf(this.state.currentStage);
    const nextIdx = currentIdx + 1;

    if (nextIdx >= STAGE_ORDER.length) {
      // Already at or past the last stage — mark as complete.
      if (!this.state.completedStages.includes(this.state.currentStage)) {
        this.state.completedStages.push(this.state.currentStage);
      }
      return this.state.currentStage;
    }

    this.state.completedStages.push(this.state.currentStage);
    this.state.currentStage = STAGE_ORDER[nextIdx];
    return this.state.currentStage;
  }

  /**
   * Store an artefact in the workflow state.
   *
   * @param key   - Artefact identifier (e.g. 'brief', 'palette', 'final').
   * @param value - The artefact content.
   */
  addArtifact(key: string, value: string): void {
    this.state.artifacts[key] = value;
  }

  /**
   * Return a shallow copy of the current workflow state.
   *
   * @returns The current WorkflowState snapshot.
   */
  getState(): WorkflowState {
    return {
      currentStage: this.state.currentStage,
      completedStages: [...this.state.completedStages],
      artifacts: { ...this.state.artifacts },
      metadata: { ...this.state.metadata },
    };
  }

  /**
   * Reset the workflow back to the initial (gather) stage, clearing all
   * artefacts, metadata, and completion history.
   */
  reset(): void {
    this.state = {
      currentStage: 'gather',
      completedStages: [],
      artifacts: {},
      metadata: {},
    };
  }

  /**
   * Check whether the workflow has passed through all four stages.
   *
   * @returns true if all stages have been completed.
   */
  isComplete(): boolean {
    return this.state.completedStages.length >= STAGE_ORDER.length;
  }
}
