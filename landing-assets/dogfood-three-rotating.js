
        import * as THREE from 'three';
        import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
        import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
        import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
        import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

        let scene, camera, renderer, controls, composer;
        let shapes = [];
        let pointLight, pointLight2;
        let time = 0;

        function init() {
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x0a0a1a);
            scene.fog = new THREE.Fog(0x0a0a1a, 8, 25);

            camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
            camera.position.set(0, 3, 10);

            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.2;
            document.body.appendChild(renderer.domElement);

            controls = new OrbitControls(camera, renderer.domElement);
            controls.enableDamping = true;
            controls.dampingFactor = 0.05;
            controls.minDistance = 5;
            controls.maxDistance = 20;

            const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
            scene.add(ambientLight);

            const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
            directionalLight.position.set(5, 10, 7);
            scene.add(directionalLight);

            pointLight = new THREE.PointLight(0xff6b6b, 2, 15);
            pointLight.position.set(-3, 2, 3);
            scene.add(pointLight);

            pointLight2 = new THREE.PointLight(0x4ecdc4, 2, 15);
            pointLight2.position.set(3, -2, -3);
            scene.add(pointLight2);

            const pointLightHelper1 = new THREE.PointLightHelper(pointLight, 0.3);
            const pointLightHelper2 = new THREE.PointLightHelper(pointLight2, 0.3);
            scene.add(pointLightHelper1);
            scene.add(pointLightHelper2);

            createShapes();

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

            const gridHelper = new THREE.GridHelper(20, 40, 0x222233, 0x111122);
            gridHelper.position.y = -3;
            scene.add(gridHelper);

            window.addEventListener('resize', onWindowResize);
        }

        function createShapes() {
            const geometries = [
                new THREE.IcosahedronGeometry(1, 0),
                new THREE.OctahedronGeometry(1, 0),
                new THREE.TetrahedronGeometry(1, 0),
                new THREE.BoxGeometry(1.4, 1.4, 1.4),
                new THREE.TorusGeometry(0.8, 0.3, 16, 32),
                new THREE.ConeGeometry(0.8, 1.5, 6)
            ];

            const materials = [
                new THREE.MeshStandardMaterial({ color: 0xff6b6b, metalness: 0.3, roughness: 0.4, emissive: 0xff6b6b, emissiveIntensity: 0.1 }),
                new THREE.MeshStandardMaterial({ color: 0x4ecdc4, metalness: 0.5, roughness: 0.3, emissive: 0x4ecdc4, emissiveIntensity: 0.1 }),
                new THREE.MeshStandardMaterial({ color: 0xffe66d, metalness: 0.4, roughness: 0.2, emissive: 0xffe66d, emissiveIntensity: 0.1 }),
                new THREE.MeshStandardMaterial({ color: 0xa855f7, metalness: 0.6, roughness: 0.3, emissive: 0xa855f7, emissiveIntensity: 0.1 }),
                new THREE.MeshStandardMaterial({ color: 0x06ffa5, metalness: 0.2, roughness: 0.5, emissive: 0x06ffa5, emissiveIntensity: 0.1 }),
                new THREE.MeshStandardMaterial({ color: 0xf472b6, metalness: 0.4, roughness: 0.4, emissive: 0xf472b6, emissiveIntensity: 0.1 })
            ];

            const positions = [
                { x: 0, y: 0, z: 0 },
                { x: 4, y: 1, z: 1 },
                { x: -4, y: -1, z: 1 },
                { x: 2, y: -2, z: -2 },
                { x: -2, y: 2, z: -2 },
                { x: 0, y: -1, z: 3 }
            ];

            for (let i = 0; i < geometries.length; i++) {
                const mesh = new THREE.Mesh(geometries[i], materials[i]);
                mesh.position.set(positions[i].x, positions[i].y, positions[i].z);
                mesh.userData = {
                    rotationSpeed: {
                        x: (Math.random() - 0.5) * 0.02,
                        y: (Math.random() - 0.5) * 0.02,
                        z: (Math.random() - 0.5) * 0.02
                    },
                    floatOffset: Math.random() * Math.PI * 2,
                    floatSpeed: 0.5 + Math.random() * 0.5,
                    originalY: positions[i].y
                };
                shapes.push(mesh);
                scene.add(mesh);
            }
        }

        function onWindowResize() {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
            composer.setSize(window.innerWidth, window.innerHeight);
        }

        function animate() {
            requestAnimationFrame(animate);
            time += 0.016;

            shapes.forEach((shape, index) => {
                shape.rotation.x += shape.userData.rotationSpeed.x;
                shape.rotation.y += shape.userData.rotationSpeed.y;
                shape.rotation.z += shape.userData.rotationSpeed.z;

                shape.position.y = shape.userData.originalY + Math.sin(time * shape.userData.floatSpeed + shape.userData.floatOffset) * 0.3;
            });

            pointLight.position.x = Math.sin(time * 0.7) * 5;
            pointLight.position.z = Math.cos(time * 0.7) * 5;
            pointLight.position.y = Math.sin(time * 0.5) * 2 + 2;

            pointLight2.position.x = Math.cos(time * 0.5) * 5;
            pointLight2.position.z = Math.sin(time * 0.5) * 5;
            pointLight2.position.y = Math.cos(time * 0.3) * 2 - 2;

            pointLight.intensity = 2 + Math.sin(time * 2) * 0.5;
            pointLight2.intensity = 2 + Math.cos(time * 2) * 0.5;

            controls.update();
            composer.render();
        }

        init();
        animate();
    