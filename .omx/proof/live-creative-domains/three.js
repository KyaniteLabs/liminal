const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111122);

const width = window.innerWidth;
const height = window.innerHeight;

const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(width, height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// Lights
const ambientLight = new THREE.AmbientLight(0x404050, 0.6);
scene.add(ambientLight);

const pointLight1 = new THREE.PointLight(0xff6644, 1.2, 20);
pointLight1.position.set(3, 3, 3);
scene.add(pointLight1);

const pointLight2 = new THREE.PointLight(0x4488ff, 1.0, 20);
pointLight2.position.set(-3, -2, 2);
scene.add(pointLight2);

// Cube with standard material for lighting response
const geometry = new THREE.BoxGeometry(1.6, 1.6, 1.6);
const material = new THREE.MeshStandardMaterial({
  color: 0xdd8844,
  metalness: 0.35,
  roughness: 0.45,
});
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

// Floor plane to show light interaction
const planeGeo = new THREE.PlaneGeometry(12, 12);
const planeMat = new THREE.MeshStandardMaterial({
  color: 0x222233,
  metalness: 0.15,
  roughness: 0.85,
});
const plane = new THREE.Mesh(planeGeo, planeMat);
plane.rotation.x = -Math.PI / 2;
plane.position.y = -1.8;
scene.add(plane);

let time = 0;
function animate() {
  requestAnimationFrame(animate);
  time += 0.01;

  // Rotate the cube
  cube.rotation.x += 0.008;
  cube.rotation.y += 0.012;

  // Animate lights in orbits
  pointLight1.position.x = Math.sin(time * 1.3) * 4;
  pointLight1.position.z = Math.cos(time * 1.3) * 4;
  pointLight1.position.y = Math.sin(time * 0.7) * 2 + 2;

  pointLight2.position.x = Math.cos(time * 0.9) * 3.5;
  pointLight2.position.z = Math.sin(time * 0.9) * 3.5;
  pointLight2.position.y = Math.cos(time * 1.1) * 1.5 - 1;

  // Gentle camera sway
  camera.position.x = Math.sin(time * 0.25) * 0.6;
  camera.position.y = Math.cos(time * 0.18) * 0.4;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
});
