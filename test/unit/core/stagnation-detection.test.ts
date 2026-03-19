/**
 * Tests for RalphLoop stagnation detection.
 */
import { RalphLoop } from '../../../src/core/RalphLoop.js';

describe('RalphLoop stagnation option', () => {
  it('normalizes stagnationThreshold with default of 7', () => {
    RalphLoop.reset();
    const state = RalphLoop.getState();
    expect(state.iteration).toBe(0);
    expect(state.history).toHaveLength(0);
  });
});
