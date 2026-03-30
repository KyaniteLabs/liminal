import { describe, it, expect } from 'vitest';
import { PromptLibrary } from '../../../src/prompts/index.js';

describe('Remotion Prompts', () => {
  it('renders remotion.generate with prompt variable', () => {
    const result = PromptLibrary.render('remotion.generate', {
      prompt: 'cosmic particle animation',
      fps: '30',
      duration: '150',
      width: '1920',
      height: '1080',
    });
    expect(result.system).toContain('Remotion');
    expect(result.system).toContain('React');
    expect(result.user).toContain('cosmic particle animation');
  });

  it('renders remotion.improve with code and feedback', () => {
    const result = PromptLibrary.render('remotion.improve', {
      prompt: 'improve the colors',
      previousCode: 'export const MyComp = () => <div/>',
      fps: '30',
      duration: '150',
      width: '1920',
      height: '1080',
    });
    expect(result.system).toContain('Remotion');
    expect(result.user).toContain('improve the colors');
    expect(result.user).toContain('export const MyComp');
  });
});
