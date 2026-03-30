<!DOCTYPE html>
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
</html>