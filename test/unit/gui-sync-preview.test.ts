import { describe, expect, it } from 'vitest';
import { buildSyncPreviewHtml } from '../../gui/src/gui/syncPreview';

describe('syncPreview', () => {
  it('injects the standard audio API into p5 previews', () => {
    const html = buildSyncPreviewHtml('function setup(){createCanvas(100,100)} function draw(){circle(50,50,window.__liminalAudio.rms*100)}');

    expect(html).toContain('window.__liminalAudio');
    expect(html).toContain('liminal-audio-frame');
    expect(html).toContain('p5.min.js');
  });

  it('blocks p5 sensor listeners before loading p5 to avoid permissions-policy console noise', () => {
    const html = buildSyncPreviewHtml('function setup(){createCanvas(100,100)}');
    const sensorPolicyIndex = html.indexOf('liminalSensorPolicy');
    const p5ScriptIndex = html.indexOf('p5.min.js');

    expect(sensorPolicyIndex).toBeGreaterThan(-1);
    expect(p5ScriptIndex).toBeGreaterThan(-1);
    expect(sensorPolicyIndex).toBeLessThan(p5ScriptIndex);
    expect(html).toContain("eventName === 'devicemotion'");
    expect(html).toContain("eventName === 'deviceorientation'");
  });

  it('wraps Three.js code with import map and audio API', () => {
    const html = buildSyncPreviewHtml('const scene = new THREE.Scene();');

    expect(html).toContain('"three"');
    expect(html).toContain('window.__liminalAudio');
    expect(html).toContain('import * as THREE');
  });
});
