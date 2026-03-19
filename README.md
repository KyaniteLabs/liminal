# Atelier — Creative Coding Agent

> "The code evolves. You curate."

A generative art system with an internal Ralph-Wiggum Loop for self-recursive iteration and improvement.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run tests
npm test

# Generate your first creative work
atelier --prompt "Create a calming blue particle system"
```

## 📖 What is Atelier?

Atelier is a creative coding agent that generates emergent generative art through self-recursive iteration. The same prompt runs repeatedly, but the "world" (files, context, history) changes each time, creating a feedback loop where the agent critiques and improves its own previous output.

### Key Features

- **Internal Ralph-Wiggum Loop**: Self-recursive iteration with automatic termination
- **Quality Gates**: Creative evaluation with minimum score threshold (≥0.7)
- **Multiple Generators**: p5.js sketches (particle systems, cellular automata)
- **Live Preview**: Built-in preview server for real-time visualization
- **Gallery System**: Save/load iterations with full history tracking
- **Export Options**: HTML, JavaScript, and ZIP archive exports
- **Live Music Coding**: Support for Strudel, Hydra, Sonic Pi, and p5.js + Web Audio

## 🏗️ Architecture

### Core Components

- **RalphLoop**: Iteration engine with safety mechanisms (max-iterations, timeout protection)
- **PromptStore**: Consistent prompt management with context injection
- **ContextAccumulation**: State management and iteration history
- **CreativeEvaluator**: Quality gates for creative and technical assessment
- **PromiseDetector**: Exact string matching for termination detection
- **P5Generator**: p5.js sketch generation (particle systems, cellular automata)
- **PreviewServer**: Live preview server (localhost:3456)
- **Renderer**: Screenshot capture with Puppeteer
- **Gallery**: Iteration persistence and archive management
- **Exporter**: Multi-format export (HTML, JS, ZIP)

### Safety Mechanisms

- **Max-iterations limit**: 20 iterations by default
- **Timeout protection**: 30 minutes per iteration
- **Quality gates**: Minimum score of 0.7 required
- **Error tolerance**: Graceful error handling with configurable strictness

## 💻 Usage

### Command Line Interface

```bash
# Basic usage
atelier --prompt "Create a particle system"

# With custom options
atelier --prompt "Generate cellular automata" \
  --max-iterations 10 \
  --output ./my-art \
  --project my-experiment

# Short flags
atelier -p "Interactive sketch" -m 5 -o ./output
```

#### CLI Options

- `--prompt, -p`: Creative prompt (required)
- `--max-iterations, -m`: Maximum iterations (default: 20)
- `--output, -o`: Output directory (default: ./output)
- `--project, -j`: Project name for gallery (default: auto-generated)

### Programmatic Usage

```javascript
import { run } from 'atelier';

// Basic usage
const result = await run('Create a calming particle system');

// With options
const result = await run('Generate cellular automata', {
  maxIterations: 10,
  output: './my-art',
  project: 'my-experiment',
  tolerateErrors: true,
  minQualityScore: 0.8
});

console.log(`Generated ${result.iterations} iterations`);
console.log(`Final score: ${result.finalScore}`);
console.log(`Completed: ${result.completed}`);
console.log(`Reason: ${result.reason}`);
```

### Configuration

Create `config/atelier.json` for project-wide settings:

```json
{
  "name": "atelier",
  "version": "1.0.0",
  "loop": {
    "maxIterations": 20,
    "timeoutMinutes": 30,
    "completionPromise": "COMPLETE"
  },
  "creative": {
    "defaultFramework": "p5.js",
    "evaluationCriteria": ["aesthetic", "technical", "novelty"],
    "minQualityScore": 0.7
  },
  "gallery": {
    "autoSave": true,
    "maxHistoryPerProject": 50
  },
  "renderer": {
    "port": 3456,
    "screenshotOnIteration": true
  }
}
```

### Using cloud vs local LLM

Atelier can use a **cloud** LLM (e.g. Inception) or a **local** LLM (e.g. Ollama). Configuration is driven by environment variables and optional config files.

**Cloud (e.g. Inception)**  
Set the provider and credentials via env (or in `~/.atelier/config.json` / project `config/atelier.json`):

- `ATELIER_LLM_PROVIDER=inception` — use the Inception-compatible API (default).
- `ATELIER_LLM_BASE_URL` — API base URL (e.g. `https://api.inceptionlabs.ai/v1`). Omit to use the default Inception URL.
- `ATELIER_LLM_MODEL` — model name (e.g. `inception-001`).
- `ATELIER_LLM_API_KEY` or `INCEPTION_API_KEY` — API key for auth.

