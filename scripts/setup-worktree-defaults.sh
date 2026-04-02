#!/bin/bash
# Git Worktree Defaults Setup Script
# Run once per computer to configure global git for worktree isolation
# Usage: curl -sSL <url> | bash
# Or: ./scripts/setup-worktree-defaults.sh

set -e

echo "🔧 Setting up Git Worktree Defaults..."
echo ""

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo "❌ Git is not installed. Please install git first."
    exit 1
fi

echo "✓ Git found: $(git --version)"
echo ""

# Configure global git aliases for worktree management
echo "📋 Configuring global git aliases..."

git config --global alias.wt '!f() { \
    if [ -z "$1" ]; then \
        echo "Usage: git wt <branch-name> [base-branch]"; \
        echo "       git wt <existing-branch>"; \
        return 1; \
    fi; \
    BRANCH="$1"; \
    BASE="${2:-main}"; \
    REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd); \
    WT_PATH="$REPO_ROOT/.worktrees/$BRANCH"; \
    \
    if git show-ref --verify --quiet "refs/heads/$BRANCH"; then \
        echo "🔗 Branch exists. Creating worktree from branch..."; \
        git worktree add "$WT_PATH" "$BRANCH"; \
    else \
        echo "🌿 Creating new branch and worktree..."; \
        git worktree add -b "$BRANCH" "$WT_PATH" "$BASE"; \
    fi; \
    echo "✓ Worktree created at: $WT_PATH"; \
    echo "📂 Run: cd $WT_PATH"; \
}; f'

git config --global alias.wtl 'worktree list'

git config --global alias.wtc '!git worktree prune && git branch --merged | grep -v "\\*" | grep -v "^\\s*main$\\|^\\s*master$" | xargs -r git branch -d 2>/dev/null || echo "No merged branches to clean"'

git config --global alias.wtr '!f() { \
    REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd); \
    if [ -z "$1" ]; then \
        echo "Usage: git wtr <worktree-name>"; \
        echo "Removes worktree and deletes branch if merged"; \
        return 1; \
    fi; \
    WT_PATH="$REPO_ROOT/.worktrees/$1"; \
    if [ -d "$WT_PATH" ]; then \
        git worktree remove "$WT_PATH" 2>/dev/null || git worktree remove --force "$WT_PATH"; \
        echo "✓ Removed worktree: $1"; \
    else \
        echo "❌ Worktree not found: $WT_PATH"; \
    fi; \
}; f'

git config --global alias.wts '!f() { \
    WT=$(git worktree list --porcelain | grep -E "^worktree " | grep ".worktrees" | head -1 | cut -d" " -f2); \
    if [ -n "$WT" ]; then \
        cd "$WT" && echo "📂 Switched to: $WT"; \
    else \
        echo "❌ No feature worktrees found. Create one with: git wt <branch>"; \
    fi; \
}; f'

echo "✓ Git aliases configured:"
echo "   git wt <branch>     - Create/switch to worktree"
echo "   git wtl             - List all worktrees"
echo "   git wtc             - Clean merged worktrees"
echo "   git wtr <name>      - Remove worktree"
echo "   git wts             - Switch to first available worktree"
echo ""

# Configure default worktree path
git config --global worktree.defaultPath '.worktrees'

echo "✓ Default worktree path set: .worktrees/"
echo ""

# Check for shell and offer to add functions
SHELL_NAME=$(basename "$SHELL")
echo "🐚 Detected shell: $SHELL_NAME"
echo ""

# Create shell integration snippet
SNIPPET_PATH="$HOME/.git-worktree-shell-integration"
cat > "$SNIPPET_PATH" << 'EOF'
# Git Worktree Shell Integration
# Add this to your .bashrc or .zshrc: source ~/.git-worktree-shell-integration

# Prompt function to show current worktree
__git_worktree_prompt() {
    local wt=$(git rev-parse --show-toplevel 2>/dev/null)
    local main=$(git rev-parse --show-superproject-working-tree 2>/dev/null || git rev-parse --show-toplevel 2>/dev/null)
    if [ -n "$wt" ] && [ -n "$main" ] && [ "$wt" != "$main" ]; then
        local wt_name=$(basename "$wt")
        echo "[$wt_name] "
    fi
}

# Enhanced checkout with worktree awareness
gco() {
    local branch=$1
    if [ -z "$branch" ]; then
        echo "Usage: gco <branch-name>"
        return 1
    fi
    
    # Skip for main/master
    if [[ "$branch" =~ ^(main|master|develop)$ ]]; then
        command git checkout "$branch"
        return
    fi
    
    local repo_root=$(git rev-parse --show-toplevel 2>/dev/null)
    if [ -z "$repo_root" ]; then
        echo "❌ Not in a git repository"
        return 1
    fi
    
    local wt_path="$repo_root/.worktrees/$branch"
    
    # Check if worktree already exists
    if [ -d "$wt_path" ]; then
        echo "📂 Switching to existing worktree: $wt_path"
        cd "$wt_path"
    else
        echo "🌿 Creating worktree: $wt_path"
        git worktree add -b "$branch" "$wt_path" 2>/dev/null || git worktree add "$wt_path" "$branch"
        cd "$wt_path"
    fi
}

