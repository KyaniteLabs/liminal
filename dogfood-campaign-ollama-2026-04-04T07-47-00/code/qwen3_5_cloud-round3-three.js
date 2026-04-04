<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Three.js Torus Knot - Global Scope</title>
    <style>body { margin: 0; overflow: hidden; }</style>
</head>
<body>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
    <script>
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(renderer.domElement);

        const geometry = new THREE.TorusKnotGeometry(10, 3, 128, 16);
        const material = new THREE.MeshStandardMaterial({ color: 0xffffff, wireframe: true });
        const torusKnot = new THREE.Mesh(geometry, material);
        scene.add(torusKnot);

        const light = new THREE.PointLight(0xffffff, 1, 100);
        scene.add(light);
        const ambientLight = new THREE.AmbientLight(0x404040);
        scene.add(ambientLight);

        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        camera.position.z = 30;

        function animate() {
            requestAnimationFrame(animate);
            const time = Date.now() * 0.001;
            torusKnot.rotation.x += 0.01;
            torusKnot.rotation.y += 0.01;
            material.color.setHSL(time % 1, 1, 0.5);
            light.position.x = Math.sin(time) * 20;
            light.position.z = Math.cos(time) * 20;
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