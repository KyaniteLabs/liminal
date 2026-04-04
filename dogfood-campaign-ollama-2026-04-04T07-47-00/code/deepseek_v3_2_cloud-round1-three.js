// 1. SETUP AND INITIALIZATION
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// Camera setup
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(5, 5, 10);

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.update();

// --- Torus Knot Creation ---
const geometry = new THREE.TorusKnotGeometry(1, 0.3, 100, 16);
// Using a LineBasicMaterial for the wireframe effect
const material = new THREE.LineBasicMaterial({ 
    linewidth: 2, 
    vertexColors: true // Important for color changing
});
const knot = new THREE.LineSegments(geometry, material);
scene.add(knot);

// --- Lighting Setup ---
// Ambient light for overall visibility
const ambientLight = new THREE.AmbientLight(0x333333); 
scene.add(ambientLight);

// Animated directional light (the main light source)
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

// Handle window resizing
window.addEventListener('resize', () => {
    camera.viewport = new THREE.Vector2(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});