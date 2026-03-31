<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Wireframe Torus Knot</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { overflow: hidden; background: #0a0a0f; }
        canvas { display: block; }
    </style>
</head>
<body>
    <script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js"></script>
    <script>
        // Scene setup
        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x0a0a0f, 0.015);

        // Camera
        const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 5, 15);

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;
        document.body.appendChild(renderer.domElement);

        // Orbit Controls
        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.autoRotate = false;

        // Torus Knot - Wireframe with custom geometry
        const torusKnotGeom = new THREE.TorusKnotGeometry(3, 0.8, 128, 32, 2, 3);
        const torusKnotMat = new THREE.MeshStandardMaterial({
            color: 0xff3366,
            wireframe: true,
            emissive: 0xff3366,
            emissiveIntensity: 0.3,
            roughness: 0.2,
            metalness: 0.8
        });
        const torusKnot = new THREE.Mesh(torusKnotGeom, torusKnotMat);
        scene.add(torusKnot);

        // Inner glow sphere
        const innerSphereGeom = new THREE.SphereGeometry(1.5, 32, 32);
        const innerSphereMat = new THREE.MeshStandardMaterial({
            color: 0x222244,
            emissive: 0x6644ff,
            emissiveIntensity: 0.8,
            roughness: 0.1,
            metalness: 0.9,
            transparent: true,
            opacity: 0.6
        });
        const innerSphere = new THREE.Mesh(innerSphereGeom, innerSphereMat);
        scene.add(innerSphere);

        // Particle system around the knot
        const particleCount = 500;
        const particleGeom = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        
        for (let i = 0; i < particleCount; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            const radius = 4 + Math.random() * 4;
            positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = radius * Math.cos(phi);
        }
        
        particleGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const particleMat = new THREE.PointsMaterial({
            color: 0x44ffff,
            size: 0.08,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        
        const particles = new THREE.Points(particleGeom, particleMat);
        scene.add(particles);

        // Orbiting spheres
        const orbitCount = 6;
        const orbs = [];
        for (let i = 0; i < orbitCount; i++) {
            const orbGeom = new THREE.SphereGeometry(0.3, 16, 16);
            const orbMat = new THREE.MeshStandardMaterial({
                color: new THREE.Color().setHSL(i / orbitCount, 1, 0.5),
                emissive: new THREE.Color().setHSL(i / orbitCount, 1, 0.3),
                emissiveIntensity: 0.5,
                roughness: 0.3,
                metalness: 0.7
            });
            const orb = new THREE.Mesh(orbGeom, orbMat);
            orb.userData = {
                angle: (i / orbitCount) * Math.PI * 2,
                speed: 0.5 + Math.random() * 0.5,
                radius: 5 + Math.random() * 2,
                yOffset: (Math.random() - 0.5) * 3
            };
            orbs.push(orb);
            scene.add(orb);
        }

        // Lighting
        const ambientLight = new THREE.AmbientLight(0x222233, 0.5);
        scene.add(ambientLight);

        // Point lights
        const pointLight1 = new THREE.PointLight(0xff3366, 2, 20);
        pointLight1.position.set(5, 5, 5);
        scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0x3366ff, 2, 20);
        pointLight2.position.set(-5, -3, 5);
        scene.add(pointLight2);

        const pointLight3 = new THREE.PointLight(0x66ff66, 1.5, 15);
        pointLight3.position.set(0, 8, -5);
        scene.add(pointLight3);

        // Directional light
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(10, 10, 10);
        scene.add(dirLight);

        // Animation
        let time = 0;

        function animate() {
            requestAnimationFrame(animate);
            
            time += 0.016;

            // Rotate torus knot
            torusKnot.rotation.x = time * 0.3;
            torusKnot.rotation.y = time * 0.5;

            // Color cycling for torus knot
            const hue = (Math.sin(time * 0.5) + 1) / 2;
            const color = new THREE.Color().setHSL(hue, 0.8, 0.5);
            torusKnotMat.color = color;
            torusKnotMat.emissive = color;

            // Pulse inner sphere
            const pulse = 1 + Math.sin(time * 3) * 0.1;
            innerSphere.scale.setScalar(pulse);
            innerSphereMat.emissiveIntensity = 0.5 + Math.sin(time * 2) * 0.3;

            // Animate particles
            particles.rotation.y = time * 0.1;
            particles.rotation.x = Math.sin(time * 0.2) * 0.1;

            // Animate orbiting spheres
            orbs.forEach((orb, i) => {
                const data = orb.userData;
                data.angle += data.speed * 0.016;
                orb.position.x = Math.cos(data.angle) * data.radius;
                orb.position.z = Math.sin(data.angle) * data.radius;
                orb.position.y = Math.sin(time * 2 + i) * 2 + data.yOffset;
            });

            // Animate point lights
            pointLight1.position.x = Math.sin(time * 1.5) * 6;
            pointLight1.position.z = Math.cos(time * 1.5) * 6;
            
            pointLight2.position.x = Math.cos(time * 1.2) * 5;
            pointLight2.position.y = Math.sin(time * 1.2) * 4;
            
            pointLight3.position.y = 8 + Math.sin(time * 2) * 3;
            pointLight3.intensity = 1.5 + Math.sin(time * 3) * 0.5;

            controls.update();
            renderer.render(scene, camera);
        }

        // Handle resize
        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });

        animate();
    </script>
</body>
</html>