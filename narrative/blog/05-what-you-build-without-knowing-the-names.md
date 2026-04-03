# What You Build Without Knowing the Names

*Or: How I accidentally invented 10 ML architectures through agricultural metaphors, got audited, and learned that names matter more than I thought*

---

I was reading through the forensic audit of my own project when I hit this sentence:

> "None of the 10 claims are formally exact matches. Six are rough analogies that capture a genuine structural similarity. Two are forced comparisons."

That is a bruising thing to read about your own work. I had spent weeks convinced I had independently reinvented a Variational Autoencoder, built a GAN, and implemented a Mixture of Experts -- all through the vehicle of agricultural metaphors and a character named Ralph Wiggum. The audit said: not quite. The spirit is there, but the mechanics are not.

Here is what happened, what it means, and why I think the gap between intuition and formal knowledge is the most interesting thing about building software with AI.

---

## The Moment of Realization

The Liminal project is a creative coding framework. You describe what you want, and it generates visual art -- p5.js sketches, Three.js scenes, GLSL shaders, music, video. Under the hood, it has an iterative refinement loop, a system for recycling failed creative work into new ideas, five AI personas that collaborate on generation, and a quality evaluation system that judges the output.

I built all of this over 33 days in early 2026. During that time, I watched a lot of YouTube. I mean a lot -- 1,481 AI-related videos in the year before the project started, with the monthly count spiking from 15 in Q1 2025 to 429 in Q4 2025. I was absorbing concepts at a rate that felt like drinking from a fire hose, but I was learning them through videos and building, not through textbooks or papers.

So when I built a system that takes failed creative outputs, decomposes them into fragments, stores those fragments, and recombines them to seed new ideas, I called it a "Compost Mill." The heap, the shredder, the seeds, the soup -- all agricultural metaphors for what I later learned looked a lot like a Variational Autoencoder.

The audit said: it is an ETL pipeline. A batch processing pipeline for creative content. The agricultural metaphor maps loosely to VAE concepts, but there is no encoder network, no latent distribution sampling, no reconstruction loss, no KL-divergence regularization. The "latent space" is a structured file system of JSON files, not a continuous vector space.

I had to sit with that for a while.

---

## The 10 Patterns, Honestly Graded

Let me walk through all 10 architecture claims, because the gradient from "genuinely reinvented" to "stretching it" tells the whole story.

### The Strong Ones

**MAP-Elites + NoveltyArchive** -- This is the closest I came to a genuine reinvention. The audit confirmed: "MAP-Elites grid is genuinely a quality-diversity archive (closest to a real reinvention)." I built a correct N-dimensional quality-diversity grid. I built a correct k-NN novelty scoring system. The algorithms are real. The gap: I used uniform random selection to retrieve elites (should be tournament selection), and the archives were write-only -- they stored data beautifully but never fed it back into the generation context. Imagine building a library where you shelve books perfectly but nobody is allowed to check them out.

**RalphLoop as (1+1) Evolution Strategy** -- The iterative refinement loop generates code, scores it, accumulates context, and repeats. The (1+1)-ES pattern -- one parent generates one offspring, the better one survives -- is genuinely similar. But there is no mutation operator (the LLM generates freely rather than perturbing the parent), no self-adaptive step size, no 1/5th success rule. It is iterative refinement with context accumulation, which captures the spirit of an evolution strategy but lacks the formal mechanics.

**Hooks as Aspect-Oriented Programming** -- I built 26 interceptor hooks that run before and after tool calls in Claude Code, enforcing rules like "always wire everything end-to-end" and "never leave stubs." The audit called this a "structurally accurate" AOP-like interceptor for the Claude Code lifecycle. The gap: hooks are constrained to Claude Code's lifecycle events, not arbitrary method join points. There is no pointcut language, no weaving. It is more interceptor filter chain than true AOP.

### The Medium Ones

