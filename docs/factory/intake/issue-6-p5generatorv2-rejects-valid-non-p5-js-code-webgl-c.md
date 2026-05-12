        # Factory intake for issue #6: P5GeneratorV2 rejects valid non-p5.js code (WebGL, Canvas 2D)

        Repository: `simongonzalezdc/liminal`
        Category: `llm_fix`
        Source issue: `#6`

        ## User request

        ## Problem

When Liminal generates WebGL fragment shaders or raw Canvas 2D animations (no p5.js dependency), the `P5GeneratorV2` still validates the output and rejects it with:

```
Generated code missing required setup() function
```

This happens because prompts requesting GLSL shaders or plain JavaScript canvas animations get routed through the p5.js generator, which expects `setup()` and `draw()` functions. The generated code is valid — it just isn't p5.js.

## Impact

- Generated WebGL shaders and Canvas 2D animations are discarded as "failed" even though the code works
- Users have to extract the code from the error's `cause.context.generatedCode` to recover it
- The retry loop wastes LLM calls regenerating code that was already correct

## Reproduction

1. Run Liminal with a prompt like: `"GLSL fragment shader animation. Deep navy background. u_time uniform drives animation. Self-contained HTML with WebGL."`
2. Observe: `[P5GeneratorV2] Code may be missing createCanvas()` warning
3. Observe: `Generated code missing required setup() function` error
4. The generated HTML/JS is valid and runs correctly in a browser

## Expected Behavior

When a prompt explicitly requests WebGL, GLSL, or Canvas 2D (no p5.js), the generator should either:

1. **Route to a non-p5 generator** that validates for `window.renderFrame()` / `window.__rendered` instead of `setup()`/`draw()`, or
2. **Skip p5.js validation** when the prompt contains keywords like "GLSL", "WebGL", "fragment shader", "Canvas 2D", or "no p5.js"

## Environment

- Liminal v2.1.0
- Provider: GLM (glm-5v-turbo)

        ## Factory interpretation

        This issue was picked up by `issue-closer`, but no safe code edit was
        produced by the configured agent providers. The Factory is therefore
        converting the issue into an implementation contract instead of silently
        skipping it.

        ## Acceptance contract

        - Confirm the desired behavior from the issue title and body.
        - Identify the smallest implementation slice that can ship independently.
        - Add or update tests/proofs for that slice before merging implementation.
        - Keep credentials, local machine paths, and deployment secrets out of the repo.
        - Close or update the source issue when the implementation PR lands.

        ## Next Factory action

        Dispatch a repo worker against this contract. If the request is too broad,
        split it into smaller `agent-ready` issues with concrete acceptance checks.
