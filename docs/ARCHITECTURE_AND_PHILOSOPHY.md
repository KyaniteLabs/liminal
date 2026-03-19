# Architecture and Philosophy

## Substrate

Atelier’s substrate is the fixed structure that drives each run: an optional prompt (which may include `{{context}}`), context injection from the accumulated world state, evaluation via the CreativeEvaluator, and termination via the promise string, max-iterations cap, and optional quality gate. Together these define how the agent sees the world and when it stops.

## Loop start

Each run begins with a human-supplied prompt and an optional seed. The prompt is stable across iterations; the seed can bootstrap initial code or parameters. The loop then repeatedly generates, evaluates, and accumulates until a termination condition is met.

## Curation

Users curate rather than micromanage: they control visibility (what the agent sees in context) and high-level control (prompt, limits, quality threshold). The system is designed so that curation of prompts and parameters shapes outcomes without requiring low-level editing of generated code.

## Full GUI

The primary interface is a full graphical UI where users start runs, view iterations, inspect the gallery, and export results. CLI and programmatic API remain available for automation and integration.

## Emergent recursion / computational life

The loop is a sandbox for self-improving, recursive behavior: the same prompt over a changing world can produce emergent refinement. The design tolerates (and optionally encourages) computational-life-style dynamics within safe bounds—sandboxed execution and clear termination prevent runaway or unsafe self-modification.

## Cloud and local LLMs

Atelier supports both cloud and local LLM backends. Users can use a hosted API (e.g. Inception) for speed and quality or run fully local (e.g. Ollama) for privacy and offline use; the loop and substrate are backend-agnostic.

## Path safety and sandbox

Output, project name, gallery paths, and seed identifiers are validated so paths cannot escape the intended base directory (`normalizePath`, `assertSafeSegment`). User-controlled paths (e.g. `--output`, project name, export path) are resolved against the current working directory or gallery base and rejected if they would escape. Sandbox execution (Puppeteer) runs generated code with timeout and network restrictions; self-improvement has depth and rate limits.
