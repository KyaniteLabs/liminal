const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111122);

const width = window.innerWidth;
const height = window.innerHeight;
const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
camera.position.z = 6;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(width, height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// Lights
const ambientLight = new THREE.AmbientLight(0x404060, 0.5);
scene.add(ambientLight);

const pointLight1 = new THREE.PointLight(0xff6644, 1.5, 50);
pointLight1.position.set(4, 4, 4);
scene.add(pointLight1);

const pointLight2 = new THREE.PointLight(0x4488ff, 1.2, 50);
pointLight2.position.set(-4, -3, 3);
scene.add(pointLight2);

const pointLight3 = new THREE.PointLight(0x44ff88, 0.8, 50);
pointLight3.position.set(0, 5, -4);
scene.add(pointLight3);

// Cube
const geo = new THREE.BoxGeometry(2, 2, 2, 4, 4, 4);
const mat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  metalness: 0.3,
  roughness: 0.4,
});
const mesh = new THREE.Mesh(geo, mat);
scene.add(mesh);

// Floor plane for light reflection
const floorGeo = new THREE.PlaneGeometry(20, 20);
const floorMat = new THREE.MeshStandardMaterial({
  color: 0x222233,
  metalness: 0.6,
  roughness: 0.3,
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -2.5;
scene.add(floor);

let time = 0;

function animate() {
  requestAnimationFrame(animate);
  time += 0.01;

  mesh.rotation.x += 0.008;
  mesh.rotation.y += 0.012;

  // Animate lights in orbits
  pointLight1.position.x = Math.sin(time * 0.7) * 5;
  pointLight1.position.z = Math.cos(time * 0.7) * 5;

  pointLight2.position.x = Math.cos(time * 0.5) * 4;
  pointLight2.position.y = Math.sin(time * 0.8) * 3 + 1;

  // Gentle camera sway
  camera.position.x = Math.sin(time * 0.2) * 0.8;
  camera.position.y = Math.cos(time * 0.15) * 0.5;
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
