# Domain Gauntlet Audit - 2026-06-08

Run id: `2026-06-08T19-59-51-938Z`

This audit enumerates the FINISH_LINE creative domains and runs the product generator, CodeValidator path, and render-or-receipt smoke for each one. Prompts include a run-specific never-used nonce to avoid stale generation cache hits.

| Domain | Generate | Validate | Render/Receipt | Status | Failure reason |
| --- | --- | --- | --- | --- | --- |
| svg | FAIL | FAIL | FAIL | FAIL | generate: svg generation timed out after 120000ms |
| p5 | PASS | PASS | PASS | PASS |  |
| glsl | PASS | PASS | FAIL | FAIL | render-or-receipt: Shader compile error: ERROR: 0:2: 'endif' : unexpected #endif found without a matching #if |
| hydra | PASS | FAIL | FAIL | FAIL | validate: hydra code is too small (103b) - minimum is 150b |
| three | PASS | PASS | PASS | PASS |  |
| tone | FAIL | FAIL | FAIL | FAIL | generate: No local LLM model detected at http://localhost:1234/v1/models. Start LM Studio/Ollama with a loaded model, run "sinter --configure", or set LIMINAL_LLM_BASE_URL and LIMINAL_LLM_MODEL. |
| strudel | FAIL | FAIL | FAIL | FAIL | generate: No local LLM model detected at http://localhost:1234/v1/models. Start LM Studio/Ollama with a loaded model, run "sinter --configure", or set LIMINAL_LLM_BASE_URL and LIMINAL_LLM_MODEL. |
| revideo | PASS | PASS | PASS | PASS |  |
| html | FAIL | FAIL | FAIL | FAIL | generate: html generation timed out after 120000ms |
| ascii | PASS | PASS | PASS | PASS |  |
| kinetic | FAIL | FAIL | FAIL | FAIL | generate: No local LLM model detected at http://localhost:1234/v1/models. Start LM Studio/Ollama with a loaded model, run "sinter --configure", or set LIMINAL_LLM_BASE_URL and LIMINAL_LLM_MODEL. |
| textgen | PASS | FAIL | FAIL | FAIL | validate: No dedicated CodeValidator/domain validator registered for textgen |

PASS domains: `p5`, `three`, `revideo`, `ascii`.

FAIL domains: `svg`, `glsl`, `hydra`, `tone`, `strudel`, `html`, `kinetic`, `textgen`.

Generation/validation/preview map:

- svg: generator `svg`, validator `CodeValidator(svg)`, headless PNG via HTMLWrapper/render pattern.
- p5: generator `p5`, validator `CodeValidator(p5)`, headless PNG via HTMLWrapper/render pattern.
- glsl: generator `shader`, validator `CodeValidator(glsl)`, headless PNG via HTMLWrapper/render pattern.
- hydra: generator `hydra`, validator `CodeValidator(hydra)`, headless PNG via HTMLWrapper/render pattern.
- three: generator `three`, validator `CodeValidator(three)`, headless PNG via HTMLWrapper/render pattern.
- tone: generator `tone`, validator `CodeValidator(tone)`, code receipt check.
- strudel: generator `strudel`, validator `CodeValidator(strudel)`, code receipt check.
- revideo: generator `revideo`, validator `CodeValidator(revideo)`, headless PNG via HTMLWrapper/render pattern.
- html: generator `html`, validator `CodeValidator(html)`, headless PNG via HTMLWrapper/render pattern.
- ascii: generator `ascii`, validator `CodeValidator(ascii)`, code receipt check.
- kinetic: generator `kinetic`, validator `CodeValidator(kinetic)` fallback only; no dedicated domain validator, headless PNG via KineticWrapper/render pattern.
- textgen: generator `textgen`, validator `CodeValidator(textgen)` fallback only; no dedicated domain validator, code receipt check.

Notes:

- `glsl` uses the existing `shader` generator entry and validates through the GLSL validator family.
- `kinetic` and `textgen` are marked FAIL until they have dedicated domain validators; their generators can still produce artifacts, but the gauntlet does not fake a core lock from size-only fallback validation.
