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

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
directionalLight.position.set(3, 4, 5);
scene.add(directionalLight);

const pointLight = new THREE.PointLight(0xff6644, 1.2, 20);
pointLight.position.set(-3, -2, 3);
scene.add(pointLight);

// Cube with standard material for lighting response
const geometry = new THREE.BoxGeometry(1.8, 1.8, 1.8);
const material = new THREE.MeshStandardMaterial({
  color: 0x22aaff,
  metalness: 0.4,
  roughness: 0.35
});
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

// Floor plane to show lighting
const floorGeo = new THREE.PlaneGeometry(12, 12);
const floorMat = new THREE.MeshStandardMaterial({
  color: 0x333344,
  metalness: 0.2,
  roughness: 0.7
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -1.6;
scene.add(floor);

// Animation
let time = 0;
function animate() {
  requestAnimationFrame(animate);
  time += 0.01;

  // Rotate the cube
  cube.rotation.x += 0.008;
  cube.rotation.y += 0.012;

  // Animate camera orbit with sin/cos
  const camRadius = 5;
  camera.position.x = Math.sin(time * 0.5) * camRadius * 0.4;
  camera.position.y = Math.cos(time * 0.3) * 2 + 1;
  camera.lookAt(0, 0, 0);

  // Animate point light position
  pointLight.position.x = Math.sin(time) * 4;
  pointLight.position.z = Math.cos(time) * 4;

  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
