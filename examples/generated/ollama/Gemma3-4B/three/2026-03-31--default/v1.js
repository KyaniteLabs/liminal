<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rotating Torus Knot</title>
    <style>
        body {
            margin: 0;
            overflow: hidden;
        }
        canvas {
            width: 100%;
            height: 100%;
            display: block;
        }
    </style>
</head>
<body>
    <script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js"></script>
    <script>
        const scene = new THREE.Scene();
        const canvas = document.querySelector('canvas');
        const renderer = new THREE.WebGLRenderer({
            canvas: canvas
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
        camera.position.z = 5;

        const controls = new THREE.OrbitControls(camera, canvas);
        controls.target.z = 0;
        controls.update();

        // Torus Knot
        const torus = new THREE.Mesh(
            new THREE.TorusKnotGeometry(0.8, 0.2, 32),
            new THREE.MeshStandardMaterial({
                color: new THREE.Color(0.8, 0.6, 0.4),
                roughness: 0.7,
                metalness: 0.3
            })
        );
        torus.rotation.x.at(0.01);
        scene.add(torus);

        // Lights
        const ambientLight = new THREE.AmbientLight(new THREE.Color(0.5, 0.5, 0.5));
        scene.add(ambientLight);

        const pointLight = new THREE.PointLight(new THREE.Color(1.0, 1.0, 1.0), 1.5);
        pointLight.position.x = 5;
        pointLight.position.y = 5;
        pointLight.position.z = 10;
        scene.add(pointLight);

        // Animation Loop
        function animate() {
            requestAnimationFrame(animate);

            torus.rotation.x.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI * 0.1);

            renderer.render(scene, camera);
        }

        animate();
    </script>
</body>
</html>