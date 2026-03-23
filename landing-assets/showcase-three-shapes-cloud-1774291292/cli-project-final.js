<think>
The user wants a Three.js 3D scene with:
1. Rotating geometric shapes
2. Dynamic lighting

I'll create a visually appealing scene with:
- Multiple geometric shapes (cube, sphere, torus, octahedron, etc.)
- Rotation animations for the shapes
- Dynamic lighting with point lights that change position/intensity
- Post-processing effects like bloom
- OrbitControls for interaction
- Proper lighting setup (ambient + point/directional lights)
- MeshStandardMaterial for materials
- Responsive handling

Let me create a complete HTML file with all these elements.
</think>

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dynamic Geometric Shapes - Three.js</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            overflow: hidden;
            background: #000;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
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
            font-size: 14px;
            text-align: center;
            pointer-events: none;
            text-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
        }
        #title {
            position: absolute;
            top: 30px;
            left: 50%;
            transform: translateX(-50%);
            color: rgba(255, 255, 255, 0.9);
            font-size: 24px;
            font-weight: 300;
            letter-spacing: 4px;
            text-transform: uppercase;
            pointer-events: none;
            text-shadow: 0 0 20px rgba(100, 150, 255, 0.5);
        }
    </style>
</head>
<body>
    <div id="title">Geometric Cosmos</div>
    <div id="info">Drag to rotate • Scroll to zoom</div>
    
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

        // Scene setup
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x050510);
        scene.fog = new THREE.FogExp2(0x050510, 0.015);

        // Camera
        const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 8, 20);

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;
        document.body.appendChild(renderer.domElement);

        // Post-processing
        const composer = new EffectComposer(renderer);
        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);

        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.8,
            0.4,
            0.85
        );
        composer.addPass(bloomPass);

        // Controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.maxDistance = 50;
        controls.minDistance = 5;

        // Lighting
        const ambientLight = new THREE.AmbientLight(0x222244, 0.5);
        scene.add(ambientLight);

        // Dynamic point lights
        const lights = [];
        const lightColors = [0xff6b6b, 0x4ecdc4, 0xffe66d, 0x95e1d3, 0xf38181];

        for (let i = 0; i < 5; i++) {
            const light = new THREE.PointLight(lightColors[i], 2, 30);
            light.position.set(
                Math.cos(i * Math.PI * 2 / 5) * 12,
                Math.sin(i * 2) * 5 + 3,
                Math.sin(i * Math.PI * 2 / 5) * 12
            );
            scene.add(light);
            lights.push({
                light,
                baseX: light.position.x,
                baseY: light.position.y,
                baseZ: light.position.z,
                phase: i * Math.PI * 2 / 5
            });
        }

        // Directional light
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.3);
        dirLight.position.set(5, 10, 5);
        scene.add(dirLight);

        // Geometric shapes
        const shapes = [];

        // Materials with MeshStandardMaterial
        const materials = [
            new THREE.MeshStandardMaterial({ 
                color: 0xff6b6b, 
                metalness: 0.7, 
                roughness: 0.2,
                emissive: 0xff6b6b,
                emissiveIntensity: 0.1
            }),
            new THREE.MeshStandardMaterial({ 
                color: 0x4ecdc4, 
                metalness: 0.8, 
                roughness: 0.15,
                emissive: 0x4ecdc4,
                emissiveIntensity: 0.1
            }),
            new THREE.MeshStandardMaterial({ 
                color: 0xffe66d, 
                metalness: 0.6, 
                roughness: 0.25,
                emissive: 0xffe66d,
                emissiveIntensity: 0.15
            }),
            new THREE.MeshStandardMaterial({ 
                color: 0x95e1d3, 
                metalness: 0.75, 
                roughness: 0.2,
                emissive: 0x95e1d3,
                emissiveIntensity: 0.1
            }),
            new THREE.MeshStandardMaterial({ 
                color: 0xf38181, 
                metalness: 0.65, 
                roughness: 0.2,
                emissive: 0xf38181,
                emissiveIntensity: 0.1
            }),
            new THREE.MeshStandardMaterial({ 
                color: 0xa8e6cf, 
                metalness: 0.7, 
                roughness: 0.2,
                emissive: 0xa8e6cf,
                emissiveIntensity: 0.1
            }),
            new THREE.MeshStandardMaterial({ 
                color: 0xdcedc1, 
                metalness: 0.8, 
                roughness: 0.15,
                emissive: 0xdcedc1,
                emissiveIntensity: 0.1
            })
        ];

        // Central icosahedron
        const centralGeo = new THREE.IcosahedronGeometry(2, 0);
        const centralMesh = new THREE.Mesh(centralGeo, materials[0]);
        scene.add(centralMesh);
        shapes.push({ mesh: centralMesh, rotationSpeed: { x: 0.005, y: 0.008, z: 0.003 }, floatSpeed: 1, floatHeight: 0.5 });

        // Orbiting cube
        const cubeGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
        const cubeMesh = new THREE.Mesh(cubeGeo, materials[1]);
        cubeMesh.position.set(6, 2, 0);
        scene.add(cubeMesh);
        shapes.push({ mesh: cubeMesh, rotationSpeed: { x: 0.02, y: 0.015, z: 0.01 }, orbitRadius: 6, orbitSpeed: 0.3, angle: 0 });

        // Torus
        const torusGeo = new THREE.TorusGeometry(1.2, 0.4, 16, 100);
        const torusMesh = new THREE.Mesh(torusGeo, materials[2]);
        torusMesh