**CompostMill as Variational Autoencoder** -- As mentioned, it is a 7-stage ETL pipeline with agricultural naming. The decomposition/recombination pattern is VAE-like in spirit. But the mechanics are completely different -- no encoder network, no differentiable training, no latent distribution.

**AestheticCritic as GAN Discriminator** -- I built a generator (LLM) and a critic (AestheticCritic) and thought "this is a GAN." The audit: "The generator never receives gradients from the critic, the critic is not trained adversarially, and there is no minimax game. The critic is a static rule-based filter applied post-generation." It evaluates code using regex patterns on source text. It does the job of saying "this looks bad," but it is not adversarial training. It is a filter.

**SwarmOrchestrator as Mixture of Experts** -- Five personas with different models and temperatures generate outputs, then vote on the best one. The audit: "This resembles an ensemble method more than MoE. In formal MoE, a gating network routes each input to a sparse subset of experts. Here, ALL personas always generate for every input (dense, not sparse)." It is a diverse ensemble with Borda count voting. Useful, but not MoE.

**ScoringEngine as Reward Model** -- A pluggable strategy pattern with four built-in scoring strategies. The audit: "There is no training on human preferences (RLHF), no reward model network, no learning from promoted/rejected history." All strategies are hand-coded heuristics or regex. It scores, but it does not learn.

**ModelRouter as Multi-Armed Bandit** -- Routes between cheap and expensive models based on confidence thresholds and task-type heuristics. The audit: "No exploration-exploitation tradeoff, no epsilon-greedy policy, no Thompson Sampling, no reward tracking per arm." The routing is deterministic, not stochastic. It is a dispatching system, not a bandit.

### The Stretches

**5 Personas as Multi-Head Attention** -- The audit graded this as "forced_comparison." Five independently-prompted LLM calls with different system prompts share none of the mechanics of multi-head attention. No Q/K/V projections, no attention scores, no softmax, no concatenation of head outputs. They are an ensemble of diverse models, not attention heads. I was reaching.

**ContextAccumulation as Event Sourcing** -- Also graded "forced_comparison." ContextAccumulation stores full state snapshots in an array with a max size of 50, truncating oldest entries (FIFO) when full. Event sourcing stores every state-changing event and reconstructs current state by replaying the event log. These are fundamentally different things. Snapshots with FIFO truncation is a circular buffer, not an event store.

---

## How This Happened

The audit grades are honest, and I accept them. But the question that interests me is not "were these exact implementations?" -- obviously not -- but "how did someone end up this close to formal architectures without knowing the names?"

The answer is in the YouTube data.

I watched 1,481 AI-related videos between April 2025 and April 2026. The quarterly trajectory is clear:

- **Q1 2025:** 15 videos. Casual curiosity. I was a pastor and ceramic artist who had just started paying attention to AI.
- **Q2 2025:** 46 videos. Growing awareness. I was starting to seek out AI content deliberately.
- **Q3 2025:** 260 videos. Intensive study. Coding agents first appear in my watch history. This is when I started understanding what LLMs could do.
- **Q4 2025:** 429 videos. Peak pre-build learning. More than 5 AI videos per day. This is where the architectural intuition was forming -- not from papers, but from watching people build things and explain their thinking.
- **January 2026:** 58 videos. Digestion period. Absorbing before building.
- **February 2026 (pre-Liminal):** 284 videos in 28 days. The launch ramp. Coding agent content spiked to 24% of my watch time.

That is the learning path. Not a CS degree. Not Andrew Ng's course. Not papers on arXiv. YouTube videos and Claude Code sessions. I absorbed the *shape* of these architectures -- the idea that you can decompose and recombine, that you can pit a generator against an evaluator, that you can route tasks to specialized agents -- without ever learning the formal vocabulary.

This is a real thing that happens. You can understand the concept of "separating concerns along different dimensions" without knowing it is called "Multi-Head Attention." You can build a system that iteratively refines output toward quality without knowing it is called a "(1+1) Evolution Strategy." The intuition is there. The naming is not.

