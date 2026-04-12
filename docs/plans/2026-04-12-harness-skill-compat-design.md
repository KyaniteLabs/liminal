# Harness Skill Compatibility Design

Date: 2026-04-12
Status: approved for implementation

## Goal

Add a practical skill-compatibility layer for the Liminal harness so repo-local and installed skills can improve coding work without trying to emulate the full Claude/Codex runtime.

## Problem

Liminal already has:
- repo guidance via `AGENTS.md` and `CLAUDE.md`
- a typed harness tool system under `src/harness/tools/`
- a generator plugin system under `plugins/`

It does not have:
- a `SKILL.md` loader
- a skill execution contract
- a harness-safe bridge to MCP-backed code/doc search

The current harness tool dispatch is hardcoded in `HarnessAgent.getToolInstance()`, which means external skills cannot be used directly.

## Non-Goals

- full Claude Code skill runtime parity
- generic execution of arbitrary skill scripts
- dynamic shell access from skills
- generic MCP registry for every possible MCP server

## Recommended Approach

Implement the practical subset:

1. Add a `SkillLoader` that discovers `SKILL.md`-based skills from a small set of local directories.
2. Add an `ExecuteSkillTool` that loads a skill by name and returns its instructions plus resolved local asset paths.
3. Add harness-safe coding tools for:
   - code search
   - doc search
   - lint
   - focused tests
4. Wire those tools into `HarnessAgent` dispatch.

This preserves the harness's typed, rate-limited, rollback-aware execution model.

## Skill Compatibility Contract

Supported shape:
- `SKILL.md`
- optional local assets and references under the skill directory

Supported behavior:
- read skill metadata and body
- expose the skill body as instructions for harness planning
- allow the harness to execute known tools named in tasks or future planning flows

Not supported in this pass:
- arbitrary script execution from skills
- recursive skill chaining
- runtime-specific directives like spawning Codex/Claude subagents directly from a skill

## Directories

The loader will check these locations in order:
- repo-local `.skills/`
- user-level `~/.agents/skills/`
- user-level `~/.codex/skills/`

## New Harness Tools

### `executeSkill`
- input: `name`
- output: resolved skill metadata and body

### `searchCode`
- input: `query`, optional `filePattern`, optional `maxResults`
- output: code matches
- implementation: shell-backed `jcodemunch` fallback first via Python package, with clear errors if unavailable

### `searchDocs`
- input: `query`, optional `maxResults`
- output: doc section matches
- implementation: shell-backed `jdocmunch` fallback first via Python package, with clear errors if unavailable

### `runLint`
- input: optional `files`, optional `timeoutMs`
- output: command result and pass/fail

### `runFocusedTests`
- input: required list of paths/patterns, optional `timeoutMs`
- output: command result and pass/fail

## Verification

Required tests:
- skill loading from a temp/local directory
- missing skill failure
- `executeSkill` returns parsed metadata/body
- `searchCode` and `searchDocs` fail cleanly when backing tools are unavailable
- `runLint` and `runFocusedTests` command construction
- `HarnessAgent.getToolInstance()` recognizes the new tool names

Required runtime verification:
- targeted Vitest suites
- `npm run build`

## Risks

- Local MCP/CLI environments differ between machines.
- Some globally installed skills may rely on runtime conventions not supported by Liminal.
- `visual-bible.html` and `THE_BIBLE.md` must be updated with the new capability.

## Recommendation

Ship the practical subset first. If it proves useful, add richer compatibility later by extending `ExecuteSkillTool` and introducing a typed MCP registry layer rather than trying to parse every agent-runtime convention up front.
