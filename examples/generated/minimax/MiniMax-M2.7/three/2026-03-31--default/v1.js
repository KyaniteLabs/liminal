<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Animated Wireframe Torus Knot</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            overflow: hidden;
            background-color: #000;
        }
        canvas {
            display: block;
        }
    </style>
</head>
<body>
    <script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script>
    <script type="module">
        import * as THREE from 'three';
        import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
        import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
        import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
        import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

        let scene, camera, renderer, controls, composer;
        let torusKnot, wireframe;
        let pointLight1, pointLight2, pointLight3;
        let time = 0;

        function init() {
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x0a0a0f);
            scene.fog = new THREE.Fog(0x0a0a0f, 5, 25);

            camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            camera.position.set(0, 0, 8);

            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.2;
            document.body.appendChild(renderer.domElement);

            controls = new OrbitControls(camera, renderer.domElement);
            controls.enableDamping = true;
            controls.dampingFactor = 0.05;
            controls.minDistance = 3;
            controls.maxDistance = 20;

            const ambientLight = new THREE.AmbientLight(0x222233, 0.5);
            scene.add(ambientLight);

            pointLight1 = new THREE.PointLight(0xff00ff, 2, 20);
            pointLight1.position.set(5, 3, 5);
            scene.add(pointLight1);

            pointLight2 = new THREE.PointLight(0x00ffff, 2, 20);
            pointLight2.position.set(-5, -3, 5);
            scene.add(pointLight2);

            pointLight3 = new THREE.PointLight(0xffff00, 2, 20);
            pointLight3.position.set(0, 5, -5);
            scene.add(pointLight3);

            const torusGeometry = new THREE.TorusKnotGeometry(2, 0.4, 128, 32);
            const material = new THREE.MeshStandardMaterial({
                color: 0xffffff,
                emissive: 0x111111,
                metalness: 0.9,
                roughness: 0.1,
                wireframe: true
            });

            torusKnot = new THREE.Mesh(torusGeometry, material);
            scene.add(torusKnot);

            const wireGeometry = new THREE.TorusKnotGeometry(2.05, 0.45, 128, 32);
            const wireMaterial = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                wireframe: true,
                transparent: true,
                opacity: 0.3
            });
            wireframe = new THREE.Mesh(wireGeometry, wireMaterial);
            scene.add(wireframe);

            const particlesGeometry = new THREE.BufferGeometry();
            const particleCount = 500;
            const positions = new Float32Array(particleCount * 3);

            for (let i = 0; i < particleCount * 3; i += 3) {
                positions[i] = (Math.random() - 0.5) * 30;
                positions[i + 1] = (Math.random() - 0.5) * 30;
                positions[i + 2] = (Math.random() - 0.5) * 30;
            }

            particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

            const particlesMaterial = new THREE.PointsMaterial({
                size: 0.05,
                color: 0xffffff,
                transparent: true,
                opacity: 0.6,
                sizeAttenuation: true
            });

            const particles = new THREE.Points(particlesGeometry, particlesMaterial);
            scene.add(particles);

            composer = new EffectComposer(renderer);
            const renderPass = new RenderPass(scene, camera);
            composer.addPass(renderPass);

            const bloomPass = new UnrealBloomPass(
                new THREE.Vector2(window.innerWidth, window.innerHeight),
                1.5,
                0.4,
                0.85
            );
            composer.addPass(bloomPass);

            window.addEventListener('resize', onWindowResize);
        }

        function onWindowResize() {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
            composer.setSize(window.innerWidth, window.innerHeight);
        }

        function animate() {
            requestAnimationFrame(animate);

            time += 0.01;

            torusKnot.rotation.x += 0.003;
            torusKnot.rotation.y += 0.005;

            wireframe.rotation.x += 0.003;
            wireframe.rotation.y += 0.005;

            const hue = (time * 0.1) % 1;
            const color = new THREE.Color().setHSL(hue, 1, 0.5);

            torusKnot.material.color.copy(color);
            torusKnot.material.emissive.copy(color).multiplyScalar(0.2);
            wireframe.material.color.copy(color);

            pointLight1.position.x = Math.sin(time * 1.5) * 6;
            pointLight1.position.y = Math.cos(time * 1.2) * 4;
            pointLight1.position.z = Math.cos(time * 1.8) * 6;
            pointLight1.color.copy(color);

            pointLight2.position.x = Math.cos(time * 1.3) * 6;
            pointLight2.position.y = Math.sin(time * 1.7) * 4;
            pointLight2.position.z = Math.sin(time * 2) * 6;

            const hue2 = (hue + 0.33) % 1;
            pointLight2.color.setHSL(hue2, 1, 0.5);

            pointLight3.position.x = Math.sin(time * 0.8) * 5;
            pointLight3.position.y = Math.cos(time * 1.1) * 6;
            pointLight3.position.z = Math.cos(time * 1.4) * 5;

            const hue3 = (hue + 0.66) % 1;
            pointLight3.color.setHSL(hue3, 1, 0.5);

            controls.update();
            composer.render();
        }

        init();
        animate();
    </script>
</body>
</html>