---

## Jake Van Clief and the Shipping Problem

There is another thread in this story that has nothing to do with architecture and everything to do with why anything shipped at all.

Before Liminal existed, before the 33 days of furious building, there was a period where I was learning about AI but not shipping anything. I was watching hundreds of videos, running local LLMs on my Mac, experimenting with agents -- but nothing was getting finished. The iteration trap: you tweak forever, never declare done, never move on.

The method that broke the trap was ICM -- Iterative Creation Method, from Jake Van Clief. I discovered it through the same YouTube pipeline that taught me everything else. The core idea: ship small, complete things rapidly. Do not wait for perfection. Declare done and move on.

The commit data shows exactly when this clicked. Before ICM adoption, I had projects with dozens of commits but no releases. After ICM, I shipped multiple projects in quick succession: GlazeLab, openglaze, PuenteWorks. And then Liminal -- 294 commits in 33 days, 9 distinct eras, version 0.1.0 shipped on day 29.

Without ICM, Liminal would still be a folder on my desktop called "atelier" with a half-finished PRD and no working code. The architecture patterns are interesting, but the shipping methodology is what made any of this exist at all.

This is worth stating plainly because the archaeology data supports it: the developer's improvement trajectory was not about learning better architecture. It was about learning to need less context, to write more precise specifications, and to ship before things are perfect. The session data shows the message-per-commit ratio dropping from 9.90 corrections per commit in the quality crusade era to 0.85 in the multimedia expansion era. That is not better architecture knowledge. That is better communication discipline.

---

## The Dogfood Lesson: What Broke and Why It Matters

On day 31, I ran the system against itself. The dogfood testing was supposed to be a victory lap. It was not.

The headline finding, originally reported as a 7.4% success rate (4 out of 54 runs), turned out to be a conflation error. The audit caught this: the numerator came from one test agent (4 successes out of 36 runs = 11.1%), the denominator from another test agent's matrix (6 models x 9 domains = 54), and combining them produced a number that neither dataset independently supports. The real figures: Agent A achieved 4/36 (11.1%) across p5.js domains; Agent B achieved 11/52 (21.2%) across broader domains. The combined rate is 15/88 (17.0%).

But the success rate is not the most interesting finding. The most interesting finding is the **scoring dead zone**.

Every single p5.js run -- from a 160-byte stub that does nothing to a 2,163-byte full implementation -- scored exactly 0.68. Not approximately. Exactly. The CreativeEvaluator, which is supposed to discriminate quality, gave every output the same score. I reverse-engineered the formula: technicalScore x 0.6 + creativeScore x 0.4, with technical defaulting to 4/5 (0.8) and creative defaulting to 3/6 (0.5). That gives you 0.48 + 0.20 = 0.68. Every time. For everything.

This means the scoring system -- the component that was supposed to close the feedback loop, the thing that would tell the generator "this is good, stop iterating" or "this is bad, try again" -- could not tell the difference between working code and garbage. It was a flat line.

The second critical finding was the RalphLoop iteration count. The original narrative said: "RalphLoop treats 0.68 as quality threshold met and exits at iteration 1." The audit corrected this: the dogfood test harness was configured with `maxIterations: 1`. The loop stopped because it was only allowed one iteration, not because the quality gate evaluated 0.68 and found it acceptable. The quality gate only triggers at iteration 2 and beyond. With `maxIterations: 1`, the gate never fired.

This inverts the causal story. The narrative said the scoring system had a dead zone where 0.68 passes as acceptable. The truth is the test harness never let the scoring system make that judgment at all. Whether the loop would have iterated correctly if given more iterations remains unverified.

And then there was the wiring. Eight of nine generators returned "No LLM configured" -- not because the LLM integration was broken, but because the generators were never wired to the ModelRouter. Only P5Generator was connected. The other eight had the code for LLM integration but nobody had actually called the right initialization function. The audit confirmed: "16 of Agent A's 32 failures were specifically 'No LLM configured' config errors, meaning the generator was never invoked for those domains."

