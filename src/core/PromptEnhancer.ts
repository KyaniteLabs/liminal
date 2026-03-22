/**
 * PromptEnhancer - Sequential prompt enhancement with creative cross-pollination
 *
 * Enhances prompts by injecting:
 * 1. Random compost seed for creative cross-pollination
 * 2. Compost DNA for domain knowledge
 * 3. Archived high-quality examples from past runs
 *
 * Extracted from RalphLoop.ts (lines 291-345).
 */

import { SeedBank } from '../compost/SeedBank.js';
import { mergeConfig as mergeCompostConfig } from '../compost/defaults.js';
import { generatorRegistry } from '../generators/GeneratorRegistry.js';
import { ArchiveLearning } from '../learning/index.js';
import { Logger } from '../utils/Logger.js';
import { formatSeedForPrompt } from './lir/LIRPromptFormatter.js';
import type { NormalizedLoopOptions } from './LoopConfig.js';

/**
 * Enhance a prompt with compost seed, DNA, and archive examples
 *
 * Each step is try/catch — failures are logged but don't block the loop.
 */
export async function enhancePrompt(
  usedPrompt: string,
  loadedPrompt: string,
  options: NormalizedLoopOptions,
  archiveLearning: ArchiveLearning | null
): Promise<string> {
  let enhanced = usedPrompt;

  // 1. Inject a random compost seed for creative cross-pollination
  try {
    const compostConfig = mergeCompostConfig();
    const seedBank = new SeedBank(compostConfig);
    const seed = await seedBank.getRandomSeed();
    if (seed) {
      enhanced += '\n\n---\nCreative seed from compost:\n' + formatSeedForPrompt(seed, 500);
    }
  } catch (err) {
    Logger.warn('RalphLoop', 'Compost seed injection failed:', err);
  }

  // 2. Inject compost DNA if available for the detected domain
  try {
    const allDNA = generatorRegistry.getAllDNA();
    if (allDNA.size > 0) {
      const dispatchedDNA = generatorRegistry.dispatch(loadedPrompt);
      const matchedDomain = dispatchedDNA?.entry?.name;
      if (matchedDomain) {
        const dna = generatorRegistry.getDNA(matchedDomain);
        if (dna && dna.coreLogic) {
          enhanced += '\n\n---\nDomain knowledge from compost DNA:\n' +
            `Core pattern: ${dna.coreLogic}\n` +
            (dna.prompts?.length > 0 ? `Example prompt: ${dna.prompts[0]}\n` : '');
        }
      }
      // Also inject from all DNA entries if domain match is weak
      if (!dispatchedDNA || dispatchedDNA.confidence < 0.7) {
        for (const [domain, dna] of allDNA) {
          const promptLower = loadedPrompt.toLowerCase();
          if (promptLower.includes(domain.toLowerCase()) && dna.coreLogic) {
            enhanced += '\n\n---\nCompost DNA for "' + domain + '":\n' +
              `Core pattern: ${dna.coreLogic}\n`;
            break; // Only inject one fallback DNA
          }
        }
      }
    }
  } catch (err) {
    Logger.warn('RalphLoop', 'Compost DNA injection failed:', err);
  }

  // 3. Inject archived high-quality examples from past runs
  if (archiveLearning) {
    try {
      const archiveEnhanced = archiveLearning.buildEnhancedPrompt(enhanced, options.collabDomain || 'p5');
      if (archiveEnhanced !== enhanced) {
        enhanced = archiveEnhanced;
      }
    } catch (err) {
      Logger.warn('RalphLoop', 'Archive learning injection failed:', err);
    }
  }

  return enhanced;
}
