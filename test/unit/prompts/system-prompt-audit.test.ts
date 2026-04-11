import { describe, expect, it } from 'vitest';

import { PromptLibrary } from '../../../src/prompts/index.js';
import { SELF_IMPROVE_SYSTEM_PROMPT } from '../../../src/harness/prompts/self-improve.js';

describe('system prompt audit guardrails', () => {
  it('code-only generator prompts do not require markdown code blocks', () => {
    const contradictoryPatterns = [
      /must be wrapped in a markdown code block/i,
      /output (?:a|the) .*code block/i,
      /single .*code block/i,
    ];

    const prompts = PromptLibrary.list().filter((prompt) =>
      prompt.tags?.includes('code-only') || prompt.tags?.includes('no-markdown'),
    );

    for (const prompt of prompts) {
      for (const pattern of contradictoryPatterns) {
        expect(prompt.systemPrompt).not.toMatch(pattern);
      }
    }
  });

  it('three.generate uses a consistent modern OrbitControls module path', () => {
    const threePrompt = PromptLibrary.get('three.generate');
    expect(threePrompt).toBeDefined();
    expect(threePrompt?.systemPrompt).toContain('three/addons/controls/OrbitControls.js');
    expect(threePrompt?.systemPrompt).toContain('import map');
    expect(threePrompt?.systemPrompt).toContain('module script');
    expect(threePrompt?.systemPrompt).not.toContain('examples/jsm/controls/OrbitControls.js');
    expect(threePrompt?.systemPrompt).not.toContain('global THREE from CDN');
  });

  it('glsl.generate aligns complexity guidance with validator minimum size', () => {
    const glslPrompt = PromptLibrary.get('glsl.generate');
    expect(glslPrompt).toBeDefined();
    expect(glslPrompt?.systemPrompt).toContain('at least 800 characters');
    expect(glslPrompt?.systemPrompt).not.toContain('at least 1000 characters');
  });

  it('remotion.improve separates prior code without markdown fences', () => {
    const remotionPrompt = PromptLibrary.get('remotion.improve');
    expect(remotionPrompt).toBeDefined();
    expect(remotionPrompt?.userPromptTemplate).toContain('<previous_code>');
    expect(remotionPrompt?.userPromptTemplate).toContain('</previous_code>');
    expect(remotionPrompt?.userPromptTemplate).not.toContain('```');
  });

  it('self-improve prompt stays concise while preserving the JSON tool contract', () => {
    expect(SELF_IMPROVE_SYSTEM_PROMPT.length).toBeLessThan(3200);
    expect(SELF_IMPROVE_SYSTEM_PROMPT).toContain('Return JSON only');
    expect(SELF_IMPROVE_SYSTEM_PROMPT).toContain('Use tool "complete" only');
    expect(SELF_IMPROVE_SYSTEM_PROMPT).not.toContain('## Example Session');
  });

  it('chat.assistant uses explicit context tags instead of ad-hoc separators', () => {
    const chatPrompt = PromptLibrary.get('chat.assistant');
    expect(chatPrompt).toBeDefined();

    const rendered = PromptLibrary.render('chat.assistant', { userPrompt: 'hello' });
    expect(chatPrompt?.systemPrompt).toContain('Return valid JSON only');
    expect(rendered.user).toBe('hello');
  });

  it('collaboration critic prompts avoid step-by-step wording and ask for evidence', () => {
    const criticIds = [
      'collab.role.technical-critic',
      'collab.role.artistic-critic',
      'collab.role.domain-expert',
    ];

    for (const id of criticIds) {
      const prompt = PromptLibrary.get(id);
      expect(prompt).toBeDefined();
      expect(prompt?.systemPrompt).not.toContain('Think step by step');
      expect(prompt?.systemPrompt).toContain('evidence-backed');
    }
  });
});