Example:

```bash
export ATELIER_LLM_PROVIDER=inception
export ATELIER_LLM_BASE_URL=https://api.inceptionlabs.ai/v1
export ATELIER_LLM_MODEL=inception-001
export ATELIER_LLM_API_KEY=your-api-key
atelier --prompt "Create a particle system"
```

**Local (Ollama)**  
Run [Ollama](https://ollama.ai) locally, then point Atelier at it:

- `ATELIER_LLM_PROVIDER=ollama` — use the Ollama API.
- `ATELIER_LLM_BASE_URL` — Ollama base URL (default `http://localhost:11434`).
- `ATELIER_LLM_MODEL` — model name (e.g. `llama3.2`). No API key needed.

Example:

```bash
# Start Ollama and pull a model (e.g. llama3.2)
ollama serve
ollama pull llama3.2

export ATELIER_LLM_PROVIDER=ollama
export ATELIER_LLM_MODEL=llama3.2
atelier --prompt "Create a particle system"
```

Integration tests for the dual-LLM path (`test/integration/dual-llm.test.ts`) run against the configured backend when available and skip with a clear message when the backend is unreachable or not configured (e.g. no API key, Ollama not running).

## 🧪 Testing

```bash
# Run all tests
npm test

# Run integration tests only
npm run test:integration

# Run E2E tests (full loop, seed/quality, GUI, sandbox; skip when backends unavailable)
npm run test:e2e

# Run with coverage (from source: src/)
npm run test:coverage

# Watch mode
npm run test:watch

# Type checking
npm run typecheck

# Lint (project ESLint config)
npm run lint

# Performance benchmarks
npm run benchmark
```

**E2E with real LLM (Ollama):** Required E2E tests use Ollama at `http://localhost:11434`. Start Ollama and run `ollama pull mistral` (or `ollama pull llama3.2`) before running E2E. Cloud E2E (Inception/OpenAI) is optional and skips when the API key is unset.

### Test structure

- **Unit** (`test/unit/`): RalphLoop, ConfigLoader, path sanitization, CreativeEvaluator, gallery, exporter, TUI, sandbox, etc.
- **Integration** (`test/integration/`): full-loop, ralph-loop, dual-LLM, CLI, preview-server, GUI config API.
- **Generators** (`test/generators/`): p5-generator, particle-system, cellular-automata, p5-generator-llm, prompt-to-generator-params.
- **E2E** (`test/e2e/`): full-loop with cloud LLM, full-loop with local Ollama, seed + quality gate, GUI config/gallery, sandbox + requestImprovement. E2E tests skip with a clear message when the required backend (API key, Ollama, Chrome) is unavailable.

### Test results (current)

- **Total:** 53 suites, 753 tests.
- **Passing:** 745 tests (50 suites).
- **Known failures:** 8 tests in 3 integration suites — promise-detection and “different code each iteration” (depend on LLM/template output) and one GUI test (expects different `/gui` content). See `IMPACT_ANALYSIS.md` for details.
- **E2E:** 5 suites, 9 tests; all pass or skip when backends are missing.

### Coverage

- Coverage is collected from **source** (`src/**/*.ts`, `src/**/*.tsx`); no build required. Thresholds (e.g. 80%) are configured in `jest.config.js` and enforced by `npm run test:coverage`.

## 🎵 Live Music Coding

Atelier supports **live music coding** for performative, real-time generative art:

### Supported platforms

- **Strudel**: Web-based TidalCycles (browser-native)
- **Hydra**: Audio-reactive visuals (WebGL + Web Audio)
- **Sonic Pi**: Ruby-based (OSC + MIDI)
- **FoxDot**: Python-based (OSC)
- **p5.js + Web Audio**: Browser-native DSP

### CLI

```bash
atelier --prompt "ambient glitch set, 20 min" \
  --mode live-music \
  --output ./set
```

This writes `strudel.js` and `hydra.js` to the output directory. Optional project config `config/atelier.json` can include `live` (e.g. `midiOutput`, `oscHost`, `oscPort`, `syncMode`).

### Programmatic API

```javascript
import { generateMusic, generateVisuals, generateMusicToVisual } from 'atelier';

const musicOutput = await generateMusic("anxious post-rock build", { musicPlatform: 'strudel' });
const visualOutput = await generateVisuals({ prompt: "same mood, audio reactive", platform: 'hydra' });

// Music-to-visual bridge (BPM/FFT derived from music, passed to visuals)
const bridge = await generateMusicToVisual("ambient glitch", { musicPlatform: 'strudel', visualPlatform: 'hydra' });
```

## 📊 Performance

### Benchmarks

- **Iteration speed**: Target &lt; 5 minutes per iteration  
- **Memory usage**: Target &lt; 500MB per iteration  
- **Test execution**: 753 tests (745 passing; 8 known integration failures). E2E skips when backends unavailable.

Run benchmarks:

```bash
npm run benchmark
```

## 🔧 Development

### Project Structure

```
atelier-workspace/
├── src/
│   ├── core/              # RalphLoop, Evaluator, PromiseDetector, PromptStore, ContextAccumulation
│   ├── generators/        # P5GeneratorLLM, ParticleSystem, CellularAutomata
│   ├── render/            # PreviewServer, Renderer
│   ├── gallery/           # Gallery, SeedArchive
│   ├── export/            # Exporter
│   ├── config/            # ConfigLoader, PromptHistory
│   ├── llm/               # LLMClient
│   ├── sandbox/           # SandboxRunner
│   ├── improvement/       # requestImprovement, SelfImprovement
│   ├── music/             # generateMusic
│   ├── musicToVisual/     # generateMusicToVisual
│   ├── tui/               # TUI (Run/Stop, timeline, gallery)
│   └── utils/             # normalizePath, promptToGeneratorParams
├── gui/                   # Full GUI (Vite + React + Express)
├── test/
│   ├── unit/
│   ├── integration/
│   ├── generators/
│   └── e2e/
├── config/                # atelier.json (project config)
├── gallery/               # Saved iterations
└── output/                # Exported files
```

### Build Commands

```bash
# TypeScript compilation
npm run build

# Generate documentation
npm run docs

# Run linting
npm run lint
```

## 🤝 Contributing

### Development Workflow

1. **Fork and clone** the repository
2. **Install dependencies**: `npm install`
3. **Create feature branch**: `git checkout -b feature/my-feature`
4. **Make changes** with TDD approach:
   - Write failing test first
   - Implement minimum to pass
   - Refactor and improve
5. **Run tests**: `npm test`
6. **Check coverage**: `npm run test:coverage`
7. **Type check**: `npm run typecheck`
8. **Commit changes** with conventional commits
9. **Push and create** pull request

### Code Quality Standards

- **Test coverage**: Must exceed 80%
- **TypeScript**: Strict type checking required
- **TDD approach**: Red-Green-Refactor cycle
- **Documentation**: Comment complex logic
- **Error handling**: Graceful degradation

## 📝 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- **Ralph-Wiggum Loop pattern**: Geoffrey Huntley
- **Emergent Garden**: Artificial life and emergence inspiration
- **Blaise Agüera y Arcas**: "Computational Life" research
- **p5.js**: Generative art framework
- **Lenia**: Continuous cellular automata

---

Built with TDD. See **IMPACT_ANALYSIS.md** for full impact analysis, test summary, and documentation index.

**Status**: ✅ Production-ready (8 known integration test failures; see IMPACT_ANALYSIS.md)  
**Version**: 1.0.0  
**Tests**: 745 passing, 8 known failures (integration; LLM/GUI-dependent)

