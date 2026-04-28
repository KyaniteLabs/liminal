import { describe, it, expect } from 'vitest';

import { ImportGuardTool } from '../../../src/harness/tools/ImportGuardTool.js';

describe('ImportGuardTool', () => {
  const tool = new ImportGuardTool();

  it('exposes correct name and description', () => {
    expect(tool.name).toBe('importGuard');
    expect(tool.description).toBe('Validate imports against security whitelist');
  });

  describe('safe imports', () => {
    it('allows Revideo imports in revideo domain', async () => {
      const code = `
        import { makeScene, useTime } from '@revideo/core';
        import { Txt, Rect } from '@revideo/2d';
      `;

      const result = await tool.execute({ code, domain: 'revideo' });

      expect(result.success).toBe(true);
      expect(result.data!.safe).toBe(true);
      expect(result.data!.allowed).toContain('@revideo/core');
      expect(result.data!.allowed).toContain('@revideo/2d');
      expect(result.data!.blocked).toEqual([]);
    });

    it('allows three.js imports in three domain', async () => {
      const code = `
        import * as THREE from 'three';
        import { Canvas } from '@react-three/fiber';
      `;

      const result = await tool.execute({ code, domain: 'three' });

      expect(result.data!.safe).toBe(true);
      expect(result.data!.allowed).toContain('three');
      expect(result.data!.allowed).toContain('@react-three/fiber');
      expect(result.data!.blocked).toEqual([]);
    });

    it('allows p5 and tone imports in p5 domain', async () => {
      const code = `
        import p5 from 'p5';
        import { Synth } from 'tone';
      `;

      const result = await tool.execute({ code, domain: 'p5' });

      expect(result.data!.safe).toBe(true);
      expect(result.data!.allowed).toContain('p5');
      expect(result.data!.allowed).toContain('tone');
    });

    it('allows node builtins in node domain', async () => {
      const code = `
        import fs from 'fs';
        import path from 'path';
        import { exec } from 'child_process';
      `;

      const result = await tool.execute({ code, domain: 'node' });

      expect(result.data!.safe).toBe(true);
      expect(result.data!.allowed).toContain('fs');
      expect(result.data!.allowed).toContain('path');
      expect(result.data!.allowed).toContain('child_process');
      expect(result.data!.blocked).toEqual([]);
    });

    it('allows hydra-synth in hydra domain', async () => {
      const code = `import Hydra from 'hydra-synth';`;

      const result = await tool.execute({ code, domain: 'hydra' });

      expect(result.data!.safe).toBe(true);
      expect(result.data!.allowed).toContain('hydra-synth');
    });
  });

  describe('dangerous imports', () => {
    it('blocks fs import in p5 domain', async () => {
      const code = `import fs from 'fs';`;

      const result = await tool.execute({ code, domain: 'p5' });

      expect(result.success).toBe(false);
      expect(result.data!.safe).toBe(false);
      expect(result.data!.blocked).toHaveLength(1);
      expect(result.data!.blocked[0]).toEqual({
        source: 'fs',
        reason: "Node.js builtin 'fs' not allowed in p5 domain",
      });
    });

    it('blocks child_process in three domain', async () => {
      const code = `import { exec } from 'child_process';`;

      const result = await tool.execute({ code, domain: 'three' });

      expect(result.data!.safe).toBe(false);
      expect(result.data!.blocked[0].source).toBe('child_process');
    });

    it('blocks vm module in revideo domain', async () => {
      const code = `import vm from 'vm';`;

      const result = await tool.execute({ code, domain: 'revideo' });

      expect(result.data!.safe).toBe(false);
      expect(result.data!.blocked[0].source).toBe('vm');
    });

    it('blocks os module in strudel domain', async () => {
      const code = `import os from 'os';`;

      const result = await tool.execute({ code, domain: 'strudel' });

      expect(result.data!.safe).toBe(false);
      expect(result.data!.blocked[0].source).toBe('os');
    });
  });

  describe('domain-specific whitelist', () => {
    it('allows @strudel scoped packages in strudel domain', async () => {
      const code = `
        import { Sequence } from '@strudel/core';
        import { controls } from '@strudel/mini';
      `;

      const result = await tool.execute({ code, domain: 'strudel' });

      expect(result.data!.safe).toBe(true);
      expect(result.data!.allowed).toContain('@strudel/core');
      expect(result.data!.allowed).toContain('@strudel/mini');
    });

    it('blocks non-whitelisted packages in shader domain', async () => {
      const code = `import glMatrix from 'gl-matrix';`;

      const result = await tool.execute({ code, domain: 'shader' });

      // shader domain has empty whitelist — everything non-relative is blocked
      expect(result.data!.safe).toBe(false);
      expect(result.data!.blocked[0].source).toBe('gl-matrix');
      expect(result.data!.blocked[0].reason).toContain('not in whitelist');
    });

    it('blocks @react-three/fiber in p5 domain (wrong domain)', async () => {
      const code = `import { Canvas } from '@react-three/fiber';`;

      const result = await tool.execute({ code, domain: 'p5' });

      expect(result.data!.safe).toBe(false);
      expect(result.data!.blocked[0].source).toBe('@react-three/fiber');
    });

    it('allows @tonejs scoped packages in p5 domain', async () => {
      const code = `import * as Tone from '@tonejs/piano';`;

      const result = await tool.execute({ code, domain: 'p5' });

      expect(result.data!.safe).toBe(true);
      expect(result.data!.allowed).toContain('@tonejs/piano');
    });

    it('allows @revideo scoped packages in revideo domain', async () => {
      const code = `import { makeScene } from '@revideo/core';`;

      const result = await tool.execute({ code, domain: 'revideo' });

      expect(result.data!.safe).toBe(true);
      expect(result.data!.allowed).toContain('@revideo/core');
    });
  });

  describe('multiple imports in same file', () => {
    it('evaluates mixed safe and dangerous imports together', async () => {
      const code = `
        import { makeScene } from '@revideo/core';
        import fs from 'fs';
        import lodash from 'lodash';
      `;

      const result = await tool.execute({ code, domain: 'revideo' });

      // @revideo/core: allowed, fs: blocked (dangerous), lodash: blocked (not whitelisted)
      expect(result.data!.safe).toBe(false);
      expect(result.data!.allowed).toContain('@revideo/core');
      expect(result.data!.blocked).toHaveLength(2);

      const blockedSources = result.data!.blocked.map(b => b.source);
      expect(blockedSources).toContain('fs');
      expect(blockedSources).toContain('lodash');
    });
  });

  describe('no imports', () => {
    it('allows code with no imports', async () => {
      const code = `const x = 42; console.log(x);`;

      const result = await tool.execute({ code, domain: 'p5' });

      expect(result.success).toBe(true);
      expect(result.data!.safe).toBe(true);
      expect(result.data!.allowed).toEqual([]);
      expect(result.data!.blocked).toEqual([]);
    });
  });

  describe('relative imports', () => {
    it('allows relative imports in any domain', async () => {
      const code = `
        import { helper } from './utils';
        import config from '../config';
      `;

      const result = await tool.execute({ code, domain: 'shader' });

      // Relative imports bypass domain whitelist
      expect(result.data!.safe).toBe(true);
      expect(result.data!.allowed).toContain('./utils');
      expect(result.data!.allowed).toContain('../config');
    });
  });

  describe('require() syntax', () => {
    it('detects require() imports and validates them', async () => {
      const code = `const fs = require('fs');`;

      const result = await tool.execute({ code, domain: 'p5' });

      expect(result.data!.safe).toBe(false);
      expect(result.data!.blocked[0].source).toBe('fs');
    });

    it('allows require() for whitelisted modules', async () => {
      const code = `const path = require('path');`;

      const result = await tool.execute({ code, domain: 'node' });

      expect(result.data!.safe).toBe(true);
      expect(result.data!.allowed).toContain('path');
    });
  });

  describe('dynamic imports', () => {
    it('warns about dynamic import() calls', async () => {
      const code = `const mod = import('some-module');`;

      const result = await tool.execute({ code, domain: 'p5' });

      expect(result.data!.warnings).toHaveLength(1);
      expect(result.data!.warnings[0]).toContain('Dynamic imports detected');
    });

    it('does not warn for static imports', async () => {
      const code = `import p5 from 'p5';`;

      const result = await tool.execute({ code, domain: 'p5' });

      expect(result.data!.warnings).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('returns error for empty code', async () => {
      const result = await tool.execute({ code: '', domain: 'p5' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('No code provided');
      expect(result.data!.safe).toBe(false);
    });

    it('returns error for missing code', async () => {
      const result = await tool.execute({ domain: 'p5' } as unknown as { code: string });

      expect(result.success).toBe(false);
      expect(result.error).toBe('No code provided');
    });

    it('handles unknown domain by blocking non-relative imports', async () => {
      const code = `import lodash from 'lodash';`;

      // domain is typed but we test the fallback for an unlisted domain
      const result = await tool.execute({ code, domain: 'hydra' as const });

      // lodash is not in hydra whitelist
      expect(result.data!.safe).toBe(false);
      expect(result.data!.blocked[0].source).toBe('lodash');
    });
  });
});
