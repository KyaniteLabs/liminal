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

const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
keyLight.position.set(5, 5, 5);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x4488ff, 0.6);
fillLight.position.set(-4, -2, -3);
scene.add(fillLight);

const pointLight = new THREE.PointLight(0xff6644, 1, 20);
pointLight.position.set(3, 2, 2);
scene.add(pointLight);

// Cube with standard material for lighting response
const geometry = new THREE.BoxGeometry(2, 2, 2);
const material = new THREE.MeshStandardMaterial({
  color: 0x22aacc,
  metalness: 0.3,
  roughness: 0.4
});
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

// Floor plane to catch shadows and show light interaction
const floorGeo = new THREE.PlaneGeometry(20, 20);
const floorMat = new THREE.MeshStandardMaterial({
  color: 0x222233,
  metalness: 0.1,
  roughness: 0.9
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -2;
scene.add(floor);

// Small orbiting sphere for extra visual interest
const sphereGeo = new THREE.SphereGeometry(0.3, 16, 16);
const sphereMat = new THREE.MeshStandardMaterial({
  color: 0xff4466,
  emissive: 0x441122,
  metalness: 0.6,
  roughness: 0.2
});
const orbiter = new THREE.Mesh(sphereGeo, sphereMat);
scene.add(orbiter);

let time = 0;

function animate() {
  requestAnimationFrame(animate);
  time += 0.01;

  // Rotate the main cube
  cube.rotation.x += 0.008;
  cube.rotation.y += 0.012;

  // Orbit the small sphere around the cube
  const orbitRadius = 2.8;
  orbiter.position.x = Math.cos(time * 1.5) * orbitRadius;
  orbiter.position.y = Math.sin(time * 0.8) * 0.8;
  orbiter.position.z = Math.sin(time * 1.5) * orbitRadius;

  // Animate camera position slightly
  camera.position.x = Math.sin(time * 0.3) * 0.8;
  camera.position.y = Math.cos(time * 0.2) * 0.5;
  camera.lookAt(0, 0, 0);

  // Animate point light position
  pointLight.position.x = Math.sin(time) * 4;
  pointLight.position.z = Math.cos(time) * 4;

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
