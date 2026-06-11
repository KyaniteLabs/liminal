# Product UX/QoL audit — GUI, TUI, CLI, system (2026-06-11)

Method: live captures — GUI toured headless across all 9 views (backend-down AND bridge-up states, screenshots in `.quality/gui-audit/`), TUI launched in tmux with the screen captured, CLI help inspected. Run while the all-domains-at-A generation campaign proceeds.

## P0 — first-run/operator breakers

1. **TUI crashes with a raw Node stack trace when Go is missing** (`spawn go ENOENT`, unhandled `error` event): the launcher builds the Go binary at launch. Fix: preflight `go` with a friendly message + automatic fallback to the Ink TUI (`tui:ink` exists); ship/cached prebuilt binary preferred.
2. **`sinter tui` runs a full `tsc` rebuild (~90s) on every launch** (`tui: npm run build && …`). Fix: skip the build when dist is fresh (the daemon's HEAD-stamp pattern, `.quality/last-build-sha`, already solves this) — cold start should be <5s.
3. **GUI backend-down state is nearly silent**: a small "Connecting" pill; no banner naming the missing piece or the command to start it; console spams 502s. Each tab fails differently with developer-grade copy (`Failed to execute 'json' on 'Response': Unexpected end of JSON input` shown verbatim in Cockpit; raw "API not reachable" strips in Review). Fix: one degraded-state banner per missing dependency with the exact remedy command; never render fetch exceptions verbatim.

## P1 — trust & architecture

4. **Three backends, no supervisor, no shared health surface**: studio backend (`gui/start.js`), TUI bridge (:3000), preview server (:3456) overlap in role; the GUI cannot tell the user which is missing. Fix: one `/api/health` aggregate (per-dependency status + remedy) consumed by a single status indicator; `sinter studio` should supervise all required pieces.
5. **Settings/header assert state without evidence**: header shows `MODEL lmstudio / local-model` even when disconnected; Settings renders provider defaults that look like live config (machine default is MiniMax). Stamped-claims doctrine applies to UI: show "unknown (disconnected)" rather than a guess; hydrate Settings from real config and label the source.
6. **Stale brand copy**: masthead subtitle reads "Codex for creative coding" — wrong product name.
7. **TUI startup replays the entire archive as `[ArchivePlacement]` log spam** (hundreds of lines before the cockpit). Fix: those belong at debug level, or behind the bridge log file only.

## P2 — quality of life

8. **CLI help is a flat 40+ command list** — group into CREATE / CURATE (archive, taste, dream, garden) / OPERATE (tui, studio, bridge, serve) / INSPECT (report, fs, market, ledger), and add a 5-line "common flows" header. (The June-10 missing-commands gap is fixed; this is the next step.)
9. **Showpieces aren't surfaced**: archive-composed works (`scripts/quality/compose-archive.mjs` → `.quality/showcase/`) have no GUI/gallery surface; the system's best output is invisible to its own UI. A "Showcase" view (archive tops + composites) is the natural P1-composition product surface.
10. **GUI IA: tab content stacks under the persistent Generate hero** instead of switching views — Settings/Cockpit render below the hero on one scrolling page. Decide: real routes/views, or an intentional single-page flow with the hero collapsed on non-Generate tabs.
11. **Left rail scaffolding visible** ("Create tools +", "More +", empty "Session") in default state.
12. **Recurring temp leak**: every killed headless render leaks a Chrome profile (967 accumulated; 55 GB code_sign_clone incident 2026-06-11). Add a sweep of dead `puppeteer_dev_chrome_profile-*` (>1 day) to the daemon/watchman.

## Noted good

Skip-to-content link; honest empty states ("No artifact yet" + explanation); example placeholder prompt; Settings privacy copy ("keys stored locally… never sent to the frontend"); bridge startup banner names provider/model/log path.

## Suggested execution order

P0.2 (tui cold start, ~10 lines) → P0.1 (go preflight + Ink fallback) → P0.3 + P1.4 together (health aggregate + degraded banners) → P1.5/P1.6 (truthful header/settings + copy) → P2.9 (Showcase view — pairs with the composition direction) → rest.
