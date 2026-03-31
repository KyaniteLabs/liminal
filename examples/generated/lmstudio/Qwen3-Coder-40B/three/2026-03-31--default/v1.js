<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Three.js Torus Knot Scene</title>
    <style>
        body { margin: 0; overflow: hidden; background-color: #050505; }
        canvas { display: block; }
    </style>
</head>
<body>
<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js"></script>

<script>
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a15);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, 8);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(renderer.domElement);

    // OrbitControls
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Create wireframe torus knot (p=3, q=2)
    const torusGeometry = new THREE.TorusGeometry(2, 0.6, 16, 100);
    
    // Wireframe material
    const material = new THREE.MeshBasicMaterial({
        color: 0x00a0ff,
        wireframe: true
    });

    const torusKnot = new THREE.Mesh(torusGeometry, material);
    scene.add(torusKnot);

    // Animated lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0xff00ff, 2, 50);
    pointLight1.position.set(5, 5, 5);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x00ffff, 2, 50);
    pointLight2.position.set(-5, -5, -5);
    scene.add(pointLight2);

    // Color changing effect
    let hue = 0;

    function animate() {
        requestAnimationFrame(animate);

        // Rotate torus knot
        torusKnot.rotation.x += 0.01;
        torusKnot.rotation.y += 0.015;

        // Change color over time using HSL
        hue = (hue + 0.005) % 1;
        const color = new THREE.Color().setHSL(hue, 0.8, 0.5);
        torusKnot.material.color.copy(color);

        // Animate lights
        const time = Date.now() * 0.001;
        pointLight1.position.x = Math.sin(time) * 5;
        pointLight1.position.z = Math.cos(time) * 5;
        pointLight2.position.x = Math.cos(time * 1.3) * 5;
        pointLight2.position.y = Math.sin(time * 1.3) * 5;

        controls.update();
        renderer.render(scene, camera);
    }

    animate();

    // Handle window resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
</script>
</body>
</html>