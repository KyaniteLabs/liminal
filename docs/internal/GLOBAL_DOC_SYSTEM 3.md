# Global Documentation Remediation System

> A universal framework for preventing documentation decay across all projects.

## Executive Summary

The documentation decay patterns discovered in liminal exist in **every codebase everywhere**. This document provides a systematic approach to implement documentation validation across all projects globally.

## Core Principles

1. **Documentation is Code** - Treat docs with same rigor as source code
2. **Validation is Automated** - Never rely on manual doc reviews
3. **Prevention Over Cure** - Block doc drift before it happens
4. **Universal Applicability** - Framework works for any project type

## The Universal Pattern

Every project suffers from the same 6 patterns:

| Pattern | Cause | Solution |
|---------|-------|----------|
| Feature Abandonment | Deleted features without doc cleanup | File reference validation |
| Mass Refactoring | Code moved/renamed, docs stale | Automated path checking |
| Undocumented Features | Built without documentation | Code coverage detection |
| Partial Implementation | Started, never finished | TODO/FIXME tracking |
| Version Chaos | No single source of truth | Version consistency enforcement |
| Organizational Drift | Structural changes not reflected | Directory change detection |

## Implementation by Project Type

### TypeScript/JavaScript Projects

**Files to Create:**

```
scripts/
├── validate-version.js      # Version consistency
├── verify-file-refs.js      # File existence check
├── detect-undocumented.js   # Undocumented code finder
└── audit-docs.js            # Comprehensive audit

.githooks/
└── pre-commit               # Pre-commit validation

.github/workflows/
└── doc-validation.yml       # CI validation

.github/
└── PULL_REQUEST_TEMPLATE.md # Doc checklist
```

**package.json additions:**
```json
{
  "scripts": {
    "validate-docs": "node scripts/validate-version.js && node scripts/verify-file-refs.js",
    "audit-docs": "node scripts/audit-docs.js"
  }
}
```

### Python Projects

**Files to Create:**

```python
# scripts/validate_version.py
import json
import re
from pathlib import Path

def validate_versions():
    files = {
        'pyproject.toml': r'version\s*=\s*"([^"]+)"',
        '__init__.py': r'__version__\s*=\s*["\']([^"\']+)["\']',
        'README.md': r'Version[:\*]*\s*(\d+\.\d+\.?\d*)',
    }
    # ... validation logic
    
if __name__ == '__main__':
    validate_versions()
```

```yaml
# .pre-commit-hooks.yaml
- id: validate-docs
  name: Validate Documentation
  entry: python scripts/validate_version.py
  language: python
```

### Rust Projects

```rust
// scripts/validate_version.rs
use std::fs;
use regex::Regex;

fn validate_versions() -> Result<(), String> {
    let cargo_toml = fs::read_to_string("Cargo.toml")
        .map_err(|e| e.to_string())?;
    // ... validation logic
    Ok(())
}
```

### Go Projects

```go
// scripts/validate_version.go
package main

import (
    "os"
    "regexp"
)

func main() {
    files := map[string]string{
        "go.mod": `module .* v(\d+\.\d+\.\d+)`,
        "version.go": `Version = "(\d+\.\d+\.\d+)"`,
    }
    // ... validation logic
}
```

## Universal Installer

Create a one-command installer that detects project type and sets up appropriate validation:

```bash
#!/bin/bash
# install-doc-validation.sh
# Universal documentation validation installer

PROJECT_TYPE=$(detect_project_type)

case $PROJECT_TYPE in
  "node")
    setup_node_validation
    ;;
  "python")
    setup_python_validation
    ;;
  "rust")
    setup_rust_validation
    ;;
  "go")
    setup_go_validation
    ;;
  *)
    echo "Unknown project type"
    exit 1
    ;;
esac

echo "✅ Documentation validation installed!"
echo "Run: validate-docs"
```

## CI/CD Integration Matrix

| Platform | Config File | Validation Step |
|----------|-------------|-----------------|
| GitHub Actions | `.github/workflows/doc-validation.yml` | `run: npm run validate-docs` |
| GitLab CI | `.gitlab-ci.yml` | `script: npm run validate-docs` |
| CircleCI | `.circleci/config.yml` | `run: npm run validate-docs` |
| Travis CI | `.travis.yml` | `script: npm run validate-docs` |
| Jenkins | `Jenkinsfile` | `sh 'npm run validate-docs'` |
| Azure DevOps | `azure-pipelines.yml` | `script: npm run validate-docs` |

## Pre-Commit Hook Matrix

| Tool | Config File | Hook Definition |
|------|-------------|-----------------|
| husky (Node) | `.husky/pre-commit` | `npm run validate-docs` |
| pre-commit (Python) | `.pre-commit-config.yaml` | `entry: validate-docs` |
| lefthook (Universal) | `lefthook.yml` | `run: validate-docs` |
| Git native | `.git/hooks/pre-commit` | Direct script |

## The Global Rollout Plan

### Phase 1: Template Repository (Week 1)

Create `github.com/Pastorsimon1798/doc-validation-templates`:

```
templates/
├── node/
│   ├── scripts/
│   ├── .githooks/
│   └── .github/
├── python/
│   ├── scripts/
│   ├── .pre-commit-hooks.yaml
│   └── .github/
├── rust/
│   └── ...
└── go/
    └── ...

install.sh  # Universal installer
```

### Phase 2: GitHub/GitLab Integration (Week 2)

Create marketplace actions:

```yaml
# GitHub Action
name: 'Documentation Validation'
description: 'Validate documentation stays in sync with code'
runs:
  using: 'composite'
  steps:
    - run: ${{ github.action_path }}/validate.sh
      shell: bash
```

### Phase 3: IDE Integration (Week 3)

VS Code Extension:
- Real-time doc validation
- Auto-fix suggestions
- Version consistency highlighting

### Phase 4: Organizational Enforcement (Week 4)

For organizations with multiple repos:

```yaml
# .github/organization-workflows.yml
workflows:
  - name: doc-validation
    repositories:
      - "*"
    branches:
      - main
    required: true
```

## Success Metrics

After global implementation:

| Metric | Before | After |
|--------|--------|-------|
| Doc drift incidents | High | Zero |
| Time to detect drift | Weeks | Minutes |
| Developer friction | Manual reviews | Automated |
| Cross-project consistency | None | Universal |

## Adoption Checklist

For any new project:

- [ ] Install doc validation system
- [ ] Configure version sources
- [ ] Set up CI validation
- [ ] Add pre-commit hooks
- [ ] Create PR template
- [ ] Train team on workflow
- [ ] Monitor for 2 weeks
- [ ] Celebrate zero drift!

## Maintenance

**Weekly:**
- Run `audit-docs` across all projects
- Review any new drift patterns

**Monthly:**
- Update validation rules
- Share learnings across teams

**Quarterly:**
- Review global adoption
- Update templates

---

## The Vision

> Every commit, every project, everywhere: Documentation stays in sync automatically.

No more "the docs are out of date."
No more "I'll update the README later."
No more doc drift.

**Documentation is code. Validate it like code.**
