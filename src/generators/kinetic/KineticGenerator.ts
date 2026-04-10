import { TierBasedGenerator, type TierBasedGeneratorOptions } from '../TierBasedGenerator.js';
import { KINETIC_SYSTEM_PROMPT, buildKineticPrompt } from './kineticPrompt.js';
import { Logger } from '../../utils/Logger.js';

export interface KineticGeneratorOptions extends TierBasedGeneratorOptions {}

/**
 * Kinetic — CSS-native generative art domain.
 *
 * Generates autonomous, perpetually-animated visual compositions using
 * CSS @keyframes and SVG. Zero JavaScript required at runtime.
 */
export class KineticGenerator extends TierBasedGenerator {
  constructor(llmOrConfig?: ConstructorParameters<typeof TierBasedGenerator>[1]) {
    super('kinetic', llmOrConfig);
  }

  async generate(prompt: string, options?: KineticGeneratorOptions): Promise<string> {
    const response = await this.generateFull(prompt, options);
    return response.code;
  }

  protected validateOutput(code: string): { valid: boolean; error?: string } {
    // Must be valid HTML
    if (!code.includes('<!DOCTYPE html>') && !code.includes('<html')) {
      return { valid: false, error: 'Generated code is not valid HTML' };
    }
    // Must have @keyframes (the defining characteristic)
    if (!code.includes('@keyframes')) {
      return { valid: false, error: 'Generated code contains no @keyframes — not a kinetic artwork' };
    }
    // Must not contain <script> tags
    if (/<script/i.test(code)) {
      return { valid: false, error: 'Generated code contains JavaScript — kinetic art is pure CSS/SVG' };
    }
    return { valid: true };
  }

  async generateFull(prompt: string, options?: KineticGeneratorOptions) {
    if (!this.llm) {
      throw new Error('KineticGenerator: LLM not initialized');
    }

    const systemPrompt = KINETIC_SYSTEM_PROMPT;
    const userPrompt = buildKineticPrompt(prompt);

    Logger.info('KineticGenerator', 'Generating CSS-kinetic artwork');

    const response = await this.llm.generate(
      systemPrompt,
      userPrompt,
      options?.signal,
      options?.bypassCache
    );

    const code = response.code;
    if (!code || code.trim().length === 0) {
      throw new Error('KineticGenerator: LLM returned empty code');
    }

    const validated = this.validateOutput(code);
    if (!validated.valid) {
      throw new Error(`KineticGenerator: ${validated.error}`);
    }

    return response;
  }
}
