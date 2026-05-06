# Liminal Launch Thread — Launch-Candidate Copy

**Positioning:** Codex for creative coding. Clean chat, same-screen preview, honest proof.

Copy-paste each post, then attach fresh screenshots from the local proof bundle summarized in `docs/launch/launch-candidate-2026-04-30.md`.

---

## Post 1/8 — The Hook

I built Liminal: Codex for creative coding.

You chat with an AI agent, describe a sketch / shader / sound / scene, and the artifact previews in the same screen while you keep iterating.

No separate dashboard. No fake fallback. Just prompt → preview → revise.

[Attach: Studio home or final preview screenshot]

---

## Post 2/8 — The Studio

The main surface is intentionally simple:

- chat on the left
- live preview on the right
- Generate / Revise / Variation / Polish
- advanced receipts hidden until you ask

The internal harness is still there, but it does not have to be the artist's mental model.

[Attach: Studio screenshot showing preview panel]

---

## Post 3/8 — The Preview Contract

A creative coding tool has to show the work where the conversation is happening.

Liminal's launch-candidate smoke generated a p5.js moonlit garden, mounted the preview in Studio, then accepted a revision: darker, slower, more spacious.

Same screen. No pop-up-only workflow.

[Attach: `05-revision-preview.png`]

---

## Post 4/8 — The Mediums

Liminal can target multiple creative-code domains:

p5.js, SVG, GLSL, Three.js, Hydra, Strudel, Tone.js, Revideo, HyperFrames, ASCII, Kinetic, TextGen.

The user can name a medium explicitly, or Liminal can choose one from the creative brief.

---

## Post 5/8 — Voice Input

Text is not the only input.

The microphone preview turns speech or sound features into a synesthetic visual direction: brightness, ripples, particles, typography, and palette respond to the sound.

It also handles denied microphone permission with a clear recovery message.

[Attach: mic preview screenshot or receipt snippet]

---

## Post 6/8 — Honesty

Liminal is not perfect.

The point is not to hide failure. The point is to make creative generation observable enough that failures can be diagnosed, repaired, and improved without pretending every output is magic.

The receipts are available, but they stay behind Details unless you need them.

---

## Post 7/8 — How to Try It

Run Studio:

```bash
pnpm install
pnpm build
LIMINAL_LLM_PROVIDER=glm GLM_API_KEY=... pnpm gui
```

Then type a creative prompt and watch the preview panel.

You can also use local/open providers through LM Studio or Ollama.

---

## Post 8/8 — The Ask

Reply with a prompt.

I'll generate it live and show:

- the preview
- the medium used
- whether it needed revision
- any honest caveats

Let's see what creative coding feels like when the agent is a collaborator, not just a code emitter.

---

## Proof Checklist Before Posting

- [ ] Current `main` equals `origin/main`
- [ ] `pnpm gui` launches Studio
- [ ] p5 prompt creates same-screen preview
- [ ] revision keeps preview mounted
- [ ] microphone preview smoke passes
- [ ] screenshots copied from the local proof bundle summarized in `docs/launch/launch-candidate-2026-04-30.md`
- [ ] remaining caveats listed plainly
