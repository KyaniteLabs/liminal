// Code 1: Standard setup with time-based color cycling and simple light animation
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

function setupScene1() {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    camera.position.set(5, 5, 5);
    controls.update();

    // Geometry: Torus Knot
    const radius = 1;
    const tube = 0.1;
    const geometry = new THREE.TorusKnotGeometry(radius, tube, 100, 16);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true });
    const knot = new THREE.Mesh(geometry, material);
    scene.add(knot);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x444444); // Soft ambient light
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 1, 100);
    pointLight.position.set(5, 10, 5);
    scene.add(pointLight);

    // Animation loop
    let startTime = Date.now();
    function animate() {
        requestAnimationFrame(animate);

        // Rotation
        knot.rotation.x += 0.005;
        knot.rotation.y += 0.01;

        // Color Change (Sine wave based on time)
        const time = (Date.now() - startTime) / 1000;
        const r = Math.sin(time * 0.5) * 0.5 + 0.5;
        const g = Math.sin(time * 0.5 + Math.PI * 2/3) * 0.5 + 0.5;
        const b = Math.sin(time * 0.5 + Math.PI * 4/3) * 0.5 + 0.5;
        material.color.set(r * 0xffffff, g * 0xffffff, b * 0xffffff);

        // Animated Light (Moving the point light)
        pointLight.position.x = Math.sin(time * 0.5) * 10;
        pointLight.position.z = Math.cos(time * 0.5) * 10;

        controls.update();
        renderer.render(scene, camera);
    }
    animate();
}

setupScene1();