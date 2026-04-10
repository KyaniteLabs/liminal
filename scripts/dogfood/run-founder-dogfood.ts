#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RalphLoop } from "../../src/core/RalphLoop.js";
import { registerAllGenerators } from "../../src/generators/registerGenerators.js";
import { generatorRegistry } from "../../src/generators/GeneratorRegistry.js";
import { HTMLWrapper } from "../../src/utils/htmlWrapper.js";
import { Domain } from "../../src/types/domains.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "../..");

type SupportedDomain = "p5" | "glsl" | "three" | "strudel" | "hydra" | "tone" | "ascii" | "html" | "textgen" | "remotion" | "revideo";

interface Scenario {
  domain: SupportedDomain;
  prompt: string;
  collabDomain?: Domain;
  check: (code: string) => boolean;
}

interface ScenarioResult {
  domain: string;
  prompt: string;
  runIndex: number;
  success: boolean;
  completed: boolean;
  iterations: number;
  finalScore: number;
  durationMs: number;
  reason: string;
  artifactBase: string;
  codePath?: string;
  htmlPath?: string;
  error?: string;
}

interface Report {
  timestamp: string;
  branch: string;
  requestedRunsPerScenario: number;
  requestedMaxIterations: number;
  activeGenerators: string[];
  scenarios: ScenarioResult[];
  summary: {
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    completionRate: number;
    averageScore: number;
    averageIterations: number;
  };
}

const DEFAULT_RUNS_PER_SCENARIO = 2;
const DEFAULT_MAX_ITERATIONS = 3;

function getArg(name: string, fallback?: string): string | undefined {
  const match = process.argv.find(arg => arg.startsWith(`--${name}=`));
  return match ? match.slice(name.length + 3) : fallback;
}

function toPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function nowStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function branchName(): string {
  try {
    const headPath = path.join(PROJECT_ROOT, ".git", "HEAD");
    const content = fs.readFileSync(headPath, "utf8");
    const ref = content.match(/ref: refs\/heads\/(.+)/);
    return ref?.[1]?.trim() ?? "detached-head";
  } catch {
    return "unknown";
  }
}

function getActiveGeneratorNames(): string[] {
  return generatorRegistry.getAll().map(entry => entry.name).sort();
}

