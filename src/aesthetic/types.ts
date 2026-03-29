// ---------------------------------------------------------------------------
// Aesthetic types – design constraints, presets, critic config
// ---------------------------------------------------------------------------

/** Color harmony strategy */
export type HarmonyMode =
  | 'analogous'
  | 'complementary'
  | 'triadic'
  | 'split-complementary'
  | 'monochromatic'
  | 'free';

/** Overall colour temperature preference */
export type TemperatureBalance = 'warm' | 'cool' | 'balanced' | 'any';

/** Layout composition guide */
export type CompositionGuide =
  | 'rule-of-thirds'
  | 'golden-ratio'
  | 'center'
  | 'free';

/** Typography font style preference */
export type FontStyle = 'serif' | 'sans-serif' | 'mono' | 'mixed' | 'any';

/** Named aesthetic preset */
export type AestheticPreset =
  | 'minimalist'
  | 'vibrant'
  | 'cinematic'
  | 'playful'
  | 'free';

// ---------------------------------------------------------------------------
// Constraint sub-objects
// ---------------------------------------------------------------------------

export interface ColorConstraints {
  harmonyMode: HarmonyMode;
  maxColors: number;
  saturationRange: [number, number];
  lightnessRange: [number, number];
  contrastMin: number;
  temperatureBalance: TemperatureBalance;
  forbiddenColors?: string[];
}

export interface LayoutConstraints {
  focalPointRequired: boolean;
  minWhitespace: number;
  balanceThreshold: number;
  compositionGuide: CompositionGuide;
}

export interface TypographyConstraints {
  maxFonts: number;
  sizeHierarchyRequired: boolean;
  minReadability: number;
  fontStyle: FontStyle;
}

export interface SoundConstraints {
  maxDissonance: number;
  rhythmicCoherenceMin: number;
  tonalCenterRequired: boolean;
}

export interface GeneralConstraints {
  complexityRange: [number, number];
  forbiddenPatterns: string[];
  minAestheticScore: number;
}

// ---------------------------------------------------------------------------
// Top-level constraint envelope
// ---------------------------------------------------------------------------

export interface DesignConstraints {
  color: ColorConstraints;
  layout: LayoutConstraints;
  typography: TypographyConstraints;
  sound: SoundConstraints;
  general: GeneralConstraints;
}

// ---------------------------------------------------------------------------
// Critic result types
// ---------------------------------------------------------------------------

export interface AestheticViolation {
  rule: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  location?: string;
}

export interface AestheticReport {
  score: number;
  violations: AestheticViolation[];
  passed: boolean;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Critic configuration
// ---------------------------------------------------------------------------

export type CriticStrictness = 'lenient' | 'moderate' | 'strict';

export interface CriticConfig {
  enabledCritics: string[];
  strictness: CriticStrictness;
  constraints: DesignConstraints;
}

// ---------------------------------------------------------------------------
// Default constraints – permissive baseline
// ---------------------------------------------------------------------------

export const DEFAULT_DESIGN_CONSTRAINTS: DesignConstraints = {
  color: {
    harmonyMode: 'free',
    maxColors: 7,
    saturationRange: [0.05, 0.95],
    lightnessRange: [0.1, 0.9],
    contrastMin: 3.0,
    temperatureBalance: 'any',
  },
  layout: {
    focalPointRequired: false,
    minWhitespace: 0.1,
    balanceThreshold: 0.3,
    compositionGuide: 'free',
  },
  typography: {
    maxFonts: 3,
    sizeHierarchyRequired: false,
    minReadability: 3.0,
    fontStyle: 'any',
  },
  sound: {
    maxDissonance: 0.5,
    rhythmicCoherenceMin: 0.3,
    tonalCenterRequired: false,
  },
  general: {
    complexityRange: [0.1, 0.9],
    forbiddenPatterns: [],
    minAestheticScore: 0.6,
  },
};

// ---------------------------------------------------------------------------
// Preset profiles – partial overrides over the defaults
// ---------------------------------------------------------------------------

export const PRESET_PROFILES: Record<string, Partial<DesignConstraints>> = {
  minimalist: {
    color: {
      harmonyMode: 'monochromatic',
      maxColors: 2,
      saturationRange: [0.0, 0.3],
      lightnessRange: [0.2, 0.9],
      contrastMin: 7.0,
      temperatureBalance: 'balanced',
    },
    layout: {
      focalPointRequired: true,
      minWhitespace: 0.4,
      balanceThreshold: 0.8,
      compositionGuide: 'rule-of-thirds',
    },
    typography: {
      maxFonts: 1,
      sizeHierarchyRequired: true,
      minReadability: 4.5,
      fontStyle: 'sans-serif',
    },
    general: {
      complexityRange: [0.1, 0.3],
      forbiddenPatterns: ['gradient', 'shadow', 'texture'],
      minAestheticScore: 0.7,
    },
  },

  vibrant: {
    color: {
      harmonyMode: 'triadic',
      maxColors: 8,
      saturationRange: [0.6, 1.0],
      lightnessRange: [0.3, 0.8],
      contrastMin: 3.5,
      temperatureBalance: 'any',
    },
    layout: {
      focalPointRequired: true,
      minWhitespace: 0.1,
      balanceThreshold: 0.4,
      compositionGuide: 'free',
    },
    typography: {
      maxFonts: 3,
      sizeHierarchyRequired: true,
      minReadability: 3.5,
      fontStyle: 'mixed',
    },
    general: {
      complexityRange: [0.6, 1.0],
      forbiddenPatterns: [],
      minAestheticScore: 0.5,
    },
  },

  cinematic: {
    color: {
      harmonyMode: 'split-complementary',
      maxColors: 5,
      saturationRange: [0.2, 0.7],
      lightnessRange: [0.1, 0.6],
      contrastMin: 6.0,
      temperatureBalance: 'warm',
    },
    layout: {
      focalPointRequired: true,
      minWhitespace: 0.2,
      balanceThreshold: 0.7,
      compositionGuide: 'golden-ratio',
    },
    typography: {
      maxFonts: 2,
      sizeHierarchyRequired: true,
      minReadability: 4.5,
      fontStyle: 'serif',
    },
    general: {
      complexityRange: [0.3, 0.7],
      forbiddenPatterns: ['neon', 'cartoon'],
      minAestheticScore: 0.65,
    },
  },

  playful: {
    color: {
      harmonyMode: 'analogous',
      maxColors: 6,
      saturationRange: [0.5, 1.0],
      lightnessRange: [0.4, 0.9],
      contrastMin: 3.0,
      temperatureBalance: 'warm',
    },
    layout: {
      focalPointRequired: false,
      minWhitespace: 0.15,
      balanceThreshold: 0.4,
      compositionGuide: 'free',
    },
    typography: {
      maxFonts: 3,
      sizeHierarchyRequired: false,
      minReadability: 3.0,
      fontStyle: 'mixed',
    },
    general: {
      complexityRange: [0.5, 1.0],
      forbiddenPatterns: [],
      minAestheticScore: 0.5,
    },
  },

  free: {},
};
