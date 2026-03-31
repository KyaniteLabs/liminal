<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Wireframe Torus Knot</title>
    <style>
        body { margin: 0; overflow: hidden; background: #000; }
        canvas { display: block; }
    </style>
</head>
<body>
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

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x050510);

        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 0, 40);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        document.body.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;

        const geometry = new THREE.TorusKnotGeometry(12, 4, 128, 32);
        const material = new THREE.MeshStandardMaterial({
            color: 0xff0066,
            wireframe: true,
            roughness: 0.2,
            metalness: 0.9,
            emissive: 0x220044,
            emissiveIntensity: 0.3
        });

        const torusKnot = new THREE.Mesh(geometry, material);
        scene.add(torusKnot);

        const ambientLight = new THREE.AmbientLight(0x222222, 1.5);
        scene.add(ambientLight);

        const pointLight1 = new THREE.PointLight(0x00ffff, 3, 100);
        pointLight1.position.set(25, 25, 25);
        scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0xff00ff, 3, 100);
        pointLight2.position.set(-25, -25, 25);
        scene.add(pointLight2);

        const pointLight3 = new THREE.PointLight(0xffff00, 2, 80);
        pointLight3.position.set(0, 30, -20);
        scene.add(pointLight3);

        let time = 0;

        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });

        function animate() {
            requestAnimationFrame(animate);
            
            time += 0.015;

            torusKnot.rotation.x += 0.008;
            torusKnot.rotation.y += 0.012;

            const hue = (time * 0.08) % 1;
            material.color.setHSL(hue, 0.9, 0.5);
            material.emissive.setHSL((hue + 0.5) % 1, 0.8, 0.15);

            pointLight1.position.x = Math.sin(time) * 35;
            pointLight1.position.z = Math.cos(time) * 35;
            pointLight1.position.y = Math.sin(time * 0.7) * 25;
            pointLight1.intensity = 2 + Math.sin(time * 3) * 1;

            pointLight2.position.x = Math.sin(time + Math.PI) * 35;
            pointLight2.position.z = Math.cos(time + Math.PI) * 35;
            pointLight2.position.y = Math.cos(time * 0.5) * 25;
            pointLight2.intensity = 2 + Math.cos(time * 2.5) * 1;

            pointLight3.position.x = Math.sin(time * 0.5) * 30;
            pointLight3.position.z = Math.cos(time * 1.3) * 30;
            pointLight3.intensity = 1.5 + Math.sin(time * 4) * 0.8;

            controls.update();
            renderer.render(scene, camera);
        }

        animate();
    </script>
</body>
</html>