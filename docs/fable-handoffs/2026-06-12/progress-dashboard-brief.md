# Build Brief: "Progress" — visual proof dashboard for Sinter's self-improvement loop

You are building a dashboard inside the Sinter repo (`~/workspaces/liminal`) that makes the
self-improvement process VISIBLE: a contact sheet of generations per domain, scores improving
over time, and per-piece metadata (score, model era, provenance). The whole loop currently runs
invisibly in a daemon; this page is the owner's window into it.

## Hard rules (non-negotiable)
1. Branch `feat/progress-dashboard`, push after committing, land via Forgejo PR (main is protected):
   `TOKEN=$(printf 'protocol=https\nhost=git.kyanitelabs.tech\n\n' | git credential fill | awk -F= '/^password=/{print $2}')`
   create: `curl -s -X POST -H "Authorization: token $TOKEN" -H "Content-Type: application/json" https://git.kyanitelabs.tech/api/v1/repos/KyaniteLabs/liminal/pulls -d '{"head":"feat/progress-dashboard","base":"main","title":"...","body":"..."}'` ; merge: same URL + `/pulls/<N>/merge` with `{"Do":"merge"}`. Never print the token.
2. NEVER write to `~/.sinter/**` — all data access is read-only.
3. NEVER commit `docs/validation/self-improve-ledger.jsonl` (live daemon file).
4. Use the existing sinter design tokens (`gui/src/index.css` `:root`: `--sinter-bg-void`, `--sinter-surface-1/2`, `--sinter-text`, `--sinter-muted`, `--sinter-cyan`, `--font-display`/`--font-mono`). Dark theme only. No new CSS frameworks.
5. Verify with a headless screenshot before claiming done (puppeteer is installed; pattern: launch headless, goto, waitUntil 'domcontentloaded', sleep 4s, screenshot). Zero console pageerrors.
6. Do not weaken or skip any failing check. If blocked, write findings to `docs/fable-handoffs/2026-06-12/dashboard-findings.md` and stop.

## Where it lives
Add to the EXISTING studio backend `gui/server.js` (Express, port 5174):
- `GET /progress` — server-rendered static HTML page (no React; inline `<style>`/`<script>` is fine).
- `GET /api/progress/data` — JSON aggregation endpoint (below).
The GUI's Showcase rail already links views; OPTIONALLY add a plain `<a href="http://localhost:5174/progress">` somewhere harmless in the GUI nav, but the standalone page is the deliverable.

## Data sources (all already exist)
1. **Archive**: `~/.sinter/archive/quality_archive.json` → `{ archives: { <domain>: Entry[] } }`.
   Entry: `{ id, domain, prompt, output, qualityScore, createdAt, metadata }`.
   Key metadata: `metadata.renderMeasure` (gen-time verdict/luminance), `metadata.rescore`
   (`{ priorScore, rescoredAt, provenance }` — present on entries re-normalized 2026-06-12;
   prior→current delta is the HONESTY story, show it as `0.95 → 0.82`), `metadata.quarantinedAt` (exclude).
2. **Ledger**: `docs/validation/self-improve-ledger.jsonl` (newline JSON, one line per daemon cycle):
   `{ ts, codeSha, targetedDomains[], scores[], admitted, after: { archive, health } }`.
   `admitted` exists only on recent lines (older lines: treat as null, not 0).
3. **Live render of ANY entry**: `GET /api/archive/:id/render` (same server!) — returns a
   self-contained HTML page for the piece (domain-aware wrapping already handled). Use it as
   `<iframe loading="lazy" sandbox="allow-scripts" src="/api/archive/<id>/render">` thumbnails.
4. Model attribution: entries do NOT reliably record their generator model (historical gap).
   Derive an honest "model era" label: all entries = `glm-5v-turbo` era, EXCEPT domain `three`
   entries with `createdAt >= 2026-06-12T16:00Z` = `MiniMax-M3` (routing began then). Label the
   field "model (era-derived)" — do not present it as recorded fact. If
   `metadata.generatorModel` exists on an entry, prefer it.

## Page design (one page, three sections)
1. **Header strip**: per-domain sparkline of archive-entry `qualityScore` vs `createdAt`
   (tiny inline SVG, no chart lib) + current top/floor per domain + total admitted in the last
   24h from the ledger. This is the "it's improving" proof at a glance.
2. **Cycle timeline**: horizontal bar list of the last ~40 ledger lines: time, targeted domains,
   scores, `admitted` (highlight admitted>0 in cyan — these are the wins). Mark the
   2026-06-12 re-normalization moment with a labeled divider ("scores became honest here").
3. **Contact sheet**: tabs or stacked sections per visual domain (p5, glsl, three, hydra, svg,
   ascii, textgen, kinetic). Each entry = card with lazy iframe thumb (~240px), score badge,
   `prior → current` rescore delta when present, model era, createdAt, prompt (truncated,
   title-attribute full), id in mono. Sort newest first. Cap initial render to 8 per domain with
   a "show all" toggle per domain (160 live iframes at once will melt the machine — lazy + capped
   is mandatory).
4. Auto-refresh the data (not the iframes) every 60s via the JSON endpoint; show "last updated".

## Acceptance checklist
- [ ] `node gui/start.js` (PORT=5174) serves `/progress`; page renders with real data.
- [ ] Sparklines show per-domain score-over-time from the real archive.
- [ ] At least one rescored entry visibly shows `prior → current` (e.g. 0.95 → 0.82).
- [ ] Cycle timeline shows the recent `admitted 1` and `admitted 5` lines highlighted.
- [ ] Lazy iframes: initial page load spawns ≤ 8 iframes per domain.
- [ ] Headless screenshot taken and inspected; zero pageerrors.
- [ ] PR created + merged via the recipe; branch deleted after.
