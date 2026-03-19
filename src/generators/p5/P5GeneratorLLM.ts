import { LLMClient, LLMConfig } from '../../llm/LLMClient.js';

export interface P5GeneratorOptions {
  maxIterations?: number;
  temperature?: number;
  /** Optional AbortSignal for request timeout/cancellation */
  signal?: AbortSignal;
}

export class P5GeneratorLLM {
  private llm: LLMClient;

  constructor(llmConfig?: Partial<LLMConfig>, _options?: P5GeneratorOptions) {
    this.llm = new LLMClient(llmConfig);
  }

  async generate(prompt: string, options?: P5GeneratorOptions): Promise<string> {
    // If LLM is not configured, fall back to template-based generation
    if (!LLMClient.isConfigured()) {
      return this.generateTemplate(prompt);
    }

    try {
      // Only add sound-specific instructions via context
      const lowerPrompt = prompt.toLowerCase();
      const soundContext = this.promptSuggestsSound(lowerPrompt)
        ? '\nNote: The user wants sound/audio. Include Web Audio API (AudioContext, createOscillator) or p5.sound.'
        : '';
      const context = soundContext || undefined;
      const llmResponse = await this.llm.generateP5Sketch(prompt, context, options?.signal);

      // If LLM returns empty code, fall back to templates
      if (!llmResponse.code || llmResponse.code.trim() === '') {
        return this.generateTemplate(prompt);
      }

      return llmResponse.code;
    } catch (error) {
      // If LLM call fails, fall back to template-based generation
      console.error('P5GeneratorLLM.generate: LLM call failed, using template fallback:', error instanceof Error ? error.message : error);
      return this.generateTemplate(prompt);
    }
  }

  /**
   * Build system prompt with noise preference instructions.
   */
  static buildSystemPrompt(): string {
    return `You are an expert creative coding assistant specializing in p5.js.
Generate valid, creative p5.js sketch code based on the user's description.

Rules:
1. Return ONLY valid JavaScript code for p5.js (no markdown, no explanations)
2. Include setup() and draw() functions
3. Use creative colors, animations, and effects that match the prompt
4. Add comments explaining key parts
5. Ensure code is self-contained and runnable
6. Canvas size: use createCanvas(800, 600) or appropriate size
7. Include p5.js library usage (shapes, colors, animation, interaction if relevant)

Noise preference:
- Prefer noise() and noiseSeed() over Math.random() for organic, smooth variation
- Use Perlin noise for particle movement, color gradients, wave patterns, flow fields
- noise() produces smooth continuous values — use it for anything that should feel natural
- Only use Math.random() when you truly need discrete random values`;
  }

  private generateTemplate(prompt: string): string {
    const lowerPrompt = prompt.toLowerCase();

    if (this.promptSuggestsSound(lowerPrompt)) {
      return this.soundTemplate();
    }
    if (lowerPrompt.includes('particle')) {
      return this.particleTemplate();
    } else if (lowerPrompt.includes('flow') || lowerPrompt.includes('field') || (lowerPrompt.includes('particle') && lowerPrompt.includes('flow'))) {
      return this.flowFieldTemplate();
    } else if (lowerPrompt.includes('galax') || lowerPrompt.includes('star') || lowerPrompt.includes('space')) {
      return this.galaxyTemplate();
    } else if (lowerPrompt.includes('cellular') || lowerPrompt.includes('automata')) {
      return this.cellularTemplate();
    } else if (lowerPrompt.includes('fract') || lowerPrompt.includes('fractal')) {
      return this.fractalTemplate();
    } else {
      return this.basicTemplate();
    }
  }

  private particleTemplate(): string {
    return `function setup() {
  createCanvas(800, 600);
}

function draw() {
  background(20);
  const count = 100;
  for (let i = 0; i < count; i++) {
    fill(255, 100 + i * 1.5, 150 + i * 1);
    ellipse(Math.random() * width, Math.random() * height, 2 + Math.random() * 3, 2 + Math.random() * 3);
  }
}`;
  }

  private galaxyTemplate(): string {
    return `function setup() {
  createCanvas(800, 600);
}

function draw() {
  background(5, 5, 15);
  translate(width / 2, height / 2);
  const count = 200;
  for (let i = 0; i < count; i++) {
    const angle = i * 0.1;
    const radius = i * 1.5;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    fill(255, 255, 200);
    ellipse(x, y, 2, 2);
  }
}`;
  }

