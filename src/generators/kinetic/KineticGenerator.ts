/**
 * KineticGenerator - CSS-native generative art.
 */

import { TierBasedGenerator, type TierBasedGeneratorOptions } from '../TierBasedGenerator.js';
import type { LLMResponse } from '../../llm/LLMClient.js';
import { CodeValidator } from '../../core/CodeValidator.js';
import { KINETIC_SYSTEM_PROMPT, buildKineticPrompt } from './kineticPrompt.js';
import { KineticWrapper } from './KineticWrapper.js';
import { Logger } from '../../utils/Logger.js';

export interface KineticGeneratorOptions extends TierBasedGeneratorOptions {}

export class KineticGenerator extends TierBasedGenerator {
  constructor(llmOrConfig?: ConstructorParameters<typeof TierBasedGenerator>[1]) {
    super('kinetic', llmOrConfig);
  }

  async generate(prompt: string, options?: KineticGeneratorOptions): Promise<string> {
    const response = await this.generateFull(prompt, options);
    return response.code;
  }

  async generateFull(prompt: string, options?: KineticGeneratorOptions): Promise<LLMResponse> {
    if (!this.llm) {
      throw new Error('KineticGenerator: LLM not initialized');
    }

    Logger.info('KineticGenerator', 'Generating CSS-kinetic artwork');
    const response = await this.llm.generate(
      KINETIC_SYSTEM_PROMPT,
      buildKineticPrompt(prompt),
      options?.signal,
      options?.bypassCache
    );

    if (!response.code || response.code.trim().length === 0) {
      throw new Error('KineticGenerator: LLM returned empty code');
    }

    const validated = this.validateOutput(response.code);
    if (!validated.valid) {
      throw new Error(`KineticGenerator: ${validated.error}`);
    }

    return response;
  }

  protected validateOutput(code: string): { valid: boolean; error?: string } {
    const validation = CodeValidator.validate(code, 'kinetic');
    if (!validation.valid) {
      return { valid: false, error: validation.errors.join('; ') };
    }
    return { valid: true };
  }

  wrapForGallery(code: string): string {
    return KineticWrapper.wrap(code, { title: 'Kinetic Artwork' });
  }
}