These are not theoretical gaps. These are the concrete consequences of building without formal knowledge. If I had known the term "contract testing" or "integration testing at module boundaries," I would have tested that each generator could actually reach the LLM before declaring it functional. If I had known "calibration" in the scoring context, I would have checked whether my scoring function produced any variance. If I had known "convergence detection," I would not have needed to discover through frustration that my loop was stopping prematurely.

---

## The Three Most Costly Gaps

The archaeology data estimates roughly 2.25 million tokens were spent on corrections, rework, and dead-end explorations that formal knowledge would have prevented. That figure is an archaeological approximation without a documented calculation methodology -- it was derived from session counts and subjective token-per-session assumptions. I cannot defend it as a precise measurement. But the relative ranking is instructive.

**Gap 1: RalphLoop completion detection (~400K tokens, 6+ sessions)**

The loop was the most-edited file in the entire project -- 41 modifications across 33 days. I kept trying to make it "stop when the thing is good" without knowing the formal concept of "rejection sampling with convergence detection." The fix is one sentence: "Iterate LLM generation, score via multi-objective reward, accept above threshold, stop when rolling-average improvement is less than epsilon for 3 consecutive iterations." One sentence versus 41 modifications over 6 sessions.

**Gap 2: Write-only archives (~300K tokens, 5+ sessions)**

I built beautiful data stores. The MAP-Elites grid, the NoveltyArchive, the SeedBank -- all correctly implemented at the algorithm level. But they were write-only. Data went in and never came out. Nobody ever queried the archive to inject diverse or novel examples into the generation context. The fix: "Wire archive retrieval into generation context" -- about 80 lines of code across 4 files.

**Gap 3: Triple redundancy (~200K tokens, 4+ sessions)**

Three separate scoring systems (CreativeEvaluator, ScoringEngine, AestheticCritic). Three separate memory systems (HarnessMemory, EpisodicMemory, SemanticArtMemory). Three separate collaboration systems (Swarm, DeepCollab, CollabClient). None of the triples shared any code. The fix: "Use Strategy pattern with pluggable backends" -- consolidate each triple into one system with swappable implementations.

These three gaps share a common pattern: I was close to the right answer but lacked the vocabulary to specify it precisely. The intuition was "evaluate quality" but the formal term was "multi-objective reward model with composable scoring dimensions." The intuition was "remember past work" but the formal term was "retrieval-augmented generation with pluggable memory backends." Every time I described what I wanted in my own words, the AI agent would interpret them differently, and we would spend a session correcting the misunderstanding.

---

## What This Means for AI-Assisted Development

Here is the thing I keep coming back to: the architecture was directionally correct. The audit confirmed that every named module exists, is functional, and does something genuinely related to the claimed pattern. The MAP-Elites grid is a real quality-diversity archive. The NoveltyArchive implements real k-NN novelty scoring. The Borda count voting is correct. The hook system is genuinely AOP-like.

The intuition was there. What was missing was precision.

I think this is the central challenge of AI-assisted development right now. When you can build anything by describing it in natural language, the quality of what you build is limited by the precision of your descriptions. If you know the formal term "Variational Autoencoder," you can type those three words and get a correct implementation. If you do not know the term, you type "a system that decomposes failed creative work into reusable fragments and recombines them to seed new ideas" -- and what you get is directionally right but mechanically incomplete.

The AI does not know what you do not know. It cannot fill in the gaps in your vocabulary. If you say "compost bin," it builds a compost bin. If you say "VAE," it builds a VAE. The difference between those two outcomes is not the AI's capability. It is your vocabulary.

This has implications for how we think about "AI democratizing software development." Yes, AI lowers the barrier to building. But it does not lower the barrier to building well. The barrier shifts from "can you write the code?" to "can you precisely specify what you want?" And precise specification requires knowing the names of things.

