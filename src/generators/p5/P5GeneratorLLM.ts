import { LLMClient, LLMConfig } from '../../llm/LLMClient.js';

export interface P5GeneratorOptions {
  maxIterations?: number;
  temperature?: number;
}

export class P5GeneratorLLM {
  private llm: LLMClient;
  private options: P5GeneratorOptions;

  constructor(llmConfig?: Partial<LLMConfig>, options?: P5GeneratorOptions) {
    this.options = options || {};
    this.llm = new LLMClient(llmConfig);
  }

  async generate(prompt: string, options?: P5GeneratorOptions): Promise<string> {
    // If LLM is not configured, fall back to template-based generation
    if (!LLMClient.isConfigured()) {
      return this.generateTemplate(prompt);
    }

    // Use LLM to generate creative p5.js code
    const systemPrompt = `You are an expert creative coding assistant specializing in p5.js.
Generate valid, creative p5.js sketch code based on the user's description.

Rules:
1. Return ONLY valid JavaScript code for p5.js (no markdown, no explanations)
2. Include setup() and draw() functions
3. Use creative colors, animations, and effects that match the prompt
4. Add comments explaining key parts
5. Ensure code is self-contained and runnable
6. Canvas size: use createCanvas(800, 600) or appropriate size
7. Include p5.js library usage (shapes, colors, animation, interaction if relevant)
8. For particle systems: create 50-200 particles with movement and effects
9. For galaxies: create multiple layers of stars with rotation and gradients
10. For cellular automata: implement rules-based generation with visual evolution`;

    const userPrompt = `Create a p5.js sketch: ${prompt}`;
    const llmResponse = await this.llm.generateP5Sketch(systemPrompt, userPrompt);

    return llmResponse.code;
  }

  private generateTemplate(prompt: string): string {
    const lowerPrompt = prompt.toLowerCase();
    
    // Simple template-based fallback
    if (lowerPrompt.includes('particle')) {
      return this.particleTemplate();
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
    ellipse(
      Math.random() * width,
      Math.random() * height,
      2 + Math.random() * 3,
      2 + Math.random() * 3
    );
  }
}`;
  }

  private galaxyTemplate(): string {
    return `function setup() {
  createCanvas(800, 600);
}

function draw() {
  background(10, 5, 20);
  noStroke();
  
  // Stars
  for (let i = 0; i < 200; i++) {
    fill(255, 255, 200);
    const size = Math.random() * 2 + 0.5;
    ellipse(
      Math.random() * 800,
      Math.random() * 600,
      size,
      size
    );
  }
  
  // Nebulae
  for (let i = 0; i < 5; i++) {
    const hue = (i * 360 / 5) % 360;
    colorMode(HSB);
    fill(hue, 50, 50, 0.1);
    
    const x = Math.random() * 800;
    const y = Math.random() * 600;
    const size = Math.random() * 80 + 20;
    
    ellipse(x, y, size, size);
  }
  
  colorMode(RGB);
}`;
  }

  private cellularTemplate(): string {
    return `function setup() {
  createCanvas(800, 600);
  background(0);
  noStroke();
}

function draw() {
  const cols = 15;
  const rows = 15;
  const cellSize = 800 / cols;
  
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const state = Math.random() > 0.5 ? 1 : 0;
      fill(state * 255, state * 255, state * 255);
      rect(i * cellSize, j * cellSize, cellSize, cellSize);
    }
  }
}`;
  }

  private fractalTemplate(): string {
    return `function setup() {
  createCanvas(800, 600);
  background(0);
}

function draw() {
  stroke(255);
  strokeWeight(1);
  drawTree(400, 300, 150, -Math.PI / 2);
  drawTree(400, 300, 150, Math.PI / 2);
  drawTree(500, 200, 50, -Math.PI / 2);
}

function drawTree(x, y, len, angle) {
  push();
  translate(x, y);
  rotate(angle);
  line(0, 0, len);
  pop();
}`;
  }

  private basicTemplate(): string {
    return `function setup() {
  createCanvas(800, 600);
}

function draw() {
  background(220);
  fill(255, 100, 100, 0.8);
  ellipse(
    Math.sin(millis() * 0.002) * 200 + 400,
    Math.cos(millis() * 0.003) * 150 + 300,
    50,
    50
  );
}`;
  }
}

// Export the class for use
