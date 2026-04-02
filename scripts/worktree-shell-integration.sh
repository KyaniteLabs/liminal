#!/bin/bash
# Git Worktree Shell Integration
# Source this file in your .bashrc or .zshrc:
#   source ~/.git-worktree-shell-integration
#
# Or use directly:
#   source scripts/worktree-shell-integration.sh

# =============================================================================
# PROMPT FUNCTIONS
# =============================================================================

# Show current worktree name in prompt
# Usage: PS1='$(__git_worktree_prompt)'$PS1
__git_worktree_prompt() {
    local wt=$(git rev-parse --show-toplevel 2>/dev/null)
    local main=$(git rev-parse --show-superproject-working-tree 2>/dev/null || git rev-parse --show-toplevel 2>/dev/null)
    
    if [ -n "$wt" ] && [ -n "$main" ] && [ "$wt" != "$main" ]; then
        local wt_name=$(basename "$wt")
        echo "[$wt_name] "
    fi
}

# Alternative: More detailed prompt with git info
__git_worktree_prompt_detailed() {
    local wt=$(git rev-parse --show-toplevel 2>/dev/null)
    local main=$(git rev-parse --show-superproject-working-tree 2>/dev/null || git rev-parse --show-toplevel 2>/dev/null)
    
    if [ -n "$wt" ] && [ "$wt" != "$main" ]; then
        local wt_name=$(basename "$wt")
        local branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
        echo "[$wt_name:$branch] "
    fi
}

# =============================================================================
# NAVIGATION FUNCTIONS
# =============================================================================

# Enhanced checkout with automatic worktree creation
# Usage: gco <branch-name>
gco() {
    local branch=$1
    
    if [ -z "$branch" ]; then
        echo "Usage: gco <branch-name>"
        echo "       gco -              # Return to main worktree"
        return 1
    fi
    
    # Special case: '-' means go back to main
    if [ "$branch" = "-" ]; then
        local repo_root=$(git rev-parse --show-toplevel 2>/dev/null)
        if [ -n "$repo_root" ]; then
            # Check if we're in a worktree
            local current=$(pwd)
            if [[ "$current" == *".worktrees"* ]]; then
                cd "$repo_root"
                echo "📂 Returned to main: $repo_root"
            else
                echo "Already in main worktree"
            fi
        fi
        return 0
    fi
    
    # Skip for main/master/develop - just checkout normally
    if [[ "$branch" =~ ^(main|master|develop)$ ]]; then
        command git checkout "$branch"
        return $?
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
        if git show-ref --verify --quiet "refs/heads/$branch"; then
            # Branch exists
            git worktree add "$wt_path" "$branch" || return 1
        else
            # Create new branch
            git worktree add -b "$branch" "$wt_path" 2>/dev/null || \
            git worktree add -b "$branch" "$wt_path" main || return 1
        fi
        cd "$wt_path"
        echo "✓ Created and switched to: $branch"
    fi
}

