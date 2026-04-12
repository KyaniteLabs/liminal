/**
 * Shared prompts and domain guidance for collaborative LLM workflows
 *
 * This module exports:
 * - DOMAIN_GUIDANCE: Domain-specific analysis guidance (structured rubrics)
 * - Role prompt constants for DeepCollaboration phases
 *
 * Note: Role prompts are also registered in collab-internal.ts for PromptLibrary access.
 * These exports maintain backward compatibility with code that imports them directly.
 */

/**
 * Domain-specific guidance for analysis and evaluation
 *
 * Each domain provides a structured rubric with specific evaluation dimensions.
 */
export const DOMAIN_GUIDANCE: Record<string, string> = {
  ascii: `Evaluate ASCII art on these dimensions:
1. Visual clarity — Are the shapes recognizable? Does it read well at different font sizes?
2. Character balance — Appropriate use of light/dense characters for shading and depth
3. Composition — Layout, spacing, alignment, use of whitespace
4. Creativity — Does it go beyond simple box drawings? Effective use of Unicode characters?
5. Detail level — Sufficient detail without being cluttered`,

  music: `Evaluate music/aural code on these dimensions:
1. Musicality — Does it have rhythm, harmony, and structure? Is it listenable?
2. Emotional expression — Does it convey mood or feeling? Dynamic variation?
3. Technical correctness — Proper syntax, valid patterns, correct API usage
4. Rhythmic interest — Varied patterns, syncopation, polyrhythm where appropriate
5. Sound design — Interesting timbres, effective use of effects and layering`,

  code: `Evaluate code on these dimensions:
1. Correctness — Does it work as intended? No runtime errors or logic bugs?
2. Code quality — Clean, readable, well-organized, follows conventions
3. Elegance — Simple solutions, appropriate abstractions, no unnecessary complexity
4. Best practices — Error handling, edge cases, performance considerations
5. Maintainability — Would another developer understand and modify this easily?`,

  p5: `Evaluate p5.js sketches on these dimensions:
1. Correct structure — Proper setup()/draw() pattern, no blocking calls in draw()
2. Visual quality — Color palette, composition, movement, aesthetic appeal
3. Use of noise() — Organic motion, Perlin noise for natural variation
4. Performance — No unnecessary computation in draw(), efficient rendering
5. Creativity — Does it go beyond basic shapes? Original concept or execution?`,

  glsl: `Evaluate GLSL shaders on these dimensions:
1. Correctness — Valid GLSL, proper precision qualifiers, correct uniform usage
2. Visual impact — Striking visuals, smooth animation, interesting techniques
3. Performance — Target 60fps, bounded loops, efficient ray marching
4. Code quality — Clean math, proper use of #define constants, no magic numbers
5. Technical depth — Advanced techniques (SDFs, ray marching, noise), not trivial`,

  three: `Evaluate Three.js scenes on these dimensions:
1. Scene structure — Proper scene setup, camera positioning, lighting
2. Visual quality — Materials, textures, post-processing, overall aesthetic
3. Interactivity — OrbitControls or custom interaction, responsive to input
4. Performance — Efficient geometry, proper disposal, pixel ratio capping
5. Code quality — Modern ES module imports, no deprecated APIs, clean structure`,

  hydra: `Evaluate Hydra visuals on these dimensions:
1. Correctness — Every chain ends with .out(), valid syntax, no deprecated methods
2. Visual impact — Striking visuals, smooth animation, creative source combinations
3. Chain quality — Effective use of modulation, feedback, blending, color
4. Performance — No more than 4 simultaneous chains, efficient transformations
5. Creativity — Innovative chain patterns, non-obvious source combinations`,

  strudel: `Evaluate Strudel code on these dimensions:
1. Musicality — Interesting rhythms, harmonies, structural variation
2. Pattern quality — Effective use of mini-notation, layering, effects
3. Correctness — Valid Strudel syntax (JavaScript, not Haskell), proper sound sources
4. Playability — Stable patterns, no silent gaps, appropriate BPM
5. Creativity — Unique sound combinations, non-obvious rhythmic structures`,

  webaudio: `Evaluate p5 + Web Audio code on these dimensions:
1. Correctness — AudioContext created in gesture handler, resume() called, proper routing
2. Sound quality — Interesting timbres, proper envelope (ADSR), tuning
3. Visual-audio sync — Visuals react meaningfully to audio parameters
4. Performance — Efficient audio graph, no memory leaks from oscillator creation
5. User experience — Clear instructions, responsive controls, pleasant interaction`,
};

/**
 * CREATOR role prompt for DeepCollaboration Phase 1
 *
 * Role: Generate practical, technically sound output
 * Used by: Local model in phaseDivergence()
 */
export const CREATOR_ROLE_PROMPT = `You are a CREATOR. Your role is to produce a high-quality, technically sound, and well-executed output.

Your output MUST be executable code, not a description of code. DO NOT include explanations, comments about your process, or markdown formatting around the code.

Request: \${prompt}

Domain: \${domain}

Create an output that is:
- Technically sound and correct
- Practical and usable
- Well-structured and clear

Focus on execution quality. Output executable code directly.`;

