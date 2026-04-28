import { describe, it, expect } from 'vitest';
/**
 * Tests for ThinkingMiner - Extracts actionable insights from thinking traces
 *
 * ThinkingMiner is a pure-logic class (no I/O, no mocks needed).
 * It runs regex matchers against thinking strings to extract:
 * - insights: what the model's behavior reveals
 * - actionItems: concrete steps to improve prompts or system
 * - patterns: named category tags for the detected behavior
 */

import { ThinkingMiner } from '../../../src/harness/ThinkingSeparation.js';

describe('ThinkingMiner', () => {
  const miner = new ThinkingMiner();

  // ---------------------------------------------------------------------------
  // mineGeneratorThinking
  // ---------------------------------------------------------------------------
  describe('mineGeneratorThinking', () => {
    it('detects confusion patterns and returns correct insight/action', () => {
      const thinking = 'I am confused about what the user wants here. It is unclear to me.';

      const result = miner.mineGeneratorThinking(thinking);

      expect(result.insights).toContain('Model confusion detected - prompt may be ambiguous');
      expect(result.actionItems).toContain('Add clearer examples to prompt');
      expect(result.patterns).toContain('confusion');
    });

    it('detects over-engineering patterns', () => {
      const thinking =
        'Let me think about the optimization and performance of this solution. ' +
        'I should consider scaling and efficiency.';

      const result = miner.mineGeneratorThinking(thinking);

      expect(result.insights).toContain('Model over-engineering for simple task');
      expect(result.actionItems).toContain('Add "keep it simple" constraint');
      expect(result.patterns).toContain('over_engineering');
    });

    it('detects wrong domain thoughts (three.js without p5)', () => {
      const thinking =
        'This looks like a three.js scene. I could use WebGL shaders to render it.';

      const result = miner.mineGeneratorThinking(thinking);

      expect(result.insights).toContain('Model thinking about wrong technology');
      expect(result.actionItems).toContain('Clarify domain requirements');
      expect(result.patterns).toContain('wrong_domain_thoughts');
    });

    it('does not flag wrong domain when p5 is present alongside three.js', () => {
      const thinking =
        'This project uses three.js but the user explicitly wants p5 integration.';

      const result = miner.mineGeneratorThinking(thinking);

      expect(result.patterns).not.toContain('wrong_domain_thoughts');
    });

    it('detects code-in-thinking pattern', () => {
      const thinking = 'Let me think... <think\>here is code: ```js\nconsole.log("hi");\n```</think\>';

      const result = miner.mineGeneratorThinking(thinking);

      expect(result.insights).toContain('Model putting code in thinking tags');
      expect(result.actionItems).toContain('Add "output code after thinking" instruction');
      expect(result.patterns).toContain('code_in_thinking');
    });

    it('detects uncertainty language', () => {
      const thinking = 'Maybe this is the right approach, or perhaps we could try something else.';

      const result = miner.mineGeneratorThinking(thinking);

      expect(result.insights).toContain('Model uncertain - lacks confidence');
      expect(result.actionItems).toContain('Add "be confident" instruction');
      expect(result.patterns).toContain('uncertainty');
    });

    it('detects infinite reconsideration (more than 2 reconsideration words)', () => {
      const thinking =
        'Actually, let me reconsider. On second thought, I think I should actually ' +
        'reconsider the approach again. Wait, actually this is better.';

      const result = miner.mineGeneratorThinking(thinking);

      expect(result.insights).toContain('Model stuck in analysis paralysis');
      expect(result.actionItems).toContain('Add "be decisive" instruction');
      expect(result.patterns).toContain('infinite_reconsideration');
    });

    it('does not flag infinite reconsideration with only 2 reconsideration words', () => {
      const thinking = 'Actually, let me reconsider this once.';

      const result = miner.mineGeneratorThinking(thinking);

      expect(result.patterns).not.toContain('infinite_reconsideration');
    });

    it('extracts multiple patterns from a single thinking string', () => {
      const thinking =
        'I am confused about this. Maybe I should use three.js for optimization. ' +
        'Actually, on second thought, let me reconsider, actually I am not sure.';

      const result = miner.mineGeneratorThinking(thinking);

      // Should have at least confusion + uncertainty
      expect(result.patterns).toContain('confusion');
      expect(result.patterns).toContain('uncertainty');
      expect(result.insights.length).toBeGreaterThanOrEqual(2);
      expect(result.actionItems.length).toBeGreaterThanOrEqual(2);
    });

    it('returns empty arrays for thinking with no recognizable patterns', () => {
      const thinking = 'The sky is blue today and I like sandwiches.';

      const result = miner.mineGeneratorThinking(thinking);

      expect(result.insights).toEqual([]);
      expect(result.actionItems).toEqual([]);
      expect(result.patterns).toEqual([]);
    });

    it('returns empty arrays for empty string', () => {
      const result = miner.mineGeneratorThinking('');

      expect(result.insights).toEqual([]);
      expect(result.actionItems).toEqual([]);
      expect(result.patterns).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // mineHarnessThinking
  // ---------------------------------------------------------------------------
  describe('mineHarnessThinking', () => {
    it('detects architectural insights', () => {
      const thinking = 'The architecture needs a refactor. We should restructure the module layout.';

      const result = miner.mineHarnessThinking(thinking);

      expect(result.insights).toContain('Harness identified architectural issue');
      expect(result.systemChanges).toContain('Consider architectural change');
    });

    it('detects recurring patterns', () => {
      const thinking = 'I see this pattern every time. The model consistently makes this mistake.';

      const result = miner.mineHarnessThinking(thinking);

      expect(result.insights).toContain('Harness detected recurring pattern');
      expect(result.actionItems).toContain('Create automated fix for pattern');
    });

    it('detects tool suggestions and extracts the tool name', () => {
      const thinking = 'We need a tool for validation. Should add a missing tool to check outputs.';

      const result = miner.mineHarnessThinking(thinking);

      expect(result.insights.length).toBeGreaterThanOrEqual(1);
      // The regex captures the word after "tool for/to"
      const toolInsight = result.insights.find(i => i.includes('Harness suggests new tool'));
      expect(toolInsight).not.toBeNull();
    });

    it('does not create tool suggestions without a captured tool name', () => {
      const thinking = 'We need better tools in general.';

      const result = miner.mineHarnessThinking(thinking);

      // "need a tool" not present, so no tool suggestion
      const toolInsight = result.insights.find(i => i.includes('Harness suggests new tool'));
      expect(toolInsight).toBeUndefined();
    });

    it('detects prompt engineering issues', () => {
      const thinking = 'The prompt is not clear enough. We should tell the model to be more specific.';

      const result = miner.mineHarnessThinking(thinking);

      expect(result.insights).toContain('Harness identified prompt issue');
      expect(result.actionItems).toContain('Update prompt template');
    });

    it('detects validation gaps', () => {
      const thinking = 'We need to add validation to check and verify the output before returning.';

      const result = miner.mineHarnessThinking(thinking);

      expect(result.insights).toContain('Harness identified validation gap');
      expect(result.actionItems).toContain('Add validation step');
    });

    it('extracts multiple categories from a single harness thinking string', () => {
      const thinking =
        'The architecture is wrong and the pattern is consistent. ' +
        'We need to update the prompt instructions and add validation checks.';

      const result = miner.mineHarnessThinking(thinking);

      // Should have architecture + pattern + prompt + validation
      expect(result.insights.length).toBeGreaterThanOrEqual(3);
      expect(result.systemChanges).toContain('Consider architectural change');
      expect(result.actionItems.length).toBeGreaterThanOrEqual(2);
    });

    it('returns empty arrays for thinking with no recognizable patterns', () => {
      const thinking = 'Today is a sunny day.';

      const result = miner.mineHarnessThinking(thinking);

      expect(result.insights).toEqual([]);
      expect(result.actionItems).toEqual([]);
      expect(result.systemChanges).toEqual([]);
    });

    it('returns empty arrays for empty string', () => {
      const result = miner.mineHarnessThinking('');

      expect(result.insights).toEqual([]);
      expect(result.actionItems).toEqual([]);
      expect(result.systemChanges).toEqual([]);
    });
  });
});
