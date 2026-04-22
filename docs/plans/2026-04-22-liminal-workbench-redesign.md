# Liminal Workbench Redesign Implementation Plan

**Goal:** Build the first professional Liminal Studio workbench slice that replaces the tab-first GUI shell with a canvas-first creation workspace.

**Architecture:** Keep existing backend routes and bridge events. Refactor the React GUI into a workbench shell with command bar, left rail, center stage, right inspector, and bottom timeline. Start with a static/integrated shell using existing state, then move existing panels into the new layout incrementally.

**Tech Stack:** React, Vite, CSS custom properties, existing Express GUI backend, existing TUI bridge events, Vitest, Playwright screenshots.

---

### Task 1: Lock The Workbench State Model

**Files:**
- Create: `test/unit/gui-workbench-state.test.ts`
- Create: `gui/src/gui/workbenchState.ts`

**Step 1: Write the failing test**

Test that legacy tabs are mapped into workbench modes:

```ts
import { describe, expect, it } from 'vitest';
import { getWorkbenchMode, WORKBENCH_MODES } from '../../gui/src/gui/workbenchState';

describe('workbenchState', () => {
  it('maps old tabs into unified workbench modes', () => {
    expect(getWorkbenchMode('create').id).toBe('generate');
    expect(getWorkbenchMode('cockpit').id).toBe('generate');
    expect(getWorkbenchMode('live').id).toBe('review');
    expect(getWorkbenchMode('curator').id).toBe('review');
    expect(getWorkbenchMode('compost').id).toBe('evolve');
    expect(getWorkbenchMode('activity').id).toBe('observe');
    expect(WORKBENCH_MODES.map((mode) => mode.id)).toEqual(['generate', 'review', 'evolve', 'observe', 'settings']);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- test/unit/gui-workbench-state.test.ts --coverage=false`
Expected: FAIL because `workbenchState.ts` does not exist.

**Step 3: Implement minimal state module**

Create `gui/src/gui/workbenchState.ts` with:

```ts
export type WorkbenchModeId = 'generate' | 'review' | 'evolve' | 'observe' | 'settings';

export interface WorkbenchMode {
  id: WorkbenchModeId;
  label: string;
  legacyTabs: string[];
}

export const WORKBENCH_MODES: WorkbenchMode[] = [
  { id: 'generate', label: 'Generate', legacyTabs: ['create', 'cockpit', 'liveMusic'] },
  { id: 'review', label: 'Review', legacyTabs: ['live', 'curator'] },
  { id: 'evolve', label: 'Evolve', legacyTabs: ['compost'] },
  { id: 'observe', label: 'Observe', legacyTabs: ['activity'] },
  { id: 'settings', label: 'Settings', legacyTabs: ['config'] },
];

export function getWorkbenchMode(tab: string): WorkbenchMode {
  return WORKBENCH_MODES.find((mode) => mode.legacyTabs.includes(tab)) ?? WORKBENCH_MODES[0];
}
```

**Step 4: Verify**

Run: `npm run test -- test/unit/gui-workbench-state.test.ts --coverage=false`
Expected: PASS.

**Step 5: Commit**

```bash
git add gui/src/gui/workbenchState.ts test/unit/gui-workbench-state.test.ts
git commit -m "Define unified GUI workbench modes"
```

### Task 2: Introduce The Liminal Design Tokens

**Files:**
- Modify: `gui/src/index.css`
- Test: screenshot inspection

**Step 1: Add compatibility token layer**

Add new `--liminal-*` tokens in `:root`, then map old `--atelier-*` names to them temporarily:

```css
:root {
  --liminal-bg-void: #08090d;
  --liminal-surface-1: #10131a;
  --liminal-surface-2: #171b24;
  --liminal-surface-3: #202634;
  --liminal-line: rgba(151, 164, 190, 0.18);
  --liminal-line-strong: rgba(151, 164, 190, 0.34);
  --liminal-text: #eef3ff;
  --liminal-muted: #99a4b8;
  --liminal-dim: #687386;
  --liminal-cyan: #59e1ff;
  --liminal-violet: #8f5cff;
  --liminal-orchid: #c26bff;
  --liminal-green: #58c777;
  --liminal-amber: #f2b84b;
  --liminal-red: #d95763;

  --atelier-bg: var(--liminal-bg-void);
  --atelier-surface: var(--liminal-surface-1);
  --atelier-surface-raised: var(--liminal-surface-2);
  --atelier-border: var(--liminal-line);
  --atelier-border-strong: var(--liminal-line-strong);
  --atelier-text: var(--liminal-text);
  --atelier-text-muted: var(--liminal-muted);
  --atelier-text-dim: var(--liminal-dim);
  --atelier-accent: var(--liminal-cyan);
}
```

**Step 2: Remove one-note brown first impression**

Remove or replace the brown radial gradient in `body::before`.

**Step 3: Verify CSS build**

Run: `cd gui && npm run build`
Expected: PASS.

**Step 4: Commit**

