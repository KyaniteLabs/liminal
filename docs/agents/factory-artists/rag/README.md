# Factory Artist RAG Seeds

This folder adds public-source retrieval seeds for the temporary Factory artist guidance.

It is reference-only source manifests. It is not Liminal runtime configuration, not a runtime RAG index, not an audit procedure, and not an ingestion pipeline. These files are not `SKILL.md` skills and are not loaded by `SkillLoader`.

## How To Use

Each artist has a folder with:

- `README.md` for the human intent and retrieval angle.
- `sources.json` for machine-readable public source pointers.

Use these manifests as a starting map for future RAG ingestion, manual research, or source-backed persona refinement.

## Reuse Rules

- Public blogs, video captions, transcripts, podcasts, articles, and archives are reference-only unless their page says otherwise.
- Do not copy full transcripts or articles into this repository.
- Use short, attributed excerpts only when they are necessary and copyright-safe.
- Code examples are reusable only when the repository has a visible compatible license.
- Public repositories with no detected license are inspect-only.

## Boundary

This pack exists to make the imported people more robust as guidance. It does not wire them into prompts, Studio, generation flows, or review automation.
