// Code 1: Basic Setup with Time-Based Color Cycling
import * as THREE from 'https://unpkg.com/three@0.158.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.158.0/examples/jsm/controls/OrbitControls.js';

function initCode1() {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Setup Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    camera.position.set(5, 5, 5);
    controls.update();

    // 1. Torus Knot Geometry (Wireframe)
    const knot = new THREE.TorusKnot(1.5, 0.4, 100, 100);
    const wireframeMaterial = new THREE.MeshBasicMaterial({ color: 0xcccccc, wireframe: true });
    const torusKnot = new THREE.Mesh(knot, wireframeMaterial);
    scene.add(torusKnot);

    // 2. Animated Lighting (Hemisphere Light + Directional)
    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 3);
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);

    // 3. Animation Loop
    let startTime = Date.now();
    function animate() {
        requestAnimationFrame(animate);

        // Rotation
        torusKnot.rotation.x += 0.005;
        torusKnot.rotation.y += 0.01;

        // Color Cycling (Changing the wireframe material color)
        const elapsed = (Date.now() - startTime) / 1000;
        const colorMix = (Math.sin(elapsed * 0.5) + 1) / 2 * 0.8 + 0.2; // 0.2 to 1.0
        const newColor = new THREE.Color().setHSL(elapsed * 0.01 + 0.3, 1, 0.5);
        wireframeMaterial.color.copy(newColor);

        // Animated Light Intensity (Flashing effect)
        const lightIntensity = 1 + Math.sin(elapsed * 1.5) * 0.5;
        directionalLight.intensity = lightIntensity;

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

initCode1();