# Fuzzy worktree switcher
# Usage: wt
wt() {
    local repo_root=$(git rev-parse --show-toplevel 2>/dev/null)
    if [ -z "$repo_root" ]; then
        echo "❌ Not in a git repository"
        return 1
    fi
    
    # Get list of feature worktrees
    local wt_list=$(git worktree list --porcelain 2>/dev/null | \
        grep -E "\.worktrees" | \
        grep -E "^worktree " | \
        cut -d' ' -f2)
    
    if [ -z "$wt_list" ]; then
        echo "❌ No feature worktrees found"
        echo "Create one with: gco <branch-name>"
        return 1
    fi
    
    # Add main worktree as option
    local main_wt="$repo_root [MAIN]"
    wt_list="$main_wt
$wt_list"
    
    if command -v fzf &> /dev/null; then
        # Use fzf for fuzzy finding
        local selected=$(echo "$wt_list" | \
            fzf --preview '
                path=$(echo {} | sed "s/ \[MAIN\]$//")
                if [ -d "$path/.git" ] || [ -f "$path/.git" ]; then
                    cd "$path" && git status -s 2>/dev/null | head -5
                    echo "---"
                    cd "$path" && git log --oneline -3 2>/dev/null
                fi
            ' \
            --preview-window=right:50% \
            --header="Select worktree (Ctrl-C to cancel):" \
            --height=15)
        
        if [ -n "$selected" ]; then
            local path=$(echo "$selected" | sed 's/ \[MAIN\]$//')
            cd "$path"
            echo "📂 Switched to: $(basename "$path")"
        fi
    else
        # Simple numbered selector
        echo "$wt_list" | nl
        echo ""
        read -p "Select worktree number (0 for main): " num
        
        if [ "$num" = "0" ]; then
            cd "$repo_root"
            echo "📂 Switched to: main"
        else
            local selected=$(echo "$wt_list" | sed -n "${num}p" | sed 's/ \[MAIN\]$//')
            if [ -n "$selected" ] && [ -d "$selected" ]; then
                cd "$selected"
                echo "📂 Switched to: $(basename "$selected")"
            else
                echo "❌ Invalid selection"
                return 1
            fi
        fi
    fi
}

# Quick worktree list with status
# Usage: wtl
wtl() {
    local repo_root=$(git rev-parse --show-toplevel 2>/dev/null)
    if [ -z "$repo_root" ]; then
        echo "❌ Not in a git repository"
        return 1
    fi
    
    echo "📂 Worktrees in: $(basename $repo_root)"
    echo ""
    
    git worktree list | while read -r line; do
        local path=$(echo "$line" | awk '{print $1}')
        local commit=$(echo "$line" | awk '{print $2}')
        local branch=$(echo "$line" | awk '{print $3}')
        
        if [[ "$path" == *".worktrees"* ]]; then
            local name=$(basename "$path")
            local uncommitted=$(git -C "$path" status --porcelain 2>/dev/null | wc -l | tr -d ' ')
            
            if [ "$uncommitted" -gt 0 ]; then
                printf "  📝 %-25s %s (%s changes)\n" "$name" "$branch" "$uncommitted"
            else
                printf "  ✓  %-25s %s\n" "$name" "$branch"
            fi
        else
            printf "  🏠 %-25s %s (main)\n" "(main)" "$branch"
        fi
    done
}

# Return to main worktree
# Usage: main
main() {
    local repo_root=$(git rev-parse --show-toplevel 2>/dev/null)
    if [ -z "$repo_root" ]; then
        echo "❌ Not in a git repository"
        return 1
    fi
    
    cd "$repo_root"
    echo "📂 Back to main: $repo_root"
}

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

# Show worktree info
# Usage: wti [worktree-name]
wti() {
    local name=$1
    local repo_root=$(git rev-parse --show-toplevel 2>/dev/null)
    
    if [ -z "$repo_root" ]; then
        echo "❌ Not in a git repository"
        return 1
    fi
    
    if [ -z "$name" ]; then
        # Use current directory
        name=$(basename $(pwd))
    fi
    
    local wt_path="$repo_root/.worktrees/$name"
    
    if [ ! -d "$wt_path" ] && [ "$(basename $(pwd))" != "$name" ]; then
        echo "❌ Worktree not found: $name"
        return 1
    fi
    
    if [ ! -d "$wt_path" ]; then
        wt_path=$(pwd)
    fi
    
    echo "📊 Worktree Info: $name"
    echo "=================="
    echo "Path: $wt_path"
    echo "Branch: $(git -C "$wt_path" rev-parse --abbrev-ref HEAD 2>/dev/null)"
    echo "Last commit: $(git -C "$wt_path" log -1 --format='%h %s (%cr)' 2>/dev/null)"
    echo "Uncommitted: $(git -C "$wt_path" status --porcelain 2>/dev/null | wc -l | tr -d ' ') files"
    echo ""
    git -C "$wt_path" status -s
}

# Clean up merged worktrees
# Usage: wtclean [--dry-run]
wtclean() {
    local dry_run=false
    
    if [ "$1" = "--dry-run" ] || [ "$1" = "-n" ]; then
        dry_run=true
        echo "[DRY RUN] Would perform the following actions:"
        echo ""
    fi
    
    local repo_root=$(git rev-parse --show-toplevel 2>/dev/null)
    if [ -z "$repo_root" ]; then
        echo "❌ Not in a git repository"
        return 1
    fi
    
    git worktree list --porcelain | grep -E "^worktree " | cut -d' ' -f2 | while read -r path; do
        [[ "$path" == "$repo_root" ]] && continue
        
        local name=$(basename "$path")
        local branch=$(git -C "$path" rev-parse --abbrev-ref HEAD 2>/dev/null)
        
        if git branch --merged main | grep -q "^[* ]* $branch$"; then
            if [ "$dry_run" = true ]; then
                echo "  Would remove: $name (branch $branch is merged)"
            else
                echo "Removing: $name"
                git worktree remove "$path" 2>/dev/null || \
                git worktree remove --force "$path"
            fi
        fi
    done
    
    if [ "$dry_run" = false ]; then
        git worktree prune
        echo "✓ Cleanup complete"
    fi
}

# =============================================================================
# ALIASES (Optional)
# =============================================================================

# Uncomment to enable aliases
# alias wt='wt'
# alias wtl='wtl'
# alias wti='wti'
# alias wtclean='wtclean'
# alias main='main'

# =============================================================================
# BASH/ZSH COMPLETION
# =============================================================================

# Bash completion for gco
_gco_completion() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local branches=$(git branch -a | sed 's/^[* ]*//' | sed 's|^remotes/||')
    COMPREPLY=( $(compgen -W "$branches" -- "$cur") )
}

# Zsh completion for gco
_gco_completion_zsh() {
    local -a branches
    branches=(${(f)"$(git branch -a | sed 's/^[* ]*//' | sed 's|^remotes/||')"})
    _describe -t branches 'branches' branches
}

# Register completions
if [ -n "$BASH_VERSION" ]; then
    complete -F _gco_completion gco
elif [ -n "$ZSH_VERSION" ]; then
    compdef _gco_completion_zsh gco 2>/dev/null || true
fi

# =============================================================================
# SETUP CHECK
# =============================================================================

# Check if we're in a git repo and show tip
check_worktree_setup() {
    local repo_root=$(git rev-parse --show-toplevel 2>/dev/null)
    if [ -z "$repo_root" ]; then
        return 0
    fi
    
    # Check if .worktrees is gitignored
    if ! git check-ignore -q .worktrees 2>/dev/null; then
        echo "💡 Tip: Run 'git-worktree-init' to set up worktrees for this project"
    fi
}

# Run check on shell startup (optional)
# check_worktree_setup

echo "✓ Worktree shell integration loaded"
echo "  Functions: gco, wt, wtl, wti, wtclean, main"
echo "  Prompt: Add PS1='\$(__git_worktree_prompt)'\$PS1 to your shell config"
