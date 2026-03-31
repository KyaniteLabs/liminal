
        import * as THREE from 'three';
        import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
        import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
        import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
        import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

        let scene, camera, renderer, composer, controls;
        let sculpture, particles;
        const clock = new THREE.Clock();

        function init() {
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x0a0a0f);
            scene.fog = new THREE.FogExp2(0x0a0a0f, 0.02);

            camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
            camera.position.set(0, 2, 8);

            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.2;
            document.body.appendChild(renderer.domElement);

            controls = new OrbitControls(camera, renderer.domElement);
            controls.enableDamping = true;
            controls.dampingFactor = 0.05;
            controls.maxDistance = 20;
            controls.minDistance = 3;
            controls.autoRotate = true;
            controls.autoRotateSpeed = 0.5;

            setupLighting();
            createSculpture();
            createParticles();
            setupPostProcessing();

            window.addEventListener('resize', onWindowResize);
            animate();
        }

        function setupLighting() {
            const ambientLight = new THREE.AmbientLight(0x222233, 0.5);
            scene.add(ambientLight);

            const pointLight1 = new THREE.PointLight(0x6366f1, 2, 50);
            pointLight1.position.set(5, 5, 5);
            scene.add(pointLight1);

            const pointLight2 = new THREE.PointLight(0xec4899, 2, 50);
            pointLight2.position.set(-5, 3, -5);
            scene.add(pointLight2);

            const pointLight3 = new THREE.PointLight(0x06b6d4, 2, 50);
            pointLight3.position.set(0, -5, 5);
            scene.add(pointLight3);

            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
            directionalLight.position.set(10, 10, 10);
            scene.add(directionalLight);
        }

        function createIridescentMaterial(color, opacity = 1) {
            return new THREE.MeshPhysicalMaterial({
                color: color,
                metalness: 0.1,
                roughness: 0.2,
                transmission: 0,
                thickness: 2,
                envMapIntensity: 1,
                clearcoat: 1,
                clearcoatRoughness: 0.1,
                iridescence: 1,
                iridescenceIOR: 1.5,
                iridescenceThicknessRange: [100, 800],
                opacity: opacity,
                transparent: opacity < 1
            });
        }

        function createSculpture() {
            sculpture = new THREE.Group();

            const coreGeometry = new THREE.IcosahedronGeometry(1, 1);
            const coreMaterial = createIridescentMaterial(0x6366f1);
            const core = new THREE.Mesh(coreGeometry, coreMaterial);
            sculpture.add(core);

            const ringGeometry = new THREE.TorusGeometry(2.5, 0.15, 16, 100);
            const ringMaterial = createIridescentMaterial(0xec4899);
            const ring1 = new THREE.Mesh(ringGeometry, ringMaterial);
            ring1.rotation.x = Math.PI / 2;
            sculpture.add(ring1);

            const ring2 = new THREE.Mesh(ringGeometry, ringMaterial.clone());
            ring2.rotation.x = Math.PI / 3;
            ring2.rotation.y = Math.PI / 4;
            sculpture.add(ring2);

            const ring3 = new THREE.Mesh(ringGeometry, ringMaterial.clone());
            ring3.rotation.x = -Math.PI / 4;
            ring3.rotation.z = Math.PI / 3;
            sculpture.add(ring3);

            const torusKnotGeometry = new THREE.TorusKnotGeometry(1.5, 0.2, 128, 16, 2, 3);
            const torusKnotMaterial = createIridescentMaterial(0x06b6d4);
            const torusKnot = new THREE.Mesh(torusKnotGeometry, torusKnotMaterial);
            torusKnot.position.y = 0;
            sculpture.add(torusKnot);

            for (let i = 0; i < 8; i++) {
                const octahedronGeometry = new THREE.OctahedronGeometry(0.3 + Math.random() * 0.3, 0);
                const octahedronMaterial = createIridescentMaterial(
                    new THREE.Color().setHSL(i / 8, 0.8, 0.6)
                );
                const octahedron = new THREE.Mesh(octahedronGeometry, octahedronMaterial);

                const angle = (i / 8) * Math.PI * 2;
                const radius = 3.5 + Math.random() * 0.5;
                octahedron.position.x = Math.cos(angle) * radius;
                octahedron.position.z = Math.sin(angle) * radius;
                octahedron.position.y = (Math.random() - 0.5) * 2;

                octahedron.userData.originalY = octahedron.position.y;
                octahedron.userData.floatSpeed = 0.5 + Math.random() * 0.5;
                octahedron.userData.floatOffset = Math.random() * Math.PI * 2;
                sculpture.add(octahedron);
            }

            for (let i = 0; i < 12; i++) {
                const tetrahedronGeometry = new THREE.TetrahedronGeometry(0.2 + Math.random() * 0.2, 0);
                const tetrahedronMaterial = createIridescentMaterial(
                    new THREE.Color().setHSL((i / 12 + 0.5) % 1, 0.7, 0.5),
                    0.7
                );
                const tetrahedron = new THREE.Mesh(tetrahedronGeometry, tetrahedronMaterial);

                const phi = Math.random() * Math.PI * 2;
                const theta = Math.random() * Math.PI;
                const orbitRadius = 4 + Math.random() * 1;

                tetrahedron.position.x = Math.sin(theta) * Math.cos(phi) * orbitRadius;
                tetrahedron.position.y = Math.cos(theta) * orbitRadius * 0.5;
                tetrahedron.position.z = Math.sin(theta) * Math.sin(phi) * orbitRadius;

                tetrahedron.userData.orbitAngle = phi;
                tetrahedron.userData.orbitSpeed = 0.2 + Math.random() * 0.3;
                tetrahedron.userData.orbitRadius = orbitRadius;
                tetrahedron.userData.orbitTilt = theta;
                sculpture.add(tetrahedron);
            }

            const pedestalGeometry = new THREE.CylinderGeometry(0.5, 0.8, 0.3, 32);
            const pedestalMaterial = new THREE.MeshStandardMaterial({
                color: 0x1a1a2e,
                metalness: 0.8,
                roughness: 0.2
            });
            const pedestal = new THREE.Mesh(pedestalGeometry, pedestalMaterial);
            pedestal.position.y = -3;
            sculpture.add(pedestal);

            scene.add(sculpture);
        }

        function createParticles() {
            const particleCount = 500;
            const positions = new Float32Array(particleCount * 3);
            const colors = new Float32Array(particleCount * 3);

            for (let i = 0; i < particleCount; i++) {
                positions[i * 3] = (Math.random() - 0.5) * 30;
                positions[i * 3 + 1] = (Math.random() - 0.5) * 30;
                positions[i * 3 + 2] = (Math.random() - 0.5) * 30;

                const color = new THREE.Color();
                color.setHSL(Math.random() * 0.2 + 0.7, 0.8, 0.6);
                colors[i * 3] = color.r;
                colors[i * 3 + 1] = color.g;
                colors[i * 3 + 2] = color.b;
            }

            const particleGeometry = new THREE.BufferGeometry();
            particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

            const particleMaterial = new THREE.PointsMaterial({
                size: 0.05,
                vertexColors: true,
                transparent: true,
                opacity: 0.6,
                blending: THREE.AdditiveBlending
            });

            particles = new THREE.Points(particleGeometry, particleMaterial);
            scene.add(particles);
        }

        function setupPostProcessing() {
            composer = new EffectComposer(renderer);

            const renderPass = new RenderPass(scene, camera);
            composer.addPass(renderPass);

            const bloomPass = new UnrealBloomPass(
                new THREE.Vector2(window.innerWidth, window.innerHeight),
                0.8,
                0.4,
                0.85
            );
            composer.addPass(bloomPass);
        }

        function onWindowResize() {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
            composer.setSize(window.innerWidth, window.innerHeight);
        }

        function animate() {
            requestAnimationFrame(animate);

            const elapsedTime = clock.getElapsedTime();

            sculpture.children.forEach((child, index) => {
                if (child.type === 'Mesh') {
                    if (child.geometry.type === 'IcosahedronGeometry') {
                        child.rotation.x = elapsedTime * 0.3;
                        child.rotation.y = elapsedTime * 0.5;
                        child.scale.setScalar(1 + Math.sin(elapsedTime * 2) * 0.05);
                    }

                    if (child.geometry.type === 'TorusGeometry' && child.geometry.parameters.tube > 0.3) {
                        child.rotation.z = elapsedTime * (0.2 + index * 0.05);
                    }

                    if (child.geometry.type === 'TorusKnotGeometry') {
                        child.rotation.x = elapsedTime * 0.4;
                        child.rotation.y = elapsedTime * 0.3;
                        child.rotation.z = elapsedTime * 0.2;
                    }

                    if (child.userData.floatSpeed) {
                        child.position.y = child.userData.originalY +
                            Math.sin(elapsedTime * child.userData.floatSpeed + child.userData.floatOffset) * 0.3;
                        child.rotation.x = elapsedTime * 0.5;
                        child.rotation.y = elapsedTime * 0.3;
                    }

                    if (child.userData.orbitSpeed) {
                        child.userData.orbitAngle += child.userData.orbitSpeed * 0.01;
                        child.position.x = Math.sin(child.userData.orbitAngle) *
                            Math.sin(child.userData.orbitTilt) * child.userData.orbitRadius;
                        child.position.y = Math.cos(child.userData.orbitTilt) * child.userData.orbitRadius * 0.5;
                        child.position.z = Math.cos(child.userData.orbitAngle) *
                            Math.sin(child.userData.orbitTilt) * child.userData.orbitRadius;
                        child.rotation.x = elapsedTime;
                        child.rotation.y = elapsedTime * 0.7;
                    }
                }
            });

            particles.rotation.y = elapsedTime * 0.02;
            particles.rotation.x = Math.sin(elapsedTime * 0.1) * 0.1;

            controls.update();
            composer.render();
        }

        init();
    