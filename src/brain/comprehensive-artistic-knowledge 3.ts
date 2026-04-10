/**
 * Comprehensive artistic knowledge data for ArtKnowledgeGraph
 *
 * This file contains extensive artistic techniques, movements, artists, and principles
 * organized by domain (p5, shader, three, music, hydra, strudel) to make Liminal
 * a well-rounded artistic creative tool.
 */

export interface ArtisticConcept {
  name: string;
  type: 'movement' | 'technique' | 'artist' | 'principle' | 'color' | 'composition' | 'domain';
  domain?: 'p5' | 'shader' | 'three' | 'music' | 'hydra' | 'strudel' | 'tone';
  description: string;
  keywords: string[];
  related?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Comprehensive artistic techniques by domain
 */
export const ARTISTIC_TECHNIQUES: Record<string, ArtisticConcept[]> = {
  // P5.JS TECHNIQUES
  p5: [
    {
      name: 'Coordinate Systems',
      type: 'technique',
      domain: 'p5',
      description: 'Working with translate(), rotate(), scale() for 2D/3D transformations',
      keywords: ['transform', 'matrix', 'push', 'pop', 'coordinate', 'space']
    },
    {
      name: 'Shape Primitives',
      type: 'technique',
      domain: 'p5',
      description: 'Basic and advanced shapes: point, line, triangle, rect, quad, ellipse, arc, beginShape, vertex',
      keywords: ['shape', 'primitive', 'drawing', 'geometry', 'polygon']
    },
    {
      name: 'Color Modes',
      type: 'technique',
      domain: 'p5',
      description: 'HSB vs RGB, color(), background(), fill(), stroke(), alpha transparency',
      keywords: ['color', 'hsb', 'rgb', 'fill', 'stroke', 'alpha', 'transparency']
    },
    {
      name: 'Perlin Noise',
      type: 'technique',
      domain: 'p5',
      description: 'noise() for organic randomness, smooth gradients, natural textures',
      keywords: ['noise', 'perlin', 'random', 'organic', 'smooth', 'texture']
    },
    {
      name: 'Animation Basics',
      type: 'technique',
      domain: 'p5',
      description: 'draw() loop, frameCount, frameRate, millis(), deltaTime for smooth animation',
      keywords: ['animation', 'loop', 'timing', 'frame', 'smooth']
    },
    {
      name: 'Interaction Events',
      type: 'technique',
      domain: 'p5',
      description: 'mousePressed, keyPressed, touchStarted, mouseDragged, mouseWheel, mouseMoved',
      keywords: ['mouse', 'keyboard', 'touch', 'interaction', 'event']
    },
    {
      name: 'Image Processing',
      type: 'technique',
      domain: 'p5',
      description: 'loadPixel, updatePixel, get(), set(), blend modes, filters, convolution',
      keywords: ['pixel', 'image', 'filter', 'blend', 'convolution', 'manipulation']
    },
    {
      name: 'Typography',
      type: 'technique',
      domain: 'p5',
      description: 'text(), textSize(), textAlign(), textFont(), textWidth(), textLeading, textAscent',
      keywords: ['text', 'font', 'typography', 'lettering']
    },
    {
      name: 'WebGL Mode',
      type: 'technique',
      domain: 'p5',
      description: 'WEBGL mode, createCanvas, drawing in 3D space, lighting, materials',
      keywords: ['webgl', '3d', 'lighting', 'material', 'renderer']
    },
    {
      name: 'Sound Synthesis',
      type: 'technique',
      domain: 'p5',
      description: 'p5.Oscillator, p5.Envelope, p5.SoundFile, p5.Amplitude, p5.FFT',
      keywords: ['sound', 'audio', 'oscillator', 'envelope', 'synthesis', 'fft']
    },
    {
      name: 'Camera Control',
      type: 'technique',
      domain: 'p5',
      description: 'createCamera, camera(), orbitControl, perspective, ortho, frustum',
      keywords: ['camera', 'perspective', 'view', 'control', 'orbit']
    },
    {
      name: 'Particle Systems',
      type: 'technique',
      domain: 'p5',
      description: 'Arrays of particle objects with position, velocity, acceleration, lifespan, physics',
      keywords: ['particle', 'system', 'physics', 'array', 'life', 'death']
    },
    {
      name: 'Flow Field',
      type: 'technique',
      domain: 'p5',
      description: 'Perlin noise vector field, particle following noise gradients, organic movement',
      keywords: ['flow', 'field', 'noise', 'vector', 'gradient', 'organic']
    },
    {
      name: 'Cellular Automata',
      type: 'technique',
      domain: 'p5',
      description: 'Game of Life, 1D/2D CA rules, neighbor counting, grid-based evolution',
      keywords: ['cellular', 'automata', 'game of life', 'grid', 'neighbor', 'evolution']
    },
    {
      name: 'L-Systems',
      type: 'technique',
      domain: 'p5',
      description: 'Lindenmayer systems, string rewriting, turtle graphics, fractal plants',
      keywords: ['l-system', 'fractal', 'plant', 'turtle', 'rewriting']
    },
    {
      name: 'Recursive Patterns',
      type: 'technique',
      domain: 'p5',
      description: 'Recursive functions, fractal trees, Sierpinski triangle, Koch snowflake',
      keywords: ['recursive', 'fractal', 'tree', 'triangle', 'snowflake']
    },
    {
      name: 'Physics Simulation',
      type: 'technique',
      domain: 'p5',
      description: 'Verlet integration, spring-mass, collision detection, gravity, forces',
      keywords: ['physics', 'verlet', 'spring', 'collision', 'gravity', 'force']
    },
    {
      name: 'Data Visualization',
      type: 'technique',
      domain: 'p5',
      description: 'Maps, charts, graphs, data mapping, interactive visualization',
      keywords: ['data', 'visualization', 'chart', 'graph', 'map', 'interactive']
    },
    {
      name: 'Procedural Terrain',
      type: 'technique',
      domain: 'p5',
      description: 'Noise-based heightmaps, diamond-square algorithm, mesh generation',
      keywords: ['terrain', 'heightmap', 'noise', 'mesh', 'procedural', 'landscape']
    },
    {
      name: 'Interactive Typography',
      type: 'technique',
      domain: 'p5',
      description: 'Text that responds to mouse, keyboard, or audio, kinetic typography',
      keywords: ['typography', 'interactive', 'kinetic', 'text', 'response']
    },
    {
      name: 'Generative Text',
      type: 'technique',
      domain: 'p5',
      description: 'RiTa library, word associations, Markov chains, grammar-based generation',
      keywords: ['generative', 'text', 'rita', 'markov', 'grammar', 'language']
    },
    {
      name: 'Shader Integration',
      type: 'technique',
      domain: 'p5',
      description: 'loadShader, createShader, setUniform, passing p5 variables to shaders',
      keywords: ['shader', 'uniform', 'glsl', 'webgl', 'integration']
    },
    {
      name: 'DOM Manipulation',
      type: 'technique',
      domain: 'p5',
      description: 'createP, createDiv, createButton, createSlider, createSelect, positioning',
      keywords: ['dom', 'html', 'element', 'button', 'slider', 'interface']
    },
    {
      name: 'Video Processing',
      type: 'technique',
      domain: 'p5',
      description: 'createCapture, video, createVideo, pixel manipulation, computer vision',
      keywords: ['video', 'capture', 'camera', 'pixel', 'vision', 'processing']
    },
    {
      name: 'Pixel Array Manipulation',
      type: 'technique',
      domain: 'p5',
      description: 'pixels[], accessing and modifying pixel data directly for image effects',
      keywords: ['pixel', 'array', 'direct', 'manipulation', 'effect']
    },
    {
      name: 'Object-Oriented Design',
      type: 'technique',
      domain: 'p5',
      description: 'Classes for agents, particles, entities with methods and properties',
      keywords: ['oop', 'class', 'object', 'agent', 'entity', 'design']
    },
    {
      name: 'Instancing Geometry',
      type: 'technique',
      domain: 'p5',
      description: 'Drawing thousands of identical objects efficiently with geometry batching',
      keywords: ['instancing', 'batch', 'performance', 'thousands', 'geometry']
    },
    {
      name: 'Offscreen Graphics',
      type: 'technique',
      domain: 'p5',
      description: 'createGraphics, drawing to buffer, compositing, multi-pass rendering',
      keywords: ['offscreen', 'buffer', 'graphics', 'composite', 'multi-pass']
    },
    {
      name: 'Blend Modes',
      type: 'technique',
      domain: 'p5',
      description: 'ADD, SUBTRACT, LIGHTEST, DARKEST, DIFFERENCE, MULTIPLY, SCREEN',
      keywords: ['blend', 'mode', 'composite', 'add', 'subtract', 'multiply']
    },
    {
      name: 'Masking and Clipping',
      type: 'technique',
      domain: 'p5',
      description: 'mask(), createMask, clipping regions, selective drawing',
      keywords: ['mask', 'clip', 'region', 'selective', 'area']
    },
  ],

  // SHADER/GLSL TECHNIQUES
  shader: [
    {
      name: 'Raymarching',
      type: 'technique',
      domain: 'shader',
      description: 'SDF rendering, sphere tracing, soft shadows, ambient occlusion',
      keywords: ['raymarching', 'sdf', 'sphere', 'tracing', 'shadow', 'ao']
    },
    {
      name: 'Signed Distance Functions',
      type: 'technique',
      domain: 'shader',
      description: 'Basic SDFs (sphere, box, cylinder, torus), boolean operations (union, intersection, subtraction)',
      keywords: ['sdf', 'distance', 'function', 'boolean', 'union', 'intersect', 'subtract']
    },
    {
      name: 'Noise Functions',
      type: 'technique',
      domain: 'shader',
      description: 'Perlin, Simplex, Worley, Value noise, fbm, domain warping',
      keywords: ['noise', 'perlin', 'simplex', 'worley', 'fbm', 'warp']
    },
    {
      name: 'Fractal Brownian Motion',
      type: 'technique',
      domain: 'shader',
      description: 'Octave layering of noise for detail accumulation and texture generation',
      keywords: ['fbm', 'fractal', 'brownian', 'octave', 'noise', 'detail']
    },
    {
      name: 'Domain Warping',
      type: 'technique',
      domain: 'shader',
      description: 'Distorting coordinate space with noise for organic patterns',
      keywords: ['warp', 'domain', 'fbm', 'distortion', 'organic', 'space']
    },
    {
      name: 'Trigonometric Palettes',
      type: 'technique',
      domain: 'shader',
      description: 'cos() based palette generation, cosine palette, IQ palettes',
      keywords: ['palette', 'cosine', 'iq', 'color', 'gradient', 'shadertoy']
    },
    {
      name: 'Post-Processing',
      type: 'technique',
      domain: 'shader',
      description: 'Bloom, vignette, chromatic aberration, film grain, color grading',
      keywords: ['bloom', 'vignette', 'aberration', 'grain', 'grading', 'post']
    },
    {
      name: 'Normal Mapping',
      type: 'technique',
      domain: 'shader',
      description: 'Surface detail without geometry, bump maps, normal calculation',
      keywords: ['normal', 'bump', 'mapping', 'surface', 'detail']
    },
    {
      name: 'Reflection and Refraction',
      type: 'technique',
      domain: 'shader',
      description: 'Fresnel effect, Snell\'s law, environment mapping, cube mapping',
      keywords: ['reflection', 'refraction', 'fresnel', 'snell', 'environment']
    },
    {
      name: 'Procedural Patterns',
      type: 'technique',
      domain: 'shader',
      description: 'Bricks, tiles, wood grain, marble, clouds, water, fire, smoke',
      keywords: ['procedural', 'pattern', 'texture', 'brick', 'wood', 'marble']
    },
    {
      name: 'Voronoi Diagrams',
      type: 'technique',
      domain: 'shader',
      description: 'Worley noise, cellular patterns, distance-based regions',
      keywords: ['voronoi', 'worley', 'cellular', 'distance', 'region']
    },
    {
      name: 'GPGPU Techniques',
      type: 'technique',
      domain: 'shader',
      description: 'Compute shaders, parallel processing, ping-pong buffers, simulation',
      keywords: ['gpgpu', 'compute', 'parallel', 'simulation', 'buffer']
    },
    {
      name: 'SDF Primitives',
      type: 'technique',
      domain: 'shader',
      description: 'Sphere, box, cylinder, torus, cone, ellipsoid, capsule, intersection, union',
      keywords: ['sdf', 'primitive', 'shape', 'geometry', 'basic']
    },
    {
      name: 'SDF Operations',
      type: 'technique',
      domain: 'shader',
      description: 'Smooth minimum, elongation, repetition, displacement, revolution',
      keywords: ['smooth', 'min', 'elongate', 'repeat', 'displace', 'revolve']
    },
    {
      name: 'Soft Shadows',
      type: 'technique',
      domain: 'shader',
      description: 'Soft shadow mapping, ray-traced soft shadows, area light sources',
      keywords: ['shadow', 'soft', 'area', 'light', 'tracing']
    },
    {
      name: 'Ambient Occlusion',
      type: 'technique',
      domain: 'shader',
      description: 'SSAO, bent normals, cavity, dirt, ambient occlusion techniques',
      keywords: ['ao', 'ambient', 'occlusion', 'ssao', 'cavity', 'dirt']
    },
    {
      name: 'Color Grading',
      type: 'technique',
      domain: 'shader',
      description: 'Color correction, curves, levels, saturation, contrast, film look',
      keywords: ['color', 'grading', 'curve', 'level', 'saturation', 'contrast']
    },
    {
      name: 'Animation Techniques',
      type: 'technique',
      domain: 'shader',
      description: 'Uniform time, vertex displacement, texture animation, procedural animation',
      keywords: ['animation', 'time', 'displacement', 'procedural', 'uniform']
    },
    {
      name: 'Anti-aliasing',
      type: 'technique',
      domain: 'shader',
      description: 'FXAA, MSAA, supersampling, edge detection, smooth outlines',
      keywords: ['aa', 'anti-aliasing', 'fxaa', 'msaa', 'supersample']
    },
    {
      name: 'Lighting Models',
      type: 'technique',
      domain: 'shader',
      description: 'Phong, Blinn-Phong, PBR, Lambert, Oren-Nayar, Toon shading',
      keywords: ['lighting', 'phong', 'pbr', 'lambert', 'toon', 'model']
    },
  ],

  // THREE.JS TECHNIQUES
  three: [
    {
      name: 'Scene Graph',
      type: 'technique',
      domain: 'three',
      description: 'Scene, Group, Object3D hierarchy, parent-child relationships',
      keywords: ['scene', 'graph', 'group', 'hierarchy', 'parent', 'child']
    },
    {
      name: 'Geometries',
      type: 'technique',
      domain: 'three',
      description: 'BoxGeometry, SphereGeometry, CylinderGeometry, TorusKnot, extrude shapes',
      keywords: ['geometry', 'primitive', 'shape', 'box', 'sphere', 'cylinder']
    },
    {
      name: 'Materials',
      type: 'technique',
      domain: 'three',
      description: 'MeshBasicMaterial, MeshStandardMaterial, MeshPhysicalMaterial, ShaderMaterial',
      keywords: ['material', 'basic', 'standard', 'physical', 'shader', 'pbr']
    },
    {
      name: 'Lighting',
      type: 'technique',
      domain: 'three',
      description: 'AmbientLight, DirectionalLight, PointLight, SpotLight, RectAreaLight, HemisphereLight',
      keywords: ['light', 'ambient', 'directional', 'point', 'spot', 'area']
    },
    {
      name: 'Cameras',
      type: 'technique',
      domain: 'three',
      description: 'PerspectiveCamera, OrthographicCamera, CubeCamera, controls (OrbitControls, MapControls)',
      keywords: ['camera', 'perspective', 'ortho', 'orbit', 'controls', 'view']
    },
    {
      name: 'Loaders',
      type: 'technique',
      domain: 'three',
      description: 'GLTFLoader, OBJLoader, TextureLoader, FontLoader, DRACOLoader for compressed models',
      keywords: ['loader', 'gltf', 'obj', 'model', 'texture', 'compress']
    },
    {
      name: 'Animation System',
      type: 'technique',
      domain: 'three',
      description: 'AnimationClip, AnimationMixer, keyframe animation, skeletal animation, morph targets',
      keywords: ['animation', 'clip', 'mixer', 'keyframe', 'skeletal', 'morph']
    },
    {
      name: 'Post-Processing',
      type: 'technique',
      domain: 'three',
      description: 'EffectComposer, RenderPass, UnrealBloomPass, SSAOPass, shaders as passes',
      keywords: ['post', 'processing', 'composer', 'bloom', 'ssao', 'pass']
    },
    {
      name: 'InstancedMesh',
      type: 'technique',
      domain: 'three',
      description: 'Drawing thousands of identical objects with single draw call',
      keywords: ['instanced', 'mesh', 'thousands', 'performance', 'batch']
    },
    {
      name: 'LOD (Level of Detail)',
      type: 'technique',
      domain: 'three',
      description: 'Switching geometry based on distance, LOD object, detail optimization',
      keywords: ['lod', 'detail', 'distance', 'optimization', 'level']
    },
    {
      name: 'Physics Integration',
      type: 'technique',
      domain: 'three',
      description: 'Cannon.js, Ammo.js, physics bodies, constraints, simulation',
      keywords: ['physics', 'cannon', 'ammo', 'body', 'constraint', 'simulation']
    },
    {
      name: 'Particles',
      type: 'technique',
      domain: 'three',
      description: 'Points, PointsMaterial, BufferGeometry, particle systems, GPU particles',
      keywords: ['particle', 'points', 'buffer', 'geometry', 'system']
    },
    {
      name: 'Environment Mapping',
      type: 'technique',
      domain: 'three',
      description: 'CubeCamera, envMap, CubeTexture, reflection, refraction',
      keywords: ['environment', 'cube', 'map', 'reflection', 'refraction']
    },
    {
      name: 'Skeletons and Skinning',
      type: 'technique',
      domain: 'three',
      description: 'Bone, skeleton, skinning, vertex animation, armature',
      keywords: ['skeleton', 'bone', 'skinning', 'vertex', 'armature']
    },
    {
      name: 'Morph Targets',
      type: 'technique',
      domain: 'three',
      description: 'Blend shapes, facial animation, expression targets',
      keywords: ['morph', 'target', 'blend', 'shape', 'facial', 'expression']
    },
    {
      name: 'Decals',
      type: 'technique',
      domain: 'three',
      description: 'DecalGeometry, projected textures, graffiti, surface detail',
      keywords: ['decal', 'projected', 'texture', 'graffiti', 'surface']
    },
    {
      name: 'Texture Atlasing',
      type: 'technique',
      domain: 'three',
      description: 'Combining textures into one atlas, UV layout, draw call optimization',
      keywords: ['atlas', 'texture', 'uv', 'optimization', 'batch']
    },
    {
      name: 'Transform Controls',
      type: 'technique',
      domain: 'three',
      description: 'TransformControls, gizmo, interactive manipulation in editor',
      keywords: ['transform', 'control', 'gizmo', 'editor', 'manipulation']
    },
    {
      name: 'Raycasting',
      type: 'technique',
      domain: 'three',
      description: 'Raycaster, intersection testing, mouse picking, hit testing',
      keywords: ['raycast', 'intersection', 'mouse', 'pick', 'hit']
    },
    {
      name: 'Shadow Mapping',
      type: 'technique',
      domain: 'three',
      description: 'ShadowMap, PCFSoftShadowMap, cascading shadows, light shadows',
      keywords: ['shadow', 'pcf', 'cascade', 'light', 'mapping']
    },
    {
      name: 'Transparency and Alpha',
      type: 'technique',
      domain: 'three',
      description: 'Transparent objects, depthWrite, depthTest, alpha maps, fade effects',
      keywords: ['transparent', 'alpha', 'fade', 'depth', 'opacity']
    },
    {
      name: 'Custom Shaders',
      type: 'technique',
      domain: 'three',
      description: 'ShaderMaterial, onBeforeCompile, uniforms, vertex/fragment shaders',
      keywords: ['shader', 'custom', 'uniform', 'vertex', 'fragment']
    },
    {
      name: 'Video Textures',
      type: 'technique',
      domain: 'three',
      description: 'VideoTexture, playing video on surfaces, webcam integration',
      keywords: ['video', 'texture', 'webcam', 'camera', 'media']
    },
    {
      name: 'Audio Integration',
      type: 'technique',
      domain: 'three',
      description: 'PositionalAudio, AudioListener, audio spatialization, sync visuals to audio',
      keywords: ['audio', 'positional', 'spatial', 'sync', 'music', 'sound']
    },
    {
      name: 'VR and AR',
      type: 'technique',
      domain: 'three',
      description: 'WebXR, VRStereoEffect, AR, controller interaction, immersive experience',
      keywords: ['vr', 'ar', 'webxr', 'immersive', 'controller', 'stereo']
    },
  ],

  // MUSIC (STRUDEL) TECHNIQUES
  strudel: [
    {
      name: 'Pattern Sequencing',
      type: 'technique',
      domain: 'strudel',
      description: 'stack, cycle, cat, choose, min, max for pattern-based music generation',
      keywords: ['pattern', 'sequence', 'stack', 'cycle', 'cat', 'choose']
    },
    {
      name: 'Temporal Modulation',
      type: 'technique',
      domain: 'strudel',
      description: '<. slow, <. fast, room, pan, shape, gain, ctz for real-time modulation',
      keywords: ['modulation', 'slow', 'fast', 'room', 'pan', 'shape', 'gain']
    },
    {
      name: 'Stack-based Composition',
      type: 'technique',
      domain: 'strudel',
      description: 'Layering sounds with stack, note, s, sound, percolation',
      keywords: ['stack', 'layer', 'note', 'sound', 'voice', 'percolation']
    },
    {
      name: 'Rhythm Patterns',
      type: 'technique',
      domain: 'strudel',
      description: 'Polyrhythms, metric modulation, nested cycles, tuplets, cross-rhythm',
      keywords: ['rhythm', 'polyrhythm', 'modulation', 'tuplet', 'cross']
    },
    {
      name: 'Melody Generation',
      type: 'technique',
      domain: 'strudel',
      description: 'Scale-based melody, note sequences, ornamentation, generative melody',
      keywords: ['melody', 'scale', 'note', 'sequence', 'ornament']
    },
    {
      name: 'Harmonic Progression',
      type: 'technique',
      domain: 'strudel',
      description: 'Chords, voicing, harmonic rhythm, root movement, modulation',
      keywords: ['harmony', 'chord', 'voicing', 'progression', 'root']
    },
    {
      name: 'Timbre Design',
      type: 'technique',
      domain: 'strudel',
      description: 'Waveform synthesis, FM synthesis, additive synthesis, spectral techniques',
      keywords: ['timbre', 'waveform', 'synthesis', 'fm', 'additive']
    },
    {
      name: 'Spatial Audio',
      type: 'technique',
      domain: 'strudel',
      description: 'Pan, room, reverb, spatial positioning, surround sound',
      keywords: ['spatial', 'pan', 'room', 'reverb', 'surround', 'position']
    },
    {
      name: 'Microtiming',
      type: 'technique',
      domain: 'strudel',
      description: 'Human timing, groove, swing, feel, micro-rhythms',
      keywords: ['timing', 'groove', 'swing', 'feel', 'micro']
    },
    {
      name: 'Sample Manipulation',
      type: 'technique',
      domain: 'strudel',
      description: 'Granular synthesis, slicing, time-stretching, pitch-shifting',
      keywords: ['sample', 'granular', 'slice', 'stretch', 'pitch']
    },
    {
      name: 'Probability and Chance',
      type: 'technique',
      domain: 'strudel',
      description: 'rand, choose, some, every, weighted random, probabilistic patterns',
      keywords: ['random', 'probability', 'chance', 'weighted', 'probabilistic']
    },
    {
      name: 'State Machines',
      type: 'technique',
      domain: 'strudel',
      description: 'Pattern states, transitions, conditional logic, algorithmic composition',
      keywords: ['state', 'machine', 'transition', 'conditional', 'algorithmic']
    },
    {
      name: 'Pattern Algebra',
      type: 'technique',
      domain: 'strudel',
      description: 'Pattern transformations, concatenation, manipulation, structure',
      keywords: ['algebra', 'pattern', 'transform', 'concat', 'structure']
    },
    {
      name: 'Iterative Processes',
      type: 'technique',
      domain: 'strudel',
      description: 'Iter, while, accumulate, scan for iterative development',
      keywords: ['iter', 'while', 'accumulate', 'scan', 'iterative']
    },
    {
      name: 'Modulation Chains',
      type: 'technique',
      domain: 'strudel',
      description: 'Complex modulation routing, param modulation, bus modulation',
      keywords: ['modulation', 'bus', 'param', 'routing', 'chain']
    },
    {
      name: 'Global Effects',
      type: 'technique',
      domain: 'strudel',
      description: 'compress, reverb, delay, filter, distortion on entire mix',
      keywords: ['compress', 'reverb', 'delay', 'filter', 'distortion', 'effect']
    },
    {
      name: 'Live Coding Patterns',
      type: 'technique',
      domain: 'strudel',
      description: 'Modifying patterns in real-time, reactive performance, evolution',
      keywords: ['live', 'coding', 'reactive', 'evolution', 'real-time']
    },
    {
      name: 'Algorithmic Composition',
      type: 'technique',
      domain: 'strudel',
      description: 'Generative rules, cellular automata music, chaos theory',
      keywords: ['algorithmic', 'generative', 'chaos', 'cellular', 'automata']
    },
  ],

  // VISUAL (HYDRA) TECHNIQUES
  hydra: [
    {
      name: 'Source Creation',
      type: 'technique',
      domain: 'hydra',
      description: 's0, s1, s2, s3 sources, osc(), src(), noise() for texture generation',
      keywords: ['source', 'osc', 'noise', 'texture', 'input']
    },
    {
      name: 'Texture Modulation',
      type: 'technique',
      domain: 'hydra',
      description: 'mod(), scroll(), kaleid(), pixel() for texture transformation',
      keywords: ['mod', 'scroll', 'kaleid', 'pixel', 'transform']
    },
    {
      name: 'Color Manipulation',
      type: 'technique',
      domain: 'hydra',
      description: 'color(), colorama(), saturate(), contrast(), brightness(), thresh()',
      keywords: ['color', 'colorama', 'saturate', 'contrast', 'brightness', 'thresh']
    },
    {
      name: 'Blending and Composition',
      type: 'technique',
      domain: 'hydra',
      description: 'blend(), layer(), mult(), diff(), add() for combining sources',
      keywords: ['blend', 'layer', 'mult', 'diff', 'add', 'composite']
    },
    {
      name: 'Geometry and Shapes',
      type: 'technique',
      domain: 'hydra',
      description: 'shape(), voronoi(), osc(), noise() for geometric patterns',
      keywords: ['shape', 'voronoi', 'osc', 'noise', 'geometry', 'pattern']
    },
    {
      name: 'Feedback and Recursion',
      type: 'technique',
      domain: 'hydra',
      description: 'feedback(), scale(), rotate(), transform feedback loops',
      keywords: ['feedback', 'scale', 'rotate', 'transform', 'loop']
    },
    {
      name: 'Coordinate Systems',
      type: 'technique',
      domain: 'hydra',
      description: 'cartesian, polar coordinates, coordinate transforms',
      keywords: ['coord', 'cartesian', 'polar', 'transform', 'space']
    },
    {
      name: 'Math Functions',
      type: 'technique',
      domain: 'hydra',
      description: 'sin, cos, tan, abs, floor, ceil, round, mod, exp, log',
      keywords: ['math', 'trig', 'function', 'calculation', 'formula']
    },
    {
      name: 'Array Operations',
      type: 'technique',
      domain: 'hydra',
      description: 'buf[], buffer operations, array manipulation',
      keywords: ['buffer', 'array', 'buf', 'manipulation', 'data']
    },
    {
      name: 'Texture Synthesis',
      type: 'technique',
      domain: 'hydra',
      description: 'Procedural textures, noise-based, algorithmic generation',
      keywords: ['synthesis', 'procedural', 'noise', 'algorithmic', 'texture']
    },
    {
      name: 'Video Processing',
      type: 'technique',
      domain: 'hydra',
      description: 'initScreen, screen(), webcam input processing',
      keywords: ['screen', 'video', 'webcam', 'input', 'processing']
    },
    {
      name: 'Audio Reactivity',
      type: 'technique',
      domain: 'hydra',
      description: 'a.show, a.setVolume, fft[] for audio-reactive visuals',
      keywords: ['audio', 'reactive', 'fft', 'sound', 'music']
    },
    {
      name: 'Glitch and Distortion',
      type: 'technique',
      domain: 'hydra',
      description: 'glitch, pixel sorting, datamosh, chromatic aberration',
      keywords: ['glitch', 'distort', 'pixel', 'sort', 'datamosh']
    },
    {
      name: 'Masks and Regions',
      type: 'technique',
      domain: 'hydra',
      description: 'mask(), creating selection regions, conditional rendering',
      keywords: ['mask', 'region', 'selection', 'conditional']
    },
    {
      name: 'Time-based Animation',
      type: 'technique',
      domain: 'hydra',
      description: 'time, slow, speed control for animation timing',
      keywords: ['time', 'speed', 'slow', 'animation', 'tempo']
    },
    {
      name: 'Mouse Interaction',
      type: 'technique',
      domain: 'hydra',
      description: 'mouse, mx, my, mouse tracking and response',
      keywords: ['mouse', 'mx', 'my', 'interaction', 'input']
    },
    {
      name: 'Resolution Techniques',
      type: 'technique',
      domain: 'hydra',
      description: 'resolution, resizing, pixelation effects',
      keywords: ['resolution', 'resize', 'pixel', 'downscale', 'up']
    },
    {
      name: 'Post-processing Chains',
      type: 'technique',
      domain: 'hydra',
      description: 'Multiple effect passes, chaining transformations',
      keywords: ['post', 'chain', 'pass', 'effect', 'sequence']
    },
    {
      name: 'Performance Optimization',
      type: 'technique',
      domain: 'hydra',
      description: 'render() optimizations, efficient texture usage',
      keywords: ['performance', 'optimize', 'efficient', 'fps']
    },
  ],

  // TONE.JS TECHNIQUES
  tone: [
    {
      name: 'Tone.js Initialization',
      type: 'technique',
      domain: 'tone',
      description: 'Setting up Tone.js, await Tone.start(), audio context handling',
      keywords: ['init', 'setup', 'context', 'start', 'audio']
    },
    {
      name: 'Synth Types',
      type: 'technique',
      domain: 'tone',
      description: 'Synth, MonoSynth, PolySynth, AMSynth, FMSynth, DuoSynth with different oscillator and envelope configurations',
      keywords: ['synth', 'oscillator', 'envelope', 'monosynth', 'polysynth', 'am', 'fm']
    },
    {
      name: 'Oscillators',
      type: 'technique',
      domain: 'tone',
      description: 'sine, square, sawtooth, triangle, fmsquare with modulationIndex and harmonicity',
      keywords: ['oscillator', 'sine', 'square', 'sawtooth', 'triangle', 'fm', 'modulation']
    },
    {
      name: 'ADSR Envelopes',
      type: 'technique',
      domain: 'tone',
      description: 'Attack, Decay, Sustain, Release envelopes for shaping sound over time',
      keywords: ['envelope', 'adsr', 'attack', 'decay', 'sustain', 'release', 'amplitude']
    },
    {
      name: 'Polyphonic Synthesis',
      type: 'technique',
      domain: 'tone',
      description: 'PolySynth for playing chords, triggerAttackRelease with note arrays',
      keywords: ['polyphonic', 'chord', 'polysynth', 'harmony', 'voices']
    },
    {
      name: 'Effects - Reverb',
      type: 'technique',
      domain: 'tone',
      description: 'Tone.Reverb with decay time and wet/dry mix for spatial depth',
      keywords: ['reverb', 'space', 'decay', 'wet', 'dry', 'atmosphere']
    },
    {
      name: 'Effects - Delay',
      type: 'technique',
      domain: 'tone',
      description: 'FeedbackDelay, PingPongDelay for echo and rhythmic delays',
      keywords: ['delay', 'echo', 'feedback', 'pingpong', 'rhythmic', 'repeat']
    },
    {
      name: 'Effects Chain',
      type: 'technique',
      domain: 'tone',
      description: 'Chaining effects: synth.connect(delay).connect(reverb).toDestination()',
      keywords: ['chain', 'connect', 'effects', 'routing', 'signal-flow']
    },
    {
      name: 'Sequencing - Tone.Loop',
      type: 'technique',
      domain: 'tone',
      description: 'Creating repeating patterns with Tone.Loop, interval-based scheduling',
      keywords: ['loop', 'sequence', 'repeat', 'pattern', 'schedule', 'interval']
    },
    {
      name: 'Sequencing - Tone.Sequence',
      type: 'technique',
      domain: 'tone',
      description: 'Tone.Sequence for stepping through arrays of values',
      keywords: ['sequence', 'step', 'array', 'pattern', 'iterate']
    },
    {
      name: 'Sequencing - Tone.Part',
      type: 'technique',
      domain: 'tone',
      description: 'Tone.Part for complex sequences with different events at different times',
      keywords: ['part', 'sequence', 'events', 'timing', 'complex']
    },
    {
      name: 'Transport System',
      type: 'technique',
      domain: 'tone',
      description: 'Tone.Transport.start(), BPM scheduling, transport timing for synchronized loops',
      keywords: ['transport', 'bpm', 'sync', 'timing', 'schedule', 'master']
    },
    {
      name: 'Chord Progressions',
      type: 'technique',
      domain: 'tone',
      description: 'Musical chords: triads, sevenths (Maj7, m7, dominant), voice leading',
      keywords: ['chord', 'progression', 'harmony', 'triad', 'seventh', 'voicing']
    },
    {
      name: 'Arpeggios',
      type: 'technique',
      domain: 'tone',
      description: 'Breaking chords into sequential note patterns, up/down arpeggios',
      keywords: ['arpeggio', 'arp', 'pattern', 'broken', 'chord']
    },
    {
      name: 'Scales and Modes',
      type: 'technique',
      domain: 'tone',
      description: 'Major, minor, pentatonic, blues, dorian, mixolydian scales for melodic content',
      keywords: ['scale', 'mode', 'key', 'melody', 'pentatonic', 'blues']
    },
    {
      name: 'Filter Modulation',
      type: 'technique',
      domain: 'tone',
      description: 'Tone.Filter with lowpass, highpass, bandpass, frequency and Q modulation',
      keywords: ['filter', 'lowpass', 'highpass', 'bandpass', 'modulation', 'sweep']
    },
    {
      name: 'LFO Modulation',
      type: 'technique',
      domain: 'tone',
      description: 'Tone.LFO for modulating parameters, vibrato, tremolo, filter sweeps',
      keywords: ['lfo', 'modulation', 'vibrato', 'tremolo', 'sweep', 'oscillate']
    },
    {
      name: 'Memory Nodes',
      type: 'technique',
      domain: 'tone',
      description: 'Tone.FeedbackDelay for echoes, Tone.Waveform for recording/looping',
      keywords: ['memory', 'feedback', 'loop', 'record', 'waveform']
    },
    {
      name: 'Sample Instruments',
      type: 'technique',
      domain: 'tone',
      description: 'Tone.Sampler, Tone.Players for loading and triggering audio samples',
      keywords: ['sample', 'sampler', 'player', 'audio-file', 'loading']
    },
    {
      name: 'Noise Generation',
      type: 'technique',
      domain: 'tone',
      description: 'Tone.Noise for white, pink, brown noise, textures, percussion',
      keywords: ['noise', 'white', 'pink', 'brown', 'texture', 'percussion']
    },
    {
      name: 'Analyser and Visualization',
      type: 'technique',
      domain: 'tone',
      description: 'Tone.Analyser with FFT, waveform data for audio visualization',
      keywords: ['analyser', 'fft', 'waveform', 'visualize', 'spectrum']
    },
    {
      name: 'Volume and Dynamics',
      type: 'technique',
      domain: 'tone',
      description: 'Tone.Volume, velocity control, expression, automation',
      keywords: ['volume', 'dynamics', 'velocity', 'automation', 'expression']
    },
    {
      name: 'Panning and Spatialization',
      type: 'technique',
      domain: 'tone',
      description: 'Tone.Panner, stereo width, spatial positioning of sounds',
      keywords: ['pan', 'stereo', 'spatial', 'width', 'position']
    },
    {
      name: 'Musical Timing',
      type: 'technique',
      domain: 'tone',
      description: 'Tone.Time values: 4n, 8n, 16n for rhythmic timing, triplets, dotted notes',
      keywords: ['timing', 'rhythm', 'duration', 'tempo', 'note-value']
    },
    {
      name: 'Ambient Pad Synthesis',
      type: 'technique',
      domain: 'tone',
      description: 'Long attack/release, slow modulation, reverb-heavy atmospheric pads',
      keywords: ['ambient', 'pad', 'atmosphere', 'slow', 'evolving']
    },
    {
      name: 'Bass Synthesis',
      type: 'technique',
      domain: 'tone',
      description: 'Low frequency sine/square waves, short envelopes, punchy basslines',
      keywords: ['bass', 'sub', 'low', 'frequency', 'punchy']
    },
    {
      name: 'Lead Synthesis',
      type: 'technique',
      domain: 'tone',
      description: 'Bright oscillators, filter sweeps, expressive monophonic leads',
      keywords: ['lead', 'monophonic', 'bright', 'melody', 'expressive']
    },
  ],
};

/**
 * Artistic style categories
 * Generic descriptors for different artistic approaches and styles
 */
export const ARTISTIC_STYLES: ArtisticConcept[] = [
  { name: 'Generative Art Pioneer Style', type: 'movement', description: 'Early algorithmic and plotter-based art approaches', keywords: ['pioneer', 'plotter', 'algorithmic', 'generative', 'early'] },
  { name: 'Interactive Installation Style', type: 'movement', description: 'User-responsive art in physical spaces', keywords: ['interactive', 'responsive', 'installation', 'space', 'physical'] },
  { name: 'Data Visualization Style', type: 'movement', description: 'Visual representation of information and datasets', keywords: ['data', 'viz', 'information', 'visualization', 'representation'] },
  { name: 'Live Coding Performance', type: 'movement', description: 'Real-time programming as artistic performance', keywords: ['live', 'real-time', 'performance', 'improvisation', 'coding'] },
  { name: 'Shader Art Style', type: 'movement', description: 'GPU-based visual creation using GLSL', keywords: ['shader', 'glsl', 'gpu', 'fragment', 'visual'] },
  { name: 'Procedural Generation Style', type: 'movement', description: 'Algorithmic content creation with rules and systems', keywords: ['procedural', 'algorithmic', 'automated', 'systematic', 'rules'] },
  { name: 'Minimalist Conceptual Style', type: 'movement', description: 'Art based on ideas, instructions, and reduction', keywords: ['minimalism', 'conceptual', 'instructions', 'systems', 'reduction'] },
  { name: 'Optical Pattern Style', type: 'movement', description: 'Perception-based art using patterns and visual effects', keywords: ['op-art', 'pattern', 'perception', 'optical', 'visual'] },
  { name: 'Mathematical Art Style', type: 'movement', description: 'Art based on mathematical principles and geometry', keywords: ['tessellation', 'geometry', 'mathematical', 'fractal', 'algorithmic'] },
  { name: 'ML-Generated Art Style', type: 'movement', description: 'Art created with machine learning and neural networks', keywords: ['ml', 'neural', 'ai', 'machine-learning', 'generative'] },
  { name: 'Light Installation Style', type: 'movement', description: 'Art using light as primary medium in spaces', keywords: ['light', 'installation', 'responsive', 'environment', 'illumination'] },
  { name: 'Immersive Digital Style', type: 'movement', description: 'Large-scale interactive digital environments', keywords: ['interactive', 'immersive', 'installation', 'digital', 'environment'] },
];

/**
 * Design principles and artistic concepts
 */
export const DESIGN_PRINCIPLES: ArtisticConcept[] = [
  // Fundamental
  { name: 'Balance', type: 'principle', description: 'Visual equilibrium, distribution of visual weight', keywords: ['equilibrium', 'weight', 'distribution', 'stability'] },
  { name: 'Contrast', type: 'principle', description: 'Difference between elements, juxtaposition', keywords: ['difference', 'juxtaposition', 'opposition'] },
  { name: 'Emphasis', type: 'principle', description: 'Focal point, center of interest, dominance', keywords: ['focal', 'dominance', 'hierarchy', 'attention'] },
  { name: 'Movement', type: 'principle', description: 'Visual rhythm, path, direction', keywords: ['rhythm', 'path', 'direction', 'flow'] },
  { name: 'Pattern', type: 'principle', description: 'Repetition, regularity, predictability', keywords: ['repetition', 'regularity', 'repeat'] },
  { name: 'Rhythm', type: 'principle', description: 'Alternation, variation, beat', keywords: ['alternation', 'variation', 'beat', 'pulse'] },
  { name: 'Unity', type: 'principle', description: 'Cohesion, harmony, togetherness', keywords: ['cohesion', 'harmony', 'together'] },
  { name: 'Variety', type: 'principle', description: 'Diversity, difference, contrast', keywords: ['diversity', 'difference', 'contrast'] },

  // Advanced
  { name: 'Negative Space', type: 'principle', description: 'Empty space as design element, breathing room', keywords: ['empty', 'space', 'breathing', 'minimal'] },
  { name: 'Golden Ratio', type: 'principle', description: 'Divine proportion, natural growth pattern', keywords: ['phi', 'proportion', 'natural', 'fibonacci'] },
  { name: 'Rule of Thirds', type: 'principle', description: 'Composition grid, focal point placement', keywords: ['grid', 'composition', 'focal', 'placement'] },
  { name: 'Symmetry', type: 'principle', description: 'Mirror balance, reflection', keywords: ['mirror', 'reflection', 'balance', 'formal'] },
  { name: 'Asymmetry', type: 'principle', description: 'Informal balance, dynamic tension', keywords: ['informal', 'dynamic', 'tension', 'modern'] },
  { name: 'Depth', type: 'principle', description: 'Foreground/background, layering, perspective', keywords: ['layer', 'perspective', 'space', '3d'] },
  { name: 'Scale', type: 'principle', description: 'Size relationships, proportion, hierarchy', keywords: ['size', 'proportion', 'hierarchy', 'relative'] },
  { name: 'Proximity', type: 'principle', description: 'Grouping, relationship, closeness', keywords: ['grouping', 'near', 'close', 'relationship'] },
  { name: 'Closure', type: 'principle', description: 'Completeness, filling gaps, mental completion', keywords: ['complete', 'fill', 'mental', 'gestalt'] },
  { name: 'Continuity', type: 'principle', description: 'Flow, alignment, connection', keywords: ['flow', 'alignment', 'connection', 'line'] },
  { name: 'Figure-Ground', type: 'principle', description: 'Subject vs background, perception separation', keywords: ['subject', 'background', 'separation', 'perception'] },
  { name: 'Gestalt', type: 'principle', description: 'Perception principles, grouping psychology', keywords: ['perception', 'grouping', 'psychology', 'gestalt'] },
];

/**
 * Art movements and styles
 */
export const ART_MOVEMENTS: ArtisticConcept[] = [
  // Historical
  { name: 'Generative Art', type: 'movement', description: 'Art created through algorithms, code, autonomous systems', keywords: ['algorithmic', 'autonomous', 'systems', 'code'] },
  { name: 'Algorithmic Art', type: 'movement', description: 'Art created using algorithmic processes', keywords: ['algorithmic', 'systematic', 'procedural'] },
  { name: 'Computational Art', type: 'movement', description: 'Art created with computers and software', keywords: ['computer', 'software', 'digital'] },
  { name: 'Op Art', type: 'movement', description: 'Optical art, perception, pattern, visual effects', keywords: ['optical', 'pattern', 'perception', 'visual'] },
  { name: 'Minimalism', type: 'movement', description: 'Minimal elements, simplicity, reduction', keywords: ['simple', 'reduction', 'essential', 'basic'] },
  { name: 'Abstract Expressionism', type: 'movement', description: 'Emotion, gesture, automatic painting', keywords: ['emotion', 'gesture', 'abstract', 'painterly'] },
  { name: 'Kinetic Art', type: 'movement', description: 'Movement, mechanical art, sculpture in motion', keywords: ['movement', 'mechanical', 'motion', 'dynamic'] },
  { name: 'Digital Art', type: 'movement', description: 'Art created with digital technology', keywords: ['digital', 'technology', 'electronic'] },
  { name: 'Interactive Art', type: 'movement', description: 'User-responsive, installation, participatory', keywords: ['interactive', 'responsive', 'participatory', 'installation'] },
  { name: 'Installation Art', type: 'movement', description: 'Space-based art, immersive, environmental', keywords: ['space', 'immersive', 'environmental', 'site'] },
  { name: 'Sound Art', type: 'movement', description: 'Art using sound as medium', keywords: ['sound', 'audio', 'music', 'acoustic'] },

  // Contemporary
  { name: 'Data Art', type: 'movement', description: 'Visualization of data, information aesthetics', keywords: ['data', 'viz', 'information', 'visualization'] },
  { name: 'Glitch Art', type: 'movement', description: 'Digital artifacts, errors, degradation aesthetics', keywords: ['glitch', 'error', 'artifact', 'degradation'] },
  { name: 'AI Art', type: 'movement', description: 'Art created with artificial intelligence', keywords: ['ai', 'machine learning', 'neural', 'generative'] },
  { name: 'Creative Coding', type: 'movement', description: 'Programming as artistic practice', keywords: ['code', 'programming', 'software', 'practice'] },
  { name: 'Live Coding', type: 'movement', description: 'Real-time programming as performance', keywords: ['real-time', 'performance', 'live', 'improvisation'] },
  { name: 'Procedural Generation', type: 'movement', description: 'Algorithmic content creation', keywords: ['procedural', 'algorithmic', 'automated', 'systematic'] },
];

/**
 * Color theory concepts
 */
export const COLOR_THEORY: ArtisticConcept[] = [
  { name: 'Color Harmony', type: 'color', description: 'Pleasing color combinations', keywords: ['harmony', 'combination', 'palette'] },
  { name: 'Complementary', type: 'color', description: 'Opposite colors on color wheel', keywords: ['opposite', 'wheel', 'contrast'] },
  { name: 'Analogous', type: 'color', description: 'Adjacent colors on color wheel', keywords: ['adjacent', 'wheel', 'neighbor'] },
  { name: 'Triadic', type: 'color', description: 'Three colors evenly spaced', keywords: ['three', 'spaced', 'balanced'] },
  { name: 'Split-Complementary', type: 'color', description: 'One color plus adjacent to complement', keywords: ['split', 'adjacent', 'variant'] },
  { name: 'Tetradic', type: 'color', description: 'Four colors (two complementary pairs)', keywords: ['four', 'rectangle', 'double-complement'] },
  { name: 'Warm Colors', type: 'color', description: 'Red, orange, yellow - energetic, advancing', keywords: ['warm', 'red', 'orange', 'yellow', 'advancing'] },
  { name: 'Cool Colors', type: 'color', description: 'Blue, green, purple - calming, receding', keywords: ['cool', 'blue', 'green', 'purple', 'receding'] },
  { name: 'Saturation', type: 'color', description: 'Color intensity, purity from gray to pure', keywords: ['intensity', 'purity', 'vibrance', 'chroma'] },
  { name: 'Value', type: 'color', description: 'Lightness from dark to light', keywords: ['lightness', 'brightness', 'tone', 'luminance'] },
  { name: 'Hue', type: 'color', description: 'Color family on color wheel', keywords: ['family', 'wheel', 'spectrum'] },
  { name: 'HSB/HSL', type: 'color', description: 'Hue, Saturation, Brightness/Lightness color models', keywords: ['hsb', 'hsl', 'model', 'component'] },
  { name: 'CMYK', type: 'color', description: 'Cyan, Magenta, Yellow, Key (print)', keywords: ['print', 'subtractive', 'ink'] },
  { name: 'Grayscale', type: 'color', description: 'Single channel, luminance only', keywords: ['gray', 'mono', 'luminance'] },
  { name: 'Gradient', type: 'color', description: 'Color transition, ramp, blend', keywords: ['ramp', 'transition', 'blend', 'interpolation'] },
  { name: 'Palette', type: 'color', description: 'Curated color collection', keywords: ['collection', 'set', 'scheme'] },
];

/**
 * Composition concepts
 */
export const COMPOSITION: ArtisticConcept[] = [
  { name: 'Golden Ratio', type: 'composition', description: 'Divine proportion 1:1.618, natural growth pattern', keywords: ['phi', 'proportion', 'fibonacci', 'natural'] },
  { name: 'Rule of Thirds', type: 'composition', description: 'Divide into 9, place subjects on intersections', keywords: ['grid', 'intersection', 'focus', 'thirds'] },
  { name: 'Symmetry', type: 'composition', description: 'Mirror balance, formal composition', keywords: ['mirror', 'formal', 'balanced', 'reflection'] },
  { name: 'Asymmetry', type: 'composition', description: 'Informal balance, dynamic tension', keywords: ['informal', 'dynamic', 'tension', 'modern'] },
  { name: 'Leading Lines', type: 'composition', description: 'Lines that guide the eye through composition', keywords: ['guide', 'direction', 'path', 'flow'] },
  { name: 'Framing', type: 'composition', description: 'Cropping, borders, edge treatment', keywords: ['crop', 'border', 'edge', 'window'] },
  { name: 'Perspective', type: 'composition', description: 'Depth illusion, vanishing point, horizon', keywords: ['depth', 'vanishing', 'horizon', '3d'] },
  { name: 'Depth', type: 'composition', description: 'Foreground/background separation, layering', keywords: ['layer', 'separation', 'foreground', 'background'] },
  { name: 'Scale', type: 'composition', description: 'Size relationships, proportion, hierarchy', keywords: ['size', 'proportion', 'hierarchy'] },
  { name: 'Point of View', type: 'composition', description: 'Camera angle, eye level, vantage point', keywords: ['camera', 'angle', 'vantage', 'view'] },
  { name: 'Cropping', type: 'composition', description: 'Frame selection, removing elements', keywords: ['frame', 'selection', 'remove', 'cut'] },
  { name: 'Negative Space', type: 'composition', description: 'Empty space, breathing room, minimal', keywords: ['empty', 'breathing', 'minimal', 'white'] },
  { name: 'Visual Hierarchy', type: 'composition', description: 'Order of importance, emphasis flow', keywords: ['hierarchy', 'order', 'importance', 'flow'] },
  { name: 'Focal Point', type: 'composition', description: 'Center of interest, primary subject', keywords: ['focus', 'center', 'primary', 'main'] },
];

export function getAllArtisticConcepts(): ArtisticConcept[] {
  return [
    ...ARTISTIC_TECHNIQUES.p5,
    ...ARTISTIC_TECHNIQUES.shader,
    ...ARTISTIC_TECHNIQUES.three,
    ...ARTISTIC_TECHNIQUES.strudel,
    ...ARTISTIC_TECHNIQUES.hydra,
    ...ARTISTIC_STYLES,
    ...DESIGN_PRINCIPLES,
    ...ART_MOVEMENTS,
    ...COLOR_THEORY,
    ...COMPOSITION,
  ];
}
