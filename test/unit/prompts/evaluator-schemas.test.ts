import { describe, it, expect } from 'vitest';
import {
  getCollabScoreSchema,
  getDimensionEvaluationSchema,
  getScalarScoringSchema,
} from '../../../src/prompts/evaluatorSchemas.js';

describe('evaluatorSchemas', () => {
  it('returns scalar scoring schema with expected fields', () => {
    const schema = getScalarScoringSchema();
    expect(schema).toContain('"score"');
    expect(schema).toContain('"technical"');
    expect(schema).toContain('"suggestions"');
  });

  it('returns collab score schema with compact fields', () => {
    const schema = getCollabScoreSchema();
    expect(schema).toContain('"score"');
    expect(schema).toContain('"reasoning"');
  });

  it('returns dimension evaluation schema with evidence and overall fields', () => {
    const schema = getDimensionEvaluationSchema();
    expect(schema).toContain('"scores"');
    expect(schema).toContain('"evidence"');
    expect(schema).toContain('"overall"');
  });
});