  private cellularTemplate(): string {
    return `function setup() {
  createCanvas(800, 600);
}

function draw() {
  background(255);
  const cellSize = 10;
  for (let x = 0; x < width; x += cellSize) {
    for (let y = 0; y < height; y += cellSize) {
      if (Math.random() > 0.5) {
        fill(0);
        rect(x, y, cellSize, cellSize);
      }
    }
  }
}`;
  }

  private fractalTemplate(): string {
    return `function setup() {
  createCanvas(800, 600);
}

function draw() {
  background(255);
  drawCircle(width / 2, height / 2, 300);
}

function drawCircle(x, y, radius) {
  ellipse(x, y, radius);
  if (radius > 20) {
    drawCircle(x + radius / 2, y, radius / 2);
    drawCircle(x - radius / 2, y, radius / 2);
  }
}`;
  }

  private basicTemplate(): string {
    return `function setup() {
  createCanvas(800, 600);
}

function draw() {
  background(220);
  fill(100, 150, 200);
  ellipse(width / 2, height / 2, 100, 100);
}`;
  }

  /**
   * Returns true if the prompt suggests sound/audio (e.g. "sound", "audio", "music", "beep", "subtle sound").
   */
  private promptSuggestsSound(lowerPrompt: string): boolean {
    const soundKeywords = ['sound', 'audio', 'music', 'beep'];
    return soundKeywords.some((kw) => lowerPrompt.includes(kw));
  }

  /**
   * Minimal runnable p5 sketch with Web Audio API (no extra lib).
   * Oscillator tone on mouse click. If using p5.sound instead, add script tag for export:
   * // p5.sound CDN for export: <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/addons/p5.sound.min.js"></script>
   */
  private flowFieldTemplate(): string {
    return `// Generated by Atelier - Flow Field
let particles = [];
let zoff = 0;

function setup() {
  createCanvas(800, 600);
  for (let i = 0; i < 500; i++) {
    particles.push(new FlowParticle());
  }
}

function draw() {
  background(0, 0, 0, 10);
  for (let p of particles) {
    let angle = noise(p.pos.x * 0.005, p.pos.y * 0.005, zoff) * TWO_PI * 4;
    let force = p5.Vector.fromAngle(angle);
    force.setMag(2);
    p.applyForce(force);
    p.update();
    p.edges();
    p.show();
  }
  zoff += 0.001;
}

class FlowParticle {
  constructor() {
    this.pos = createVector(random(width), random(height));
    this.vel = p5.Vector.random2D();
    this.acc = createVector(0, 0);
    this.maxSpeed = 3;
    this.prevPos = this.pos.copy();
  }
  applyForce(f) { this.acc.add(f); }
  update() {
    this.vel.add(this.acc);
    this.vel.limit(this.maxSpeed);
    this.prevPos = this.pos.copy();
    this.pos.add(this.vel);
    this.acc.mult(0);
  }
  edges() {
    if (this.pos.x > width) { this.pos.x = 0; this.prevPos.x = 0; }
    if (this.pos.x < 0) { this.pos.x = width; this.prevPos.x = width; }
    if (this.pos.y > height) { this.pos.y = 0; this.prevPos.y = 0; }
    if (this.pos.y < 0) { this.pos.y = height; this.prevPos.y = height; }
  }
  show() {
    stroke(100, 180, 255, 200);
    strokeWeight(1);
    line(this.pos.x, this.pos.y, this.prevPos.x, this.prevPos.y);
  }
}`;
  }

  private soundTemplate(): string {
    return `// Generated by Atelier P5Generator - with Web Audio
// Uses Web Audio API (no extra library)

let audioCtx = null;

function setup() {
  createCanvas(800, 600);
  background(40);
}

function draw() {
  fill(255, 200, 100);
  noStroke();
  ellipse(width / 2, height / 2, 80, 80);
  fill(255);
  textAlign(CENTER, CENTER);
  text('click for sound', width / 2, height / 2 + 60);
}

function mousePressed() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  const osc = audioCtx.createOscillator();
  osc.frequency.value = 440;
  osc.type = 'sine';
  osc.connect(audioCtx.destination);
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.15);
}`;
  }
}
