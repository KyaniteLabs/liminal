# Electron Desktop Shell Implementation Plan

**Goal:** Give Sinter Studio a first-class Electron entrypoint that launches the existing Studio in a desktop window.

**Architecture:** The Electron main process supervises the existing Studio runtime instead of creating a second backend. Built GUI assets are served by the Studio backend for normal desktop launches; `--dev` keeps the current Vite-backed flow for local iteration.

**Tech Stack:** Electron, a local macOS app packager script, existing Node/Express Studio backend, existing React/Vite Studio frontend, Vitest static regression coverage.

---

### Task 1: Add Desktop Runtime Shell

**Files:**
- Create: `electron/main.cjs`
- Create: `electron/preload.cjs`
- Modify: `gui/start.js`

**Steps:**
1. Add an Electron main process that starts Studio through Electron's Node-compatible child mode.
2. Keep renderer isolation enabled with `contextIsolation`, `sandbox`, and no renderer Node integration.
3. Load built static Studio assets when present; fall back to the current Vite runner only in dev mode.
4. Serve `gui/dist` from the existing backend so desktop launches use one local origin for UI and API.

### Task 2: Add Commands and Packaging

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`
- Modify: `README.md`

**Steps:**
1. Add `desktop`, `desktop:dev`, `desktop:build`, `desktop:smoke`, and `desktop:package:mac` scripts.
2. Ignore generated Electron app output.
3. Document the shortest operator command path.

### Task 3: Add Regression Proof

**Files:**
- Create: `scripts/proof/electron-smoke.mjs`
- Create: `test/desktop/electron-shell.test.ts`

**Steps:**
1. Prove Electron is installed and main/preload scripts parse.
2. Assert security flags, external-link handling, permission scoping, Studio reuse, and package scripts.
3. Run targeted tests, typecheck, build, GUI build, and desktop smoke before committing.
