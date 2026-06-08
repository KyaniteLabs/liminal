/**
 * LoopPersistence - Gallery save + merge-every-N operations for RalphLoop
 *
 * Handles persistence concerns:
 * - Saving iterations to gallery
 * - Merge-every-N: take two from history, produce proposed, save to gallery
 *
 * Extracted from RalphLoop.ts (lines 556-589).
 */

import { Gallery } from '../gallery/Gallery.js';
import { GalleryFSAdapter } from '../fs/adapters/GalleryFSAdapter.js';
import { mergeSketchCode } from '../utils/mergeSketchCode.js';
import { ContextAccumulation } from './ContextAccumulation.js';
import { CodeValidator } from './CodeValidator.js';
import type { NormalizedLoopOptions, IterationContext } from './LoopConfig.js';
import type { SinterFS } from '../fs/SinterFS.js';

/**
 * Handles gallery persistence and merge operations within the loop.
 */
export class LoopPersistence {
  private adapter?: GalleryFSAdapter;

  constructor(
    private gallery: Gallery,
    private options: NormalizedLoopOptions,
    private liminalFs?: SinterFS,
  ) {
    if (this.liminalFs) {
      this.adapter = new GalleryFSAdapter(this.gallery, this.liminalFs);
    }
  }

  /**
   * Save an iteration to the gallery.
   */
  async saveIteration(iteration: number, code: string): Promise<void> {
    if (!this.options.project) return;

    const versionCode = this.validateGalleryVersionCode(code);

    try {
      await this.gallery.saveIteration(this.options.project, iteration, versionCode);
    } catch (error) {
      if (!this.options.tolerateErrors) {
        throw error;
      }
      return;
    }

    if (this.adapter) {
      try {
        this.adapter.writeGalleryVersionRef(this.options.project, iteration, versionCode);
      } catch {
        // SinterFS reference failures must not hide a successful gallery save.
      }
    }
  }

  /**
   * Check and perform merge-every-N step.
   * After every N iterations, merge last two from history and call onMergeStep.
   */
  async saveMergeStep(iteration: number): Promise<void> {
    if (
      this.options.mergeEveryN == null ||
      this.options.mergeEveryN < 2 ||
      iteration % this.options.mergeEveryN !== 0
    ) {
      return;
    }

    const history = ContextAccumulation.getHistory();
    if (history.length < 2) return;

    const lastTwo = history.slice(-2) as IterationContext[];
    const codeA = lastTwo[0].code;
    const codeB = lastTwo[1].code;
    const proposed = mergeSketchCode(codeA, codeB);
    this.options.onMergeStep?.({ codeA, codeB, proposed });

    if (!this.options.project) return;

    const versionCode = this.validateGalleryVersionCode(proposed);

    try {
      await this.gallery.saveIteration(this.options.project, iteration + 1, versionCode);
    } catch (error) {
      if (!this.options.tolerateErrors) throw error;
      return;
    }

    if (this.adapter) {
      try {
        this.adapter.writeGalleryVersionRef(this.options.project, iteration + 1, versionCode);
      } catch {
        // SinterFS reference failures must not hide a successful gallery save.
      }
    }
  }

  private validateGalleryVersionCode(code: string): string {
    const domain = this.getValidationDomain();
    if (!domain) return code;

    const validation = CodeValidator.validate(code, domain);
    if (!validation.valid) {
      throw new Error(`Gallery version validation failed for ${domain}: ${validation.errors.join('; ')}`);
    }

    return validation.cleanedCode;
  }

  private getValidationDomain(): string | null {
    const domain = this.options.collabDomain || this.options.mode;
    return domain ? String(domain) : null;
  }
}
