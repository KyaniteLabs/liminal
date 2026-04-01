# Audit Workflow — Repeatable Repository Audit Procedure

**Purpose:** A structured, repeatable procedure for auditing any TypeScript/Node.js repository. Designed for use with Claude Code agents, jcodemunch, jdocmunch, and jdatamunch.

**Total time:** ~95 minutes for a thorough audit

---

## Tool Requirements

| Tool | Purpose | Install |
|------|---------|---------|
| jcodemunch (`mcp__jcodemunch__`) | Code symbol search, file outlines, text search | MCP server |
| jdocmunch (`mcp__jdocmunch__`) | Documentation search, TOC navigation | MCP server |
| jdatamunch (`mcp__jdatamunch__`) | Tabular data analysis (CSV/JSONL) | MCP server |
| `gh` CLI | GitHub API, CI, PR, issues, settings | `brew install gh` |
| `pnpm`/`npm` | Dependency audit, pack dry-run | Already installed |
| `git` | History, size, secrets scan | Already installed |

---

## Phase 1: Automated Scanning (5 min)

Run these commands first — they produce raw data for all subsequent phases.

### 1.1 Dependency vulnerabilities
```bash
pnpm audit 2>&1 | tee /tmp/audit-deps.txt
```

### 1.2 Git history secrets
```bash
# Check for leaked secrets
git log --all --diff-filter=D -- '*.env' '*.key' '*.pem' '*.secret' 2>&1 | head -20
git log --all -p -S 'sk-' -- '*.env' 2>&1 | head -20
git log --all -p -S 'API_KEY=' 2>&1 | head -20
git log --all -p -S'password=' -- '*.ts' '*.js' 2>&1 | head -20
```

### 1.3 Repo size and bloat
```bash
git count-objects -vH
du -sh .git src/ node_modules/ examples/ test/ landing-assets/ dist/ 2>/dev/null
git ls-files | awk -F. '{print $NF}' | sort | uniq -c | sort -rn | head -20
git ls-files | grep -E '\.(png|jpg|mp4|zip|tar|gz)$' | wc -l
git rev-list --objects --all | git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | awk '/^blob/ {print $3, $4}' | sort -rn | head -20
```

### 1.4 npm publishability
```bash
npm pack --dry-run 2>&1 | tail -5
```

### 1.5 Index source code (if not already indexed)
```
jcodemunch: index_folder(path=".", incremental=true)
jdocmunch: index_local(path=".")
```

### 1.6 Index data files
```
jdatamunch: index_local() for any CSV/JSONL/Excel files
```

### 1.7 Pattern scanning
```
jcodemunch: search_text(query="catch {}")                    # bare catches
jcodemunch: search_text(query="console.log")                # log leaks
jcodemunch: search_text(query=": any")                      # any types
jcodemunch: search_text(query="TODO")                        # incomplete features
jcodemunch: search_text(query="process.env.HOME")           # platform issues
jcodemunch: search_text(query="/tmp")                        # hardcoded paths
jcodemunch: search_text(query="eval(")                       # code injection
jcodemunch: search_text(query="innerHTML")                   # XSS vectors
```

### Deliverable
Raw data from all commands above, saved to memory or notes.

---

## Phase 2: Source Code Quality (15 min)

### 2.1 Error handling patterns
```
jcodemunch: search_text(query="catch (") — review all catch blocks
jcodemunch: search_text(query="catch {}") — bare catches
jcodemunch: search_text(query="return null") — silent failures
jcodemunch: search_text(query="return []") — silent defaults
jcodemunch: search_text(query="return ''") — empty returns
```

Manual review:
- [ ] Read each catch block — is the error logged? Propagated? Returned as default?
- [ ] Identify swallowed errors vs acceptable catches
- [ ] Find `console.warn`-only catches that should propagate

### 2.2 Dead code detection
```
jcodemunch: get_file_tree() — full directory structure
jcodemunch: search_text(query="export function") — all exported functions
jcodemunch: search_text(query="@deprecated") — deprecated code
```

Manual review:
- [ ] Compare exports to imports — find orphaned modules
- [ ] Check for duplicate interfaces/types across files
- [ ] Find files that nothing imports from

### 2.3 Stubs and incomplete code
```
jcodemunch: search_text(query="TODO")
jcodemunch: search_text(query="FIXME")
jcodemunch: search_text(query="HACK")
jcodemunch: search_text(query="not yet implemented")
jcodemunch: search_text(query="placeholder")
```

