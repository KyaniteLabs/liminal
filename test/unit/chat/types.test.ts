import { describe, it, expect } from 'vitest';

// This import will fail initially (RED phase)
import {
  CreativeSession,
  Session,
  Episode,
  Conversation,
  ConversationMessage,
  InterviewQuestion,
  Reference,
  Parameter,
  Iteration,
  GenerationContext,
  Suggestion,
  Domain,
  Technique,
  CreativeBrief,
} from '../../../src/chat/types.js';

describe('Chat Type Definitions', () => {
  describe('Domain', () => {
    it('accepts all valid domain types', () => {
      const validDomains: Domain[] = [
        'p5',
        'shader',
        'three',
        'music',
        'hydra',
        'strudel',
      ];

      validDomains.forEach((domain) => {
        expect(domain).toBeTruthy();
      });
    });
  });

  describe('CreativeSession', () => {
    it('accepts valid session with all required fields', () => {
      const session: CreativeSession = {
        id: 'session-1',
        startedAt: new Date('2026-03-22'),
        userId: 'user-123',
        brief: {
          intent: 'Create something beautiful',
          context: 'For a gallery show',
          mood: 'ethereal',
          constraints: ['no external assets'],
          references: [],
          domain: 'p5',
          techniques: [],
          complexity: 'medium',
        },
        iterations: [],
        status: 'active',
      };

      expect(session.id).toBe('session-1');
      expect(session.status).toBe('active');
    });

    it('accepts session without optional fields', () => {
      const session: CreativeSession = {
        id: 'session-2',
        startedAt: new Date(),
        iterations: [],
        status: 'paused',
      };

      expect(session.userId).toBeUndefined();
      expect(session.brief).toBeUndefined();
    });

    it('accepts all valid status values', () => {
      const statuses: Array<'active' | 'paused' | 'completed'> = ['active', 'paused', 'completed'];

      statuses.forEach((status) => {
        const session: CreativeSession = {
          id: `session-${status}`,
          startedAt: new Date(),
          iterations: [],
          status,
        };
        expect(session.status).toBe(status);
      });
    });
  });

  describe('Session', () => {
    it('accepts valid session with messages', () => {
      const session: Session = {
        sessionId: 'sess-1',
        createdAt: new Date(),
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: 'Hello',
            timestamp: new Date(),
          },
          {
            id: 'msg-2',
            role: 'assistant',
            content: 'Hi there!',
            timestamp: new Date(),
          },
        ],
        metadata: {
          theme: 'dark',
        },
      };

      expect(session.sessionId).toBe('sess-1');
      expect(session.messages).toHaveLength(2);
    });
  });

  describe('Episode', () => {
    it('accepts valid episode with all types', () => {
      const types: Array<'conversation' | 'generation' | 'feedback'> = ['conversation', 'generation', 'feedback'];

      types.forEach((type) => {
        const episode: Episode = {
          id: `ep-${type}`,
          timestamp: new Date(),
          type,
          content: { data: 'test' },
        };
        expect(episode.type).toBe(type);
      });
    });
  });

  describe('Conversation', () => {
    it('accepts valid conversation with messages', () => {
      const conversation: Conversation = {
        id: 'conv-1',
        sessionId: 'sess-1',
        messages: [
          {
            id: 'msg-1',
            role: 'system',
            content: 'System message',
            timestamp: new Date(),
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(conversation.id).toBe('conv-1');
      expect(conversation.messages).toHaveLength(1);
    });
  });

  describe('ConversationMessage', () => {
    it('accepts all valid roles', () => {
      const roles: Array<'user' | 'assistant' | 'system'> = ['user', 'assistant', 'system'];

      roles.forEach((role) => {
        const message: ConversationMessage = {
          id: `msg-${role}`,
          role,
          content: `Test ${role} message`,
          timestamp: new Date(),
        };
        expect(message.role).toBe(role);
      });
    });

    it('accepts message with metadata', () => {
      const message: ConversationMessage = {
        id: 'msg-meta',
        role: 'user',
        content: 'Message with metadata',
        timestamp: new Date(),
        metadata: {
          tokens: 42,
          model: 'gpt-4',
        },
      };

      expect(message.metadata?.tokens).toBe(42);
    });
  });

  describe('InterviewQuestion', () => {
    it('accepts valid question with all phases', () => {
      const phases: Array<'greeting' | 'discovery' | 'confirm' | 'generating'> = [
        'greeting',
        'discovery',
        'confirm',
        'generating',
      ];

      phases.forEach((phase) => {
        const question: InterviewQuestion = {
          id: `q-${phase}`,
          phase,
          question: `Test question for ${phase}`,
          type: 'text',
          required: true,
        };
        expect(question.phase).toBe(phase);
      });
    });

    it('accepts question with choices', () => {
      const question: InterviewQuestion = {
        id: 'q-choice',
        phase: 'discovery',
        question: 'Choose your preference',
        type: 'choice',
        options: ['Option A', 'Option B', 'Option C'],
        required: false,
      };

      expect(question.type).toBe('choice');
      expect(question.options).toHaveLength(3);
    });

    it('accepts multiple choice question', () => {
      const question: InterviewQuestion = {
        id: 'q-multi',
        phase: 'discovery',
        question: 'Select all that apply',
        type: 'multiple',
        options: ['A', 'B', 'C'],
        required: true,
      };

      expect(question.type).toBe('multiple');
    });
  });

  describe('Reference', () => {
    it('accepts all valid reference types', () => {
      const types: Array<'past-work' | 'external' | 'movement' | 'technique'> = [
        'past-work',
        'external',
        'movement',
        'technique',
      ];

      types.forEach((type) => {
        const reference: Reference = {
          type,
          id: `ref-${type}`,
          description: `Test ${type} reference`,
        };
        expect(reference.type).toBe(type);
      });
    });
  });

  describe('Parameter', () => {
    it('accepts slider parameter with bounds', () => {
      const param: Parameter = {
        name: 'speed',
        value: 0.5,
        type: 'slider',
        min: 0,
        max: 1,
        step: 0.01,
      };

      expect(param.type).toBe('slider');
      expect(param.min).toBe(0);
      expect(param.max).toBe(1);
    });

    it('accepts toggle parameter', () => {
      const param: Parameter = {
        name: 'enabled',
        value: true,
        type: 'toggle',
      };

      expect(param.type).toBe('toggle');
      expect(param.value).toBe(true);
    });

    it('accepts select parameter with options', () => {
      const param: Parameter = {
        name: 'mode',
        value: 'normal',
        type: 'select',
        options: ['normal', 'add', 'multiply'],
      };

      expect(param.type).toBe('select');
      expect(param.options).toHaveLength(3);
    });

    it('accepts text parameter', () => {
      const param: Parameter = {
        name: 'label',
        value: 'My Label',
        type: 'text',
      };

      expect(param.type).toBe('text');
      expect(param.value).toBe('My Label');
    });
  });

  describe('Iteration', () => {
    it('accepts valid iteration with all fields', () => {
      const iteration: Iteration = {
        version: 1,
        code: 'function draw() { background(255); }',
        domain: 'p5',
        score: 0.85,
        timestamp: new Date(),
        parameters: {
          backgroundColor: '#ffffff',
        },
        diffFromPrevious: 'Initial version',
      };

      expect(iteration.version).toBe(1);
      expect(iteration.domain).toBe('p5');
      expect(iteration.score).toBe(0.85);
    });

    it('accepts iteration without optional fields', () => {
      const iteration: Iteration = {
        version: 2,
        code: 'rect(0, 0, 100, 100);',
        domain: 'shader',
        timestamp: new Date(),
      };

      expect(iteration.score).toBeUndefined();
      expect(iteration.parameters).toBeUndefined();
      expect(iteration.diffFromPrevious).toBeUndefined();
    });
  });

  describe('GenerationContext', () => {
    it('accepts valid generation context', () => {
      const context: GenerationContext = {
        prompt: 'Create a flowing animation',
        domain: 'p5',
        techniques: [
          {
            name: 'noise field',
            domain: 'p5',
            description: 'Using Perlin noise for organic motion',
            keywords: ['noise', 'flow', 'organic'],
          },
        ],
        constraints: ['max 100 lines', 'no external assets'],
        references: [
          {
            type: 'movement',
            id: 'ref-1',
            description: 'Inspired by generative art approaches',
          },
        ],
      };

      expect(context.domain).toBe('p5');
      expect(context.techniques).toHaveLength(1);
      expect(context.constraints).toHaveLength(2);
    });
  });

  describe('Suggestion', () => {
    it('accepts all valid suggestion types', () => {
      const types: Array<'technique' | 'parameter' | 'swarm' | 'compost' | 'archive'> = [
        'technique',
        'parameter',
        'swarm',
        'compost',
        'archive',
      ];

      types.forEach((type) => {
        const suggestion: Suggestion = {
          type,
          title: `Test ${type}`,
          description: `A ${type} suggestion`,
          priority: 'medium',
        };
        expect(suggestion.type).toBe(type);
      });
    });

    it('accepts all valid priorities', () => {
      const priorities: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];

      priorities.forEach((priority) => {
        const suggestion: Suggestion = {
          type: 'technique',
          title: `Priority ${priority}`,
          description: `Test`,
          priority,
        };
        expect(suggestion.priority).toBe(priority);
      });
    });

    it('accepts suggestion with action', () => {
      const suggestion: Suggestion = {
        type: 'compost',
        title: 'Use Compost Seed',
        description: 'Incorporate a seed from the compost',
        priority: 'high',
        action: async () => {
          return { seedId: 'seed-123' };
        },
      };

      expect(suggestion.action).not.toBeNull();
      expect(typeof suggestion.action).toBe('function');
    });
  });

  describe('Technique', () => {
    it('accepts valid technique', () => {
      const technique: Technique = {
        name: 'particle system',
        domain: 'p5',
        description: 'Create moving particles with physics',
        keywords: ['particles', 'physics', 'motion', 'velocity'],
      };

      expect(technique.name).toBe('particle system');
      expect(technique.domain).toBe('p5');
      expect(technique.keywords).toHaveLength(4);
    });
  });

  describe('CreativeBrief', () => {
    it('accepts complete brief with all fields', () => {
      const brief: CreativeBrief = {
        intent: 'Create an interactive art piece',
        context: 'For a digital gallery exhibition',
        mood: 'calming and meditative',
        constraints: ['mouse interaction only', 'max 200 lines'],
        references: [
          {
            type: 'movement',
            id: 'ref-1',
            description: 'Inspired by interactive art styles',
          },
        ],
        domain: 'p5',
        techniques: [
          {
            name: 'interactive particles',
            domain: 'p5',
            description: 'Particles that respond to mouse',
            keywords: ['mouse', 'interactive', 'particles'],
          },
        ],
        complexity: 'medium',
        useSwarm: true,
        useArchiveLearning: false,
        useCompostSeeds: true,
      };

      expect(brief.intent).toBe('Create an interactive art piece');
      expect(brief.domain).toBe('p5');
      expect(brief.complexity).toBe('medium');
      expect(brief.useSwarm).toBe(true);
    });

    it('accepts brief without optional strategy flags', () => {
      const brief: CreativeBrief = {
        intent: 'Simple sketch',
        context: 'Learning',
        mood: 'playful',
        constraints: [],
        references: [],
        domain: 'p5',
        techniques: [],
        complexity: 'simple',
      };

      expect(brief.useSwarm).toBeUndefined();
      expect(brief.useArchiveLearning).toBeUndefined();
      expect(brief.useCompostSeeds).toBeUndefined();
    });

    it('accepts all complexity levels', () => {
      const complexities: Array<'simple' | 'medium' | 'complex'> = ['simple', 'medium', 'complex'];

      complexities.forEach((complexity) => {
        const brief: CreativeBrief = {
          intent: `Test ${complexity}`,
          context: 'Test',
          mood: 'neutral',
          constraints: [],
          references: [],
          domain: 'p5',
          techniques: [],
          complexity,
        };
        expect(brief.complexity).toBe(complexity);
      });
    });
  });
});
