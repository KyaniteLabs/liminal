<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Three.js 3D Scene</title>
    <script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js"></script>
    <style>canvas{display:block;}</style>
</head>
<body>
<script>
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 10);

const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5,10,7);
scene.add(directionalLight);

// Torus Knot object
const geometry = new THREE.ParametricGeometry(
    (u,v) => {
        const t = u;
        return new THREE.Vector3(Math.sin(t)*Math.cos(v), Math.sin(t)*Math.sin(v), Math.cos(t));
    },
    16,
    8
);
const material = new THREE.MeshStandardMaterial({color:0x1a2b3c});
const torusKnot = new THREE.Mesh(geometry, material);
scene.add(torusKnot);

// Animation Loop
function animate() {
    requestAnimationFrame(animate);
    torusKnot.rotation.z += 0.01;
    directionalLight.position.y += 0.05;
    renderer.render(scene, camera);
}
animate();

// Orbit Controls
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Resize handling
window.addEventListener('resize', () => {
    const aspect = window.innerWidth / window.innerHeight;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

</script>
</body>
</html>