```bash
git add gui/src/index.css
git commit -m "Refresh GUI design tokens for Liminal Studio"
```

### Task 3: Build The Workbench Shell

**Files:**
- Create: `gui/src/components/WorkbenchShell.tsx`
- Modify: `gui/src/App.tsx`
- Modify: `gui/src/index.css`

**Step 1: Write a smoke test if practical**

If React component testing is available, assert that `WorkbenchShell` renders `Liminal Studio`, `Generate`, `Review`, `Evolve`, `Observe`, `Settings`, and `Stage`.

**Step 2: Create `WorkbenchShell.tsx`**

Component props:

```ts
interface WorkbenchShellProps {
  activeMode: string;
  onModeChange: (legacyTab: string) => void;
  commandSlot: React.ReactNode;
  stageSlot: React.ReactNode;
  inspectorSlot: React.ReactNode;
  timelineSlot: React.ReactNode;
  leftSlot: React.ReactNode;
}
```

Layout:

- `.liminal-workbench`
- `.liminal-commandbar`
- `.liminal-left-rail`
- `.liminal-stage`
- `.liminal-inspector`
- `.liminal-timeline`

**Step 3: Integrate in `App.tsx`**

For the first slice:

- Default active tab becomes `create` or `cockpit`, not `config`.
- Use `WorkbenchShell` for main layout.
- Place prompt/run controls in command/stage.
- Place `OperatorCockpit` summary or role cards in inspector.
- Keep legacy panel rendering behind mode content until subsequent tasks.

**Step 4: Verify**

Run:

```bash
npm run build
cd gui && npm run build
```

Expected: both PASS.

**Step 5: Screenshot**

Run local GUI and capture:

```bash
npx playwright screenshot --full-page http://localhost:<vite-port>/ .omx/proof/gui-workbench/desktop.png
npx playwright screenshot --full-page --viewport-size=390,844 http://localhost:<vite-port>/ .omx/proof/gui-workbench/mobile.png
```

Expected: first viewport shows workbench/canvas, not config form.

**Step 6: Commit**

```bash
git add gui/src/components/WorkbenchShell.tsx gui/src/App.tsx gui/src/index.css .omx/proof/gui-workbench
git commit -m "Introduce canvas-first GUI workbench shell"
```

### Task 4: Move Settings Out Of The First Screen

**Files:**
- Modify: `gui/src/App.tsx`
- Modify: `gui/src/index.css`

**Step 1: Default to Generate mode**

Change initial GUI tab/mode so first paint is Generate.

**Step 2: Convert config form into Settings panel**

Settings remains reachable via left rail or command bar button. It must not be first-screen content.

**Step 3: Verify**

Run:

```bash
npm run test -- test/unit/gui-workbench-state.test.ts --coverage=false
npm run build
cd gui && npm run build
```

**Step 4: Screenshot**

Capture desktop/mobile first viewport.

**Step 5: Commit**

```bash
git add gui/src/App.tsx gui/src/index.css
git commit -m "Move GUI settings behind workbench mode"
```

### Task 5: Rename Current Product Identity Away From Atelier

**Files:**
- Modify: `gui/package.json`
- Modify: `gui/server.js`
- Modify: `gui/src/index.css`
- Modify: `gui/src/**/*.tsx`

**Step 1: Keep compatibility paths explicit**

Do not remove legacy config support. Change comments to “legacy Atelier compatibility”.

**Step 2: Rename package**

Change `gui/package.json` name from `atelier-gui` to `liminal-studio-gui`.

**Step 3: Rename user-facing and primary code-facing CSS**

Prefer new `liminal-*` classes for new workbench components. Do not do a risky repo-wide rename in one pass; leave compatibility wrappers until all components migrate.

**Step 4: Verify**

Run:

```bash
npm run test -- test/integration/gui-config-roles.test.js test/integration/gui-security-regression.test.js --coverage=false
npm run build
cd gui && npm run build
```

**Step 5: Commit**

```bash
git add gui/package.json gui/server.js gui/src
git commit -m "Retire Atelier identity from current GUI shell"
```

### Task 6: Final Visual QA And PR

**Files:**
- Create/update: `.omx/proof/gui-workbench/`

**Step 1: Run full focused verification**

```bash
npm run test -- test/unit/gui-workbench-state.test.ts test/unit/tui-bridge/BridgeLauncherConfig.test.ts test/integration/gui-config-roles.test.js --coverage=false
npm run build
cd gui && npm run build
npm run lint
```

**Step 2: Run screenshot verification**

Capture desktop/mobile screenshots.

**Step 3: Inspect screenshots**

Check:

- First viewport is a workbench.
- Preview/stage is visually dominant.
- Settings are not default.
- Text fits on mobile.
- Palette is not brown/gold dominant.
- No nested card stacks.

**Step 4: Open PR**

```bash
git push -u origin fix/gui-workbench-redesign-20260422
gh pr create --base main --head fix/gui-workbench-redesign-20260422
```

**Step 5: Monitor CI and reviews**

Address all actionable review comments before merge.