---

## The Honest Accounting

Let me be direct about what the audit found, because this is not a victory narrative.

The 7.4% success rate was a conflation of two different datasets. The 0.68 scoring dead zone means the system could not discriminate quality at all. The RalphLoop stopped at iteration 1 because the test harness was misconfigured, not because of a design flaw -- which means we still do not know if the loop actually works correctly when given multiple iterations. Eight of nine generators had no LLM connection. THE_BIBLE documentation claimed 21 production-ready subsystems; the dogfood testing confirmed only p5.js worked end-to-end.

These are real problems. They are the problems you get when you build fast, learn by doing, and do not have the vocabulary to specify what you want precisely. The architecture audit found "0 exact matches, 6 rough analogies, 2 forced comparisons" among the 10 architecture claims. The speculative improvement percentages (30-50%, 15-25%, 60-80%) have no empirical backing. The token waste estimate (~2.25M) is an approximation without a methodology.

I include all of this because the archaeology project is not hagiography. It is archaeology. You dig up what is there, not what you wish was there. What is there is a developer who built something directionally sophisticated through intuition and metaphor, got most of the way there, and fell short on the mechanics because he did not know the names.

---

## Names Matter, but Shipping Matters More

I am now working through a curriculum of 24 topics in 5 tiers, ranked by return on investment based on what the archaeology data shows I actually need. Evolutionary computation fundamentals -- the (1+1)-ES, tournament selection, fitness-proportionate selection, convergence detection -- would have prevented an estimated 800K tokens of waste across the project. Integration testing and contract-driven development would have caught the "No LLM configured" problem before dogfood testing. Specification writing -- the discipline of saying precisely what you mean -- would have compressed the 9.90 correction messages per commit down to something more reasonable.

I am learning the names. And the names are powerful. Knowing "rejection sampling with convergence detection" is worth approximately 400K tokens of wasted iteration. Knowing "closed-loop quality-diversity optimization" is worth approximately 300K tokens of write-only archives. Each formal term is a shortcut that replaces a dozen sessions of trial and error with a single precise instruction.

But here is the other thing: I shipped. In 33 days, I built a creative coding framework with 9 generator domains, 5 AI personas, an iterative refinement loop, a creative recycling system, aesthetic critics, audio-to-visual mapping, and an evolution engine. Not all of it worked. Most of it needed fixing. But it existed. It was real. It was out of my head and into the world.

The formal names would have made it better. But the ICM methodology -- ship small, complete things rapidly -- is what made it exist at all. There is a developer I know who has been studying ML architectures for two years. They know all the names. They have read all the papers. They have not shipped a single project. They are waiting until they understand everything perfectly.

I do not understand everything perfectly. I understand the shapes of things. I built those shapes imperfectly, with agricultural metaphors instead of formal terms. Then I shipped them, tested them, found them broken, and wrote an honest audit about what broke and why.

The names matter. They are shortcuts that save you from costly rework. But the shipping matters more. Because the thing you ship imperfectly can be improved. The thing you never ship because you are still learning the names does not exist.

Build the thing. Ship the thing. Then learn the names of what you built. The names will tell you what you got right, what you got wrong, and what to fix next. That is what the archaeology project taught me. Not that I was a genius who independently reinvented VAEs -- I did not, the audit is clear on that. But that intuition, combined with the courage to ship before you are ready, combined with the humility to audit honestly, is a development methodology that actually works.

Even if you do not know what to call it.

---

*This post is based on the Liminal Archaeology project -- a forensic analysis of 294 commits, 58 Claude Code sessions, 7,059 cross-repo commits, and 1,481 YouTube videos. The full audit report, reverse-engineering plan, and learning curriculum are available in the archaeology branch of the Liminal repository. All data points cited in this post are verified in the forensic audit, except where explicitly noted as approximate.*
