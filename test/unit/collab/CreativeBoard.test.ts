import { describe, it, expect } from 'vitest';
import { CreativeBoard } from '../../../src/collab/CreativeBoard.js';
import type { BoardAgent } from '../../../src/collab/CreativeBoard.js';

describe('CreativeBoard', () => {
  it('deliberates with default agents and returns structured verdict', () => {
    const board = new CreativeBoard();
    const result = board.deliberate(
      'function setup() { createCanvas(400,400); }\nfunction draw() { background(0); ellipse(200,200,50); }',
      'p5',
    );
    expect(result.stances).toHaveLength(3);
    expect(['approve', 'revise', 'reject']).toContain(result.overallVerdict);
    expect(result.aggregateScore).toBeGreaterThanOrEqual(0);
    expect(result.aggregateScore).toBeLessThanOrEqual(1);
    expect(Array.isArray(result.tensions)).toBe(true);
    expect(Array.isArray(result.consensusPoints)).toBe(true);
  });

  it('provides three default agents', () => {
    const agents = CreativeBoard.getDefaultAgents();
    expect(agents).toHaveLength(3);
    expect(agents.map(a => a.name)).toEqual(['The Minimalist', 'The Expressionist', 'The Technician']);
  });

  it('accepts custom agents', () => {
    const custom: BoardAgent = {
      name: 'Custom Agent',
      role: 'Test role',
      expertise: ['testing'],
      systemPrompt: 'You test things.',
      temperature: 0.5,
    };
    const board = new CreativeBoard([custom]);
    const result = board.deliberate('const x = 1;', 'code');
    expect(result.stances).toHaveLength(1);
    expect(result.stances[0].agentName).toBe('Custom Agent');
  });

  it('rejects code with infinite loop', () => {
    const board = new CreativeBoard();
    const result = board.deliberate('while(true) { console.log("x"); }', 'code');
    expect(result.risks.length).toBeGreaterThan(0);
  });
});
