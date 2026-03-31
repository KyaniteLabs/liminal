<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rotating Torus Knot</title>
    <script type="importmap">
        {"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}
    </script>
</head>
<body>
    <script type="module">
        import * as THREE from 'three';

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000000);

        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.z = 5;

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        const orbitControls = new THREE.OrbitControls(camera, renderer.domElement);
        orbitControls.update();

        // Torus Knot
        const torus = new THREE.MeshStandardMaterial({ color: new THREE.Color(0xff0000), roughness: 0.5 });
        const torusGeometry = new THREE.TorusGeometry(0.7, 0.2, 32, 32);
        const torusMesh = new THREE.Mesh(torusGeometry, torus);
        scene.add(torusMesh);

        // Animation
        let angle = 0;
        const rotationSpeed = 0.02;

        function animate() {
            requestAnimationFrame(animate);

            angle += rotationSpeed;
            torusMesh.rotation.y = angle;

            // Animated Lighting
            const light = new THREE.PointLight(0xffffff, 1, 5);
            light.position.x = Math.sin(angle * 2) * 3;
            light.position.z = Math.cos(angle * 2) * 3;
            light.intensity = 1;

            scene.add(light);
            scene.remove(light); // Remove and re-add to update position

            // Color Change
            const color = new THREE.Color(0xff0000);
            color.setHex(Math.max(0, Math.round(color.getHex() / 0xffffff) * 0xffffff));
            torus.color = color;

        }

        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });

        animate();
    </script>
</body>
</html>