# Liminal — Feature Viability Analysis

**Date:** 2026-04-06
**Status:** Draft
**Classification:** Internal — Proprietary
**Author:** Generated from deep codebase exploration + market research

---

## A. Executive Summary

Liminal is a creative coding engine that combines iterative LLM generation, multi-domain code output (p5.js, Three.js, GLSL, Hydra, Strudel, Tone.js, Remotion, ASCII, generative text), quality scoring, evolutionary optimization, and cross-domain composition into a single system.

### Top 3 Opportunities

1. **Creative Coding SaaS** ($10-30/mo) — The fastest path to revenue. Most of the pipeline works today. Target: creative coders, artists, educators.
2. **API / Engine Licensing** ($0.01-0.10/generation) — Let other tools embed Liminal's generation brain. High-value, low-volume.
3. **Programmatic Video Studio** ($50-500/video) — Marketing teams need video at scale. Liminal has Remotion + narrative pipeline.

### Top 3 Risks

1. **LLM dependency** — Core value requires external LLM APIs. Price changes or deprecations are existential.
2. **Shallow quality scoring** — Regex-based evaluation doesn't validate against human judgment. Low-quality outputs will erode trust.
3. **Competitive response** — Midjourney, Runway, or OpenAI could add "creative code output" in a single sprint. They have 100x the resources.

### The Bottom Line

Liminal's strongest asset is **integration breadth** — 9 creative domains working end-to-end with iterative generation, evolutionary optimization, and cross-domain composition. No single component is algorithmically novel, but the orchestration is real engineering that would take 6-12 months to replicate from scratch. The **IntuitionEngine** (Thompson Sampling + CreativeWorldModel + DreamEngine + ProceduralTier) is the most commercially interesting subsystem because it gets smarter with usage — a potential data flywheel.

**Recommendation:** Proprietary license, start with SaaS + API, invest in closing the meta-harness feedback loop and validating quality scoring against human judgment.

---

## B. Honest Capability Assessment

### What Liminal Does Well

| Capability | Maturity | Commercial Value |
|---|---|---|
| Multi-domain code generation (9 domains) | Production | High — nobody else does this breadth |
| Iterative refinement (RalphLoop) | Production | Medium — standard optimization loop, but well-orchestrated |
| IntuitionEngine (model selection + learning) | Production | High — gets smarter with usage, potential flywheel |
| Audio → visual mapping pipeline | Production | Medium — functional but standard DSP techniques |
| Composition engine (multi-layer) | Production | Medium — 9 adapters with cross-layer state |
| Compost mill (creative memory) | Production | Low — collision strategies are trivial, LLM does real work |
| Export pipeline (HTML, JS, ZIP, MP4, GIF, WebM) | Production | Medium — solid plumbing |
| Preview server + gallery | Production | Medium — foundation for SaaS UI |
| Embedding-based semantic search | Production | Low — standard SBERT, no domain-specific training |

### What Liminal Does NOT Do Well

