<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Wireframe Torus Knot</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            overflow: hidden;
            background: #000;
        }
        canvas {
            display: block;
        }
    </style>
</head>
<body>
    <script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js"></script>
    <script>
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a0a15);
        scene.fog = new THREE.FogExp2(0x0a0a15, 0.05);

        const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 2, 8);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        document.body.appendChild(renderer.domElement);

        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.minDistance = 3;
        controls.maxDistance = 20;

        const ambientLight = new THREE.AmbientLight(0x222244, 0.5);
        scene.add(ambientLight);

        const pointLight1 = new THREE.PointLight(0xff0066, 3, 25);
        pointLight1.position.set(5, 5, 5);
        scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0x00ffaa, 3, 25);
        pointLight2.position.set(-5, -5, 5);
        scene.add(pointLight2);

        const pointLight3 = new THREE.PointLight(0x6600ff, 2, 20);
        pointLight3.position.set(0, 0, -5);
        scene.add(pointLight3);

        const torusKnotGeometry = new THREE.TorusKnotGeometry(2, 0.6, 128, 32, 2, 3);
        const wireframeMaterial = new THREE.MeshStandardMaterial({
            color: 0xff00ff,
            wireframe: true,
            emissive: 0xff00ff,
            emissiveIntensity: 0.3,
            roughness: 0.5,
            metalness: 0.8
        });
        const torusKnot = new THREE.Mesh(torusKnotGeometry, wireframeMaterial);
        scene.add(torusKnot);

        const innerTorusGeometry = new THREE.TorusGeometry(1.2, 0.15, 16, 50);
        const innerMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            emissive: 0x00ffff,
            emissiveIntensity: 0.5,
            roughness: 0.3,
            metalness: 0.9
        });
        const innerTorus = new THREE.Mesh(innerTorusGeometry, innerMaterial);
        innerTorus.rotation.x = Math.PI / 2;
        scene.add(innerTorus);

        const particlesGeometry = new THREE.BufferGeometry();
        const particlesCount = 300;
        const positions = new Float32Array(particlesCount * 3);
        const colors = new Float32Array(particlesCount * 3);

        for (let i = 0; i < particlesCount; i++) {
            const radius = 4 + Math.random() * 8;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            
            positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = radius * Math.cos(phi);

            const color = new THREE.Color();
            color.setHSL(Math.random() * 0.3 + 0.5, 1, 0.5);
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }

        particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const particlesMaterial = new THREE.PointsMaterial({
            size: 0.08,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        const particles = new THREE.Points(particlesGeometry, particlesMaterial);
        scene.add(particles);

        const ringGeometry = new THREE.TorusGeometry(3.5, 0.05, 8, 64);
        const ringMaterial = new THREE.MeshStandardMaterial({
            color: 0xffaa00,
            emissive: 0xffaa00,
            emissiveIntensity: 0.8,
            roughness: 0.2,
            metalness: 1
        });

        const ring1 = new THREE.Mesh(ringGeometry, ringMaterial);
        ring1.rotation.x = Math.PI / 3;
        scene.add(ring1);

        const ring2 = new THREE.Mesh(ringGeometry, ringMaterial.clone());
        ring2.rotation.x = -Math.PI / 4;
        ring2.rotation.y = Math.PI / 6;
        scene.add(ring2);

        const ring3 = new THREE.Mesh(ringGeometry, ringMaterial.clone());
        ring3.rotation.z = Math.PI / 5;
        ring3.rotation.x = Math.PI / 2;
        scene.add(ring3);

        function animate() {
            requestAnimationFrame(animate);

            const time = Date.now() * 0.001;

            torusKnot.rotation.x = time * 0.3;
            torusKnot.rotation.y = time * 0.2;

            const hue = (Math.sin(time * 0.5) + 1) / 2;
            wireframeMaterial.color.setHSL(hue, 1, 0.5);
            wireframeMaterial.emissive.setHSL(hue, 1, 0.3);

            innerTorus.rotation.z = time * 0.8;
            innerTorus.rotation.y = time * 0.5;

            pointLight1.position.x = Math.sin(time * 0.7) * 8;
            pointLight1.position.y = Math.cos(time * 0.5) * 6;
            pointLight1.position.z = Math.sin(time * 0.3) * 8;

            pointLight2.position.x = Math.cos(time * 0.4) * 7;
            pointLight2.position.y = Math.sin(time * 0.6) * 7;
            pointLight2.position.z = Math.cos(time * 0.2) * 6;

            pointLight3.position.x = Math.sin(time * 0.3 + 2) * 5;
            pointLight3.position.y = Math.cos(time * 0.4 + 2) * 5;
            pointLight3.position.z = -4 + Math.sin(time * 0.2) * 2;

            const intensity = 2 + Math.sin(time * 2) * 1;
            pointLight1.intensity = intensity;
            pointLight2.intensity = 2 + Math.cos(time * 1.5) * 1;

            particles.rotation.y = time * 0.05;
            particles.rotation.x = Math.sin(time * 0.1) * 0.1;

            ring1.rotation.z = time * 0.2;
            ring2.rotation.y = time * 0.15;
            ring3.rotation.x = time * 0.25;

            controls.update();
            renderer.render(scene, camera);
        }

        animate();

        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });
    </script>
</body>
</html>