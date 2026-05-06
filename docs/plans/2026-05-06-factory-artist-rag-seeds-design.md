# Factory Artist RAG Seed Design

Date: 2026-05-06

## Goal

Create a docs-only RAG seed pack for every imported Factory artist so future agents can enrich the distillations from public, above-board source anchors without wiring anything into Liminal runtime behavior.

## Non-Goals

- Do not vendor transcripts, blog posts, course material, books, or large copied excerpts.
- Do not implement embeddings, retrieval, ingestion, or prompt routing.
- Do not define or replace the user's audit procedure.
- Do not treat public-but-unlicensed code as reusable code.

## Structure

- `docs/agents/factory-artists/rag/README.md` defines the boundary and reuse policy.
- `docs/agents/factory-artists/rag/index.json` lists every imported artist and their RAG folder.
- `docs/agents/factory-artists/rag/<artist>/README.md` gives a human-readable use note.
- `docs/agents/factory-artists/rag/<artist>/sources.json` gives machine-readable source pointers, reuse posture, and known gaps.

## Source Policy

Public discourse sources are reference anchors only. They can be summarized with attribution and short compliant excerpts when needed, but they are not copied into this repo.

Open-source code sources require a visible license before reuse. Repositories with no detected license may be inspected for public context only.

## Completion Criteria

- Every artist in `roster.json` has a RAG folder.
- Every folder has a README and valid `sources.json`.
- The root index is valid JSON and includes all fourteen artists.
- Verification covers JSON parsing and whitespace sanity.
