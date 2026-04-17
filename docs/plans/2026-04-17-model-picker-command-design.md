# Bubble Tea Model Picker Command Design

## Goal

Make provider and model switching an operator-native Bubble Tea workflow. The
user should not edit `~/.liminal/config.json` or export environment variables
for ordinary dogfood runs.

## Design

`/model` is the primary surface. It prints a command-palette-style picker with
numbered choices, current provider/model, and examples. Operators can then use
`/model <number>`, `/model <provider>`, or `/model <provider> <model-or-alias>`.

The existing `/provider openrouter ...` path stays as a compatibility alias.
Switches persist to `~/.liminal/config.json`, rebuild the live bridge
`LLMClient`, and update the session status so Bubble Tea shows the new
provider/model immediately.

## Provider Handling

Recognized providers are the existing Liminal provider keys: `custom`,
`minimax`, `glm`, `lmstudio`, `ollama`, `openrouter`, `kimi`, and `moonshot`.
For direct OpenAI, `/model openai ...` maps to `custom` because the current
provider resolver treats `https://api.openai.com/v1` as OpenAI-compatible
custom.

Local providers (`lmstudio`, `ollama`) do not require keys. Cloud providers
reuse a configured key, then a matching live-client key, then provider-specific
environment variables.

## Verification

Focused tests cover:

- `/model` listing the picker and current model.
- `/model openai gpt-5.4-mini` persisting direct OpenAI-compatible config.
- `/model lmstudio local-model` switching without an API key.
- `/model 1` selecting a numbered picker entry.
- Existing `/provider openrouter ...` compatibility.
