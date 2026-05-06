import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');

function readRepoFile(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

describe('final QA copy drift guardrails', () => {
  it('keeps public launch domain copy aligned with the final-QA launch surface', () => {
    const readme = readRepoFile('README.md');
    const launchThread = readRepoFile('docs/marketing/launch-thread-ready.md');
    const architecture = readRepoFile('docs/architecture.html');
    const launchDomains = 'p5.js, SVG, GLSL, Three.js, Hydra, Strudel, Tone.js, Revideo, HyperFrames, ASCII, Kinetic, TextGen';

    expect(readme).toContain(launchDomains);
    expect(launchThread).toContain(launchDomains);
    expect(architecture).toContain(launchDomains);
    expect(architecture).toContain('12 launch creative domains');
    expect(architecture).toContain('src/generators/hyperframes/');
    expect(readme).not.toContain('Revideo, HTML, ASCII');
    expect(launchThread).not.toContain('Revideo, HTML, ASCII');
    expect(architecture).not.toContain('Revideo, HTML, ASCII');
  });

  it('separates CreativeBoard terminology from five-persona swarm terminology', () => {
    const readme = readRepoFile('README.md');
    const features = readRepoFile('docs/features.html');
    const cli = readRepoFile('bin/liminal');

    expect(readme).toContain('CreativeBoard critique');
    expect(readme).toContain('3-agent board (Minimalist / Expressionist / Technician)');
    expect(readme).toContain('5 default runtime personas (Kai / Nova / Rex / Sam / Max)');
    expect(readme).toContain('Five default personas (Kai, Nova, Rex, Sam, Max) generate in parallel');
    expect(features).toContain('Five default personas (Kai, Nova, Rex, Sam, Max) generate in parallel');
    expect(cli).toContain('Use Liminal swarm (5 default personas) for generation');
    expect(cli).not.toContain('7-persona');
  });

  it('does not describe the Live AV utility as a disabled Hydra preview surface', () => {
    const appSource = readRepoFile('gui/src/App.tsx');
    const features = readRepoFile('docs/features.html');
    const cli = readRepoFile('bin/liminal');

    expect(appSource).toContain('Live AV');
    expect(appSource).toContain('Hydra — read-only video synth code');
    expect(features).toContain('<strong>Live AV</strong>');
    expect(cli).toContain('Liminal: Live AV');
    expect(appSource).not.toContain('sandbox-pending');
    expect(appSource).not.toContain('until an isolated Hydra runtime is available');
  });
});
