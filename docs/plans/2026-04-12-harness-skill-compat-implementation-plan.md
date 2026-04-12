# Harness Skill Compatibility Implementation Plan

Date: 2026-04-12

## Scope

Implement the approved practical subset:
- `SkillLoader`
- `ExecuteSkillTool`
- `SearchCodeTool`
- `SearchDocsTool`
- `RunLintTool`
- `RunFocusedTestsTool`
- `HarnessAgent` dispatch wiring
- docs updates

## Steps

1. Add failing tests for:
   - skill loading
   - execute-skill behavior
   - new tool command/error behavior
   - harness dispatch coverage
2. Implement new types and loader utilities.
3. Implement the new tools in `src/harness/tools/`.
4. Export tools from `src/harness/tools/index.ts`.
5. Wire tool dispatch in `src/harness/agent/HarnessAgent.ts`.
6. Update docs:
   - `AGENTS.md`
   - `CLAUDE.md`
   - `docs/THE_BIBLE.md`
   - `docs/visual-bible.html`
7. Verify with targeted tests, then build.

## Success Criteria

- Harness can load a named local/global skill through a typed tool.
- Harness exposes code/doc search and focused lint/test execution as first-class tools.
- New tools are documented and covered by tests.
- Build passes after the change.

## Out of Scope

- generic script execution from skill folders
- arbitrary MCP auto-discovery
- full Claude/Codex agent-runtime compatibility
