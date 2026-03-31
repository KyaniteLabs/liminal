<!DOCTYPE html>
<html>

<head>
  <title>Granite Torus Knot Animation</title>
  <script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>
  <style>
    canvas {{
      background-color: #000;
    }}
  </style>
  <script id="controls" type="application/json">
    {
      "type": "orbitControls",
      "position": [-1, -1, 0],
      "radius": 2
    }
  </script>
</head>

<body>
  <canvas id="glCanvas"></canvas>

  <script>
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);

    document.getElementById('controls').appendChild(document.createElement('canvas'));
    document.getElementById('controls').getContext('webgl', function() {
      return webgl;
    });

    const wireframeGeometry = new THREE.BufferGeometry();
    wireframeGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(100 * 12), 3));
    const mesh = new THREE.Mesh(wireframeGeometry, new MeshStandardMaterial({ color: 'blue' }));
    scene.add(mesh);

    function updateWireFrame() {
      // Update geometry and material based on knot data
      const knotData = [...];
      for (let i = 0; i < knotData.length; i++) {
        const radius = Math.pow(knotData[i], 2);
        mesh.material.uniforms.position.r.uniform.value = radius;
        mesh.material.uniforms.rotation.u.uniform.value = -Math.PI / 2 + i * 4;
      }
    }

    document.getElementById('controls').addEventListener('mousemove', (e) => {
      camera.updateProjectionMatrix();
      const mouseWorldSpacePos = new THREE.Vector3().applyMatrix3(camera.matrix_world);
      wireframeGeometry.setAttribute('position', new THREE.BufferAttribute(mouseWorldSpacePos.toArray(), 1));
      mesh.position.copy(mouseWorldSpacePos);
    });

    document.getElementById('controls').addEventListener('wheel', (e) => {
      const wheelAxis = e.deltaY < 0 ? 'y' : 'x';
      camera.updateProjectionMatrix();
      wireframeGeometry.setAttribute(wheelAxis, new THREE.BufferAttribute(new Float32Array(100 * 12), 3));
    });

    updateWireFrame();

    function animate() {
      requestAnimationFrame(animate);
      world.step(1 / 60);
      renderer.render(scene, camera);
    }

    window.addEventListener('resize', () => {
      const aspect = window.innerWidth / window.innerHeight;
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    }
  </script>

</body>
</html>