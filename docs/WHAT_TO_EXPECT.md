# What to Expect When Running Liminal Studio

**First-Time User Guide**

This guide describes the current product path: open Studio, write a creative prompt, generate an artifact, inspect the same-screen preview, and either revise or polish the result.

## Start Studio

From the repository root:

```bash
pnpm gui
```

The command builds the local package and starts the Studio backend. Open the local Studio URL printed by the command. The first screen is the chat-first workbench, not a task dashboard.

You should see:

- **Liminal Studio** at the top of the workbench.
- A **Message Liminal** composer.
- A right-side preview panel for generated sketches, shaders, images, motion, and playable sound.
- Generate tools for choosing Auto, p5.js, Three.js, SVG, GLSL, Hydra, Strudel, Tone.js, HyperFrames, Kinetic, ASCII, Text, Revideo, or Organism output.
- Secondary tools such as Improve, Review, Evolve, Observe, and Settings behind the workbench navigation.

## Provider Readiness

If Studio cannot connect to a model provider, fix provider setup before judging generation quality.

The setup paths are provider-specific:

- Local providers: LM Studio and Ollama can run without cloud API keys.
- Cloud providers: MiniMax, OpenAI, OpenRouter, GLM, Kimi, Moonshot, or a custom OpenAI-compatible endpoint need their matching key.
- The CLI and onboarding diagnostics name the exact missing key for the selected provider.

For a quick local sanity check:

```bash
liminal provider help
```

## Generate Your First Artifact

In the **Message Liminal** box, write a normal creative request, for example:

```text
Create a p5.js sketch of luminous blue-green particles orbiting a dark center.
```

Click **Generate**.

Expected behavior:

- The composer changes from Ready to Working.
- A visible **Stop** button appears beside Generate while the run is active.
- The work log opens with live generation steps.
- The preview panel changes from the empty state to a same-screen preview when an artifact is available.
- If the prompt says a specific domain, such as Hydra, Revideo, Tone.js, or GLSL, the prompt overrides a stale selected mode.

## Revise Or Polish

After a draft preview appears, keep working in the same message box.

Use natural follow-up language:

```text
Make the particles move more slowly and add a soft red ring near the center.
```

Choose **Generate** for a fast new draft, or **Polish** when you want the slower quality pass with scoring, repair, and preview checks.

Expected behavior:

- Existing code context is carried into the follow-up.
- The preview stays visible while the next run prepares a replacement.
- If an inline image preview fails to load, Studio shows a visible preview error with a retry control instead of silently hiding the failure.

## If Generation Fails

Failures should be visible in the workbench. Look for:

- A provider or endpoint error in the work log.
- A preview unavailable state in the preview panel.
- A stopped state if you clicked Stop.
- A clarification request if the prompt is too ambiguous.

Useful first checks:

```bash
pnpm typecheck
pnpm --dir gui build
pnpm test:quality
```

These commands do not prove live model quality, but they tell you whether the local app and regression checks are healthy.

## CLI Fast Path

If you want the quickest non-GUI smoke, use the natural-language CLI:

```bash
liminal "a luminous blue-green particle garden"
```

Use Studio when you want the product experience: prompt, timeline, stop control, preview, revision, and polish in one place.

## Success Criteria

You have completed a healthy first run when:

- Studio starts with `pnpm gui`.
- The **Message Liminal** composer accepts a creative prompt.
- **Generate** starts a run and shows a visible Stop control.
- A same-screen preview appears, or a visible error explains why it could not.
- A follow-up prompt can revise the artifact.
- **Polish** remains available for the slower quality pass.
- `pnpm typecheck` and `pnpm --dir gui build` pass locally.

## Quick Reference

```bash
pnpm gui                  # Start Studio
liminal provider help     # Check provider setup guidance
pnpm typecheck            # Root TypeScript check
pnpm --dir gui build      # Studio production build
pnpm test:quality         # Test quality scan
```
