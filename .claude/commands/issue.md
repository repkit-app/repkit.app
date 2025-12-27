# RepKit.app Issue Management (GitHub + Worktrees)

Manage GitHub issues with git worktrees for parallel development using the `/issue` command (alias: `/i`).

## Architecture

Uses **git worktrees** to work on multiple issues concurrently without context switching:
- Each issue gets its own directory under `worktrees/`
- No `git stash` or branch switching needed
- Parallel work on multiple features
- Clean separation of concerns

## Quick Start

```bash
# 1. Start work on an issue (fully automated)
/issue start 9

# 2. Work in the dedicated worktree
cd ~/code/repkit-app/worktrees/issue-9
# ... develop ...

# 3. Push and create PR
/issue push

# 4. Complete and cleanup
/issue merge
```

## Project Configuration

- **Project ID**: `PVT_kwDODj92184BGb0W` (repkit.app Web Infrastructure)
- **Project Number**: `1`
- **Owner**: `rustpoint`
- **Repo**: `rustpoint/repkit.app`
- **Status Field ID**: `PVTSSF_lADODj92184BGb0Wzg3e1zw`
- **Status Options**:
  - Todo: `f75ad846`
  - In Progress: `47fc9ee4`
  - Done: `98236657`

## Available Commands

### /issue start <issue>

**AUTOMATED COMMAND** - Start work on an issue (creates worktree, assigns issue, syncs board).

**When this command is invoked, execute the following steps:**

```bash
# Prerequisites
if ! command -v gh &> /dev/null; then
    echo "❌ Error: GitHub CLI (gh) is not installed"
    exit 1
fi

MAIN_REPO=~/code/repkit-app
WORKTREE_DIR=$MAIN_REPO/worktrees/issue-<issue>

# Step 1: Get issue title and generate slug
ISSUE_TITLE=$(gh issue view <issue> -R rustpoint/repkit.app --json title --jq '.title' 2>/dev/null)

if [ -z "$ISSUE_TITLE" ]; then
    echo "❌ Error: Issue #<issue> not found"
    exit 1
fi

SLUG=$(echo "$ISSUE_TITLE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9 ]//g' | tr ' ' '-' | head -c 30 | sed 's/-$//')

echo "🚀 Starting work on issue #<issue>: $ISSUE_TITLE"
echo ""

# Step 2: Create worktrees directory if needed
mkdir -p $MAIN_REPO/worktrees

# Step 3: Create worktree and branch
echo "📂 Creating worktree at $WORKTREE_DIR..."
git -C $MAIN_REPO worktree add $WORKTREE_DIR -b issue-<issue>-$SLUG

if [ $? -ne 0 ]; then
    echo "❌ Failed to create worktree"
    exit 1
fi
echo "  ✓ Worktree created"
echo ""

# Step 4: Install dependencies
echo "📦 Installing dependencies..."
cd $WORKTREE_DIR && npm install
echo "  ✓ Dependencies installed"
echo ""

# Step 5: Assign issue to yourself
echo "👤 Assigning issue #<issue>..."
gh issue edit <issue> -R rustpoint/repkit.app --add-assignee @me
echo "  ✓ Issue assigned"
echo ""

# Step 6: Sync with project board
echo "🔍 Syncing with project board..."
/validate
echo ""

# Final output
echo "✅ Ready to work on issue #<issue>"
echo "📍 Worktree: $WORKTREE_DIR"
echo "🌿 Branch: issue-<issue>-$SLUG"
echo ""
echo "Next steps:"
echo "  cd $WORKTREE_DIR"
echo "  # ... make your changes ..."
echo "  /issue push    # Push and create PR"
echo "  /issue merge   # Complete and cleanup"
```

**What this command does:**
1. ✅ Fetches issue title and generates branch slug
2. ✅ Creates worktree at `~/code/repkit-app/worktrees/issue-<issue>`
3. ✅ Creates branch `issue-<issue>-<slug>`
4. ✅ Installs npm dependencies
5. ✅ Assigns issue to you
6. ✅ Runs `/validate` to sync project board

### /issue status [issue]

Show current status (auto-detects from directory):

```bash
/issue status
# Shows:
# - Issue details and status
# - Current branch and commits
# - PR status if exists
# - Project board column
```

### /issue push [issue]

Push changes and create/update PR:

```bash
/issue push
# - Pushes branch to origin
# - Creates PR with "Closes #[issue]"
# - Links PR to project board
```

### /issue merge [issue]

**ENFORCES STRICT PRE-MERGE CHECKS** - Complete the work only after all requirements met.

**When this command is invoked, execute the following steps:**

