#!/usr/bin/env bash
#
# Lightweight issue workflow helper for repkit.app
# Inspired by ~/code/repkit/scripts/* issue automation.
#
# Usage:
#   ./issue start <number>   # create branch and assign/label issue
#   ./issue push <number>    # push branch and create/update PR
#   ./issue ready <number>   # mark PR ready for review
#   ./issue check <number>   # show PR checks/review/mergeability
#   ./issue status <number>  # summarize branch/PR/CI
#   ./issue merge <number>   # merge PR with squash + delete branch
#   ./issue rebase <number>  # rebase branch onto origin/main
#   ./issue cleanup <number> # delete local/remote branches
#   ./issue abandon <number> # close PR and delete branches
#   ./issue list             # list local issue branches
#

set -euo pipefail

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

info() { echo -e "${BLUE}ℹ${NC}  $*"; }
success() { echo -e "${GREEN}✓${NC}  $*"; }
warn() { echo -e "${YELLOW}⚠${NC}  $*"; }
error() { echo -e "${RED}✗${NC}  $*"; }

usage() {
  cat <<'EOF'
Usage:
  ./issue start <number>
  ./issue push <number>
  ./issue ready <number>
  ./issue check <number>
  ./issue status <number>
  ./issue merge <number>
  ./issue rebase <number>
  ./issue cleanup <number>
  ./issue abandon <number>
  ./issue list

Requirements: git, gh, jq
EOF
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    error "Missing required command: $1"
    exit 1
  fi
}

slugify() {
  echo "$1" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9 ]//g' | tr ' ' '-' | sed 's/-\{2,\}/-/g' | sed 's/^-//' | sed 's/-$//' | head -c 40
}

require_issue_number() {
  local issue="$1"
  if ! [[ "$issue" =~ ^[0-9]+$ ]]; then
    error "Issue number must be numeric"
    exit 1
  fi
}

fetch_issue_json() {
  local issue="$1"
  gh issue view "$issue" --json number,title,url,state 2>/dev/null
}

ensure_repo_root() {
  if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    error "Must run inside a git repository"
    exit 1
  fi
  git rev-parse --show-toplevel
}

ensure_clean() {
  if ! git diff-index --quiet HEAD -- 2>/dev/null; then
    error "Uncommitted changes present. Please commit or stash before continuing."
    git status --short
    exit 1
  fi
}

ensure_commits() {
  local ahead
  ahead=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo "0")
  if [ "$ahead" -eq 0 ]; then
    error "No commits to push (ahead of origin/main is 0)"
    exit 1
  fi
}

create_or_checkout_branch() {
  local branch="$1"
  if git show-ref --verify --quiet "refs/heads/$branch"; then
    info "Branch exists; checking out $branch"
    git checkout "$branch"
  else
    info "Creating branch $branch from origin/main"
    git fetch origin
    git checkout -b "$branch" origin/main
  fi
}

find_issue_branch() {
  local issue="$1"
  git branch --format='%(refname:short)' --list "issue-${issue}-*" | head -n1
}

cmd_start() {
  local issue="$1"
  require_issue_number "$issue"
  ensure_repo_root >/dev/null
  require_cmd gh
  require_cmd jq

  local data
  data=$(fetch_issue_json "$issue")
  if [ -z "$data" ]; then
    error "Issue #$issue not found via gh cli"
    exit 1
  fi

  local title url slug branch
  title=$(echo "$data" | jq -r '.title // empty')
  url=$(echo "$data" | jq -r '.url // empty')
  if [ -z "$title" ]; then
    error "Issue #$issue missing title"
    exit 1
  fi
  slug=$(slugify "$title")
  branch="issue-$issue-$slug"

  create_or_checkout_branch "$branch"

  if gh issue edit "$issue" --add-assignee @me >/dev/null 2>&1; then
    info "Assigned issue #$issue to @me"
  else
    warn "Could not assign issue #$issue (check permissions)"
  fi

  if gh issue edit "$issue" --add-label "status:in-progress" >/dev/null 2>&1; then
    info "Added label status:in-progress"
  else
    warn "Could not add status label (label may not exist)"
  fi

  success "Ready to work on #$issue"
  echo "   Title: $title"
  echo "   URL:   ${url:-N/A}"
  echo "   Branch: $branch"
}

