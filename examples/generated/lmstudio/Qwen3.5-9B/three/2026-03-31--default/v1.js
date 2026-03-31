<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chromatic Torus Knot</title>
    <style>
        body { margin: 0; overflow: hidden; background-color: #050505; }
        canvas { display: block; }
        #loading {
            position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
            color: white; font-family: sans-serif; pointer-events: none;
        }
    </style>
</head>
<body>
    <div id="loading">Initializing Scene...</div>

    <!-- Three.js Core -->
    <script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>
    
    <!-- OrbitControls (Global Build) -->
    <script src="https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js"></script>

    <script>
        // --- Configuration ---
        const CONFIG = {
            torusTubes: 0.8,
            tubularSegments: 40,
            radialSegments: 32,
            radius: 2,
            tubeRadius: 0.8,
            knotP: 5, // Twists
            knotQ: 6, // Turns
            colorSpeed: 0.001,
            animationDuration: 15 // seconds
        };

        // --- Scene Setup ---
        const scene = new THREE.Scene();
        
        // Fog for depth and atmosphere
        scene.fog = new THREE.FogExp2(0x050505, 0.04);
        scene.background = new THREE.Color(0x050505);

        // Camera
        const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
        camera.position.set(8, 5, 8);

        // Renderer (High Quality)
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.outputEncoding = THREE.sRGBEncoding;
        document.body.appendChild(renderer.domElement);

        // Controls
        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.autoRotate = false; // We will handle rotation manually for sync

        // --- Lighting System ---
        // Ambient light base level
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
        scene.add(ambientLight);

        // Point lights for dynamic color interaction
        const lights = [];
        
        // Light 1: Cyan/Blueish
        const light1 = new THREE.PointLight(0x00ffff, 2, 50);
        light1.position.set(-4, 3, -4);
        scene.add(light1);
        lights.push({ mesh: light1, color: 0x00ffff });

        // Light 2: Magenta/Pinkish
        const light2 = new THREE.PointLight(0xff00ff, 2, 50);
        light2.position.set(4, -3, 4);
        scene.add(light2);
        lights.push({ mesh: light2, color: 0xff00ff });

        // Light 3: Yellow/White (Filler)
        const light3 = new THREE.PointLight(0xffffaa, 1.5, 50);
        light3.position.set(0, 8, -4);
        scene.add(light3);
        lights.push({ mesh: light3, color: 0xffffee });

        // --- Main Object: Torus Knot ---
        const geometry = new THREE.TorusKnotGeometry(CONFIG.radius, CONFIG.tubeRadius, CONFIG.radialSegments, CONFIG.tubularSegments, CONFIG.knotP, CONFIG.knotQ);
        
        // Material using MeshPhysicalMaterial for realistic light interaction and fresnel effect
        const material = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            metalness: 0.1,
            roughness: 0.2,
            transmission: 0.9, // Glass-like transparency
            thickness: 2.0,
            clearcoat: 1.0,
            emissive: 0x000000,
            flatShading: false
        });

        const torusKnot = new THREE.Mesh(geometry, material);
        scene.add(torusKnot);

        // --- Particles System (Background) ---
        const particleCount = 800;
        const particlesGeometry = new THREE.BufferGeometry();
        const positions = [];
        const colors = [];

        for(let i=0; i<particleCount; i++) {
            // Spherical distribution
            const phi = Math.acos( -1 + ( 2 * i ) / particleCount );
            const theta = Math.sqrt( particleCount * Math.PI ) * phi;

            positions.push( 
                THREE.MathUtils.randFloatSpread(40), 
                THREE.MathUtils.randFloatSpread(40), 
                THREE.MathUtils.randFloatSpread(40)
            );

            // Random pastel colors for particles
            const color = new THREE.Color().setHSL(Math.random(), 0.7, 0.5);
            colors.push(color.r, color.g, color.b);
        }

        particlesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        particlesGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        const particlesMaterial = new THREE.PointsMaterial({
            size: 0.15,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });

        const particleSystem = new THREE.Points(particlesGeometry, particlesMaterial);
        scene.add(particleSystem);


        // --- Animation Loop ---
        let time = 0;
        
        function animate() {
            requestAnimationFrame(animate);

            time += CONFIG.colorSpeed;

            // 1. Rotate Torus Knot
            torusKnot.rotation.x = Math.sin(time * 0.5) + 0.2;
            torusKnot.rotation.y = Math.cos(time * 0.3) - 0.2;
            torusKnot.rotation.z = time * 0.1;

            // 2. Animate Lights (Orbit around the object)
            const radius = 6;
            lights.forEach((lightObj, index) => {
                lightObj.mesh.position.x = Math.cos(time + index) * radius;
                lightObj.mesh.position.y = Math.sin(time * 0.7 + index) * radius;
                lightObj.mesh.position.z = Math.sin(time * 0.3 + index) * radius;

                // Shift colors based on time for a "chasing rainbow" effect
                const hue = (time % 1); 
                lightObj.color.setHSL(hue, 0.8, 0.5);
            });

            // 3. Rotate Particles slowly
            particleSystem.rotation.y -= 0.02;
            particleSystem.position.x = Math.sin(time * 0.2) * 10;
            particleSystem.position.z = Math.cos(time * 0.2) * 10;

            // 4. Update Controls
            controls.update();

            renderer.render(scene, camera);
        }

        // --- Resize Handler ---
        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });

        // Cleanup loading text
        document.getElementById('loading').style.display = 'none';
        
        // Start
        animate();

    </script>
</body>
</html>