```bash
# Step 1: Auto-detect issue number from current directory
if [[ "$PWD" =~ worktrees/issue-([0-9]+) ]]; then
    ISSUE_NUM="${BASH_REMATCH[1]}"
else
    echo "❌ Error: Not in a worktree directory"
    echo "Expected: ~/code/repkit-app/worktrees/issue-XXX"
    exit 1
fi

echo "🔍 Pre-merge checks for issue #$ISSUE_NUM..."
echo ""

# Step 2: Get PR number
PR_NUM=$(gh pr list -R rustpoint/repkit.app --head "$(git branch --show-current)" --json number --jq '.[0].number' 2>/dev/null)

if [ -z "$PR_NUM" ]; then
    echo "❌ Error: No PR found. Run '/issue push' first"
    exit 1
fi

echo "📋 Found PR #$PR_NUM"
echo ""

# Step 3: Check for unresolved comment threads
echo "🤖 Checking comment threads..."
UNRESOLVED=$(gh api graphql -f query='
{
  repository(owner: "rustpoint", name: "repkit.app") {
    pullRequest(number: '$PR_NUM') {
      reviewThreads(first: 100) {
        nodes { isResolved }
      }
    }
  }
}' --jq '[.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false)] | length')

if [ "$UNRESOLVED" -gt 0 ]; then
    echo "❌ MERGE BLOCKED: $UNRESOLVED unresolved comment threads"
    echo "Run '/check' to address comments"
    exit 1
fi
echo "  ✓ All comment threads resolved"
echo ""

# Step 4: Check CI status
echo "🔄 Checking CI status..."
FAILED=$(gh pr checks "$PR_NUM" -R rustpoint/repkit.app --json conclusion --jq '[.[] | select(.conclusion != "success" and .conclusion != "skipped" and .conclusion != null)] | length' 2>/dev/null)
PENDING=$(gh pr checks "$PR_NUM" -R rustpoint/repkit.app --json state --jq '[.[] | select(.state == "pending" or .state == "in_progress")] | length' 2>/dev/null)

if [ "$FAILED" -gt 0 ]; then
    echo "❌ MERGE BLOCKED: CI checks failed"
    exit 1
fi

if [ "$PENDING" -gt 0 ]; then
    echo "❌ MERGE BLOCKED: CI checks still running"
    exit 1
fi
echo "  ✓ All CI checks passed"
echo ""

# Step 5: Check for merge conflicts
MERGEABLE=$(gh pr view "$PR_NUM" -R rustpoint/repkit.app --json mergeable --jq '.mergeable')
if [ "$MERGEABLE" = "CONFLICTING" ]; then
    echo "❌ MERGE BLOCKED: PR has merge conflicts"
    exit 1
fi
echo "  ✓ No merge conflicts"
echo ""

# Step 6: Merge
echo "✅ All checks passed!"
echo "🚀 Merging PR #$PR_NUM..."

# Navigate to main repo BEFORE merging
MAIN_REPO=$(git rev-parse --git-common-dir | sed 's|/\.git.*||')
cd "$MAIN_REPO"

if gh pr merge "$PR_NUM" -R rustpoint/repkit.app --squash --delete-branch; then
    echo "  ✓ PR merged"
else
    echo "❌ Failed to merge"
    exit 1
fi
echo ""

# Step 7: Cleanup worktree
echo "🧹 Cleaning up..."
WORKTREE_PATH="$MAIN_REPO/worktrees/issue-$ISSUE_NUM"
git worktree remove "$WORKTREE_PATH" --force 2>/dev/null && echo "  ✓ Worktree removed"
git pull origin main
echo ""

# Step 8: Update project board
/validate

echo "✅ Issue #$ISSUE_NUM completed!"
```

### /issue list

List all active worktrees:

```bash
git worktree list | grep -E "worktrees/issue-[0-9]+"
```

### /issue abandon <issue>

Completely abandon work:

```bash
# 1. Close any open PR
gh pr close <PR_NUMBER> -R rustpoint/repkit.app 2>/dev/null || true

# 2. Navigate to main repo first
cd ~/code/repkit-app

# 3. Remove worktree
git worktree remove ~/code/repkit-app/worktrees/issue-<issue> --force

# 4. Delete branches
git branch -D issue-<issue>-* 2>/dev/null || true
git push origin --delete issue-<issue>-* 2>/dev/null || true

# 5. Sync board
/validate
```

## Directory Structure

```
~/code/repkit-app/
├── app/                    # Next.js app
├── lib/                    # Shared utilities
├── .claude/                # Claude Code config
└── worktrees/              # Git worktrees (gitignored)
    ├── issue-18/           # Worktree for issue #18
    ├── issue-19/           # Worktree for issue #19
    └── issue-20/           # Worktree for issue #20
```

## Branch Naming

```
issue-[number]-[brief-description]
Examples:
- issue-18-cached-token-cost
- issue-19-gpt-5-endpoints
- issue-20-worktree-config
```

## Commit Message Format

```
[#ISSUE] Type: Description

Examples:
- [#18] fix: Calculate cached token costs correctly
- [#19] feat: Add GPT-5 mini endpoint
```

## Code Review Policy

**NO MERGE until all comment threads are resolved.**

Before using `/issue merge`:
1. Run `/check` to address all CodeRabbit comments
2. Reply to each comment with what was fixed
3. Mark all threads as resolved
4. Verify build passes

## Troubleshooting

### "Worktree already exists"
```bash
git worktree list
cd ~/code/repkit-app
git worktree remove worktrees/issue-<N> --force
```

### "Cannot merge - conflicts"
```bash
git fetch origin
git rebase origin/main
# Resolve conflicts
git rebase --continue
git push --force-with-lease
```

## Command Reference

```bash
/issue start <issue>      # Start work (creates worktree)
/issue status [issue]     # Check status
/issue push [issue]       # Push and create PR
/check [issue]            # Review comments (REQUIRED)
/issue merge [issue]      # Complete and cleanup
/issue list               # List worktrees
/issue abandon <issue>    # Abandon work
```