| Gap | Impact | Fix Effort |
|---|---|---|
| Quality scoring is regex heuristics, not validated | High — users will notice bad outputs passing gates | Medium (collect human ratings, retrain) |
| Meta-harness is open-loop (logs but doesn't auto-adapt) | High — missing the most valuable feedback mechanism | Medium (auto-prompt rewriting + model routing) |
| No RLHF or preference learning pipeline | High — no data flywheel from user feedback | High (needs infrastructure) |
| No web UI (CLI only) | Critical — most users won't install a CLI tool | High (full frontend) |
| No auth, rate limiting, or multi-tenancy | Critical — can't serve multiple users | Medium |
| Evolutionary algorithms are placeholder-grade | Medium — IGA is not a real GA, MetaMode is simulated | Medium |
| Cross-domain crossover is hand-coded, not learned | Medium — brittle mappings, doesn't generalize | Medium |
| LIR is standard AST metadata, not creative semantics | Low — marginal improvement over regex | Low priority |

### The IntuitionEngine — Hidden Gem

The most commercially interesting subsystem. Located in `src/intuition/`:

- **ThompsonSampler** — Bayesian bandit for model/strategy selection. Gets more confident with each generation.
- **CreativeWorldModel** — K-NN quality predictor from code behavior vectors. Learns what good output looks like per domain.
- **DreamEngine** — Offline exploration during idle time. Runs simulated generations to discover better strategies without user-facing cost.
- **SleepScheduler** — Determines when to dream based on activity patterns.
- **ProceduralTier** — Caches high-confidence decisions. When a domain+model+strategy combo consistently scores well, it skips full evaluation.
- **ForgettingCurve** — Ebbinghaus-inspired decay. Old, low-quality memories fade. Recent, high-quality ones are reinforced.
- **MemoryBudget** — Enforces capacity limits across all stores.
- **MemoryConsolidator** — Compresses raw episodes into reusable patterns.

**Why this matters commercially:** This is a learning system that improves with every generation. The more people use Liminal, the better the model selection and quality prediction becomes. This is a genuine data flywheel — accumulated usage data makes the product better for everyone, which attracts more users, which generates more data. This is the strongest argument for proprietary licensing.

### Infrastructure Cost Per Output Type

| Output | Dependencies | Compute Cost | Time |
|---|---|---|---|
| p5.js / HTML / JS code | LLM API only | ~$0.01-0.05 | 3-15s |
| Three.js HTML | LLM API only | ~$0.01-0.05 | 3-15s |
| GLSL shader | LLM API only | ~$0.01-0.05 | 3-15s |
| Hydra / Strudel / Tone.js | LLM API only | ~$0.01-0.05 | 3-15s |
| ASCII / Text art | LLM API only | ~$0.01-0.05 | 3-15s |
| PNG screenshot | LLM + Puppeteer | ~$0.02-0.06 | 5-20s |
| JPEG screenshot | LLM + Puppeteer | ~$0.02-0.06 | 5-20s |
| MP4 video (canvas) | LLM + Puppeteer + FFmpeg | ~$0.05-0.30 | 30-120s |
| MP4 video (Remotion) | LLM + Remotion + Chrome | ~$0.10-0.50 | 30-180s |
| WebM / GIF | LLM + FFmpeg | ~$0.05-0.30 | 20-90s |
| ZIP archive | LLM + archiver | ~$0.02-0.06 | 5-15s |
| Scores (visual/audio) | Already-rendered buffers | ~$0.001 | <1s |

**Average per creative output (with 3-5 iterations):** $0.05-0.30
**At $20/mo subscription:** Supports ~65-400 generations (depending on output type)

---

## C. Market Landscape Analysis

### Direct Competitors — Creative Coding Tools

| Tool | Price | What It Does | Liminal's Advantage |
|---|---|---|---|
| p5.js Web Editor | Free | Browser-based p5.js IDE | Liminal generates code; editor doesn't |
| Processing IDE | Free | Desktop creative coding IDE | Liminal adds LLM generation + iteration |
| Shadertoy | Free | Browser GLSL editor + community | Liminal adds generation + quality scoring |
| Strudel REPL | Free | Browser live coding music | Liminal adds multi-domain composition |
| openFrameworks | Free | C++ creative coding toolkit | Different market (C++ vs web) |
| TouchDesigner | $0-600 | Professional real-time visuals | Liminal adds AI generation; TD is manual |
| Max/MSP | $250-400 | Visual programming for music/art | Different paradigm (node-based vs code) |

### Adjacent Competitors — AI Creative Tools

| Tool | Price | What It Does | Gap vs Liminal |
|---|---|---|---|
| Midjourney | $10-60/mo | AI image generation | Outputs images, not editable code |
| DALL-E 3 | $0.04/image | AI image generation | Outputs images, not editable code |
| Runway ML | $12-28/mo | AI video generation | Outputs video, not editable code |
| Stable Diffusion | Free (self-host) | AI image generation | Outputs images, not editable code |
| Suno | $8-10/mo | AI music generation | Outputs audio, not editable patterns |
| Udio | $8-10/mo | AI music generation | Outputs audio, not editable patterns |
| Sora | $20/mo | AI video generation | Outputs video, not editable code |
| Claude / ChatGPT | Free-$20/mo | General LLM, can generate code | Single-pass, no iteration, no quality scoring |

### Commercial Creative Platforms

| Tool | Price | Revenue Model | Liminal's Angle |
|---|---|---|---|
| Figma | $0-75/mo | SaaS subscription | Liminal generates; Figma designs manually |
| After Effects | $22/mo | Adobe subscription | Liminal generates; AE composites manually |
| Resolume | $400-1000 | One-time license | Liminal generates content; Resolume performs live |
| Unity | $0-2040/yr | Subscription + revenue share | Different market (games vs generative art) |
| Remotion | Free (OSS) | Open source + consulting | Liminal uses Remotion as rendering backend |

### The Gap Nobody Fills

**Nobody combines all of these in one tool:**
1. Iterative LLM generation with quality gates
2. Multi-domain creative code output (9 domains)
3. Automated quality scoring (visual + audio)
4. Cross-domain composition (music + visuals + interaction)
5. Evolutionary optimization (MAP-Elites, novelty search)
6. Learning from usage (IntuitionEngine, Thompson Sampling)

The closest workflow today: Claude/ChatGPT for generation → paste into p5.js editor → manually iterate → export. No scoring, no multi-domain, no learning, no composition.

---

## D. Use Case Viability Matrix

### Scoring Key
- **1** = Very Low | **2** = Low | **3** = Medium | **4** = High | **5** = Very High

### Tier 1 — Build Now (High Viability)

#### 1. Creative Coding SaaS

> Web app: type a prompt → get iterative creative code across 9 domains → gallery → export.

| Dimension | Score | Notes |
|---|---|---|
| Technical Feasibility | 4 | Most pipeline works today. Needs web UI + auth + billing. |
| Market Demand | 4 | p5.js alone has millions of users. Creative coding is mainstream. |
| Revenue Potential | 3 | $10-30/mo subscription. Constrained by LLM API costs. |
| Competitive Moat | 2 | LLM orchestration is replicable. Quality data is the moat. |
| **Overall** | **3.3** | **Fastest path to revenue. Validates demand.** |

**Target users:** Creative coders, digital artists, design students, educators
**Key risk:** Conversion rate from free tools (p5 editor, Shadertoy) to paid SaaS

#### 2. API / Engine Licensing

> Let other apps embed Liminal's generation + iteration + scoring engine via API.

| Dimension | Score | Notes |
|---|---|---|
| Technical Feasibility | 3 | Needs API layer, auth, rate limiting, billing, documentation. |
| Market Demand | 3 | Niche but high-value: education companies, creative tool builders, game studios. |
| Revenue Potential | 4 | $0.01-0.10/generation, $500-5000/mo enterprise licenses. |
| Competitive Moat | 3 | Integration breadth + accumulated quality data + model routing expertise. |
| **Overall** | **3.3** | **High margin, low volume. Best paired with SaaS.** |

**Target users:** EdTech companies, creative tool builders, game studios, design agencies
**Key risk:** Enterprise sales cycle is long. API reliability must be production-grade.

#### 3. Generative Art Platform

> Generate → iterate → quality gate → mint as NFT or sell as print.

| Dimension | Score | Notes |
|---|---|---|
| Technical Feasibility | 3 | Generation works. Minting/printing is plumbing. |
| Market Demand | 3 | Art Blocks proved the model. NFT market is down but recovering. |
| Revenue Potential | 4 | Per-sale commission (5-15%) + subscription for artists. |
| Competitive Moat | 2 | Quality scoring differentiates, but art platforms are crowded. |
| **Overall** | **3.0** | **Revenue potential is high but market is volatile.** |

**Target users:** Generative artists, NFT creators, digital art collectors
**Key risk:** NFT market sentiment. Print-on-demand margins are thin.

### Tier 2 — Build Next (Medium Viability)

#### 4. Live Performance Tool

> Real-time VJ/digital instrument: Strudel (music) + Hydra (visuals) + p5.js (overlays) with live-coded parameters.

| Dimension | Score | Notes |
|---|---|---|
| Technical Feasibility | 3 | Composition engine exists. Needs real-time sync + performance UI. |
| Market Demand | 3 | Algorave/live coding community is small (~10K globally) but passionate. |
| Revenue Potential | 2 | $30-80 one-time purchase. Small market. |
| Competitive Moat | 3 | Multi-domain real-time composition is genuinely hard to replicate. |
| **Overall** | **2.8** | **Strong moat, weak revenue. Best as a marketing tool (free tier) to drive SaaS adoption.** |

#### 5. Education Platform

> AI tutor for creative coding: generate examples, iterate, explain why changes work, track learning progress.

| Dimension | Score | Notes |
|---|---|---|
| Technical Feasibility | 4 | Generation + explanation is LLM-native. Liminal already does this. |
| Market Demand | 5 | Millions learn creative coding. Coding Train has millions of views. |
| Revenue Potential | 3 | $10-20/mo subscription. Institutional licenses $500-2000/yr. |
| Competitive Moat | 2 | Education content is hard to moat. Iterative feedback loop is unique. |
| **Overall** | **3.5** | **Highest demand score. Best paired with SaaS (education tier).** |

#### 6. Audio-Visual Album Producer

> Upload music → get synchronized generative visuals. Full visual album from audio.

| Dimension | Score | Notes |
|---|---|---|
| Technical Feasibility | 3 | Audio analysis works. Visual mapping works. Beat sync needs work. |
| Market Demand | 3 | Independent musicians, visual album creators, concert visuals. |
| Revenue Potential | 3 | $5-15/track, $30-50/album. Subscription for volume users. |
| Competitive Moat | 3 | Audio-to-visual mapping pipeline is uncommon. Cross-domain synthesis is rare. |
| **Overall** | **3.0** | **Unique offering. Small market but willing to pay.** |

### Tier 3 — Long Bets (Future Potential)

#### 7. Embeddable Creative Widgets

> JS snippets for websites: generative backgrounds, audio-reactive elements, animated logos. "Stripe for creative code."

| Dimension | Score | Notes |
|---|---|---|
| Technical Feasibility | 3 | Generation works. Embedding needs CDN + sandboxing + performance optimization. |
| Market Demand | 4 | Every website wants unique visual identity. Web designers, agencies, SaaS companies. |
| Revenue Potential | 4 | Usage-based pricing. High volume potential. |
| Competitive Moat | 3 | Library of scored, tested creative snippets with quality guarantees. |
| **Overall** | **3.5** | **Highest revenue+demand combo in Tier 3. But requires significant frontend infrastructure.** |

#### 8. Creative Intelligence Platform

> The IntuitionEngine as a standalone product. Thompson Sampling + World Model + Dream Engine for any creative AI pipeline.

| Dimension | Score | Notes |
|---|---|---|
| Technical Feasibility | 2 | Needs extraction from Liminal, generalization, documentation, SDK. |
| Market Demand | 3 | AI companies building creative tools need quality assessment and model routing. |
| Revenue Potential | 4 | Enterprise licensing: $1K-10K/mo. |
| Competitive Moat | 4 | Accumulated quality data + model routing expertise + learning loop. |
| **Overall** | **3.3** | **Highest moat score. True platform play. But extraction is 3-6 months of work.** |

#### 9. Programmatic Video Studio

> Full Remotion-based video production pipeline for marketing teams. Prompt → script → storyboard → rendered video.

| Dimension | Score | Notes |
|---|---|---|
| Technical Feasibility | 3 | Remotion generator works. Narrative pipeline exists. Orchestration needs work. |
| Market Demand | 4 | Every marketing team needs video content at scale. |
| Revenue Potential | 5 | $50-500/video. $500-5000/mo subscription. Highest revenue potential. |
| Competitive Moat | 2 | Video generation is crowded (Runway, Synthesia, Bannerbear, Creatomate). |
| **Overall** | **3.5** | **Highest revenue potential. But competitive space is brutal.** |

---

## E. Revenue Model Analysis

### Model Comparison

| Model | Price Point | Monthly Revenue (100 users) | Monthly Revenue (1K users) | Monthly Revenue (10K users) | Margin |
|---|---|---|---|---|---|
| SaaS Subscription | $15/mo | $1,500 | $15,000 | $150,000 | 60-80% |
| Usage-based API | $0.05/gen | $500 | $5,000 | $50,000 | 50-70% |
| Enterprise License | $2,000/mo | $20,000 (10 accts) | $100,000 (50 accts) | — | 80-90% |
| Per-output (art/video) | $25/output | $2,500 | $25,000 | $250,000 | 70-85% |
| Marketplace Commission | 10% | $500 | $5,000 | $50,000 | 90%+ |
| One-time License | $50 | — (one-time) | — | — | 90%+ |

### Recommended Pricing (SaaS Launch)

| Tier | Price | Included |
|---|---|---|
| Free | $0 | 5 generations/day, p5.js only, watermarked |
| Maker | $12/mo | 50 generations/day, all domains, no watermark, PNG export |
| Studio | $29/mo | Unlimited generations, all domains, video export, API access, gallery |
| Enterprise | Custom | Self-hosted, SSO, SLA, custom domains, bulk API |

### Unit Economics

| Metric | Value |
|---|---|
| Average LLM cost per generation (3-5 iterations) | $0.05-0.15 |
| Average compute cost per generation (rendering) | $0.01-0.05 |
| Total cost per generation | $0.06-0.20 |
| Average generations per paid user per month | 100-300 |
| Monthly cost per user | $6-60 |
| Revenue per user (Maker tier) | $12 |
| Gross margin (Maker tier) | 80-50% (depends on usage) |

---

## F. Naming Rights, Legal & Attribution Analysis

### Current License Status

Liminal's `LICENSE` file is **MIT** — this means anyone can fork, modify, and even sell the code without paying Simon. This must change before any commercial activity.

### Integrated Dependencies — Attribution Requirements

Liminal integrates a significant number of external libraries. Each has its own license requirements:

#### Permissive (MIT/BSD/Apache — Safe for proprietary)

| Library | License | Used For | Attribution Required |
|---|---|---|---|
| `p5` | LGPL-2.1 | Canvas creative coding | License notice in distributions |
| `three` | MIT | 3D WebGL rendering | License notice |
| `tone` | MIT | Web Audio synthesis | License notice |
| `archiver` | MIT | ZIP creation | License notice |
| `better-sqlite3` | MIT | SQLite bindings | License notice |
| `@xenova/transformers` | Apache-2.0 | Local embeddings | License notice + NOTICE file |
| `dotenv` | BSD-2-Clause | Environment config | License notice |
| `commander` | MIT | CLI parsing | License notice |
| `ink` | MIT | Terminal UI | License notice |
| `react` | MIT | UI framework | License notice |
| `remotion` | MIT | Programmatic video | License notice (Remotion itself is MIT) |
| `playwright` | Apache-2.0 | Headless browser | License notice |
| `puppeteer` | Apache-2.0 | Headless browser | License notice |

#### Copyleft / Restrictive (Requires Review)

| Library | License | Used For | Concern |
|---|---|---|---|
| `hydra-synth` | AGPL-3.0 | Video synthesis | **AGPL requires source disclosure for network use. If Hydra runs on a server, users can request source.** |
| `strudel` (audio) | AGPL-3.0 | Live music patterns | **Same AGPL concern. Server-side execution triggers copyleft.** |

#### External Services (No License, But Terms of Service Apply)

| Service | Used For | Terms Concern |
|---|---|---|
| LLM APIs (OpenAI, Anthropic, MiniMax, etc.) | Code generation + evaluation | Each provider has usage terms. Generated code ownership varies by provider. |
| CDN libraries (p5.js, Three.js via CDN) | Browser runtime | CDN terms typically allow commercial use |
| FFmpeg | Video transcoding | LGPL 2.1+ — safe if dynamically linked. Static linking triggers GPL. |

### Critical Legal Actions

1. **Re-license from MIT to proprietary** — This is the single most important legal step. The current MIT license allows anyone to compete with a fork.
2. **Audit hydra-synth and strudel dependencies** — Both are AGPL. If Liminal runs these server-side (which it does via HydraAdapter and StrudelAdapter), the AGPL may require disclosing Liminal's source code. Options:
   - Run Hydra/Strudel client-side only (in the browser) — AGPL doesn't apply to client-side use
   - Negotiate commercial licenses with the library authors
   - Replace with non-AGPL alternatives (hardest path)
3. **LLM output ownership** — Verify terms for each LLM provider. Most (OpenAI, Anthropic) grant ownership of outputs to the user. MiniMax terms need verification.
4. **Trademark "Liminal"** — Search USPTO for existing trademarks. The name is generic enough that it may be taken.
5. **Attribution compliance** — Create a `THIRD_PARTY_NOTICES` file listing all dependencies with their license text. Required for MIT/BSD/Apache libraries.
6. **FFmpeg linking** — Ensure FFmpeg is dynamically linked (called via CLI, not statically compiled). Static linking would trigger GPL.
7. **Music/sound licensing** — If Tone.js or Strudel generates music, ensure there's no copyright claim from training data. This is an evolving legal area.

### Naming & Branding Considerations

- **"Liminal"** is a common English word meaning "threshold." It's used by several existing products/companies. Trademark search is critical.
- Alternative names if trademark is unavailable: **Atelier** (already used as legacy config name), **Threshold**, **The Mill**, **Compost** (leaning into the compost metaphor).
- Domain availability: `liminal.dev`, `liminal.art`, `liminal.studio` should be checked.

---

## G. Risk Assessment

### Technical Risks

| Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|
| LLM API price increase | High | Medium | Multi-provider routing (already exists). Self-hosted model fallback (Ollama). |
| LLM API deprecation | High | Low | Provider abstraction layer (already exists). Rapid migration capability. |
| Quality scoring produces bad outputs | High | High | Collect human ratings. Retrain scoring on real preferences. |
| Rendering pipeline failures (Puppeteer/Playwright) | Medium | High | Fallback between Puppeteer and Playwright. Retry logic. |
| AGPL contamination from hydra-synth/strudel | High | Medium | Client-side execution only. Commercial license negotiation. |
| Scaling bottlenecks under multi-user load | Medium | High | Stateless API design. Queue-based rendering. Horizontal scaling. |

### Market Risks

| Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|
| Creative coding market too small | High | Medium | Expand to adjacent markets (education, marketing, web design). |
| Midjourney/Runway adds "code output" mode | High | Medium | Speed to market. Accumulated quality data as moat. |
| OpenAI adds creative iteration to ChatGPT | High | Medium | Multi-domain breadth. Specialized quality scoring. Community. |
| Users won't pay for what they can get free | Medium | High | Free tier with value-add in iteration, scoring, composition. |
| NFT art market doesn't recover | Low | Medium | Don't depend on NFT revenue. Focus on SaaS + API. |

### Legal Risks

| Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|
| MIT fork competes with proprietary version | High | High | Re-license before launch. Add CLA for future contributions. |
| AGPL violation from server-side Hydra/Strudel | High | Medium | Client-side execution. Commercial license. |
| Trademark conflict on "Liminal" name | Medium | Medium | Trademark search. Alternative names ready. |
| LLM-generated code copyright ambiguity | Medium | Medium | Clear ToS. Indemnification clause. Provider ownership grants. |

---

## H. Recommended Next Steps

### Phase 0: Legal Foundation (Before Anything Else)

1. **Re-license to proprietary** (BSL or custom EULA)
2. **Audit AGPL dependencies** — resolve hydra-synth and strudel licensing
3. **Create THIRD_PARTY_NOTICES file**
4. **Trademark search for "Liminal"**
5. **Add Contributor License Agreement (CLA)** for any open contributions

### Phase 1: SaaS MVP (Months 1-3)

1. **Build web UI** — React/Next.js front end. Prompt input → generation → gallery → export.
2. **Add auth + billing** — Stripe integration, user accounts, usage tracking.
3. **Multi-tenant API** — Rate limiting, API keys, usage quotas.
4. **Landing page** — Value proposition, examples, pricing tiers.
5. **Beta launch** — Free tier to 100 users. Collect feedback, calibrate quality.

### Phase 2: Close the Feedback Loops (Months 3-6)

1. **Close meta-harness loop** — Auto-adapt prompts from failure insights. Auto-route models based on Thompson Sampling.
2. **Validate quality scoring** — Collect human ratings from beta users. Retrain scoring heuristics on real preferences.
3. **Build data flywheel** — Every user's rating improves the model for everyone. This is the moat.
4. **Extract IntuitionEngine** — Document, package, and offer as standalone API.

### Phase 3: Expand Revenue (Months 6-12)

1. **Launch API / Engine Licensing** — Enterprise tier, documentation, SDKs.
2. **Education tier** — Curriculum, tutorials, institutional licensing.
3. **Programmatic video** — Marketing team product. Remotion-based pipeline.
4. **Embeddable widgets** — JS snippets for websites. CDN + sandboxing.

---

## Appendix: Viability Score Summary

| Use Case | Feasibility | Demand | Revenue | Moat | **Total** | **Tier** |
|---|---|---|---|---|---|---|
| Creative Coding SaaS | 4 | 4 | 3 | 2 | **3.3** | 1 |
| API / Engine Licensing | 3 | 3 | 4 | 3 | **3.3** | 1 |
| Generative Art Platform | 3 | 3 | 4 | 2 | **3.0** | 1 |
| Live Performance Tool | 3 | 3 | 2 | 3 | **2.8** | 2 |
| Education Platform | 4 | 5 | 3 | 2 | **3.5** | 2 |
| Audio-Visual Album Producer | 3 | 3 | 3 | 3 | **3.0** | 2 |
| Embeddable Creative Widgets | 3 | 4 | 4 | 3 | **3.5** | 3 |
| Creative Intelligence Platform | 2 | 3 | 4 | 4 | **3.3** | 3 |
| Programmatic Video Studio | 3 | 4 | 5 | 2 | **3.5** | 3 |
