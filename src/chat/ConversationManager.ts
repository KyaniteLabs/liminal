import type {
  CreativeSession,
  Session,
  ConversationMessage,
  InterviewQuestion,
  CreativeBrief
} from './types.js';
import { buildCreativeBrief, type InterviewAnswers } from './CreativeBrief.js';
import { getNextQuestion } from './InterviewPhase.js';

// Interview phase type
type InterviewPhase = 'greeting' | 'discovery' | 'confirm' | 'generating';

/**
 * Stub interface for Art Brain integration
 * Will be replaced with SemanticArtMemory in Phase 2
 */
interface ArtBrainStub {}

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

  // Art Brain integration (stub for Phase 1)
  artBrain: ArtBrainStub | null = null; // Will be SemanticArtMemory in Phase 2

  constructor() {
    // Initialize with default state
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
    const response = this.advancePhase(nextQuestion);

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
      discovery: ['context', 'mood', 'references', 'constraints'],
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
  private advancePhase(nextQuestion: InterviewQuestion | null): AgentResponse {
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
          return {
            message: 'Generating your creation...',
            type: 'info',  // Use 'info' instead of 'generating' for confirmation
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

      // If advancing to generating phase, return info type
      if (nextPhase === 'generating') {
        return {
          message: nextQuestion.question,
          type: 'info',
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
