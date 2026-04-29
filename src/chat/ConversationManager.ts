import type {
  CreativeSession,
  Session,
  ConversationMessage,
  InterviewQuestion,
  CreativeBrief,
  Iteration,
  Suggestion
} from './types.js';
import { buildCreativeBrief, type InterviewAnswers } from './CreativeBrief.js';
import { getNextQuestion } from './InterviewPhase.js';
import { RalphLoop } from '../core/RalphLoop.js';
import type { IterationContext } from '../core/LoopConfig.js';
// Note: SemanticArtMemory archived as part of Fix 8 - using HarnessMemory via GuidanceEngine
import { GuidanceEngine } from './GuidanceEngine.js';
import { SemanticArtMemory } from '../brain/archive/SemanticArtMemory.js';
import { buildCreativePreferencePromptHints } from './CreativePreferenceGuide.js';

// Interview phase type
type InterviewPhase = 'greeting' | 'discovery' | 'confirm' | 'generating';

/**
 * Response from the agent to a user message
 */
export interface AgentResponse {
  message: string;
  type: 'question' | 'info' | 'error' | 'generating';
  nextPhase?: InterviewPhase;
}

/**
 * Manages conversation state, interview flow, and session history
 */
export class ConversationManager {
  // Session state
  currentSession: CreativeSession | null = null;
  sessionHistory: Session[] = [];

  // Interview state
  interviewPhase: InterviewPhase = 'greeting';
  interviewAnswers: Map<string, any> = new Map();

  // Guidance engine for proactive suggestions
  guidance: GuidanceEngine;
  artBrain: SemanticArtMemory;

  constructor(artBrain?: SemanticArtMemory) {
    // Initialize with default state
    this.artBrain = artBrain || new SemanticArtMemory();
    this.guidance = new GuidanceEngine(this.artBrain);
  }

  /**
   * Start a new creative session
   */
  startNewSession(): void {
    // Save current session to history if it exists
    if (this.currentSession) {
      // Only save if it's not already in history
      const exists = this.sessionHistory.find(s => s.sessionId === this.currentSession!.id);
      if (!exists) {
        this.sessionHistory.push({
          sessionId: this.currentSession.id,
          createdAt: this.currentSession.startedAt,
          messages: []
        });
      }
    }

    // Generate unique ID
    const id = this.generateUniqueId();

    // Create new session
    this.currentSession = {
      id,
      startedAt: new Date(),
      iterations: [],
      status: 'active'
    };

    // Reset interview state
    this.interviewPhase = 'greeting';
    this.interviewAnswers.clear();
  }

  /**
   * Continue an existing session from history
   */
  continueSession(sessionId: string): void {
    // Find session in history
    const session = this.sessionHistory.find(s => s.sessionId === sessionId);

    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // For now, create a new CreativeSession from the old session
    // In Phase 2, we'll properly restore the full session state
    this.currentSession = {
      id: sessionId,
      startedAt: session.createdAt,
      iterations: [],
      status: 'active'
    };
  }

  /**
   * Process a user message through the interview flow
   */
  async processUserMessage(message: string): Promise<AgentResponse> {
    // Record user message
    this.recordMessage('user', message);

    // Update interview answers based on current phase
    this.updateAnswers(message);

    // Get next question
    const nextQuestion = getNextQuestion(this.interviewPhase, this.interviewAnswers);

    // Advance phase if current phase is complete
    const response = await this.advancePhase(nextQuestion);

    // Record assistant response
    this.recordMessage('assistant', response.message);

    return response;
  }

  /**
   * Get the current interview question
   */
  getInterviewQuestion(): InterviewQuestion | null {
    // Return null if we're in generating phase
    if (this.interviewPhase === 'generating') {
      return null;
    }
    return getNextQuestion(this.interviewPhase, this.interviewAnswers);
  }

  /**
   * Build a creative brief from interview answers
   */
  buildCreativeBrief(): CreativeBrief {
    return buildCreativeBrief(
      Object.fromEntries(this.interviewAnswers) as InterviewAnswers
    );
  }

