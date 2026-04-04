<!-- Code 1: Basic Implementation -->
<!DOCTYPE html>
<html>
<head>
    <style>body { margin: 0; overflow: hidden; }</style>
</head>
<body>
    <script type="module">
        import * as THREE from 'https://unpkg.com/three@0.158.0/build/three.module.js';
        import { OrbitControls } from 'https://unpkg.com/three@0.158.0/examples/jsm/controls/OrbitControls.js';

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(renderer.domElement);

        const geometry = new THREE.TorusKnotGeometry(10, 3, 100, 16);
        const material = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
        const torusKnot = new THREE.Mesh(geometry, material);
        scene.add(torusKnot);

        const light = new THREE.PointLight(0xffffff, 1, 100);
        light.position.set(10, 10, 10);
        scene.add(light);

        const controls = new OrbitControls(camera, renderer.domElement);
        camera.position.z = 30;

        const clock = new THREE.Clock();

        function animate() {
            requestAnimationFrame(animate);
            const time = clock.getElapsedTime();

            torusKnot.rotation.x = time * 0.5;
            torusKnot.rotation.y = time * 0.5;

            material.color.setHSL((time * 0.1) % 1, 1, 0.5);
            
            light.position.x = Math.sin(time) * 20;
            light.position.y = Math.cos(time) * 20;
            light.color.setHSL((time * 0.2) % 1, 1, 0.5);

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