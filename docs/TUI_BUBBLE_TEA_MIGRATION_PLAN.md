# TUI Bubble Tea Migration Plan

**Status Date:** 2026-04-09
**Last Updated:** 2026-04-09 — Bridge contract defined. TS bridge service built and wired. Bubble Tea shell connected to bridge via SSE. Happy-path parity achieved. Ink containment complete.
Use a shared TypeScript bridge with:
- local HTTP request endpoints
- SSE event streaming
HTTP + SSE fits the current backend shape, is simpler to audit, and is enough for the MVP's pane-first response flow.

## Migration sequence
1. finish Ink containment
2. define shared bridge types
3. implement bridge service in TS
4. scaffold Bubble Tea shell
5. wire Bubble Tea to bridge
6. move trust/provenance UX into Bubble Tea
7. retire Ink after happy-path parity