  /**
   * Generate creative work from a brief using RalphLoop
   *
   * @param brief - The creative brief with intent, domain, techniques
   * @returns Promise that resolves when generation completes
   */
  async generateFromBrief(brief: CreativeBrief): Promise<void> {
    if (!this.currentSession) {
      throw new Error('Cannot generate: no active session');
    }

    // Build prompt from brief
    let prompt = `Intent: ${brief.intent}\n`;
    if (brief.context) {
      prompt += `Context: ${brief.context}\n`;
    }
    if (brief.mood) {
      prompt += `Mood: ${brief.mood}\n`;
    }
    if (brief.constraints.length > 0) {
      const constraintsStr = Array.isArray(brief.constraints)
        ? brief.constraints.join(', ')
        : String(brief.constraints);
      prompt += `Constraints: ${constraintsStr}\n`;
    }

    // Add techniques to prompt
    if (brief.techniques.length > 0) {
      prompt += `\nTechniques to use:\n`;
      for (const technique of brief.techniques) {
        prompt += `- ${technique.name}: ${technique.description}\n`;
      }
    }

    const creativePreferenceHints = buildCreativePreferencePromptHints({
      domain: brief.domain,
      prompt,
      answers: Object.fromEntries(this.interviewAnswers),
    });
    if (creativePreferenceHints.length > 0) {
      prompt += '\nCreative preferences:\n';
      for (const hint of creativePreferenceHints) {
        prompt += `- ${hint}\n`;
      }
    }

    // Determine max iterations based on complexity
    const maxIterations = brief.complexity === 'simple' ? 5 :
                         brief.complexity === 'medium' ? 10 : 15;

    // Track thoughts for progress display
    const thoughts: string[] = [];

    // Run RalphLoop with chat mode enabled
    const result = await RalphLoop.run(prompt, {
      // Chat mode options
      chatMode: true,
      onThought: (thought: string) => {
        thoughts.push(thought);
        // Record thought as system message for history
        this.recordMessage('system', `[Generation] ${thought}`);
      },
      onIteration: (iterationContext: IterationContext) => {
        // Convert to Iteration and add to session
        const iteration: Iteration = {
          version: iterationContext.iteration,
          code: iterationContext.code,
          domain: brief.domain,
          score: iterationContext.evaluation.score,
          timestamp: new Date(iterationContext.timestamp)
        };

        if (this.currentSession) {
          this.currentSession.iterations.push(iteration);
        }
      },
      onSuggestion: (suggestion: Suggestion) => {
        // Record suggestion as system message for history
        this.recordMessage('system', `[Suggestion] ${suggestion.title}: ${suggestion.description}`);
      },
      guidanceEngine: this.guidance,

      // Domain and collaboration
      collabDomain: brief.domain as import('../types/domains.js').Domain,

      // Iteration settings
      maxIterations,
      timeoutMinutes: 10,

      // Project settings
      project: this.currentSession.id,
      galleryDir: 'gallery'
    });

    // Record final result
    this.recordMessage('system', `Generation complete: ${result.reason} (${result.iterations} iterations, score: ${result.finalScore.toFixed(2)})`);
  }

  /**
   * Generate a unique session ID
   */
  private generateUniqueId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Record a message in the current session
   */
  private recordMessage(role: 'user' | 'assistant' | 'system', content: string): void {
    const message: ConversationMessage = {
      id: this.generateUniqueId(),
      role,
      content,
      timestamp: new Date()
    };

    // Find or create session in history
    let session = this.sessionHistory.find(s => s.sessionId === this.currentSession?.id);

    if (!session) {
      if (!this.currentSession) {
        throw new Error('Cannot record message: no active session');
      }
      session = {
        sessionId: this.currentSession.id,
        createdAt: new Date(),
        messages: []
      };
      this.sessionHistory.push(session);
    }

    session.messages.push(message);
  }

  /**
   * Update interview answers based on current phase and message
   */
  private updateAnswers(message: string): void {
    // Map questions to answer IDs
    const phaseQuestions: Record<InterviewPhase, string[]> = {
      greeting: ['intent'],
      discovery: ['context', 'mood', 'references', 'constraints', 'audioPreference', 'aestheticPreset'],
      confirm: ['confirmed'],
      generating: []
    };

    const currentQuestions = phaseQuestions[this.interviewPhase];

    // Find first unanswered question in current phase
    for (const questionId of currentQuestions) {
      if (!this.interviewAnswers.has(questionId)) {
        this.interviewAnswers.set(questionId, message);
        break;
      }
    }
  }

  /**
   * Advance to next phase if current phase is complete
   */
  private async advancePhase(nextQuestion: InterviewQuestion | null): Promise<AgentResponse> {
    const phaseOrder: InterviewPhase[] = ['greeting', 'discovery', 'confirm', 'generating'];
    const currentIndex = phaseOrder.indexOf(this.interviewPhase);

    // If there's no next question, we need to advance phase
    if (!nextQuestion) {
      // Move to next phase
      if (currentIndex < phaseOrder.length - 1) {
        const nextPhase = phaseOrder[currentIndex + 1];
        this.interviewPhase = nextPhase;

        // Get first question of next phase
        const nextPhaseQuestion = getNextQuestion(nextPhase, this.interviewAnswers);

        if (nextPhaseQuestion) {
          return {
            message: nextPhaseQuestion.question,
            type: 'question',
            nextPhase
          };
        }

        // If no more questions, we're at generating phase
        if (nextPhase === 'generating') {
          // Trigger generation
          const brief = this.buildCreativeBrief();
          await this.generateFromBrief(brief);

          return {
            message: 'Generating your creation...',
            type: 'generating',
            nextPhase
          };
        }
      }

      return {
        message: 'Interview complete',
        type: 'info'
      };
    }

    // Check if the next question is from a different phase (phase advance occurred)
    if (nextQuestion.phase !== this.interviewPhase) {
      const nextPhase = nextQuestion.phase;
      this.interviewPhase = nextPhase;

      // If advancing to generating phase, trigger generation
      if (nextPhase === 'generating') {
        // Trigger generation
        const brief = this.buildCreativeBrief();
        await this.generateFromBrief(brief);

        return {
          message: nextQuestion.question,
          type: 'generating',
          nextPhase
        };
      }

      return {
        message: nextQuestion.question,
        type: 'question',
        nextPhase
      };
    }

    // Same phase, return the question
    return {
      message: nextQuestion.question,
      type: 'question'
    };
  }
}
