# Founder Manual Test Protocol

_Last updated: 2026-04-10_

## Quick launch
```bash
npm run tui
```

## Optional full dogfood sweep
If you want a broader automated run before the manual session, use:

```bash
npm run dogfood:founder -- --runs=2 --iterations=3
```

This runs multiple RalphLoop executions per active generator/domain and writes JSON + Markdown reports under `dogfood-output/`.
