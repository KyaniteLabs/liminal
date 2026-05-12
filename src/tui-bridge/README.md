# TUI Bridge

Shared HTTP/SSE bridge layer for Studio and external clients.

## Usage

- `liminal bridge [port]` — start the bridge server (default port: 3000)
- Studio GUI connects to the bridge for streamed generation and preview events

## Transport

- Control plane: local HTTP
- Event stream: SSE

## Responsibilities

- Create sessions
- Accept explicit-mode input
- Route ordinary non-creative input into the tool-using harness lane
- Emit active-response streaming events
- Hold pending actions for confirmation-first mutation
- Expose trust/provenance state