function buildScenarios(activeGenerators: string[]): Scenario[] {
  const base: Scenario[] = [
    { domain: "p5", prompt: "Create a p5 sketch with luminous geometric motion and strong color contrast.", collabDomain: Domain.P5, check: code => /createCanvas|function\s+setup/.test(code) },
    { domain: "glsl", prompt: "Create an abstract plasma shader with animated color drift and depth.", collabDomain: Domain.GLSL, check: code => /void\s+main|gl_FragColor|gl_Position/.test(code) },
    { domain: "three", prompt: "Create a rotating 3D composition with lighting and depth.", collabDomain: Domain.THREE, check: code => /THREE|Scene|WebGLRenderer/.test(code) },
    { domain: "strudel", prompt: "Create a driving live-coded rhythm pattern with drums and bass.", collabDomain: Domain.STRUDEL, check: code => /stack\(|\bs\(|note|sound/.test(code) },
    { domain: "hydra", prompt: "Create a geometric video synth pattern with kaleidoscopic motion.", collabDomain: Domain.HYDRA, check: code => /\.out\(|osc\(|shape\(/.test(code) },
    { domain: "tone", prompt: "Create an ambient synth texture with reverb and slow modulation.", collabDomain: Domain.TONE, check: code => /Tone\.|Synth|Transport/.test(code) },
    { domain: "ascii", prompt: "Create ASCII art of a mountain landscape with a moon.", collabDomain: Domain.ASCII, check: code => code.length > 40 && /[█▓▒░@#%*+=\\/|-]/.test(code) },
    { domain: "html", prompt: "Create a landing page with a hero section, visual hierarchy, and a call to action.", check: code => /<!DOCTYPE html>|<html|<body/.test(code) },
    { domain: "textgen", prompt: "Create a typographic text composition about emergence and recursion.", check: code => code.trim().length > 30 },
  ];

  if (activeGenerators.includes("remotion")) {
    base.push({ domain: "remotion", prompt: "Create a short title sequence style motion graphics component.", collabDomain: Domain.REMOTION, check: code => /useCurrentFrame|AbsoluteFill|from\s+["']remotion["']/.test(code) });
  }
  if (activeGenerators.includes("revideo")) {
    base.push({ domain: "revideo", prompt: "Create a programmatic video scene with geometric transitions and strong timing.", collabDomain: Domain.REVIDEO, check: code => /makeScene|@revideo\/core|export\s+default/.test(code) });
  }
  return base.filter(s => ["html", "ascii", "textgen"].includes(s.domain) || activeGenerators.includes(s.domain));
}

function safeWrap(domain: string, code: string): string {
  if (domain === "html") return code;
  if (domain === "revideo") {
    const escaped = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Revideo Output</title><style>body{background:#0b1020;color:#dbeafe;font-family:monospace;padding:24px}pre{white-space:pre-wrap}</style></head><body><h1>Revideo Output</h1><pre>${escaped}</pre></body></html>`;
  }
  return HTMLWrapper.wrap(code as never, domain as never);
}

async function runScenario(scenario: Scenario, runIndex: number, maxIterations: number, outDir: string): Promise<ScenarioResult> {
  const artifactBase = `${scenario.domain}-run${runIndex}`;
  const codePath = path.join(outDir, `${artifactBase}.txt`);
  const htmlPath = path.join(outDir, `${artifactBase}.html`);
  const start = Date.now();
  try {
    const result = await RalphLoop.run(scenario.prompt, {
      maxIterations,
      project: `founder-dogfood-${scenario.domain}-${runIndex}`,
      galleryDir: path.join(outDir, "gallery"),
      collabDomain: scenario.collabDomain,
      tolerateErrors: false,
      minQualityScore: 0.4,
    });
    fs.writeFileSync(codePath, result.code, "utf8");
    fs.writeFileSync(htmlPath, safeWrap(scenario.domain, result.code), "utf8");
    return {
      domain: scenario.domain,
      prompt: scenario.prompt,
      runIndex,
      success: scenario.check(result.code),
      completed: result.completed,
      iterations: result.iterations,
      finalScore: result.finalScore,
      durationMs: Date.now() - start,
      reason: result.reason,
      artifactBase,
      codePath,
      htmlPath,
    };
  } catch (error) {
    return {
      domain: scenario.domain,
      prompt: scenario.prompt,
      runIndex,
      success: false,
      completed: false,
      iterations: 0,
      finalScore: 0,
      durationMs: Date.now() - start,
      reason: "error",
      artifactBase,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function writeMarkdown(report: Report, outDir: string): string {
  const lines = [
    "# Founder Dogfood Report",
    "",
    `- Timestamp: ${report.timestamp}`,
    `- Branch: ${report.branch}`,
    `- Runs per scenario: ${report.requestedRunsPerScenario}`,
    `- Max iterations: ${report.requestedMaxIterations}`,
    `- Active generators: ${report.activeGenerators.join(", ")}`,
    "",
    "## Summary",
    "",
    `- Total runs: ${report.summary.totalRuns}`,
    `- Successful runs: ${report.summary.successfulRuns}`,
    `- Failed runs: ${report.summary.failedRuns}`,
    `- Completion rate: ${report.summary.completionRate.toFixed(1)}%`,
    `- Average score: ${report.summary.averageScore.toFixed(2)}`,
    `- Average iterations: ${report.summary.averageIterations.toFixed(2)}`,
    "",
    "## Results",
    "",
    "| Domain | Run | Success | Completed | Iterations | Score | Duration ms | Reason |",
    "|---|---:|---|---|---:|---:|---:|---|",
  ];
  for (const r of report.scenarios) {
    const reason = (r.error ?? r.reason).replace(/\|/g, "\\|");
    lines.push(`| ${r.domain} | ${r.runIndex} | ${r.success ? "✅" : "❌"} | ${r.completed ? "✅" : "❌"} | ${r.iterations} | ${r.finalScore.toFixed(2)} | ${r.durationMs} | ${reason} |`);
  }
  const mdPath = path.join(outDir, "founder-dogfood-report.md");
  fs.writeFileSync(mdPath, lines.join("\n"), "utf8");
  return mdPath;
}

async function main(): Promise<void> {
  await registerAllGenerators();
  const activeGenerators = getActiveGeneratorNames();
  const scenarios = buildScenarios(activeGenerators);
  const runsPerScenario = toPositiveInt(getArg("runs"), 2);
  const maxIterations = toPositiveInt(getArg("iterations"), 3);
  const outDir = path.join(PROJECT_ROOT, "dogfood-output", `founder-dogfood-${nowStamp()}`);
  fs.mkdirSync(outDir, { recursive: true });

  console.log("🚀 Founder dogfood starting");
  console.log(`Branch: ${branchName()}`);
  console.log(`Active generators: ${activeGenerators.join(", ")}`);
  console.log(`Scenarios: ${scenarios.map(s => s.domain).join(", ")}`);
  console.log(`Runs per scenario: ${runsPerScenario}`);
  console.log(`Max iterations per run: ${maxIterations}`);
  console.log(`Output dir: ${outDir}`);

  const results: ScenarioResult[] = [];
  let counter = 0;
  const total = scenarios.length * runsPerScenario;
  for (const scenario of scenarios) {
    for (let i = 1; i <= runsPerScenario; i++) {
      counter += 1;
      console.log(`\n[${counter}/${total}] ${scenario.domain} run ${i}`);
      const result = await runScenario(scenario, i, maxIterations, outDir);
      results.push(result);
      console.log(`  ${result.success ? "✅" : "❌"} score=${result.finalScore.toFixed(2)} iterations=${result.iterations} duration=${result.durationMs}ms`);
      if (result.error) console.log(`  error: ${result.error}`);
    }
  }

  const successfulRuns = results.filter(r => r.success).length;
  const completedRuns = results.filter(r => r.completed).length;
  const averageScore = results.length ? results.reduce((sum, r) => sum + r.finalScore, 0) / results.length : 0;
  const averageIterations = results.length ? results.reduce((sum, r) => sum + r.iterations, 0) / results.length : 0;
  const report: Report = {
    timestamp: new Date().toISOString(),
    branch: branchName(),
    requestedRunsPerScenario: runsPerScenario,
    requestedMaxIterations: maxIterations,
    activeGenerators,
    scenarios: results,
    summary: {
      totalRuns: results.length,
      successfulRuns,
      failedRuns: results.length - successfulRuns,
      completionRate: results.length ? (completedRuns / results.length) * 100 : 0,
      averageScore,
      averageIterations,
    },
  };

  const jsonPath = path.join(outDir, "founder-dogfood-report.json");
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");
  const mdPath = writeMarkdown(report, outDir);
  console.log("\n=== Founder Dogfood Summary ===");
  console.log(`Successful: ${successfulRuns}/${results.length}`);
  console.log(`Completed loops: ${completedRuns}/${results.length}`);
  console.log(`Average score: ${averageScore.toFixed(2)}`);
  console.log(`Average iterations: ${averageIterations.toFixed(2)}`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`Markdown: ${mdPath}`);
}

main().catch(error => {
  console.error("Founder dogfood runner failed:", error);
  process.exit(1);
});
