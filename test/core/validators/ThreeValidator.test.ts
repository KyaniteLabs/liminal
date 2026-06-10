import { describe, it, expect } from 'vitest';
import { ThreeValidator } from '../../../src/core/validators/ThreeValidator.js';

describe('ThreeValidator', () => {
  describe('validate', () => {
    it('should validate valid Three.js with global THREE', () => {
      const code = `
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer();
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(renderer.domElement);
        
        const geometry = new THREE.BoxGeometry();
        const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        const cube = new THREE.Mesh(geometry, material);
        scene.add(cube);
        
        function animate() {
          requestAnimationFrame(animate);
          cube.rotation.x += 0.01;
          cube.rotation.y += 0.01;
          renderer.render(scene, camera);
        }
        animate();
      `;

      const result = ThreeValidator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate valid Three.js with ES module imports', () => {
      const code = `
        import * as THREE from 'three';
        
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer();
        
        const geometry = new THREE.BoxGeometry();
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const cube = new THREE.Mesh(geometry, material);
        scene.add(cube);
      `;

      const result = ThreeValidator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate Three.js with importmap', () => {
      const code = `<!DOCTYPE html>
<html>
<head>
  <script type="importmap">
  {
    "imports": {
      "three": "https://unpkg.com/three@0.160.0/build/three.module.js"
    }
  }
  </script>
</head>
<body>
  <script type="module">
    import * as THREE from 'three';
    const scene = new THREE.Scene();
  </script>
</body>
</html>`;

      const result = ThreeValidator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject code without THREE reference', () => {
      const code = `
        const x = 100;
        const y = 200;
        console.log(x + y);
      `;

      const result = ThreeValidator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Three.js code must reference THREE object or import from "three"');
    });

    it('should reject empty code', () => {
      const result = ThreeValidator.validate('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Code is empty');
    });

    it('should warn about mixing importmap with global THREE', () => {
      const code = `<!DOCTYPE html>
<html>
<head>
  <script type="importmap">
  {
    "imports": {
      "three": "https://unpkg.com/three@0.160.0/build/three.module.js"
    }
  }
  </script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
</head>
<body>
  <script>
    // Using global THREE despite having importmap
    const scene = new THREE.Scene();
  </script>
</body>
</html>`;

      const result = ThreeValidator.validate(code);
      expect(result.errors).toContain('Three.js code mixing importmap with global THREE - use one style consistently');
    });
  });

  describe('validateHTMLWrapped', () => {
    it('should require Three.js CDN for HTML-wrapped code', () => {
      const code = `<!DOCTYPE html>
<html>
<body>
  <script>
    const scene = new THREE.Scene();
  </script>
</body>
</html>`;

      const errors = ThreeValidator.validateHTMLWrapped(code);
      expect(errors).toContain('HTML-wrapped Three.js must include Three.js CDN or importmap');
    });

    it('should accept HTML with three.js CDN', () => {
      const code = `<!DOCTYPE html>
<html>
<head>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
</head>
<body>
  <script>
    const scene = new THREE.Scene();
  </script>
</body>
</html>`;

      const errors = ThreeValidator.validateHTMLWrapped(code);
      expect(errors).toHaveLength(0);
    });

    it('should accept HTML with importmap', () => {
      const code = `<!DOCTYPE html>
<html>
<head>
  <script type="importmap">
  {
    "imports": {
      "three": "https://unpkg.com/three@0.160.0/build/three.module.js"
    }
  }
  </script>
</head>
<body>
  <script type="module">
    import * as THREE from 'three';
  </script>
</body>
</html>`;

      const errors = ThreeValidator.validateHTMLWrapped(code);
      expect(errors).toHaveLength(0);
    });
  });

  describe('detectModuleStyle', () => {
    it('should detect module style for importmap', () => {
      const code = `<script type="importmap">{"imports": {"three": "..."}}</script>`;
      expect(ThreeValidator.detectModuleStyle(code)).toBe('module');
    });

    it('should detect module style for ES imports', () => {
      const code = `import * as THREE from 'three';`;
      expect(ThreeValidator.detectModuleStyle(code)).toBe('module');
    });

    it('should detect global style for global THREE', () => {
      const code = `const scene = new THREE.Scene();`;
      expect(ThreeValidator.detectModuleStyle(code)).toBe('global');
    });

    it('should return unknown when no style detected', () => {
      const code = `const x = 1;`;
      expect(ThreeValidator.detectModuleStyle(code)).toBe('unknown');
    });
  });

  describe('lighting (guaranteed-dark guard)', () => {
    const scene = (extra: string) => [
      'const scene = new THREE.Scene();',
      'const geo = new THREE.BoxGeometry(1, 1, 1);',
      'const mat = new THREE.MeshStandardMaterial({ color: 0x44aa88 });',
      'const mesh = new THREE.Mesh(geo, mat);',
      'scene.add(mesh);',
      extra,
      'renderer.render(scene, camera);',
    ].join('\n');

    it('flags a lit material with no light (renders dark)', () => {
      const result = ThreeValidator.validate(scene(''));
      expect(result.errors.some((e) => e.includes('adds no light'))).toBe(true);
    });

    it('passes a lit material once a light is added', () => {
      const result = ThreeValidator.validate(scene('scene.add(new THREE.AmbientLight(0xffffff, 1.2));'));
      expect(result.errors.some((e) => e.includes('adds no light'))).toBe(false);
    });

    it('does not flag an unlit MeshBasicMaterial scene with no light', () => {
      const code = [
        'const scene = new THREE.Scene();',
        'const mat = new THREE.MeshBasicMaterial({ color: 0xff0066 });',
        'const mesh = new THREE.Mesh(new THREE.SphereGeometry(1), mat);',
        'scene.add(mesh);',
        'renderer.render(scene, camera);',
      ].join('\n');
      const result = ThreeValidator.validate(code);
      expect(result.errors.some((e) => e.includes('adds no light'))).toBe(false);
    });

    it('flags very dark literal backgrounds that fail image-proof luminance', () => {
      const result = ThreeValidator.validate([
        'const scene = new THREE.Scene();',
        'scene.background = new THREE.Color(0x0a0a1a);',
        'const renderer = new THREE.WebGLRenderer();',
        'const camera = new THREE.PerspectiveCamera();',
        'const mat = new THREE.MeshBasicMaterial({ color: 0xff8844 });',
        'scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat));',
        'renderer.render(scene, camera);',
      ].join('\n'));

      expect(result.errors.some((e) => e.includes('background/clear color 0x0a0a1a is too dark'))).toBe(true);
    });

    it('allows mid-tone literal backgrounds for image proof', () => {
      const result = ThreeValidator.validate([
        'const scene = new THREE.Scene();',
        'scene.background = new THREE.Color(0x6b8cff);',
        'const renderer = new THREE.WebGLRenderer();',
        'const camera = new THREE.PerspectiveCamera();',
        'const mat = new THREE.MeshBasicMaterial({ color: 0xff8844 });',
        'scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat));',
        'renderer.render(scene, camera);',
      ].join('\n'));

      expect(result.errors.some((e) => e.includes('background/clear color'))).toBe(false);
    });
  });

  describe('getMinSize', () => {
    it('should return 800 bytes as minimum size', () => {
      expect(ThreeValidator.getMinSize()).toBe(800);
    });
  });

  describe('uniformly dark material colors (audit F11)', () => {
    const scene = (materials: string) => `
      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#e8e4dc');
      const light = new THREE.AmbientLight(0xffffff, Math.PI);
      scene.add(light);
      ${materials}
      const renderer = new THREE.WebGLRenderer();
    `;

    it('flags a scene whose every material color is near-black', () => {
      // The audit's "visible lighting" proof: lights + bright background but a
      // near-black cube — invisible subject despite passing the light checks.
      const code = scene(`const m = new THREE.MeshStandardMaterial({ color: 0x111318 });`);
      const { errors } = ThreeValidator.validate(code);
      expect(errors.some((e) => e.includes('material colors') && e.includes('near-black'))).toBe(true);
    });

    it('passes when at least one material is bright (dark accents are legit)', () => {
      const code = scene(`
        const dark = new THREE.MeshStandardMaterial({ color: 0x101216 });
        const bright = new THREE.MeshStandardMaterial({ color: '#4f9dde' });
      `);
      const { errors } = ThreeValidator.validate(code);
      expect(errors.some((e) => e.includes('near-black'))).toBe(false);
    });

    it('passes when no material color literal exists (defaults are bright)', () => {
      const code = scene(`const m = new THREE.MeshStandardMaterial();`);
      const { errors } = ThreeValidator.validate(code);
      expect(errors.some((e) => e.includes('near-black'))).toBe(false);
    });

    it('catches dark colors set via material.color.set()', () => {
      const code = scene(`
        const m = new THREE.MeshStandardMaterial();
        m.color.set('#0a0a0f');
      `);
      const { errors } = ThreeValidator.validate(code);
      expect(errors.some((e) => e.includes('near-black'))).toBe(true);
    });
  });
});
