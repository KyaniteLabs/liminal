import type { SingSemanticMapping } from './PresetSchema.js';

/**
 * The full expressive vocabulary bound to conventional uniform names. The binder
 * merges these for any uniform a preset does not explicitly map, so every
 * preset — including the organism's future auto-generated ones — responds richly
 * to the voice without declaring anything.
 */
export const DEFAULT_SEMANTIC_MAPPINGS: readonly SingSemanticMapping[] = [
  { source: 'semantic', channel: 'palette.hue', target: 'u_hue' },
  { source: 'semantic', channel: 'palette.saturation', target: 'u_saturation' },
  { source: 'semantic', channel: 'palette.value', target: 'u_value' },
  { source: 'semantic', channel: 'palette.accentHue', target: 'u_accentHue' },
  { source: 'semantic', channel: 'form.family', target: 'u_form' },
  { source: 'semantic', channel: 'form.complexity', target: 'u_complexity' },
  { source: 'semantic', channel: 'form.symmetry', target: 'u_symmetry' },
  { source: 'semantic', channel: 'form.sharpness', target: 'u_sharpness' },
  { source: 'semantic', channel: 'motion.flow', target: 'u_flow' },
  { source: 'semantic', channel: 'motion.turbulence', target: 'u_turbulence' },
  { source: 'semantic', channel: 'motion.shimmer', target: 'u_shimmer' },
  { source: 'semantic', channel: 'texture.grain', target: 'u_grain' },
  { source: 'semantic', channel: 'texture.glow', target: 'u_glow' },
  { source: 'semantic', channel: 'texture.softness', target: 'u_softness' },
  { source: 'semantic', channel: 'density.coverage', target: 'u_coverage' },
  { source: 'semantic', channel: 'density.spawn', target: 'u_spawn' },
  { source: 'semantic', channel: 'composition.scale', target: 'u_scale' },
  { source: 'semantic', channel: 'composition.focalY', target: 'u_focalY' },
  { source: 'semantic', channel: 'composition.depth', target: 'u_depth' },
];
