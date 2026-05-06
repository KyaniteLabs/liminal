import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const script = readFileSync('scripts/proof/live-creative-domain-execution.ts', 'utf8');
const launchDomains = ['p5', 'svg', 'glsl', 'three', 'hydra', 'strudel', 'tone', 'revideo', 'hyperframes', 'ascii', 'kinetic', 'textgen'];

describe('live creative-domain execution matrix', () => {
  it('defaults the live proof to every launch-scoped creative domain', () => {
    expect(script).toContain('LAUNCH_CREATIVE_DOMAINS');
    for (const domain of launchDomains) {
      expect(script).toMatch(new RegExp(`['"]${domain}['"]`));
    }
    expect(script).toMatch(/let domains: Domain\[\] = \[\.\.\.LAUNCH_CREATIVE_DOMAINS\]/);
    expect(script).toContain('readCurrentGitCommit');
    expect(script).toMatch(/gitCommit:\s*readCurrentGitCommit\(process\.cwd\(\)\)/);
    expect(script).toContain('validateCreativeDomainArtifact');
    expect(script).toContain('artifactValidation');
  });

  it('treats HyperFrames as the HTML-backed video output and does not promote generic HTML in --all', () => {
    expect(script).toContain('HyperFramesGenerator');
    expect(script).toMatch(/hyperframes:\s*'create a HyperFrames/i);
    expect(script).toMatch(/hyperframes:\s*'html'/);
    expect(script).toContain("domain === 'hyperframes'");
    expect(script).toContain('useGeneratorTools: false');
    expect(script).not.toMatch(/html:\s*'create an HTML landing page/i);
    expect(script).not.toContain("case 'html': return new HTMLWebGenerator");
  });
});
