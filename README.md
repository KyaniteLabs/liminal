# Sinter

To sinter: to fire many separate particles into one solid, durable form — the way a kiln fuses grains of clay into a single vessel. That's the idea: generate across many creative-coding domains, then fuse them into one layered work.

## Try it

```bash
# Install
pnpm install
# Configure (first time) — sets up ~/.liminal/config.json
sinter --configure
# Or use environment variables:
export LLM_API_KEY=your-key
export LLM_MODEL=MiniMax-M2.7
export LLM_BASE_URL=https://api.minimax.io/anthropic
# Generate
sinter --prompt "Create a calming blue particle system"
# Studio — the active chat-first GUI workbench with same-screen preview
pnpm gui
```

```bash
# 1. Install and build
pnpm install
pnpm build
# 2. Configure a provider (or run sinter --configure)
export SINTER_LLM_PROVIDER=glm
export GLM_API_KEY=your-key
# 3. Generate from natural language
sinter "a luminous blue-green particle garden"
# 4. Launch Studio for chat, same-screen preview, revision, and optional details
pnpm gui
# 5. Studio smoke (same-screen preview path)
pnpm proof:studio-smoke
```

## Docs

- [![CI](https://github.com/KyaniteLabs/liminal/actions/workflows/ci.yml/badge.svg)
- [Public landing page](https://kyanitelabs.github.io/liminal/)
- [GitHub repository](https://github.com/KyaniteLabs/liminal)
- [docs/FINISH_LINE.md](docs/FINISH_LINE.md)
- [kyanitelabs.github.io/liminal](https://kyanitelabs.github.io/liminal/)

## License

See [LICENSE](LICENSE).
