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

  it('scales small p5 canvases into a readable Studio preview stage', () => {
    const html = buildSyncPreviewHtml('function setup(){createCanvas(160,120)}');

    expect(html).toContain('data-liminal-sync-preview="p5"');
    expect(html).toContain('main > canvas,body > canvas');
    expect(html).toContain('window.__liminalAdoptP5Canvas');
    expect(html).toContain("document.querySelectorAll('body > canvas')");
    expect(html).toContain('transform:translate(-50%,-50%)!important');
  });

  it('wraps Three.js code with import map and audio API', () => {
    const html = buildSyncPreviewHtml('const scene = new THREE.Scene();');

    expect(html).toContain('"three"');
    expect(html).toContain('window.__liminalAudio');
    expect(html).toContain('import * as THREE');
  });

  it('provides a stable canvas binding for Three.js snippets that expect one', () => {
    const html = buildSyncPreviewHtml('const renderer = new THREE.WebGLRenderer({ canvas }); renderer.render(new THREE.Scene(), new THREE.PerspectiveCamera());');

    expect(html).toContain('id="liminal-three-canvas"');
    expect(html).toContain("const canvas = document.getElementById('liminal-three-canvas')");
  });

  it('does not redeclare canvas when a Three.js snippet already destructures one', () => {
    const html = buildSyncPreviewHtml('const opts = {}; const { canvas } = opts; const renderer = new THREE.WebGLRenderer({ canvas });');

    expect(html).not.toContain('id="liminal-three-canvas"');
    expect(html).not.toContain("const canvas = document.getElementById('liminal-three-canvas')");
  });

});
