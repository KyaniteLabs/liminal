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

  it('prompt-library templates use the renderer-supported ${var} interpolation style', () => {
    const promptsWithTemplates = PromptLibrary.list().filter((prompt) => prompt.userPromptTemplate);

    for (const prompt of promptsWithTemplates) {
      expect(prompt.userPromptTemplate).not.toContain('{{');
      expect(prompt.userPromptTemplate).not.toContain('}}');
    }
  });

  it('hydra.generate does not describe .speed() as a chain method or color() as a source', () => {
    const hydraPrompt = PromptLibrary.get('hydra.generate');
    expect(hydraPrompt).toBeDefined();
    expect(hydraPrompt?.systemPrompt).toContain('GLOBAL SETTINGS:');
    expect(hydraPrompt?.systemPrompt).not.toContain('Use .speed(), .scale(), .scrollX/Y() for animation');
    expect(hydraPrompt?.systemPrompt).not.toContain('Use timing: .speed(), .scrollX(), .scrollY() for motion');
    expect(hydraPrompt?.systemPrompt).not.toContain('Use sources: osc(), src(), noise(), shape(), color(), gradient(), solid()');
  });

  it('blog prompts wrap long structured inputs in explicit tags', () => {
    const scriptUser = PromptLibrary.render('blog.script', {
      theme: 'distributed systems',
      era: '2020s',
      template: 'Layered Reveal',
      format: '60s',
      platform: 'youtube shorts',
      keyQuotes: 'quote 1\nquote 2',
      dataPoints: 'point 1\npoint 2',
    }).user;

    expect(scriptUser).toContain('<theme_brief>');
    expect(scriptUser).toContain('<key_quotes>');
    expect(scriptUser).toContain('<data_points>');
    expect(scriptUser).toContain('</data_points>');

    const specUser = PromptLibrary.render('blog.spec', {
      script: '# Script\nBeat 1',
      resolution: '1920x1080',
      fps: '30',
      brandColors: 'indigo/amber',
      brandFonts: 'Inter',
    }).user;

    expect(specUser).toContain('<video_script>');
    expect(specUser).toContain('</video_script>');
    expect(specUser).toContain('<options>');
    expect(specUser).toContain('<brand_colors>');
    expect(specUser).toContain('</options>');
  });

  describe('canonical source alignment', () => {
    it('swarm persona prompts in PromptLibrary match the canonical catalog', async () => {
      const { SWARM_PERSONA_PROMPTS } = await import('../../../src/prompts/personaCatalog.js');
      const personaIds = ['kai', 'nova', 'rex', 'sam', 'max'] as const;
      for (const id of personaIds) {
        const registered = PromptLibrary.get(`swarm.persona.${id}`);
        expect(registered?.systemPrompt).toBe(SWARM_PERSONA_PROMPTS[id]);
      }
    });

    it('DEFAULT_PERSONAS systemPrompts match the canonical catalog', async () => {
      const { SWARM_PERSONA_PROMPTS } = await import('../../../src/prompts/personaCatalog.js');
      const { DEFAULT_PERSONAS } = await import('../../../src/swarm/personas.js');
      for (const persona of DEFAULT_PERSONAS) {
        expect(persona.systemPrompt).toBe(SWARM_PERSONA_PROMPTS[persona.id]);
      }
    });

    it('CreativeBoard default agents match the canonical catalog', async () => {
      const { DEFAULT_BOARD_AGENTS } = await import('../../../src/prompts/creativeBoardAgents.js');
      const { CreativeBoard } = await import('../../../src/collab/CreativeBoard.js');
      const agents = CreativeBoard.getDefaultAgents();
      expect(agents).toHaveLength(DEFAULT_BOARD_AGENTS.length);
      for (let i = 0; i < agents.length; i++) {
        expect(agents[i]).toEqual(DEFAULT_BOARD_AGENTS[i]);
      }
    });
  });
});