cmd_push() {
  local issue="$1"
  require_issue_number "$issue"
  ensure_repo_root >/dev/null
  require_cmd gh
  require_cmd jq

  local branch
  branch=$(git branch --show-current)
  if [ -z "$branch" ]; then
    error "Not on a branch"
    exit 1
  fi

  ensure_clean
  ensure_commits

  info "Pushing branch $branch"
  git push -u origin "$branch" --force-with-lease
  success "Pushed to origin/$branch"

  local pr_num pr_url
  pr_num=$(gh pr list --head "$branch" --json number --jq '.[0].number' 2>/dev/null || echo "")

  local data title url
  data=$(fetch_issue_json "$issue")
  title=$(echo "$data" | jq -r '.title // empty')
  url=$(echo "$data" | jq -r '.url // empty')

  if [ -n "$pr_num" ]; then
    pr_url=$(gh pr view "$pr_num" --json url --jq '.url')
    success "Updated PR #$pr_num: $pr_url"
    return
  fi

  local pr_title pr_body tmp_body
  pr_title="[#$issue] ${title:-Issue $issue}"
  tmp_body=$(mktemp -t repkit-pr-XXXX.md)
  cleanup_tmp() { rm -f "$tmp_body"; }
  trap cleanup_tmp EXIT
  {
    echo "## Summary"
    echo "Implements changes for issue #$issue – ${title:-Untitled}."
    echo ""
    echo "Issue: ${url:-N/A}"
    echo ""
    echo "## Testing"
    echo "- Describe tests performed."
    echo ""
    echo "Closes #$issue"
  } > "$tmp_body"

  if gh pr create --title "$pr_title" --body-file "$tmp_body" --draft; then
    pr_num=$(gh pr list --head "$branch" --json number --jq '.[0].number' 2>/dev/null || echo "")
    pr_url=$(gh pr view "$pr_num" --json url --jq '.url' 2>/dev/null || echo "")
    success "Created PR #${pr_num:-?}: ${pr_url:-N/A}"
  else
    error "Failed to create PR"
    exit 1
  fi
  cleanup_tmp
}

cmd_status() {
  local issue="$1"
  require_issue_number "$issue"
  ensure_repo_root >/dev/null
  require_cmd gh
  require_cmd jq

  local branch
  branch=$(find_issue_branch "$issue")
  if [ -z "$branch" ]; then
    warn "No branch matching issue-$issue-*"
    return 0
  fi

  info "Branch: $branch"
  local pr_num pr_json pr_url pr_state pr_mergeable pr_draft pr_review pr_checks
  pr_num=$(gh pr list --head "$branch" --json number --jq '.[0].number' 2>/dev/null || echo "")
  if [ -z "$pr_num" ]; then
    warn "No PR found for branch"
    return 0
  fi

  pr_json=$(gh pr view "$pr_num" --json url,state,mergeable,draft,reviewDecision,statusCheckRollup 2>/dev/null || echo "")
  pr_url=$(echo "$pr_json" | jq -r '.url // empty')
  pr_state=$(echo "$pr_json" | jq -r '.state // empty')
  pr_mergeable=$(echo "$pr_json" | jq -r '.mergeable // empty')
  pr_draft=$(echo "$pr_json" | jq -r '.draft // false')
  pr_review=$(echo "$pr_json" | jq -r '.reviewDecision // "PENDING"')
  pr_checks=$(echo "$pr_json" | jq -r '.statusCheckRollup.contexts[]? | "\(.state): \(.context)"' 2>/dev/null || true)

  success "PR #$pr_num ${pr_url:-}"
  echo "   State: $pr_state • Draft: $pr_draft • Mergeable: $pr_mergeable • Review: $pr_review"
  if [ -n "$pr_checks" ]; then
    echo "   Checks:"
    echo "$pr_checks" | sed 's/^/     - /'
  else
    echo "   Checks: (none reported)"
  fi
}

cmd_ready() {
  local issue="$1"
  require_issue_number "$issue"
  ensure_repo_root >/dev/null
  require_cmd gh

  local branch pr_num
  branch=$(find_issue_branch "$issue")
  if [ -z "$branch" ]; then
    error "No branch for issue-$issue"
    exit 1
  fi
  pr_num=$(gh pr list --head "$branch" --json number --jq '.[0].number' 2>/dev/null || echo "")
  if [ -z "$pr_num" ]; then
    error "No PR found for branch $branch"
    exit 1
  fi

  info "Marking PR #$pr_num ready"
  gh pr ready "$pr_num" --yes
  success "PR #$pr_num marked ready"
}

