<think>
The user wants a Three.js 3D scene with rotating geometric shapes and dynamic lighting. Let me create a visually impressive scene with:

1. Multiple geometric shapes (not just basic ones - maybe some interesting ones)
2. Dynamic lighting that changes over time
3. Post-processing effects for visual polish
4. OrbitControls for interaction
5. Proper window resize handling
6. Animation loop with subtle object animations

Let me create a comprehensive scene with:
- A central group of rotating shapes (icosahedron, torus knot, octahedron, dodecahedron)
- Dynamic point lights that orbit and change colors
- A spotlight from above
- Ambient light
- Post-processing with bloom effect
- Particles or a ground plane
- Subtle floating animations

I'll use MeshStandardMaterial and MeshPhysicalMaterial for the main objects to get nice lighting effects.
</think>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rotating Geometric Shapes with Dynamic Lighting</title>
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
        #info {
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            color: rgba(255, 255, 255, 0.7);
            font-family: 'Segoe UI', sans-serif;
            font-size: 14px;
            text-align: center;
            pointer-events: none;
        }
    </style>
</head>
<body>
    <div id="info">Drag to orbit • Scroll to zoom</div>
    <script type="importmap">
    {
        "imports": {
            "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
            "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
        }
    }
    </script>
    <script type="module">
        import * as THREE from 'three';
        import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
        import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
        import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
        import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

        let scene, camera, renderer, composer, controls;
        let shapes = [];
        let lights = [];
        let particles;
        let clock;

        function init() {
            clock = new THREE.Clock();

            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x0a0a0f);
            scene.fog = new THREE.Fog(0x0a0a0f, 15, 35);

            camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
            camera.position.set(0, 5, 12);

            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.2;
            document.body.appendChild(renderer.domElement);

            controls = new OrbitControls(camera, renderer.domElement);
            controls.enableDamping = true;
            controls.dampingFactor = 0.05;
            controls.maxDistance = 30;
            controls.minDistance = 5;

            setupLights();
            setupShapes();
            setupParticles();
            setupPostProcessing();

            window.addEventListener('resize', onWindowResize);
            animate();
        }

        function setupLights() {
            const ambientLight = new THREE.AmbientLight(0x222233, 0.5);
            scene.add(ambientLight);

            const mainLight = new THREE.DirectionalLight(0xffffff, 1);
            mainLight.position.set(5, 10, 5);
            scene.add(mainLight);

            const colors = [0xff006e, 0x00f5d4, 0xfee440, 0x9b5de5];
            
            for (let i = 0; i < 4; i++) {
                const light = new THREE.PointLight(colors[i], 2, 20);
                light.userData = {
                    angle: (i / 4) * Math.PI * 2,
                    radius: 8,
                    speed: 0.3 + Math.random() * 0.2,
                    yOffset: Math.sin(i * Math.PI / 2) * 3
                };
                lights.push(light);
                scene.add(light);
            }

            const spotLight = new THREE.SpotLight(0xffffff, 3, 25, Math.PI / 6, 0.5);
            spotLight.position.set(0, 15, 0);
            spotLight.target.position.set(0, 0, 0);
            scene.add(spotLight);
            scene.add(spotLight.target);
        }

        function setupShapes() {
            const materials = [
                new THREE.MeshStandardMaterial({ 
                    color: 0xff006e, 
                    metalness: 0.8, 
                    roughness: 0.2,
                    emissive: 0xff006e,
                    emissiveIntensity: 0.1
                }),
                new THREE.MeshStandardMaterial({ 
                    color: 0x00f5d4, 
                    metalness: 0.9, 
                    roughness: 0.1,
                    emissive: 0x00f5d4,
                    emissiveIntensity: 0.1
                }),
                new THREE.MeshStandardMaterial({ 
                    color: 0xfee440, 
                    metalness: 0.7, 
                    roughness: 0.3,
                    emissive: 0xfee440,
                    emissiveIntensity: 0.1
                }),
                new THREE.MeshPhysicalMaterial({ 
                    color: 0x9b5de5, 
                    metalness: 0.3, 
                    roughness: 0.2,
                    clearcoat: 1,
                    clearcoatRoughness: 0.1,
                    emissive: 0x9b5de5,
                    emissiveIntensity: 0.15
                }),
                new THREE.MeshStandardMaterial({ 
                    color: 0x00bbf9, 
                    metalness: 0.6, 
                    roughness: 0.4,
                    emissive: 0x00bbf9,
                    emissiveIntensity: 0.1
                })
            ];

            const geometries = [
                new THREE.IcosahedronGeometry(1.2, 0),
                new THREE.TorusKnotGeometry(0.8, 0.3, 100, 16),
                new THREE.OctahedronGeometry(1, 0),
                new THREE.DodecahedronGeometry(1, 0),
                new THREE.TetrahedronGeometry(1.3, 0)
            ];

            const positions = [
                { x: 0, y: 0, z: 0 },
                { x: 4, y: 1, z: 2 },
                { x: -4, y: -1, z: 2 },
                { x: 3, y: -1, z: -3 },
                { x: -3, y: 1, z: -3 }
            ];

            geometries.forEach((geometry, i) => {
                const mesh = new THREE.Mesh(geometry, materials[i]);
                mesh.position.set(positions[i].x, positions[i].y, positions[i].z);
                mesh.userData = {
                    baseY: positions[i].y,
                    rotationSpeed: {
                        x: (Math.random() - 0.5) * 0.5,
                        y: (Math.random() - 0.5) * 0.5,
                        z: (Math.random() - 0.5) * 0.5
                    },
                    floatSpeed: 0.5 + Math.random() * 0.5,
                    floatOffset: Math.random() * Math.PI * 2
                };
                shapes.push(mesh);
                scene.add(mesh);
            });

            const ringGeometry = new THREE.TorusGeometry(6, 0.05, 16, 100);
            const ringMaterial = new THREE.MeshBasicMaterial({ 
                color: 0xffffff,
                transparent: true,
                opacity: 0.3
            });
            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            ring.rotation.x = Math.PI / 2;
            ring.userData = { rotationSpeed: 0.1 };
            shapes.push(ring);
            scene.add(ring);
        }

        function setupParticles() {
            const particleCount = 500;
            const geometry = new THREE.BufferGeometry();
            const positions = new Float32