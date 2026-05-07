import { describe, expect, it } from 'vitest';
import { P5_CDN, P5_SOUND_CDN } from '../../../src/constants.js';
import { getLocalP5ScriptForUrl } from '../../../src/utils/browserAssetFallbacks.js';

describe('browser asset fallbacks', () => {
  it('fulfills canonical p5 and p5.sound cdnjs URLs from local package assets', async () => {
    await expect(getLocalP5ScriptForUrl(P5_CDN)).resolves.toContain('p5.js');
    await expect(getLocalP5ScriptForUrl(P5_SOUND_CDN)).resolves.toContain('p5.sound');
  });

  it('keeps the legacy addons p5.sound cdnjs path offline-safe', async () => {
    const localScript = await getLocalP5ScriptForUrl(
      'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/addons/p5.sound.min.js',
    );

    expect(localScript).toContain('p5.sound');
  });

  it('ignores unrelated cdnjs assets', async () => {
    await expect(
      getLocalP5ScriptForUrl('https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.min.js'),
    ).resolves.toBeNull();
  });
});