cmd_check() {
  local issue="$1"
  require_issue_number "$issue"
  ensure_repo_root >/dev/null
  require_cmd gh
  require_cmd jq

  cmd_status "$issue"
}

cmd_rebase() {
  local issue="$1"
  require_issue_number "$issue"
  ensure_repo_root >/dev/null

  local branch
  branch=$(find_issue_branch "$issue")
  if [ -z "$branch" ]; then
    error "No branch for issue-$issue"
    exit 1
  fi

  info "Rebasing $branch onto origin/main"
  git checkout "$branch"
  git fetch origin
  git rebase origin/main
  success "Rebased $branch"
}

cmd_cleanup() {
  local issue="$1"
  require_issue_number "$issue"
  ensure_repo_root >/dev/null

  local branch
  branch=$(find_issue_branch "$issue")
  if [ -z "$branch" ]; then
    warn "No branch for issue-$issue"
    return 0
  fi

  local current
  current=$(git branch --show-current)
  if [ "$current" = "$branch" ]; then
    warn "Currently on $branch; switching to main before cleanup"
    git checkout main || git checkout origin/main || true
  fi

  info "Deleting local branch $branch"
  git branch -D "$branch"

  info "Deleting remote branch (if exists)"
  if git push origin --delete "$branch"; then
    success "Remote branch deleted"
  else
    warn "Remote branch not deleted (may not exist)"
  fi
}

cmd_abandon() {
  local issue="$1"
  require_issue_number "$issue"
  ensure_repo_root >/dev/null
  require_cmd gh

  local branch pr_num
  branch=$(find_issue_branch "$issue")
  if [ -z "$branch" ]; then
    error "No branch for issue-$issue"
    exit 1
  fi
  pr_num=$(gh pr list --head "$branch" --json number --jq '.[0].number' 2>/dev/null || echo "")

  if [ -n "$pr_num" ]; then
    info "Closing PR #$pr_num"
    gh pr close "$pr_num" --delete-branch --yes || warn "PR close failed"
  else
    warn "No PR found for branch $branch"
  fi

  cmd_cleanup "$issue"
  success "Abandoned issue #$issue (branch/pr cleaned)"
}

cmd_merge() {
  local issue="$1"
  require_issue_number "$issue"
  ensure_repo_root >/dev/null
  require_cmd gh

  local branch pr_num
  branch=$(git branch --show-current)
  if [ -z "$branch" ]; then
    error "Not on a branch"
    exit 1
  fi

  pr_num=$(gh pr list --head "$branch" --json number --jq '.[0].number' 2>/dev/null || echo "")
  if [ -z "$pr_num" ]; then
    error "No PR found for branch $branch"
    exit 1
  fi

  info "Merging PR #$pr_num with squash + delete-branch"
  gh pr merge "$pr_num" --squash --delete-branch --auto || {
    error "Merge failed"
    exit 1
  }
  success "Merged PR #$pr_num"
}

cmd_list() {
  ensure_repo_root >/dev/null
  git branch --format='%(refname:short)' | grep '^issue-' || {
    warn "No issue branches found"
  }
}

main() {
  if [ $# -lt 1 ]; then
    usage
    exit 1
  fi

  local cmd="${1:-}"
  shift

  case "$cmd" in
    start)
      if [ $# -ne 1 ]; then usage; exit 1; fi
      cmd_start "$1"
      ;;
    push)
      if [ $# -ne 1 ]; then usage; exit 1; fi
      cmd_push "$1"
      ;;
    ready)
      if [ $# -ne 1 ]; then usage; exit 1; fi
      cmd_ready "$1"
      ;;
    check)
      if [ $# -ne 1 ]; then usage; exit 1; fi
      cmd_check "$1"
      ;;
    status)
      if [ $# -ne 1 ]; then usage; exit 1; fi
      cmd_status "$1"
      ;;
    rebase)
      if [ $# -ne 1 ]; then usage; exit 1; fi
      cmd_rebase "$1"
      ;;
    cleanup)
      if [ $# -ne 1 ]; then usage; exit 1; fi
      cmd_cleanup "$1"
      ;;
    abandon)
      if [ $# -ne 1 ]; then usage; exit 1; fi
      cmd_abandon "$1"
      ;;
    merge)
      if [ $# -ne 1 ]; then usage; exit 1; fi
      cmd_merge "$1"
      ;;
    list)
      cmd_list
      ;;
    *)
      usage
      exit 1
      ;;
  esac
}

main "$@"
