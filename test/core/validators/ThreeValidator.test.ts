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

    it('should reject duplicate THREE imports in raw scene code', () => {
      const code = `
        import * as THREE from 'three';
        import * as THREE from "https://unpkg.com/three@0.162.0/build/three.module.js";
        const scene = new THREE.Scene();
      `;

      const result = ThreeValidator.validate(code);
      expect(result.errors).toContain('Three.js code must not declare multiple THREE imports');
    });

    it('should reject redeclaring wrapper-owned canvas in raw scene code', () => {
      const code = `
        import * as THREE from 'three';
        const scene = new THREE.Scene();
        const canvas = document.createElement('canvas');
        const renderer = new THREE.WebGLRenderer({ canvas });
      `;

      const result = ThreeValidator.validate(code);
      expect(result.errors).toContain('Three.js raw scene must use wrapper-provided canvas instead of redeclaring canvas');
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

    it('should reject an animation loop that is defined but never started', () => {
      const code = `
        import * as THREE from 'three';
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ canvas });
        const cube = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
        scene.add(cube);
        function animate() {
          requestAnimationFrame(animate);
          cube.rotation.y += 0.01;
          renderer.render(scene, camera);
        }
      `;

      const result = ThreeValidator.validate(code);
      expect(result.errors).toContain('Three.js animation loop is defined but never started with animate()');
    });

    it('should reject an animation loop that only renders without changing scene state', () => {
      const code = `
        import * as THREE from 'three';
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ canvas });
        const cube = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
        scene.add(cube);
        function animate() {
          requestAnimationFrame(animate);
          renderer.render(scene, camera);
        }
        animate();
      `;

      const result = ThreeValidator.validate(code);
      expect(result.errors).toContain('Three.js animation loop should mutate scene state before rendering');
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

  describe('getMinSize', () => {
    it('should return 500 bytes as minimum size', () => {
      expect(ThreeValidator.getMinSize()).toBe(500);
    });
  });
});