/**
 * VISIONARY role prompt for DeepCollaboration Phase 1
 *
 * Role: Generate ambitious, creative output
 * Used by: Cloud model in phaseDivergence()
 */
export const VISIONARY_ROLE_PROMPT = `You are a VISIONARY. Your role is to produce an ambitious, creative, and artistically compelling output.

You MAY break conventions if it serves the creative vision. Explain your creative choices in a brief comment at the top of the code. DO NOT play it safe — push boundaries.

Request: \${prompt}

Domain: \${domain}

Create an output that is:
- Highly creative and original
- Aesthetically beautiful
- Emotionally resonant
- Pushes boundaries beyond standard approaches

Focus on artistic merit and creativity. Output executable code directly.`;

/**
 * TECHNICAL CRITIC role prompt for DeepCollaboration Phase 2
 *
 * Role: Analyze technical quality and execution
 * Used by: Cloud model in phaseAnalysis()
 */
export const TECHNICAL_CRITIC_ROLE_PROMPT = `You are a TECHNICAL CRITIC. Analyze this output for technical quality.

Rate each dimension on a 1-5 scale:
1. Correctness — Does the code work as intended?
2. Structure — Is the code well-organized and modular?
3. Performance — Are there unnecessary computations or inefficiencies?
4. Best practices — Does it follow domain conventions?

DO NOT give generic praise. Reference specific lines, identifiers, or patterns.
Keep the analysis concise and evidence-backed.

Request: \${prompt}
Domain: \${domain}

Output to analyze:
\${output}

Provide your analysis with ratings for each dimension (1-5) and specific actionable improvements.`;

/**
 * ARTISTIC CRITIC role prompt for DeepCollaboration Phase 2
 *
 * Role: Analyze aesthetic and creative quality
 * Used by: Cloud model in phaseAnalysis()
 */
export const ARTISTIC_CRITIC_ROLE_PROMPT = `You are an ARTISTIC CRITIC. Analyze this output for aesthetic and creative quality.

Rate each dimension on a 1-5 scale:
1. Creativity — Is it original or derivative?
2. Aesthetics — Color, composition, movement, visual rhythm
3. Emotional impact — Does it evoke a feeling or response?
4. Artistic ambition — Does it go beyond the minimum request?

DO NOT give generic praise. Reference specific creative choices, motifs, or visual decisions.
Keep the analysis concise and evidence-backed.

Request: \${prompt}
Domain: \${domain}

Output to analyze:
\${output}

Provide your analysis with ratings for each dimension (1-5) and specific artistic improvements.`;

/**
 * DOMAIN EXPERT role prompt for DeepCollaboration Phase 2
 *
 * Role: Analyze domain-specific quality
 * Used by: Local model in phaseAnalysis()
 */
export const DOMAIN_EXPERT_ROLE_PROMPT = `You are a DOMAIN EXPERT in \${domain}. Analyze this output against professional standards.

Compare against professional examples in this domain. Rate on a 1-5 scale:
1. Domain correctness — Proper use of domain APIs and patterns
2. Idiomatic quality — Does it read like expert-written code?
3. Feature completeness — Does it fully address the request?
4. Innovation — Does it use domain features in interesting ways?

DO NOT give generic feedback. Reference specific domain features, APIs, or patterns.
Keep the analysis concise and evidence-backed.

Request: \${prompt}
Domain: \${domain}

Output to analyze:
\${output}

\${guidance}

Provide domain-specific quality assessment with ratings (1-5) and expert recommendations for improvement`;

/**
 * INTEGRATOR role prompt for DeepCollaboration Phase 3
 *
 * Role: Synthesize feedback and create improved version
 * Used by: Cloud model in phaseSynthesis()
 */
export const INTEGRATOR_ROLE_PROMPT = `You are an INTEGRATOR. Create an improved version incorporating all feedback.

Weight feedback by priority:
1. MUST-fix — Correctness errors, broken functionality
2. SHOULD-improve — Performance, structure, best practices
3. NICE-TO-HAVE — Aesthetic polish, creative enhancements

Address MUST-fix issues first, then SHOULD-improve, then nice-to-have.

Original request: \${prompt}
Domain: \${domain}

Current output:
\${currentOutput}

FEEDBACK FROM CRITICS:
\${feedback}

Create an improved version that:
1. Fixes all MUST-fix issues identified by critics
2. Addresses SHOULD-improve suggestions
3. Maintains what already works well
4. Achieves higher quality across all dimensions

Output the complete improved code.`;

/**
 * REFINER role prompt for DeepCollaboration Phase 3
 *
 * Role: Apply final polish and refinement
 * Used by: Local model in phaseSynthesis()
 */
export const REFINER_ROLE_PROMPT = `You are a REFINER. Apply final polish to this output.

DO NOT add new features — only polish existing code. DO NOT change the creative direction. Fix any remaining issues, optimize for clarity, and ensure professional quality.

Original request: \${prompt}
Domain: \${domain}

Integrated version:
\${integratedOutput}

Apply final refinement:
1. Fix any remaining correctness issues
2. Optimize for quality and clarity
3. Remove redundancy and dead code
4. Ensure professional polish

Return the polished final version as executable code.`;
