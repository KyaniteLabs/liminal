const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

const width = window.innerWidth;
const height = window.innerHeight;
const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(width, height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// Lights
const ambientLight = new THREE.AmbientLight(0x404060, 0.5);
scene.add(ambientLight);

const pointLight1 = new THREE.PointLight(0xff6b6b, 1.5, 20);
pointLight1.position.set(3, 3, 4);
scene.add(pointLight1);

const pointLight2 = new THREE.PointLight(0x4ecdc4, 1.2, 20);
pointLight2.position.set(-3, -2, 3);
scene.add(pointLight2);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
dirLight.position.set(2, 4, 6);
scene.add(dirLight);

// Cube with standard material for lighting response
const geometry = new THREE.BoxGeometry(1.8, 1.8, 1.8);
const material = new THREE.MeshStandardMaterial({
  color: 0xe056fd,
  metalness: 0.3,
  roughness: 0.4
});
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

// Floor plane to show light interaction
const floorGeo = new THREE.PlaneGeometry(12, 12);
const floorMat = new THREE.MeshStandardMaterial({
  color: 0x16213e,
  metalness: 0.1,
  roughness: 0.85
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -2;
scene.add(floor);

let time = 0;

function animate() {
  requestAnimationFrame(animate);
  time += 0.01;

  // Rotate cube
  cube.rotation.x += 0.008;
  cube.rotation.y += 0.012;

  // Animate lights in orbits
  pointLight1.position.x = Math.sin(time * 0.7) * 4;
  pointLight1.position.z = Math.cos(time * 0.7) * 4 + 2;

  pointLight2.position.x = Math.cos(time * 0.5) * 3.5;
  pointLight2.position.y = Math.sin(time * 0.9) * 2 - 1;

  // Gentle camera sway
  camera.position.x = Math.sin(time * 0.15) * 0.6;
  camera.position.y = Math.cos(time * 0.12) * 0.4;
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
