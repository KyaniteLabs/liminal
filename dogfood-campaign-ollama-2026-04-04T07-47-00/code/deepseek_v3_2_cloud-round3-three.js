// Code 1: Standard setup with Perlin Noise color change and Ambient/Directional lighting
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

function initScene1() {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000011, 1);
    document.body.appendChild(renderer.domElement);

    // --- Controls and Lighting ---
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    camera.position.set(5, 5, 5);
    controls.update();

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(5, 10, 7);
    scene.add(directionalLight);

    // --- Torus Knot Geometry ---
    const knotGeometry = new THREE.TorusKnotGeometry(2, 0.5, 100, 16);
    const material = new THREE.MeshBasicMaterial({
        color: 0x66ff00,
        wireframe: true
    });
    const knot = new THREE.Mesh(knotGeometry, material);
    scene.add(knot);

    // --- Animation Loop Variables ---
    let startTime = Date.now();

    function animate() {
        requestAnimationFrame(animate);

        const elapsed = (Date.now() - startTime) / 1000;

        // Rotation
        knot.rotation.x += 0.005;
        knot.rotation.y += 0.01;

        // Color Change (using time-based sine wave)
        const r = Math.sin(elapsed * 0.5) * 0.5 + 0.5;
        const g = Math.sin(elapsed * 0.5 + Math.PI * 2 / 3) * 0.5 + 0.5;
        const b = Math.sin(elapsed * 0.5 + Math.PI * 4 / 3) * 0.5 + 0.5;
        knot.material.color.set(r * 0xffffff, g * 0xffffff, b * 0xffffff);
        
        // Animated Lighting (pulsing intensity)
        directionalLight.intensity = 1.5 + Math.sin(elapsed * 1.5) * 0.5;

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