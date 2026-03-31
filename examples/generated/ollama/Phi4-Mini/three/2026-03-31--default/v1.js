<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Three.js Rotating Wireframe Torus Knot</title>
    <style>
        body { margin: 0; }
        canvas {
            display: block;
        }
    </style>
</head>
<body>
<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js"></script>

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);

// Wireframe Torus Knot setup
const torusKnotGeometry = {
    params: { segments: 100, thickness: 10 },
    steps: 12,
};

const wireframeMaterial = new THREE.LineBasicMaterial({
    vertexColors: false,
});

const positions = [];
let angle;
for (let i = 0; i <= Math.PI * 2; i += 0.01) {
    const x = ((Math.cos(i / 4)) + 1).toFixed(3);
    const y = (((Math.sin(i * 5 / 6)) + 1).toFixed(3));
    positions.push(x, y, (i % Math.PI) - Math.PI/2)
    angle += 0.01;
}
const torusKnotGeometry = new THREE.BufferGeometry().setFromPoints(new Float32Array(positions.flat()));

const wireframeMesh = new THREE.LineCurveGeometry(torusKnotGeometry).toEdges();
wireframeMaterial.linewidth.value = 8;

const torusKnotObject = new THREE.ShapePath(wireframeMesh, { fillColor: null });
torusKnotObject.setAttribute('position', torusKnotGeometry);
scene.add(torusKnotObject);

// Animated Lighting
let lightIntensity = Math.sin(Date.now() * 0.001) + 1;
const directionalLight = new THREE.DirectionalLight(0xffffff, lightIntensity / 2)
directionalLight.position.set(-3, 5, 10).normalize();
scene.add(directionalLight);

camera.position.z = 25;

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    torusKnotObject.rotation.x += 0.01;
    torusKnotObject.rotation.y += 0.005;

    directionalLight.intensity.value *= Math.sin(Date.now() * 10) + lightIntensity / 2; // Fluctuating intensity for animation

    renderer.render(scene, camera);
}
animate();

// Handle window resize
window.addEventListener('resize', onWindowResize, false);

function onWindowResize(){
    const width = window.innerWidth;
    const height = window.innerHeight;

    while (renderer.domElement.parentNode){
        render();
    }
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
}

</script>
<canvas id="three-canvas"></canvas>

</body>
</html>