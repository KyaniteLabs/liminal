# Agent B - Dogfood Testing

**Your ONLY task:** Run the tests and report results.

## Quick Start

```bash
cd /Users/simongonzalezdecruz/workspaces/liminal

# Run all Agent B tests (63 tests)
npx tsx scripts/run-agent-b.ts
```

That's it. The script will:
- Run all 63 tests sequentially
- Log results to `dogfood-telemetry.log`
- Save outputs to `landing-live/`
- Print summary at the end

## Manual Run (if needed)

If you need to run a single test:

```bash
# Format: test-single.sh <domain> <model> <prompt>
./scripts/test-single.sh p5 granite-1b "Create a calming blue particle system"
```

## What to Report

After completion, provide:
1. Pass/fail count
2. Best output per domain (highest score)
3. Any errors or patterns noticed

## Test Matrix

| Domain | Models to Test |
|--------|----------------|
| p5 | granite4:1b, granite4:350m, qwen3.5:2b, phi4-mini, gemma3:4b, lfm2.5, kimi-k2.5 |
| glsl | (same 7 models) |
| three | (same 7 models) |
| strudel | (same 7 models) |
| hydra | (same 7 models) |
| tone | (same 7 models) |
| html | (same 7 models) |
| ascii | (same 7 models) |
| remotion | (same 7 models) |

**Total: 63 tests (9 domains × 7 models)**

## Telemetry Format

Results are automatically logged:
```
[TIME] Domain: p5 | Model: granite-1b | Status: ✅ | Duration: 4500ms | Score: 0.85 | Size: 3241b
```

## Success Criteria
- Visual domains (p5, glsl, three): Score >= 0.6
- Code domains (html, ascii, remotion): Score >= 0.4
- Music domains (strudel, hydra, tone): Valid output format

---

# POST-TESTING INSTRUCTIONS

After all 63 tests complete, do the following:

## 1. Analyze Results

```bash
# View summary
cat dogfood-telemetry.log | grep "Status: ✅" | wc -l  # Count passes
cat dogfood-telemetry.log | grep "Status: ❌" | wc -l  # Count fails

# Best per domain
cat dogfood-telemetry.log | grep "Domain: p5" | sort -k8 -rn | head -1
cat dogfood-telemetry.log | grep "Domain: glsl" | sort -k8 -rn | head -1
# ... etc for all 9 domains
```

## 2. Select Landing Page Gallery

Pick the **4 best working examples**:

| Gallery Slot | Selection Criteria |
|--------------|-------------------|
| Top-Left (p5) | Highest score p5 output |
| Top-Right (GLSL) | Highest score GLSL output |
| Bottom-Left (Three.js) | Highest score Three.js output |
| Bottom-Right (Alt) | Best from strudel/hydra/tone/html/ascii |

Copy winners to showcase folder:
```bash
cp landing-live/p5-{best-model}.html landing-assets/showcase/p5-best.html
cp landing-live/glsl-{best-model}.html landing-assets/showcase/glsl-best.html
cp landing-live/three-{best-model}.html landing-assets/showcase/three-best.html
cp landing-live/{alt-domain}-{best-model}.html landing-assets/showcase/alt-best.html
```

## 3. Update Landing Page

Edit `index.html` gallery section:
- Update iframe `src` attributes to point to new showcase files
- Update metadata (model name, score, description)

## 4. Document Findings

Create brief report covering:
- Overall pass/fail rate
- Best performing models per domain
- Worst performing models (to avoid)
- Any patterns or issues observed

## 5. Update DOGFOOD_QUEUES.md

Mark completed tests with ✅ in the Status column.