### 2.4 Type safety
```
jcodemunch: search_text(query=": any")
jcodemunch: search_text(query=" as any")
jcodemunch: search_text(query="@ts-ignore")
jcodemunch: search_text(query="!.")   # non-null assertions
```

### 2.5 Console leaks
```
jcodemunch: search_text(query="console.log")
jcodemunch: search_text(query="console.warn")
jcodemunch: search_text(query="console.error")
```

### Checklist
- [ ] All bare `catch {}` blocks identified and categorized
- [ ] Silent failure return paths documented
- [ ] Dead code / orphaned files listed
- [ ] Stubs and TODOs catalogued
- [ ] `any` usage count and worst locations noted
- [ ] Console.log count in production code (excluding CLI output)

---

## Phase 3: Architecture & Wiring (15 min)

### 3.1 CLI completeness
```
jcodemunch: get_file_outline(file="bin/liminal" or equivalent)
```

Manual review:
- [ ] Trace each CLI flag to the function it calls
- [ ] Verify the function's type signature accepts all passed properties
- [ ] Find flags that are parsed but never consumed (dead flags)
- [ ] Check commands that import from `dist/` (will fail without build)

### 3.2 Generator completeness
```
jcodemunch: search_symbols(query="Generator")
jcodemunch: get_file_outline(file="src/generators/registerGenerators.ts")
```

Manual review:
- [ ] List all generator files vs registered generators — find orphans
- [ ] Check LLM client injection pattern consistency across generators
- [ ] Verify each generator's validation logic (what passes that shouldn't?)

### 3.3 Config loading
```
jcodemunch: get_symbol(symbol_id="ConfigLoader" or similar)
```

Manual review:
- [ ] What happens when config is missing? Malformed? Partial?
- [ ] Which config fields are defined but never consumed?
- [ ] Are env var fallbacks documented?

### 3.4 Barrel exports
```
jcodemunch: search_text(query="export * from")
jcodemunch: search_text(query="export {")
```

Manual review:
- [ ] Compare each directory's index.ts to the modules in that directory
- [ ] List modules that exist but aren't barrel-exported

### Checklist
- [ ] All CLI flags traced to their consumers
- [ ] Dead flags identified
- [ ] All generators verified registered + wired
- [ ] Config dead fields identified
- [ ] Barrel export gaps listed

---

## Phase 4: LLM & Data Pipeline Integrity (10 min)

### 4.1 LLM client
```
jcodemunch: get_symbol(symbol_id="LLMClient")
jcodemunch: search_text(query="AbortSignal")
jcodemunch: search_text(query="retry")
```

Manual review:
- [ ] Timeout handling — is custom signal combined with built-in timeout?
- [ ] Retry logic — what error types are retried? Rate limiting handled?
- [ ] Response parsing — regex fallbacks fragile?
- [ ] Auth failure — does it return code that passes validation?
- [ ] Circuit breaker exists?

### 4.2 Compost/pipeline state
```
jcodemunch: get_symbol(symbol_id="CompostMill")
jcodemunch: get_symbol(symbol_id="CompostSoup")
jcodemunch: get_symbol(symbol_id="SeedBank")
```

Manual review:
- [ ] Concurrent access — any TOCTOU patterns?
- [ ] Data loss paths — does purge happen before save?
- [ ] State evolution — does the pipeline actually reload evolved state?
- [ ] Crash recovery — what happens on partial writes?

### 4.3 Creative loop
```
jcodemunch: get_symbol(symbol_id="RalphLoop")
```

Manual review:
- [ ] Can a single iteration hang indefinitely?
- [ ] Is state saved on interruption?
- [ ] Does code validation have false positives?
- [ ] Memory growth bounded?

### Checklist
- [ ] Timeout bypass bugs identified
- [ ] Retry classification gaps noted
- [ ] Data loss paths documented
- [ ] Race conditions in state management found
- [ ] Loop termination guarantees verified

---

## Phase 5: Test Coverage & CI (10 min)

### 5.1 Test coverage gaps
```bash
# Compare source modules to test files
find src/ -name "*.ts" | sed 's|src/||' | sort > /tmp/src-files.txt
find test/ -name "*.test.*" | sed 's|test/||' | sort > /tmp/test-files.txt
comm -23 /tmp/src-files.txt /tmp/test-files.txt
```

Manual review:
- [ ] Which critical modules have zero tests?
- [ ] Do tests test actual behavior or just that mocks don't throw?
- [ ] E2E tests — do they skip properly or silently pass?

