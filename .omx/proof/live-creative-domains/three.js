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
const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0xffffff, 1.2);
pointLight.position.set(4, 4, 4);
scene.add(pointLight);

const pointLight2 = new THREE.PointLight(0xff6688, 0.9);
pointLight2.position.set(-3, -2, 3);
scene.add(pointLight2);

// Rotating cube
const cubeGeo = new THREE.BoxGeometry(1.8, 1.8, 1.8);
const cubeMat = new THREE.MeshStandardMaterial({
  color: 0x22aaff,
  metalness: 0.35,
  roughness: 0.45
});
const cube = new THREE.Mesh(cubeGeo, cubeMat);
scene.add(cube);

// Secondary sphere for lighting contrast
const sphereGeo = new THREE.SphereGeometry(0.55, 32, 32);
const sphereMat = new THREE.MeshStandardMaterial({
  color: 0xff8844,
  metalness: 0.7,
  roughness: 0.25
});
const sphere = new THREE.Mesh(sphereGeo, sphereMat);
sphere.position.set(-2.2, 1.2, -0.5);
scene.add(sphere);

// Ground plane to catch shadows
const planeGeo = new THREE.PlaneGeometry(12, 12);
const planeMat = new THREE.MeshStandardMaterial({
  color: 0x222233,
  roughness: 0.85,
  metalness: 0.05
});
const plane = new THREE.Mesh(planeGeo, planeMat);
plane.rotation.x = -Math.PI / 2;
plane.position.y = -1.8;
scene.add(plane);

renderer.shadowMap.enabled = true;
cube.castShadow = true;
sphere.castShadow = true;
plane.receiveShadow = true;
pointLight.castShadow = true;

let time = 0;

function animate() {
  requestAnimationFrame(animate);
  time += 0.01;

  // Rotate the cube
  cube.rotation.x += 0.008;
  cube.rotation.y += 0.012;

  // Orbit camera with sin/cos
  const camRadius = 5.5 + Math.sin(time * 0.4) * 1.2;
  camera.position.x = Math.sin(time * 0.3) * camRadius;
  camera.position.y = Math.cos(time * 0.22) * 2.0 + 1.5;
  camera.position.z = Math.cos(time * 0.3) * camRadius;
  camera.lookAt(0, 0, 0);

  // Animate lights
  pointLight.position.x = Math.sin(time * 0.7) * 5;
  pointLight.position.z = Math.cos(time * 0.7) * 5;
  pointLight2.position.y = Math.sin(time * 0.5) * 3;

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
