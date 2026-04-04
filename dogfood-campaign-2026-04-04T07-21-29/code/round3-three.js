<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Wireframe Torus Knot 1</title>
<style>body{margin:0;overflow:hidden;background:#000}</style>
</head>
<body>
<script type="importmap">
{
  "imports": {
    "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
    "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
  }
}
</script>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(0, 0, 5);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const geometry = new THREE.TorusKnotGeometry(1.5, 0.4, 100, 16);
const material = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
const knot = new THREE.Mesh(geometry, material);
scene.add(knot);

const light = new THREE.PointLight(0xff00ff, 2, 20);
scene.add(light);
const ambient = new THREE.AmbientLight(0x404040, 0.5);
scene.add(ambient);

function animate(time) {
  requestAnimationFrame(animate);
  const t = time * 0.001;
  knot.rotation.x += 0.01;
  knot.rotation.y += 0.01;
  material.color.setHSL((t % 1), 1, 0.5);
  light.position.set(Math.sin(t * 2) * 4, Math.cos(t * 2) * 4, Math.sin(t * 1.5) * 3);
  controls.update();
  renderer.render(scene, camera);
}
animate(0);
</script>
</body>
</html>