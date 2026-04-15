/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from 'vitest';
import { HTMLAdapter } from '../../../../src/composition/adapters/HTMLAdapter.js';
import type { Layer, GlobalSettings } from '../../../../src/composition/types.js';

function createLayer(code: string): Layer {
  return {
    id: 'html-security-layer',
    type: 'html',
    code,
    config: {
      zIndex: 1,
      blendMode: 'normal',
      opacity: 1,
      position: { x: 0, y: 0 },
      scale: 1,
    },
    metadata: {
      prompt: 'html security',
      generator: 'test',
      model: 'test',
      generatedAt: new Date().toISOString(),
    },
    enabled: true,
    locked: false,
  };
}

const settings: GlobalSettings = {
  width: 800,
  height: 600,
  frameRate: 60,
  backgroundColor: '#000',
};

describe('HTMLAdapter security', () => {
  it('removes script tags and event handlers before rendering', () => {
    const adapter = new HTMLAdapter();
    const container = document.createElement('div');
    const layer = createLayer('<div id="safe" onclick="alert(1)">ok</div><script>alert(2)</script>');

    adapter.render(layer, container);

    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('#safe')?.getAttribute('onclick')).toBeNull();
    expect(container.textContent).toContain('ok');
  });

  it('removes unquoted event handlers and javascript URLs', () => {
    const adapter = new HTMLAdapter();
    const container = document.createElement('div');
    const layer = createLayer('<a id="link" href="javascript:alert(1)" onmouseover=alert(2)>link</a>');

    adapter.render(layer, container);

    const link = container.querySelector('#link');
    expect(link?.getAttribute('onmouseover')).toBeNull();
    expect(link?.getAttribute('href')).not.toContain('javascript:');
  });

  it('sanitizes style blocks in exported scripts', () => {
    const adapter = new HTMLAdapter();
    const layer = createLayer(`
      <style>
        @import url("https://evil.test/x.css");
        .x { background: url("javascript:alert(1)"); width: expression(alert(2)); color: red; }
      </style>
      <div class="x">safe</div>
    `);

    const script = adapter.generateScript(layer, settings);

    expect(script).not.toContain('@import');
    expect(script).not.toContain('javascript:');
    expect(script).not.toContain('expression(');
    expect(script).toContain('color: red');
  });
});
