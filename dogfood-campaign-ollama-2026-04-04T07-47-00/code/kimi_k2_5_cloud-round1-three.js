// Code 1: Scene Setup and Wireframe Torus Knot Generation
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// Camera setup
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// 1. Create the Torus Knot Geometry
const radius = 1;
const tube = 0.15;
const segments = 100;

// The knot structure (a torus knot)
const knot = new THREE.TorusKnotGeometry(radius, tube, 100, 20);

// 2. Create the Wireframe Material
// We use LineSegments to draw the edges of the geometry
const wireframeMaterial = new THREE.MeshBasicMaterial({
    color: 0xcccccc,
    wireframe: true,
    transparent: true,
    opacity: 0.8
});

// Create the object
const knotMesh = new THREE.Mesh(knot, wireframeMaterial);
scene.add(knotMesh);

// Controls and Animation Loop (Placeholder for the next codes)
const controls = new OrbitControls(camera, renderer.domElement);
controls.update();

function animate() {
    requestAnimationFrame(animate);

    // Basic rotation (will be enhanced in subsequent codes)
    knotMesh.rotation.y += 0.005;
    knotMesh.rotation.x += 0.001;

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.viewport = new THREE.Vector2(window.innerWidth, window.innerHeight);
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();