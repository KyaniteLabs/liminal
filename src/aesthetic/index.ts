// ---------------------------------------------------------------------------
// Aesthetic barrel – re-exports all public API
// ---------------------------------------------------------------------------

export { AestheticCritic } from './AestheticCritic.js';
export { AestheticStrategy } from './AestheticStrategy.js';
export {
  buildColorTheoryGuidance,
  contrastRatio,
  createColorTheoryPalette,
  evaluateColorTheoryPalette,
  hslToRgb,
  parseHexColor,
  rgbToHex,
  rgbToHsl,
} from './ColorTheoryEngine.js';
export type {
  ColorTheoryEvaluation,
  ColorTheoryPalette,
  ColorTheoryRequest,
  HSLColor,
  PaletteColor,
  PaletteRole,
  RGBColor,
} from './ColorTheoryEngine.js';
export type {
  DesignConstraints,
  AestheticViolation,
  AestheticReport,
  CriticConfig,
  AestheticPreset,
  HarmonyMode,
  TemperatureBalance,
  CompositionGuide,
  FontStyle,
  LIREvaluationContext,
  LIRAwareAestheticReport,
} from './types.js';
export { DEFAULT_DESIGN_CONSTRAINTS, PRESET_PROFILES } from './types.js';
