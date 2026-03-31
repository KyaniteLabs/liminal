<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Wireframe Torus Knot Scene</title>
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
        scene.fog = new THREE.FogExp2(0x0a0a1a, 0.015);

        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 5, 15);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;
        document.body.appendChild(renderer.domElement);

        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.maxDistance = 50;
        controls.minDistance = 5;

        const ambientLight = new THREE.AmbientLight(0x222233, 0.5);
        scene.add(ambientLight);

        const pointLight1 = new THREE.PointLight(0xff6b6b, 2, 50);
        pointLight1.position.set(10, 10, 10);
        scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0x4ecdc4, 2, 50);
        pointLight2.position.set(-10, -5, -10);
        scene.add(pointLight2);

        const pointLight3 = new THREE.PointLight(0xf7dc6f, 2, 50);
        pointLight3.position.set(0, 15, 0);
        scene.add(pointLight3);

        const coreGeometry = new THREE.TorusKnotGeometry(3, 0.8, 128, 32, 2, 3);
        const coreMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xff00ff,
            emissiveIntensity: 0.3,
            metalness: 0.9,
            roughness: 0.1
        });
        const coreKnot = new THREE.Mesh(coreGeometry, coreMaterial);
        scene.add(coreKnot);

        const wireframeGeometry = new THREE.TorusKnotGeometry(3.05, 0.82, 128, 32, 2, 3);
        const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            wireframe: true,
            transparent: true,
            opacity: 0.8
        });
        const wireframeKnot = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
        scene.add(wireframeKnot);

        const particlesGeometry = new THREE.BufferGeometry();
        const particleCount = 2000;
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount; i++) {
            const radius = 8 + Math.random() * 25;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI * 2;
            
            positions[i * 3] = radius * Math.sin(theta) * Math.cos(phi);
            positions[i * 3 + 1] = radius * Math.sin(theta) * Math.sin(phi);
            positions[i * 3 + 2] = radius * Math.cos(theta);

            const color = new THREE.Color();
            color.setHSL(Math.random(), 0.8, 0.6);
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

        const floatingObjects = [];
        const objectCount = 12;

        for (let i = 0; i < objectCount; i++) {
            const geometries = [
                new THREE.IcosahedronGeometry(0.4, 0),
                new THREE.OctahedronGeometry(0.5, 0),
                new THREE.TetrahedronGeometry(0.5, 0),
                new THREE.DodecahedronGeometry(0.35, 0)
            ];
            
            const geometry = geometries[Math.floor(Math.random() * geometries.length)];
            const material = new THREE.MeshStandardMaterial({
                color: new THREE.Color().setHSL(i / objectCount, 0.7, 0.5),
                metalness: 0.8,
                roughness: 0.2,
                emissive: new THREE.Color().setHSL(i / objectCount, 0.9, 0.1)
            });

            const mesh = new THREE.Mesh(geometry, material);
            
            const angle = (i / objectCount) * Math.PI * 2;
            const radius = 7 + Math.random() * 5;
            mesh.position.set(
                Math.cos(angle) * radius,
                (Math.random() - 0.5) * 6,
                Math.sin(angle) * radius
            );

            mesh.userData = {
                initialY: mesh.position.y,
                rotationSpeed: 0.5 + Math.random() * 1.5,
                floatSpeed: 0.5 + Math.random() * 1,
                floatOffset: Math.random() * Math.PI * 2
            };

            floatingObjects.push(mesh);
            scene.add(mesh);
        }

        const ringGeometry = new THREE.TorusGeometry(6, 0.05, 16, 100);
        const rings = [];
        for (let i = 0; i < 3; i++) {
            const ringMaterial = new THREE.MeshBasicMaterial({
                color: new THREE.Color().setHSL(0.5 + i * 0.15, 0.9, 0.6),
                transparent: true,
                opacity: 0.4
            });
            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            ring.rotation.x = Math.PI / 2 + (i - 1) * 0.3;
            ring.rotation.z = i * 0.5;
            rings.push(ring);
            scene.add(ring);
        }

        const clock = new THREE.Clock();

        function animate() {
            requestAnimationFrame(animate);
            
            const elapsed = clock.getElapsedTime();
            const delta = clock.getDelta();

            coreKnot.rotation.x += 0.003;
            coreKnot.rotation.y += 0.005;
            coreKnot.rotation.z += 0.002;

            wireframeKnot.rotation.x = coreKnot.rotation.x;
            wireframeKnot.rotation.y = coreKnot.rotation.y;
            wireframeKnot.rotation.z = coreKnot.rotation.z;

            const hue = (elapsed * 0.1) % 1;
            wireframeMaterial.color.setHSL(hue, 1, 0.5);
            coreMaterial.emissive.setHSL((hue + 0.5) % 1, 1, 0.3);

            pointLight1.position.x = Math.sin(elapsed * 0.7) * 15;
            pointLight1.position.z = Math.cos(elapsed * 0.7) * 15;
            pointLight1.position.y = Math.sin(elapsed * 0.5) * 10;
            pointLight1.color.setHSL((elapsed * 0.15) % 1, 0.8, 0.5);

            pointLight2.position.x = Math.sin(elapsed * 0.5 + Math.PI) * 12;
            pointLight2.position.z = Math.cos(elapsed * 0.5 + Math.PI) * 12;
            pointLight2.color.setHSL((elapsed * 0.12 + 0.33) % 1, 0.8, 0.5);

            pointLight3.position.x = Math.cos(elapsed * 0.3) * 8;
            pointLight3.position.z = Math.sin(elapsed * 0.3) * 8;
            pointLight3.color.setHSL((elapsed * 0.08 + 0.66) % 1, 0.8, 0.5);

            particles.rotation.y += 0.0005;
            particles.rotation.x += 0.0002;

            floatingObjects.forEach((obj, index) => {
                obj.rotation.x += 0.01 * obj.userData.rotationSpeed;
                obj.rotation.y += 0.015 * obj.userData.rotationSpeed;
                obj.position.y = obj.userData.initialY + 
                    Math.sin(elapsed * obj.userData.floatSpeed + obj.userData.floatOffset) * 1.5;
            });

            rings.forEach((ring, index) => {
                ring.rotation.z += 0.002 * (index + 1);
                ring.material.opacity = 0.3 + Math.sin(elapsed * 2 + index) * 0.15;
            });

            controls.update();
            renderer.render(scene, camera);
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