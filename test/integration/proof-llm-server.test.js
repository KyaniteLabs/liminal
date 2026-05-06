import { describe, it, expect, afterEach } from 'vitest';
import { installIntegrationProofLLMEnv, startIntegrationProofLLMServer } from './helpers/proof-llm-server.js';
import { LLMClient } from '../../src/llm/LLMClient.js';
import { P5Generator } from '../../src/generators/p5/P5Generator.js';

describe('integration proof LLM server', () => {
  let cleanup;

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  it('serves an OpenAI-compatible local model endpoint for integration suites', async () => {
    const proof = await startIntegrationProofLLMServer();
    cleanup = proof.close;

    const models = await fetch(`${proof.baseUrl}/models`);
    expect(models.status).toBe(200);
    await expect(models.json()).resolves.toMatchObject({
      data: [{ id: 'liminal-integration-proof-model' }],
    });

    const completion = await fetch(`${proof.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'liminal-integration-proof-model',
        messages: [{ role: 'user', content: 'Create an animated interactive cellular automata particle system' }],
      }),
    });
    const body = await completion.json();
    const code = body.choices[0].message.content;

    expect(completion.status).toBe(200);
    expect(code).toContain('function setup');
    expect(code).toContain('frameCount');
    expect(code).toMatch(/particle|cellular|mouse/i);
  });

  it('can drive P5Generator without touching the user configured provider', async () => {
    cleanup = await installIntegrationProofLLMEnv();

    expect(LLMClient.isConfigured()).toBe(true);
    const code = await P5Generator.generate('Create moving interactive particles', {});

    expect(code).toContain('function setup');
    expect(code).toContain('function draw');
    expect(code).toContain('createCanvas');
    expect(code).toContain('frameCount');
  });

  it('returns evaluator JSON for scoring prompts used by RalphLoop', async () => {
    const proof = await startIntegrationProofLLMServer();
    cleanup = proof.close;

    const completion = await fetch(`${proof.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'liminal-integration-proof-model',
        messages: [
          { role: 'system', content: 'You are an expert creative artifact evaluator. Return ONLY a JSON object.' },
          { role: 'user', content: 'Criteria: technical quality\nArtifact:\nfunction setup(){}' },
        ],
      }),
    });
    const body = await completion.json();
    const parsed = JSON.parse(body.choices[0].message.content);

    expect(parsed).toMatchObject({
      score: expect.any(Number),
      confidence: expect.any(Number),
      technical: expect.any(Number),
      creative: expect.any(Number),
      novelty: expect.any(Number),
      suggestions: [],
    });
  });
});
