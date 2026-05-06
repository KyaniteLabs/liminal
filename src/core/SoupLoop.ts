export interface SoupCandidate {
  code: string;
  score: number;
  prompt: string;
}

export interface SoupStepEvent {
  step: number;
  population: SoupCandidate[];
  merged: boolean;
  accepted: boolean;
}

export interface SoupLoopOptions {
  populationSize?: number;
  maxSteps?: number;
  galleryDir?: string;
  project?: string;
  onStep?: (event: SoupStepEvent) => void;
}

export interface SoupLoopResult {
  population: SoupCandidate[];
  bestCode: string | null;
  bestScore: number;
  project?: string;
  galleryDir?: string;
}

export class SoupLoop {
  static async run(prompt: string, options: SoupLoopOptions = {}): Promise<SoupLoopResult> {
    const populationSize = Math.max(2, options.populationSize ?? 4);
    const maxSteps = Math.max(1, options.maxSteps ?? 3);
    const population = Array.from({ length: populationSize }, (_, index) => createCandidate(prompt, index));

    for (let step = 0; step < maxSteps; step++) {
      population.sort((a, b) => b.score - a.score);
      const parentA = population[0];
      const parentB = population[1];
      const child = mergeCandidates(parentA, parentB, step);
      const weakestIndex = population.length - 1;
      const accepted = child.score >= population[weakestIndex].score;
      if (accepted) population[weakestIndex] = child;
      options.onStep?.({ step, population: [...population], merged: true, accepted });
      await Promise.resolve();
    }

    population.sort((a, b) => b.score - a.score);
    return {
      population,
      bestCode: population[0]?.code ?? null,
      bestScore: population[0]?.score ?? 0,
      project: options.project,
      galleryDir: options.galleryDir,
    };
  }
}

function createCandidate(prompt: string, index: number): SoupCandidate {
  const hue = (index * 83) % 360;
  const code = [
    `// Soup candidate ${index}: ${prompt}`,
    'function setup() { createCanvas(640, 480); noStroke(); }',
    'function draw() {',
    `  background(${hue % 255}, 28, 48);`,
    `  fill(${(hue + 80) % 255}, 180, 240, 180);`,
    '  const t = frameCount * 0.02;',
    `  circle(width / 2 + sin(t + ${index}) * 90, height / 2 + cos(t) * 70, 48 + ${index} * 4);`,
    '}',
  ].join('\n');
  return { code, prompt, score: scoreCode(code, prompt) };
}

function mergeCandidates(a: SoupCandidate, b: SoupCandidate, step: number): SoupCandidate {
  const code = [
    `// Soup merge step ${step}`,
    ...a.code.split('\n').slice(1, 4),
    ...b.code.split('\n').slice(4),
    `// blended score source ${a.score.toFixed(2)} + ${b.score.toFixed(2)}`,
  ].join('\n');
  return {
    code,
    prompt: `${a.prompt} + ${b.prompt}`,
    score: Math.min(1, (a.score + b.score) / 2 + 0.03),
  };
}

function scoreCode(code: string, prompt: string): number {
  const visibleMotion = /sin|cos|frameCount/.test(code) ? 0.25 : 0;
  const promptPresence = prompt.length > 0 && code.toLowerCase().includes(prompt.split(/\s+/)[0].toLowerCase()) ? 0.2 : 0;
  const structure = /function setup/.test(code) && /function draw/.test(code) ? 0.35 : 0;
  const length = Math.min(0.2, code.length / 2000);
  return Math.min(1, visibleMotion + promptPresence + structure + length);
}
