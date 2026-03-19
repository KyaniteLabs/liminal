/**
 * ThreeTemplates - Self-contained Three.js sketch templates
 *
 * Each template is a complete HTML file with Three.js loaded via CDN importmap.
 * Selected by prompt keywords in ThreeGenerator.
 */

export type ThreeTemplateType = 'particle-galaxy' | 'procedural-geometry' | 'instanced-mesh' | 'wireframe-terrain';

const templates: Record<ThreeTemplateType, string> = {
  'particle-galaxy': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Three.js Particle Galaxy</title>
  <style>body { margin: 0; overflow: hidden; background: #000; }</style>
  <script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
    }
  }
  </script>
</head>
<body>
  <script type="module">
    import * as THREE from 'three';
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const count = 5000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const radius = Math.random() * 3;
      const spin = radius * 2.5;
      const branchAngle = (i % 3) * ((2 * Math.PI) / 3);
      const randomX = (Math.random() - 0.5) * 0.5 * radius;
      const randomY = (Math.random() - 0.5) * 0.5 * radius;
      const randomZ = (Math.random() - 0.5) * 0.5 * radius;

      positions[i * 3] = Math.cos(branchAngle + spin) * radius + randomX;
      positions[i * 3 + 1] = randomY;
      positions[i * 3 + 2] = Math.sin(branchAngle + spin) * radius + randomZ;

      const mixRatio = radius / 3;
      colors[i * 3] = 0.3 + mixRatio * 0.7;
      colors[i * 3 + 1] = 0.2 + (1 - mixRatio) * 0.5;
      colors[i * 3 + 2] = 0.8;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.03,
      vertexColors: false,
      color: 0x6666ff,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.8,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    function animate() {
      requestAnimationFrame(animate);
      particles.rotation.y += 0.001;
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
    });
  </script>
</body>
</html>`,

  'procedural-geometry': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Three.js Procedural Geometry</title>
  <style>body { margin: 0; overflow: hidden; background: #000; }</style>
  <script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
    }
  }
  </script>
</head>
<body>
  <script type="module">
    import * as THREE from 'three';
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0xffffff, 100, 50);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);
    const pointLight2 = new THREE.PointLight(0xff6644, 80, 50);
    pointLight2.position.set(-5, -3, 3);
    scene.add(pointLight2);

    const geometries = [
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.TorusKnotGeometry(0.8, 0.3, 100, 16),
      new THREE.OctahedronGeometry(1, 0),
    ];

    const meshes = geometries.map((geo, i) => {
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(i * 0.33, 0.8, 0.5),
        metalness: 0.3,
        roughness: 0.4,
        wireframe: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.x = (i - 1) * 3;
      scene.add(mesh);
      return mesh;
    });

    function animate() {
      requestAnimationFrame(animate);
      const t = performance.now() * 0.001;
      meshes.forEach((m, i) => {
        m.rotation.x = t * (0.3 + i * 0.1);
        m.rotation.y = t * (0.2 + i * 0.15);
        m.position.y = Math.sin(t + i * 2) * 0.5;
      });
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
    });
  </script>
</body>
</html>`,

  'instanced-mesh': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Three.js Instanced Mesh</title>
  <style>body { margin: 0; overflow: hidden; background: #000; }</style>
  <script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
    }
  }
  </script>
</head>
<body>
  <script type="module">
    import * as THREE from 'three';
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000011, 0.05);
    const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);
    camera.position.set(8, 6, 8);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const ambientLight = new THREE.AmbientLight(0x334466, 3);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffeedd, 2);
    dirLight.position.set(5, 10, 5);
    scene.add(dirLight);

    const count = 2000;
    const geometry = new THREE.BoxGeometry(0.15, 0.15, 0.15);
    const material = new THREE.MeshStandardMaterial({ color: 0x4488ff, metalness: 0.6, roughness: 0.3 });
    const mesh = new THREE.InstancedMesh(geometry, material, count);

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 20;
      const y = (Math.random() - 0.5) * 20;
      const z = (Math.random() - 0.5) * 20;
      dummy.position.set(x, y, z);
      dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      const s = 0.5 + Math.random() * 1.5;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      color.setHSL(0.55 + Math.random() * 0.15, 0.8, 0.4 + Math.random() * 0.3);
      mesh.setColorAt(i, color);
    }

    scene.add(mesh);

    function animate() {
      requestAnimationFrame(animate);
      const t = performance.now() * 0.0005;
      mesh.rotation.y = t * 0.1;
      mesh.rotation.x = Math.sin(t) * 0.1;
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
    });
  </script>
</body>
</html>`,

  'wireframe-terrain': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Three.js Wireframe Terrain</title>
  <style>body { margin: 0; overflow: hidden; background: #000; }</style>
  <script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
    }
  }
  </script>
</head>
<body>
  <script type="module">
    import * as THREE from 'three';
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 10);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const size = 40;
    const segments = 60;
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00aaff,
      wireframe: true,
      transparent: true,
      opacity: 0.6,
    });

    const terrain = new THREE.Mesh(geometry, material);
    terrain.rotation.x = -Math.PI / 2;
    scene.add(terrain);

    const ambientLight = new THREE.AmbientLight(0x222244, 2);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0xff4488, 50, 30);
    pointLight.position.set(0, 5, 0);
    scene.add(pointLight);

    const posAttr = geometry.getAttribute('position');
    const baseY = new Float32Array(posAttr.count);

    for (let i = 0; i < posAttr.count; i++) {
      baseY[i] = posAttr.getZ(i);
    }

    function animate() {
      requestAnimationFrame(animate);
      const t = performance.now() * 0.001;

      for (let i = 0; i < posAttr.count; i++) {
        const x = posAttr.getX(i);
        const y = posAttr.getY(i);
        const wave = Math.sin(x * 0.3 + t) * 0.5 + Math.cos(y * 0.3 + t * 0.7) * 0.5;
        posAttr.setZ(i, baseY[i] + wave);
      }
      posAttr.needsUpdate = true;
      geometry.computeVertexNormals();

      pointLight.position.x = Math.sin(t) * 5;
      pointLight.position.z = Math.cos(t) * 5;

      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
    });
  </script>
</body>
</html>`,
};

/**
 * Select a Three.js template by prompt keywords.
 */
export function selectThreeTemplate(prompt: string): string {
  const lower = prompt.toLowerCase();

  if (/galaxy|star|space|particle\s*3d|3d\s*particle/.test(lower)) return templates['particle-galaxy'];
  if (/terrain|landscape|ground|wave\s*terrain|wireframe\s*terrain/.test(lower)) return templates['wireframe-terrain'];
  if (/instanced|field|grid|thousands|many\s*(cubes?|boxes)/.test(lower)) return templates['instanced-mesh'];
  if (/geometry|shape|torus|knot|icosahedron|octahedron|procedural/.test(lower)) return templates['procedural-geometry'];

  return templates['procedural-geometry']; // default
}

export { templates };
