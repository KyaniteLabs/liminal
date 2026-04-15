# TUI Bridge

Shared bridge layer for Bubble Tea and existing TypeScript runtime.

## Operator model
- Bubble Tea is the **coding/operator harness**
- Non-creative input should route into the **tool-using harness/runtime lane** by default
- Creative generation is a separate lane, not the default shell behavior
- Lane differences should come from runtime policy (verification, trust, bounded packets), not from conflicting personalities

## MVP transport
- Control plane: local HTTP
- Event stream: SSE

## Responsibilities
- create sessions
- accept explicit-mode input
- route ordinary non-creative input into the tool-using harness lane
- emit active-response streaming events
- hold pending actions for confirmation-first mutation
- expose trust/provenance state

## Non-goals for MVP
- WebSocket transport
- Ink parity
- advanced dashboards
