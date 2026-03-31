<!DOCTYPE html>
<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js"></script>
<style>
body { margin: 0; overflow: hidden; }
</style>
<script>
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({antialias: true});
document.body.appendChild(renderer.domElement);
const controls = new THREE.OrbitControls(camera, renderer.domElement);
const ambientLight = new THREE.AmbientLight('ambient', 0xffffff);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
const materials = [];
const colors = ['#ff0000', '#00ff00', '#0000ff', '#ff00ff', '#00ffff'];
const angles = [];
const animationFrame = [];
const renderLoop = () => {
  requestAnimationFrame(renderLoop);
  colors.forEach((color, i) => {
    materials[i] = new THREE.MeshStandardMaterial({ color: color });
  });
  // Simulate color change
  const time = Date.now();
  const interval = 1000 / 60;
  const t = time % interval;
  colors[t % colors.length] = color;
  // Rotate object
  const rot = [0, 0, 0];
  rot.x += 0.1 * angles[t];
  rot.z += 0.2 * angles[t];
  // ... more rotation logic
};
renderLoop();
</script>
</body>
</html>