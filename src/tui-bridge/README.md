# TUI Bridge

Shared bridge layer for Bubble Tea and existing TypeScript runtime.

## MVP transport
- Control plane: local HTTP
- Event stream: SSE

## Responsibilities
- create sessions
- accept explicit-mode input
- emit active-response streaming events
- hold pending actions for confirmation-first mutation
- expose trust/provenance state

## Non-goals for MVP
- WebSocket transport
- Ink parity
- advanced dashboards