### 5.2 CI configuration
```bash
gh run list --limit 10
cat .github/workflows/*.yml
gh api repos/:owner/:repo/branches/:branch/protection 2>&1
```

Manual review:
- [ ] Are all checks (typecheck, lint, test, build) present?
- [ ] Does CI have `permissions:` block (least privilege)?
- [ ] Are action versions pinned to SHA (not just `@v4`)?
- [ ] Branch protection enforced for admins?
- [ ] PR review workflow — does it have all install steps?

### Checklist
- [ ] Test coverage gaps by module listed
- [ ] Test quality issues identified
- [ ] CI pipeline completeness verified
- [ ] Branch protection gaps documented

---

## Phase 6: Security (10 min)

### 6.1 Injection vectors
```
jcodemunch: search_text(query="eval(")
jcodemunch: search_text(query="new Function")
jcodemunch: search_text(query="innerHTML")
jcodemunch: search_text(query="execFile")
jcodemunch: search_text(query="child_process")
```

### 6.2 Authentication & secrets
```
jcodemunch: search_text(query="API_KEY")
jcodemunch: search_text(query="Authorization")
jcodemunch: search_text(query="Bearer")
```

Manual review:
- [ ] SSRF protection exists and is configurable?
- [ ] CSRF library is actively maintained (not deprecated)?
- [ ] Rate limiting configured?
- [ ] Helmet/security headers present?
- [ ] User input sanitized before reaching LLM prompts?
- [ ] Path traversal protection exists?

### 6.3 Dependency vulnerabilities
Use output from Phase 1.1 (`pnpm audit`)

### Checklist
- [ ] Code injection vectors assessed
- [ ] XSS vectors identified
- [ ] SSRF protection verified
- [ ] Auth patterns reviewed
- [ ] Prompt injection surface evaluated
- [ ] CVEs from pnpm audit catalogued

---

## Phase 7: Platform & Operations (10 min)

### 7.1 Cross-platform compatibility
```
jcodemunch: search_text(query="process.env.HOME")
jcodemunch: search_text(query="/tmp")
jcodemunch: search_text(query="process.platform")
jcodemunch: search_text(query="path.join")
jcodemunch: search_text(query="path.sep")
jcodemunch: search_text(query="os.homedir")
jcodemunch: search_text(query="os.tmpdir")
```

Manual review:
- [ ] Hardcoded `/` in path operations?
- [ ] `process.env.HOME` used instead of `os.homedir()`?
- [ ] Unix-only fallbacks (`/tmp`)?
- [ ] Child process commands cross-platform?
- [ ] Any `process.platform` checks?

### 7.2 Signal handling & graceful shutdown
```
jcodemunch: search_text(query="SIGTERM")
jcodemunch: search_text(query="SIGINT")
jcodemunch: search_text(query="beforeExit")
jcodemunch: search_text(query="process.on")
```

Manual review:
- [ ] SIGTERM handler exists?
- [ ] State saved on process exit?
- [ ] Temp files cleaned up?
- [ ] Server connections closed gracefully?

### 7.3 Resource exhaustion
```
jcodemunch: search_text(query="fs.writeFile")
jcodemunch: search_text(query="ParsingCache")
```

Manual review:
- [ ] Disk space checks before writes?
- [ ] Temp file cleanup exists?
- [ ] Cache size limits / eviction policies?
- [ ] Log rotation?
- [ ] Unbounded file creation?

### Checklist
- [ ] Windows compatibility issues listed
- [ ] Signal handling gaps identified
- [ ] Resource exhaustion vectors documented

---

## Phase 8: Presentation & Public Readiness (10 min)

### 8.1 GitHub metadata
```bash
gh repo view --json description,homepageUrl,repositoryTopics,isPrivate,hasWikiEnabled,hasIssuesEnabled
gh api repos/:owner/:repo/pages 2>&1
git tag -l
gh api repos/:owner/:repo/releases --jq '.[].tag_name'
```

### 8.2 File audit
```bash
# List root-level files that shouldn't be public
git ls-files | grep -iE '(audit|remediation|dogfood|red.team|adversarial|security.audit|broken|preexisting|improvements.summary|prd|atomic.tasks)'
git ls-files | grep -E '\.(png|jpg|mp4|zip)$' | head -30
```

### 8.3 README review
Manual review:
- [ ] First 3 lines explain what this is?
- [ ] Installation instructions correct and tested?
- [ ] Broken links or stale references?
- [ ] Version numbers consistent?
- [ ] Claims verifiable (test counts, feature counts)?
- [ ] Appropriate length for public README?

