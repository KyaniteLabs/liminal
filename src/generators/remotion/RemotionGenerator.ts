/**
 * Legacy compatibility alias for the active Revideo generator.
 *
 * New runtime paths should import RevideoGenerator directly.
 */

export {
  RevideoGenerator as RemotionGenerator,
  type RevideoGeneratorOptions as RemotionGeneratorOptions,
} from '../revideo/RevideoGenerator.js';
