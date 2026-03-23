import type {
  CreativeBrief,
  Domain,
  Technique,
  Reference
} from './types.js';

export interface InterviewAnswers {
  intent?: string;
  context?: string;
  mood?: string;
  constraints?: string[];
  references?: Reference[];
  preferredDomain?: Domain;
}

/**
 * Technique definitions for keyword matching
 */
const TECHNIQUE_DEFINITIONS: Omit<Technique, 'domain'>[] = [
  {
    name: 'Particle Systems',
    description: 'Systems of particles that move and interact',
    keywords: ['particle']
  },
  {
    name: 'Flow Fields',
    description: 'Vector fields that guide movement',
    keywords: ['flow']
  },
  {
    name: 'Perlin Noise',
    description: 'Gradient noise for organic textures',
    keywords: ['noise']
  },
  {
    name: 'Cellular Automata',
    description: 'Grid-based computational systems',
    keywords: ['cellular', 'automata']
  }
];

/**
 * Build a CreativeBrief from interview answers
 * Infers domain, techniques, and complexity from the provided answers
 */
export function buildCreativeBrief(answers: InterviewAnswers): CreativeBrief {
  // Extract direct answers with defaults
  const intent = answers.intent ?? '';
  const context = answers.context ?? '';
  const mood = answers.mood ?? '';
  const constraints = answers.constraints ?? [];
  const references = answers.references ?? [];

  // Infer domain (default to 'p5')
  const domain: Domain = answers.preferredDomain ?? 'p5';

  // Infer techniques from intent keywords
  const techniques = inferTechniques(intent, domain);

  // Infer complexity based on intent length and constraints
  const complexity = inferComplexity(intent, constraints);

  return {
    // From interview
    intent,
    context,
    mood,
    constraints,
    references,

    // Inferred by Liminal
    domain,
    techniques,
    complexity,

    // Generation strategy (not set in Phase 1)
    useSwarm: undefined,
    useArchiveLearning: undefined,
    useCompostSeeds: undefined
  };
}

/**
 * Infer techniques from intent keywords
 */
function inferTechniques(intent: string, domain: Domain): Technique[] {
  const techniques: Technique[] = [];
  const lowerIntent = intent.toLowerCase();

  for (const def of TECHNIQUE_DEFINITIONS) {
    // Check if any keyword appears in the intent
    if (def.keywords.some(keyword => lowerIntent.includes(keyword))) {
      techniques.push({
        ...def,
        domain
      });
    }
  }

  return techniques;
}

/**
 * Infer complexity based on intent length and number of constraints
 */
function inferComplexity(
  intent: string,
  constraints: string[]
): 'simple' | 'medium' | 'complex' {
  const intentLength = intent.length;
  const constraintCount = constraints.length;

  // Simple: short intent and few constraints
  if (intentLength < 20 && constraintCount < 2) {
    return 'simple';
  }

  // Complex: long intent or many constraints
  if (intentLength > 50 || constraintCount >= 3) {
    return 'complex';
  }

  // Medium: everything else
  return 'medium';
}
