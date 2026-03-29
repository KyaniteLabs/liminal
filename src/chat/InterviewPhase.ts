import type {
  InterviewQuestion
} from './types.js';

type InterviewPhase = 'greeting' | 'discovery' | 'confirm' | 'generating';

/**
 * All interview questions organized by phase
 */
const QUESTIONS_BY_PHASE: Record<InterviewPhase, InterviewQuestion[]> = {
  greeting: [
    {
      id: 'intent',
      phase: 'greeting',
      question: "Welcome to Liminal! What would you like to create today?",
      type: 'text',
      required: true
    }
  ],

  discovery: [
    {
      id: 'context',
      phase: 'discovery',
      question: "What's the context for this creation? (e.g., web background, installation, gallery piece, sketch)",
      type: 'text',
      required: false
    },
    {
      id: 'mood',
      phase: 'discovery',
      question: "What feeling or mood should it evoke? (e.g., meditative, dreamy, hypnotic, energetic, chaotic)",
      type: 'text',
      required: false
    },
    {
      id: 'references',
      phase: 'discovery',
      question: "Any references or inspirations? (artists, styles, past work, techniques)",
      type: 'text',
      required: false
    },
    {
      id: 'constraints',
      phase: 'discovery',
      question: "Any constraints or requirements? (e.g., performance, browser support, file size)",
      type: 'text',
      required: false
    },
    {
      id: 'audioPreference',
      phase: 'discovery',
      question: "Would you like to use voice or singing to influence the visuals?",
      type: 'choice',
      options: ['No, text only', 'Yes, voice input', 'Yes, upload audio file'],
      required: false
    },
    {
      id: 'aestheticPreset',
      phase: 'discovery',
      question: "Any aesthetic preferences?",
      type: 'choice',
      options: ['Minimalist', 'Vibrant', 'Cinematic', 'Playful', 'Surprise me'],
      required: false
    }
  ],

  confirm: [
    {
      id: 'confirmed',
      phase: 'confirm',
      question: "Ready to generate?",
      type: 'choice',
      options: ['Yes, generate!', 'No, go back'],
      required: true
    }
  ],

  generating: [
    {
      id: 'generating',
      phase: 'generating',
      question: "Generating your creation...",
      type: 'text',
      required: false
    }
  ]
};

/**
 * Get the order of interview phases
 */
export function getPhaseOrder(): InterviewPhase[] {
  return ['greeting', 'discovery', 'confirm', 'generating'];
}

/**
 * Get all interview questions
 */
export function getAllQuestions(): InterviewQuestion[] {
  const phases = getPhaseOrder();
  const allQuestions: InterviewQuestion[] = [];

  for (const phase of phases) {
    allQuestions.push(...QUESTIONS_BY_PHASE[phase]);
  }

  return allQuestions;
}

/**
 * Get the next question based on current phase and answers
 *
 * @param currentPhase - The current interview phase
 * @param answers - Map of answer IDs to their values
 * @returns The next question to ask, or null if interview is complete
 */
export function getNextQuestion(
  currentPhase: InterviewPhase,
  answers: Map<string, any>
): InterviewQuestion | null {
  const phaseOrder = getPhaseOrder();
  const currentPhaseIndex = phaseOrder.indexOf(currentPhase);

  // If we're past the last phase, interview is complete
  if (currentPhaseIndex >= phaseOrder.length) {
    return null;
  }

  // Get questions for current phase
  const phaseQuestions = QUESTIONS_BY_PHASE[currentPhase];

  // Find first unanswered question in current phase
  for (const question of phaseQuestions) {
    if (!answers.has(question.id)) {
      return question;
    }
  }

  // All questions in current phase are answered, move to next phase
  if (currentPhaseIndex < phaseOrder.length - 1) {
    const nextPhase = phaseOrder[currentPhaseIndex + 1];
    return getNextQuestion(nextPhase, answers);
  }

  return null;
}

/**
 * Generate a summary of collected answers for the confirm phase
 *
 * @param answers - Map of answer IDs to their values
 * @returns A formatted summary string of what was learned
 */
export function generateSummary(answers: Map<string, any>): string {
  const summary: string[] = [];

  // Get all questions to map IDs to questions
  const allQuestions = getAllQuestions();
  const questionMap = new Map(allQuestions.map(q => [q.id, q]));

  // Build summary for each answered question (excluding confirm/generating phases)
  const displayIds = ['intent', 'context', 'mood', 'references', 'constraints'];

  for (const id of displayIds) {
    const value = answers.get(id);
    if (value && questionMap.has(id)) {
      const question = questionMap.get(id)!;
      const displayValue = Array.isArray(value) ? value.join(', ') : value;
      summary.push(`${question.question} ${displayValue}`);
    }
  }

  return summary.join('\n');
}
