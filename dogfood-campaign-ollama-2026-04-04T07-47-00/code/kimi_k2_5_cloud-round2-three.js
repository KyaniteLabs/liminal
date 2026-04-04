// Code 1: Standard Setup with Dedicated Animation Loop
import * as THREE from 'https://unpkg.com/three@0.158.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.158.0/examples/jsm/controls/OrbitControls.js';

function initScene1() {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    scene.background = new THREE.Color(0x111122);

    // 1. Torus Knot Geometry (using Catmull-Rom or custom curve approximation for simplicity)
    const tubeRadius = 2;
    const numSegments = 100;
    const geometry = new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
            new THREE.Vector3(-5, 0, 0),
            new THREE.Vector3( 0, 5, 0),
            new THREE.Vector3( 5, 0, 5),
            new THREE.Vector3(-5, 0, -5)
        ]), 100, tubeRadius, 64, false
    );

    // 2. Color-Changing Material
    const material1 = new THREE.MeshBasicMaterial({
        vertexColors: true,
        wireframe: true
    });
    const torusKnot = new THREE.Mesh(geometry, material1);
    scene.add(torusKnot);

    // 3. Lighting (Animated)
    const ambientLight = new THREE.AmbientLight(0x4444aa, 1);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 1, 50);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);

    // 4. Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    camera.position.set(0, 5, 10);
    controls.update();

    // Animation Loop
    function animate() {
        requestAnimationFrame(animate);

        // Rotation
        torusKnot.rotation.x += 0.005;
        torusKnot.rotation.y += 0.008;

        // Color Change (via material color if using standard mesh, or by manipulating point light color)
        pointLight.color.setHSL(Math.sin(Date.now() * 0.001) * 0.5 + 0.5, 1, 1);
        
        controls.update();
        renderer.render(scene, camera);
    }

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    animate();
}

initScene1();