### 8.4 Landing page (if exists)
Manual review:
- [ ] Loads without errors?
- [ ] No internal/dev-only content visible?
- [ ] Version consistent with package.json?
- [ ] Accessibility basics (contrast, motion, ARIA)?
- [ ] Broken images/icons?

### 8.5 Community health files
Check for:
- [ ] LICENSE file
- [ ] CONTRIBUTING.md
- [ ] CODE_OF_CONDUCT.md
- [ ] .github/ISSUE_TEMPLATE/
- [ ] .github/PULL_REQUEST_TEMPLATE.md
- [ ] .github/CODEOWNERS

### Checklist
- [ ] GitHub metadata populated
- [ ] Internal documents NOT tracked
- [ ] README is presentable
- [ ] LICENSE exists
- [ ] Community files present
- [ ] Landing page is professional

---

## Phase 9: Report Generation (10 min)

### 9.1 Compile findings into AUDIT_FULL.md

Structure:
```markdown
# [Repo Name] — Full Repository Audit

**Date:** YYYY-MM-DD | **Scope:** [scope summary]

## Table of Contents
[numbered list of all sections]

## Sections grouped by category:
### Source Quality (Phases 2-3)
### Architecture (Phases 3-4)
### Testing & CI (Phase 5)
### Security (Phase 6)
### Operations (Phase 7)
### Presentation (Phase 8)

## Severity Summary
### CRITICAL (launch-blocking)
### HIGH (functional bugs)
### MEDIUM (quality/reliability)
### LOW (polish)
### GOOD (patterns to replicate)
```

### 9.2 Categorize by severity

**CRITICAL** — Data loss, security exploit, launch-blocking
**HIGH** — Functional bugs, broken features, missing safeguards
**MEDIUM** — Degraded quality, reliability risks, missing docs
**LOW** — Polish, optimization, nice-to-have
**GOOD** — Patterns worth keeping and replicating

### 9.3 Save AUDIT_WORKFLOW.md (this file)

---

## Quick Reference: Agent Prompts for Parallel Execution

When running with Claude Code, launch these agents in parallel:

### Agent 1: Source Code Quality
> "Audit all source in src/ for: swallowed errors (bare catch, console.warn-only), silent failures (return null/[]/''), dead code (zero-import modules), stubs (TODO, placeholder), type safety (any, non-null assertions, @ts-ignore), console.log leaks. Read every file. Be exhaustive."

### Agent 2: Architecture & Wiring
> "Audit CLI wiring (trace every flag to its consumer), generator completeness (registered? LLM injection consistent?), config loading (dead fields? malformed handling?), LLM client (timeout, retry, circuit breaker), compost pipeline (race conditions, data loss, state evolution), barrel exports (modules not exported). Read actual files."

### Agent 3: Tests, CI, Security
> "Audit test quality (mocks vs real code, assertion strength, coverage gaps), CI pipeline (steps, permissions, action pinning), security (eval, innerHTML, execFile, SSRF, CSRF, prompt injection, pnpm audit), documentation (LICENSE, CONTRIBUTING, version consistency), TypeScript config, package.json, gitignore."

### Agent 4: Presentation & Operations
> "Audit GitHub presentation (description, topics, homepage, stale files, README quality, landing page), platform compatibility (hardcoded /, process.env.HOME, signal handling, disk exhaustion), npm publishability (npm pack, files field, postinstall), generator output correctness (validate all examples), branch protection, accessibility."

---

## Time Budget

| Phase | Time | Tool |
|-------|------|------|
| 1. Automated Scanning | 5 min | Bash + jcodemunch |
| 2. Source Code Quality | 15 min | jcodemunch + manual |
| 3. Architecture & Wiring | 15 min | jcodemunch + manual |
| 4. LLM & Data Pipeline | 10 min | jcodemunch + manual |
| 5. Test Coverage & CI | 10 min | Bash + gh + manual |
| 6. Security | 10 min | jcodemunch + pnpm audit |
| 7. Platform & Operations | 10 min | jcodemunch + manual |
| 8. Presentation | 10 min | gh + manual |
| 9. Report Generation | 10 min | Write tool |
| **Total** | **~95 min** | |

---

*This workflow is designed to be run alongside Claude Code with jcodemunch, jdocmunch, and jdatamunch MCP tools. Adjust phases based on repo type and priorities.*
