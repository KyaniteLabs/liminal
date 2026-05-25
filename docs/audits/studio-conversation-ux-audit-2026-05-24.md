# Studio Conversation UX Audit - 2026-05-24

## Scope

The document pack asked why Studio behaved like a one-shot prompt flow instead
of a chat-first creative workshop.

Files inspected:

```text
gui/src/App.tsx
gui/src/components/WorkbenchShell.tsx
gui/src/gui/studioConversation.ts
gui/src/gui/workbenchState.ts
gui/src/gui/createModes.ts
src/agent/*
src/tui-bridge/*
gui/server.js
```

## Finding

The immediate user-facing failure was not that the text box disappeared. The
prompt bar stayed available, but messages typed after an artifact did not have
a small, explicit routing contract for the current artifact.

Without that contract, follow-up language such as "make it softer" was too easy
to treat as another standalone generation request. That made Studio feel
one-shot even when the preview and receipts still existed.

## Minimal Repair That Landed

Commit `3f6d5a5b` added a small routing layer:

```text
gui/src/gui/studioConversation.ts
```

The route now maps follow-up messages with a current receipt to:

- `revise` for ordinary instructions
- `variant` for "another version" language
- `inspect` for receipt/details/explain language
- `export` for export/save/download language

`gui/src/App.tsx` now calls that layer before submitting prompt-bar input.
Revision and variant requests carry the prior `WorkbenchRunReceipt` and
`revisionKind` through `creativePreferences`, so the bridge can link the new
generation to the visible artifact instead of pretending it is a fresh thread.

## Preview and Receipt Preservation

The repair keeps the current preview and run receipt in the Workbench shell.
Inspect/export follow-ups return notices rather than starting unnecessary new
generation runs.

## Tests

The focused unit test is:

```text
test/unit/gui/studio-conversation.test.ts
```

It verifies:

- messages after a preview default to a revision route
- "details"/"inspect" language does not trigger generation
- revision submissions include the prior artifact receipt and revision kind

Earlier branch verification also ran:

```text
pnpm typecheck
pnpm --dir gui build
pnpm test -- --coverage=false
```

## Remaining Risk

This audit repaired the artifact follow-up contract. It did not exhaustively
exercise every stop/cancel/error visual state through a browser session after
the later Sing benchmark commits. Before merging, rerun a browser smoke on the
Studio prompt bar and confirm:

- composer remains enabled after success
- preview remains visible
- stop/cancel permits another prompt
- error state permits another prompt
