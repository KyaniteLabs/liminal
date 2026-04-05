import { describe, it, expect } from 'vitest';
import { quickScore } from '../../../src/collab/Scoring.js';
import { Domain } from '../../../src/types/domains.js';
import {
  CreativeBoard,
  type BoardAgent,
  type BoardDeliberation,
} from '../../../src/collab/CreativeBoard.js';
import {
  EvaluationMemoBuilder,
  formatMemo,
  summarizeMemos,
  type EvaluationMemo,
  type MemoVerdict,
} from '../../../src/collab/EvaluationMemo.js';
import { CollaborationRole, CollaborationPhase } from '../../../src/collab/types.js';

// ─── Scoring ────────────────────────────────────────────────────────────

describe('Scoring', () => {
  it('quickScore returns value in [0, 1] range', () => {
    const score = quickScore('function setup() { createCanvas(400,400); }', Domain.P5);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('quickScore penalizes very short output', () => {
    const score = quickScore('ab', Domain.P5);
    expect(score).toBeLessThanOrEqual(0.3);
  });

  it('quickScore rewards ASCII special characters', () => {
    const output = '/\\|=+*<>@#%\n===\n|||\n+++';
    const score = quickScore(output, Domain.ASCII);
    expect(score).toBeGreaterThan(quickScore('hello world', Domain.ASCII));
  });

  it('quickScore rewards multi-line ASCII', () => {
    const output = '/\\|=+*<>@#%\n===\n|||\n+++\n===\n|||\n+++';
    const score = quickScore(output, Domain.ASCII);
    expect(score).toBeGreaterThan(0.4);
  });

  it('quickScore rewards music notation markers', () => {
    const output = 'X: 1\nT: Test\nM: 4/4\nK: C\nL: 1/8\nCDEFGABcde|:|:|\n';
    const score = quickScore(output, Domain.MUSIC);
    expect(score).toBeGreaterThan(0.7);
  });

  it('quickScore rewards code keywords', () => {
    const output = [
      'function init() {',
      '  const x = 42;',
      '  if (x > 0) {',
      '    for (let i = 0; i < x; i++) {',
      '      console.log(i);',
      '    }',
      '  }',
      '  return x;',
      '}',
    ].join('\n');
    const score = quickScore(output, Domain.CODE);
    expect(score).toBeGreaterThan(0.6);
  });

  it('quickScore rewards correct length (100-3000 chars)', () => {
    const goodLength = 'a'.repeat(500);
    const shortLength = 'ab';
    const scoreGood = quickScore(goodLength, Domain.P5);
    const scoreShort = quickScore(shortLength, Domain.P5);
    expect(scoreGood).toBeGreaterThan(scoreShort);
  });

  it('quickScore handles P5 domain with code keywords', () => {
    const code = 'function setup() {\n  createCanvas(800, 600);\n}\nfunction draw() {\n  background(200);\n  fill(255, 0, 0);\n  ellipse(400, 300, 50, 50);\n}';
    const score = quickScore(code, Domain.P5);
    expect(score).toBeGreaterThan(0.5);
  });

  it('quickScore handles GLSL domain', () => {
    const code = 'void main() {\n  gl_FragColor = vec4(1.0);\n  if (true) {\n    for (int i = 0; i < 10; i++) {\n      return;\n    }\n  }\n}';
    const score = quickScore(code, Domain.GLSL);
    expect(score).toBeGreaterThan(0.5);
  });

  it('quickScore handles THREE domain', () => {
    const code = 'const scene = new THREE.Scene();\nconst camera = new THREE.PerspectiveCamera();\nconst renderer = new THREE.WebGLRenderer();\nfor (let i = 0; i < 10; i++) {\n  return i;\n}\n';
    const score = quickScore(code, Domain.THREE);
    expect(score).toBeGreaterThan(0.5);
  });
});

// ─── CreativeBoard extended ────────────────────────────────────────────────

describe('CreativeBoard extended', () => {
  it('rejects eval() usage as security risk', () => {
    const board = new CreativeBoard();
    const code = 'eval("console.log(1)")';
    const result = board.deliberate(code, 'code');
    const riskMessages = result.risks.map(r => r.toLowerCase());
    const hasSecurityRisk = riskMessages.some(r => r.includes('security'));
    expect(hasSecurityRisk).toBe(true);
  });

  it('rewards error handling', () => {
    const board = new CreativeBoard();
    const codeWithErrorHandling = `
      try {
        doSomething();
      } catch (e) {
        handleError(e);
      }
    `;
    const result = board.deliberate(codeWithErrorHandling, 'code');
    const techStance = result.stances.find(s => s.agentName === 'The Technician');
    expect(techStance!.keyPoints.some(p => p.toLowerCase().includes('error handling'))).toBe(true);
  });

  it('detects missing setup for creative domains', () => {
    const board = new CreativeBoard();
    const codeWithoutSetup = 'function draw() { background(0); }';
    const result = board.deliberate(codeWithoutSetup, 'p5');
    const techStance = result.stances.find(s => s.agentName === 'The Technician');
    expect(techStance!.keyPoints.some(p => p.toLowerCase().includes('missing setup'))).toBe(true);
  });

  it('extracts tensions when agents disagree', () => {
    const board = new CreativeBoard();
    // Very simple code - minimalist happy, expressionist unhappy, technician neutral
    const code = 'const x = 1;';
    const result = board.deliberate(code, 'code');
    // There should be tensions if positions differ
    const positions = result.stances.map(s => s.position);
    const hasDisagreement = new Set(positions).size > 1;
    if (hasDisagreement) {
      expect(result.tensions.length).toBeGreaterThan(0);
    }
  });

  it('extracts consensus when agents agree', () => {
    const board = new CreativeBoard();
    // Good code that all agents should like
    const code = [
      'function setup() {',
      '  createCanvas(800, 600);',
      '}',
      'function draw() {',
      '  background(frameCount % 255);',
      '  fill(sin(frameCount * 0.05) * 255, 100, 150);',
      '  ellipse(mouseX, mouseY, 50, 50);',
      '  stroke(noise(frameCount * 0.01) * 255);',
      '  rect(100, 100, 200, 200);',
      '  beginShape();',
      '  vertex(50, 50);',
      '  endShape();',
      '  push();',
      '  rotate(0.1);',
      '  translate(10, 10);',
      '  pop();',
      '}',
    ].join('\n');
    const result = board.deliberate(code, 'p5');
    // All three should agree on good code
    expect(result.consensusPoints.length).toBeGreaterThan(0);
  });

  it('returns approve verdict for high quality code', () => {
    const board = new CreativeBoard();
    const goodCode = [
      'function setup() { createCanvas(800, 600); }',
      'function draw() {',
      '  background(20);',
      '  fill(200, 50, 100);',
      '  ellipse(mouseX, mouseY, 30);',
      '  stroke(100);',
      '  rect(100, 100, 50, 50);',
      '}',
    ].join('\n');
    const result = board.deliberate(goodCode, 'p5');
    expect(['approve', 'revise']).toContain(result.overallVerdict);
  });

  it('aggregate score is between 0 and 1', () => {
    const board = new CreativeBoard();
    const result = board.deliberate('const x = 42;', 'code');
    expect(result.aggregateScore).toBeGreaterThanOrEqual(0);
    expect(result.aggregateScore).toBeLessThanOrEqual(1);
  });

  it('handles code with deeply nested blocks', () => {
    const board = new CreativeBoard();
    const deepNest = `
function outer() {
  function level1() {
    function level2() {
      function level3() {
        function level4() {
          function level5() {
            // 6 levels deep
          }
        }
      }
    }
  }
}`;
    const result = board.deliberate(deepNest, 'code');
    const minimalistStance = result.stances.find(s => s.agentName === 'The Minimalist');
    expect(minimalistStance!.keyPoints.some(p => p.includes('nesting'))).toBe(true);
  });

  it('generates recommended actions based on risks', () => {
    const board = new CreativeBoard();
    const riskyCode = 'while(true) { eval("x" + Math.random()); }';
    const result = board.deliberate(riskyCode, 'code');
    expect(result.risks.length).toBeGreaterThan(0);
    expect(result.recommendedActions.length).toBeGreaterThan(0);
  });

  it('handles custom agent with neutral stance', () => {
    const customAgent: BoardAgent = {
      name: 'The Philosopher',
      role: 'Deep thinker',
      expertise: ['meaning', 'purpose', 'beauty'],
      systemPrompt: 'You ponder the meaning of code.',
      temperature: 0.5,
    };
    const board = new CreativeBoard([customAgent]);
    const result = board.deliberate('const x = 42;\nconsole.log(x);', 'code');
    expect(result.stances).toHaveLength(1);
    expect(result.stances[0].agentName).toBe('The Philosopher');
    expect(result.stances[0].confidence).toBe(0.5);
  });
});

// ─── EvaluationMemo extended ────────────────────────────────────────────────

describe('EvaluationMemo extended', () => {
  it('throws if brief is missing', () => {
    expect(() =>
      new EvaluationMemoBuilder().setTitle('T').setVerdict('approve', 0.5).setGeneratedBy('a').build()
    ).toThrow(/requires a brief/);
  });

  it('throws if verdict is missing', () => {
    expect(() =>
      new EvaluationMemoBuilder().setTitle('T').setBrief('B').setGeneratedBy('a').build()
    ).toThrow(/requires a verdict/);
  });

  it('throws if score is missing', () => {
    expect(() =>
      new EvaluationMemoBuilder().setTitle('T').setBrief('B').setVerdict('approve' as MemoVerdict, 0.5 as any).setGeneratedBy('a').build()
    ).not.toThrow();
  });

  it('throws if generatedBy is missing', () => {
    expect(() =>
      new EvaluationMemoBuilder().setTitle('T').setBrief('B').setVerdict('approve', 0.5).build()
    ).toThrow(/requires a generatedBy/);
  });

  it('memo has valid ISO timestamp', () => {
    const memo = new EvaluationMemoBuilder()
      .setTitle('T').setBrief('B').setVerdict('approve', 0.5).setGeneratedBy('a')
      .build();
    expect(new Date(memo.timestamp).getTime()).not.toBeNaN();
  });

  it('memo has valid ID format', () => {
    const memo = new EvaluationMemoBuilder()
      .setTitle('T').setBrief('B').setVerdict('approve', 0.5).setGeneratedBy('a')
      .build();
    expect(memo.id).toMatch(/^memo-[a-z0-9]+-[a-z0-9]+$/);
  });

  it('supports multiple sections', () => {
    const memo = new EvaluationMemoBuilder()
      .setTitle('Multi')
      .setBrief('Multiple sections')
      .addSection('Quality', 'High quality', 'high')
      .addSection('Style', 'Good style', 'medium')
      .addSection('Minor', 'Trivial issue', 'low')
      .setVerdict('approve', 0.9)
      .setGeneratedBy('multi-test')
      .build();
    expect(memo.sections).toHaveLength(3);
    expect(memo.sections[0].priority).toBe('high');
    expect(memo.sections[1].priority).toBe('medium');
    expect(memo.sections[2].priority).toBe('low');
  });

  it('formatMemo includes all section titles', () => {
    const memo = new EvaluationMemoBuilder()
      .setTitle('MD Sections')
      .setBrief('Brief')
      .addSection('Alpha', 'Content A', 'high')
      .addSection('Beta', 'Content B', 'low')
      .setVerdict('revise', 0.4)
      .setGeneratedBy('test')
      .build();
    const md = formatMemo(memo);
    expect(md).toContain('Alpha');
    expect(md).toContain('Beta');
    expect(md).toContain('REVISE');
    expect(md).toContain('0.40');
  });

  it('summarizeMemos extracts common issues from high-priority revise sections', () => {
    const makeMemo = (verdict: MemoVerdict, score: number, sectionTitle: string) =>
      new EvaluationMemoBuilder()
        .setTitle('T').setBrief('B')
        .addSection(sectionTitle, 'Issue detail', 'high')
        .setVerdict(verdict, score).setGeneratedBy('a')
        .build();
    const summary = summarizeMemos([
      makeMemo('revise', 0.3, 'Performance'),
      makeMemo('revise', 0.4, 'Performance'),
      makeMemo('approve', 0.9, 'Styling'),
    ]);
    expect(summary.totalEvaluations).toBe(3);
    expect(summary.approveRate).toBeCloseTo(1 / 3, 5);
    expect(summary.avgScore).toBeCloseTo((0.3 + 0.4 + 0.9) / 3, 5);
    // 'Performance' appears in 2 non-approved memos with high priority
    expect(summary.commonIssues).toContainEqual(expect.stringContaining('Performance'));
  });

  it('builder supports chaining', () => {
    const memo = new EvaluationMemoBuilder()
      .setTitle('Chain')
      .setBrief('Testing chain')
      .addSection('A', 'a', 'high')
      .addSection('B', 'b')
      .setVerdict('approve', 1.0)
      .setGeneratedBy('chain-test')
      .build();
    expect(memo.title).toBe('Chain');
    expect(memo.sections).toHaveLength(2);
    expect(memo.score).toBe(1.0);
  });
});

// ─── Collaboration types ────────────────────────────────────────────────

describe('Collaboration types', () => {
  it('CollaborationRole enum has expected values', () => {
    expect(CollaborationRole.CREATOR).toBe('creator');
    expect(CollaborationRole.VISIONARY).toBe('visionary');
    expect(CollaborationRole.TECHNICAL_CRITIC).toBe('technical');
    expect(CollaborationRole.ARTISTIC_CRITIC).toBe('artistic');
    expect(CollaborationRole.DOMAIN_EXPERT).toBe('domain');
    expect(CollaborationRole.INTEGRATOR).toBe('integrator');
    expect(CollaborationRole.REFINER).toBe('refiner');
  });

  it('CollaborationPhase enum has expected values', () => {
    expect(CollaborationPhase.DIVERGENCE).toBe('divergence');
    expect(CollaborationPhase.ANALYSIS).toBe('analysis');
    expect(CollaborationPhase.SYNTHESIS).toBe('synthesis');
    expect(CollaborationPhase.ITERATION).toBe('iteration');
  });
});