# Fuzzy worktree switcher (requires fzf if available)
wt() {
    local wt_list=$(git worktree list --porcelain 2>/dev/null | grep -E "^worktree " | cut -d" " -f2)
    if [ -z "$wt_list" ]; then
        echo "❌ No worktrees found"
        return 1
    fi
    
    if command -v fzf &> /dev/null; then
        local selected=$(echo "$wt_list" | fzf --preview 'basename {}' --preview-window=hidden)
        if [ -n "$selected" ]; then
            cd "$selected"
            echo "📂 Switched to: $(basename "$selected")"
        fi
    else
        # Simple numbered selector
        echo "$wt_list" | nl
        echo ""
        read -p "Select worktree number: " num
        local selected=$(echo "$wt_list" | sed -n "${num}p")
        if [ -n "$selected" ]; then
            cd "$selected"
            echo "📂 Switched to: $(basename "$selected")"
        fi
    fi
}
EOF

echo "📝 Shell integration saved to: $SNIPPET_PATH"
echo ""
echo "To add worktree indicator to your prompt, add this to your ~/.${SHELL_NAME}rc:"
echo ""
echo "    source ~/.git-worktree-shell-integration"
echo "    PS1='\$(__git_worktree_prompt)'\$PS1"
echo ""

# Create convenience script in PATH
BIN_DIR="$HOME/.local/bin"
mkdir -p "$BIN_DIR"

cat > "$BIN_DIR/git-worktree-init" << 'EOF'
#!/bin/bash
# Initialize worktree-based development for current project

set -e

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [ -z "$REPO_ROOT" ]; then
    echo "❌ Not in a git repository"
    exit 1
fi

cd "$REPO_ROOT"

echo "🔧 Initializing worktree development for: $(basename $REPO_ROOT)"
echo ""

# Ensure .worktrees is ignored
if ! git check-ignore -q .worktrees 2>/dev/null; then
    echo ".worktrees/" >> .gitignore
    echo "✓ Added .worktrees to .gitignore"
else
    echo "✓ .worktrees already ignored"
fi

# Create .worktrees directory with README
mkdir -p .worktrees

cat > .worktrees/README.md << 'INNEREOF'
# Worktree Directory

This directory contains isolated git worktrees for parallel development.

## Structure

```
.worktrees/
├── README.md           # This file
├── <feature-name>/     # Feature worktrees
└── agent-<id>/         # Agent-specific worktrees
```

## Rules

1. **One worktree per feature/bugfix** - Keeps branches isolated
2. **Name format:** `<issue-id>-<short-description>` or `agent-<task-id>`
3. **Clean up after merge:**
   ```bash
   git wtr <worktree-name>
   git branch -d <branch-name>
   ```
4. **Never commit this directory** - It's in `.gitignore`

## Quick Commands

| Command | Description |
|---------|-------------|
| `git wt <branch>` | Create and switch to worktree |
| `git wtl` | List all worktrees |
| `git wtc` | Clean up merged worktrees |
| `wt` | Fuzzy-find and switch worktrees |

## Multi-Agent Safety

Each agent operates in their own worktree:
- Agent A: `.worktrees/agent-a7b13158/`
- Agent B: `.worktrees/agent-ab731eb7/`
- No file conflicts, no git conflicts
INNEREOF

echo "✓ Created .worktrees/README.md"

# Add pre-checkout hook to warn about existing worktrees
mkdir -p .git/hooks
cat > .git/hooks/post-checkout << 'INNEREOF'
#!/bin/bash
# Warn if checking out branch that's already in a worktree

branch=$(git symbolic-ref --short HEAD 2>/dev/null)
[ -z "$branch" ] && exit 0

worktree=$(git worktree list --porcelain | grep -B1 "branch refs/heads/$branch" | head -1 | cut -d' ' -f2)
current=$(pwd)

if [ -n "$worktree" ] && [ "$worktree" != "$current" ]; then
    echo ""
    echo "⚠️  WARNING: Branch '$branch' is already checked out in:"
    echo "   $worktree"
    echo ""
    echo "   Consider using: cd $worktree"
    echo ""
fi
INNEREOF
chmod +x .git/hooks/post-checkout

echo "✓ Added post-checkout hook"
echo ""
echo "🎉 Worktree development initialized!"
echo ""
echo "Next steps:"
echo "  1. git wt <feature-name>     # Create your first worktree"
echo "  2. cd .worktrees/<feature-name>"
echo "  3. npm install               # Or equivalent setup"
EOF

chmod +x "$BIN_DIR/git-worktree-init"
echo "✓ Installed: git-worktree-init → $BIN_DIR/git-worktree-init"
echo ""

# Update PATH if needed
if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
    echo "⚠️  $BIN_DIR is not in your PATH"
    echo "   Add this to your ~/.${SHELL_NAME}rc:"
    echo "   export PATH=\"$BIN_DIR:\$PATH\""
    echo ""
fi

echo "🎉 Setup complete!"
echo ""
echo "Quick start for any project:"
echo "  cd <your-project>"
echo "  git-worktree-init          # One-time per project"
echo "  git wt my-feature          # Create worktree"
echo "  cd .worktrees/my-feature   # Start working"
echo ""
echo "Documentation:"
echo "  git wt --help              # Worktree alias help"
echo "  cat .worktrees/README.md   # Project worktree rules"
echo ""
