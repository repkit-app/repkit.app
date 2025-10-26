# RepKit Issue Management (GitHub + Worktrees)

Manage GitHub issues with git worktrees for parallel development using the `/issue` command (alias: `/i`).

## 🚨 Code Review Policy - REQUIRED BEFORE MERGE

**NO MERGE until all CodeRabbit comments are addressed.**

### Rule: Address Every Comment with Individual Responses

Before using `/issue merge`:

1. **Fix all CodeRabbit issues** (not optional):
   - Fix Critical/Major issues immediately
   - Fix nitpicks when requested by user
   - Create follow-up issues for non-blocking improvements

2. **Post individual response for EACH CodeRabbit comment** (not a single comprehensive comment):
   - One PR comment per CodeRabbit issue
   - Reference the specific file, line, and CodeRabbit comment you're responding to
   - For each response: what changed, why, and where (with commit SHA)
   - Use ✅/❌/ℹ️ to indicate status (fixed/not-fixed/acknowledged)

3. **Comprehensive response format**:
   ```markdown
   ## ✅ CodeRabbit Feedback Addressed

   ### Commit abc1234 - [Description] (N issues)

   #### 1. ✅ **File:Line - Severity: Issue Title**
   **Fixed:** Brief description
   - What changed: specific code changes
   - Why: rationale
   - Where: file paths and line numbers

   #### 2. ℹ️ **File:Line - Issue Title**
   **Acknowledged:** Brief explanation
   - Why not fixed: valid reason
   - Alternative: what was done instead

   ### Summary
   - Total comments: N
   - Fixed: X
   - Acknowledged: Y
   ```

4. **Verify build passes**:
   - Must see: `✅ BUILD SUCCEEDED`
   - No compilation errors
   - All CI checks green

5. **Then merge**:
   - `/issue merge` will verify all checks pass
   - CodeRabbit review must show no critical/major blocking issues

### Example Response

```markdown
## ✅ CodeRabbit Feedback Addressed

### Commit d1c0ad9 - Security and reliability fixes (3 issues)

#### 1. ✅ **lib/auth.ts:42 - Critical: SQL Injection**
**Fixed:** Use parameterized queries
- Changed: `db.query("SELECT * FROM users WHERE id = " + userId)`
- To: `db.query("SELECT * FROM users WHERE id = ?", [userId])`
- File: lib/auth.ts:42-45

#### 2. ✅ **api/users.ts:67 - Major: Rate limiting bypass**
**Fixed:** Enforce both IP and token limits
- Added dual rate-limit check (see lib/rate-limit.ts:115)
- Prevents token rotation attacks

#### 3. ℹ️ **lib/cache.ts:12 - Nitpick: In-memory cache**
**Acknowledged:** Acceptable for single-instance deployment
- Current Vercel deployment is single-instance
- Will migrate to Redis when scaling to multi-instance

### Summary
- Fixed: 2 critical, 0 major
- Acknowledged: 1 nitpick (not blocking)
```

### Why This Matters
- Creates paper trail of ALL decisions in one place
- Easy to review what was fixed in each commit
- Prevents tech debt accumulation
- Every feedback is explicitly handled with reasoning
- Future developers can understand the decision history

---

## Architecture

Uses **git worktrees** to work on multiple issues concurrently without context switching:
- Each issue gets its own directory
- No `git stash` or branch switching needed
- Parallel work on multiple features
- Clean separation of concerns

## Quick Start

```bash
# 1. Start work on an issue (fully automated)
/issue start 9

# 2. Work in the dedicated worktree
cd ~/code/repkit-9
# ... develop ...

# 3. Check status
/issue status

# 4. Push and create PR
/issue push

# 5. Complete and cleanup
/issue merge
```

**Note**: `/issue start` is now fully automated! It creates the worktree, assigns the issue, and syncs the project board automatically.

## Project Configuration

- **Project ID**: `PVT_kwHOAAWWyc4BF4UX` (RepKit Development)
- **Project Number**: `3`
- **Owner**: `jaredhughes`
- **Status Field ID**: `PVTSSF_lAHOAAWWyc4BF4UXzg3Frnc`
- **Status Options**:
  - Todo: `f75ad846`
  - In Progress: `47fc9ee4`
  - Done: `98236657`

## Available Commands

### /issue start <issue>

**AUTOMATED COMMAND** - Start work on an issue (creates worktree, assigns issue, syncs board).

**When this command is invoked, execute the following steps:**

```bash
# Prerequisites: Check that GitHub CLI is available
if ! command -v gh &> /dev/null; then
    echo "❌ Error: GitHub CLI (gh) is not installed or not in PATH"
    echo "Install from: https://cli.github.com/"
    exit 1
fi

# Step 1: Get issue title and generate slug
ISSUE_TITLE=$(gh issue view <issue> --json title --jq '.title' 2>/dev/null)

if [ -z "$ISSUE_TITLE" ]; then
    echo "❌ Error: Issue #<issue> not found"
    exit 1
fi

# Generate slug from title (lowercase, spaces to hyphens, first 30 chars)
SLUG=$(echo "$ISSUE_TITLE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9 ]//g' | tr ' ' '-' | head -c 30 | sed 's/-$//')

echo "🚀 Starting work on issue #<issue>: $ISSUE_TITLE"
echo ""

# Step 2: Create worktree and branch
echo "📂 Creating worktree at ~/code/repkit-<issue>..."
git -C /Users/jaredhu/code/repkit worktree add ~/code/repkit-<issue> -b issue-<issue>-$SLUG

if [ $? -ne 0 ]; then
    echo "❌ Failed to create worktree"
    exit 1
fi
echo "  ✓ Worktree created"
echo ""

# Step 3: Assign issue to yourself
echo "👤 Assigning issue #<issue>..."
gh issue edit <issue> --add-assignee @me
echo "  ✓ Issue assigned"
echo ""

# Step 4: Run /validate to sync board (this is critical!)
echo "🔍 Syncing with project board..."
/validate
echo ""

# Final output
echo "✅ Ready to work on issue #<issue>"
echo "📍 Worktree: ~/code/repkit-<issue>"
echo "🌿 Branch: issue-<issue>-$SLUG"
echo ""

# Step 5: Check if this is iOS-related work and suggest iOS Expert agent
# Look for iOS keywords in issue title or labels
ISSUE_LABELS=$(gh issue view <issue> --json labels --jq '.labels[].name' 2>/dev/null | tr '\n' ' ')
IS_IOS_ISSUE=false

if [[ "$ISSUE_TITLE" =~ (Swift|iOS|SwiftUI|watchOS|ViewModel|Repository|GRDB|HealthKit|Widget|Watch|Concurrency|Memory|@MainActor|Actor|migration) ]] || \
   [[ "$ISSUE_LABELS" =~ (ios|swift|swiftui|watchos|architecture) ]]; then
    IS_IOS_ISSUE=true
fi

if [ "$IS_IOS_ISSUE" = true ]; then
    echo "💡 iOS/Swift work detected! Consider using the iOS Expert agent:"
    echo "   /agents → select 'ios-expert'"
    echo ""
    echo "   Available modes:"
    echo "   • critic   - Architecture review"
    echo "   • audit    - Memory/concurrency check"
    echo "   • ui       - Animation/accessibility"
    echo "   • data     - SQLite/migrations"
    echo "   • intel    - AI routing decisions"
    echo "   • test     - Testing strategy"
    echo ""
fi

echo "Next steps:"
echo "  cd ~/code/repkit-<issue>"
echo "  # ... make your changes ..."
echo "  /issue push    # Push and create PR"
echo "  /issue merge   # Complete and cleanup"
```

**What this command does:**
1. ✅ Fetches issue title and generates branch slug automatically
2. ✅ Creates worktree at `~/code/repkit-<issue>`
3. ✅ Creates branch `issue-<issue>-<slug>`
4. ✅ Assigns issue to you
5. ✅ Runs `/validate` which automatically:
   - Adds issue to project board
   - Sets status to "In Progress"
   - Applies "status:in-progress" label
   - Verifies everything is in sync

**Error handling:**
- Checks GitHub CLI (gh) is installed before proceeding
- Validates issue exists before creating worktree
- Checks worktree creation succeeded
- Provides clear error messages if something fails

**Verification after running:**
- [ ] Worktree exists at `~/code/repkit-<issue>`
- [ ] Issue assigned to you
- [ ] Issue appears in "In Progress" column: https://github.com/users/jaredhughes/projects/3/views/2
- [ ] No error messages from `/validate`

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
# - Updates issue with PR link
```

### /issue ready [issue]
Mark PR ready for review:

```bash
/issue ready
# - Removes draft status
# - Requests reviewers (if configured)
# - Moves issue to "Review" column
```

### /issue check [issue]
Review all PR comments and pipeline status:

```bash
/issue check
# Shows:
# - All CodeRabbit, human, and bot comments
# - Pipeline/check status (build, tests, reviews)
# - Comments needing attention
# - Agent addresses each comment individually in threads
# - Marks conversations as resolved when addressed
```

**Must run before `/issue merge`** - Ensures all feedback is systematically addressed.

See [/issue check documentation](./check.md) for detailed instructions.

### /issue merge [issue]

**ENFORCES STRICT PRE-MERGE CHECKS** - Complete the work only after all requirements met.

**When this command is invoked, execute the following steps:**

```bash
# Prerequisites: Check GitHub CLI is available
if ! command -v gh &> /dev/null; then
    echo "❌ Error: GitHub CLI (gh) is not installed or not in PATH"
    exit 1
fi

# Step 1: Auto-detect issue number from current directory
CURRENT_DIR=$(basename "$PWD")
if [[ "$CURRENT_DIR" =~ ^repkit-([0-9]+)$ ]]; then
    ISSUE_NUM="${BASH_REMATCH[1]}"
else
    echo "❌ Error: Not in a worktree directory (expected ~/code/repkit-XXX)"
    echo "Current directory: $PWD"
    exit 1
fi

echo "🔍 Pre-merge checks for issue #$ISSUE_NUM..."
echo ""

# Step 2: Get PR number for this issue
PR_NUM=$(gh pr list --head "$(git branch --show-current)" --json number --jq '.[0].number' 2>/dev/null)

if [ -z "$PR_NUM" ]; then
    echo "❌ Error: No PR found for current branch"
    echo "Run '/issue push' first to create a PR"
    exit 1
fi

echo "📋 Found PR #$PR_NUM"
echo ""

# Step 3: Check for unresolved CodeRabbit comments
echo "🤖 Checking CodeRabbit feedback..."
UNRESOLVED_COMMENTS=$(gh api "repos/rustpoint/repkit/pulls/$PR_NUM/comments" \
    --jq '[.[] | select(.user.login == "coderabbitai[bot]")] | length' 2>/dev/null || echo "0")

UNRESOLVED_REVIEWS=$(gh api "repos/rustpoint/repkit/pulls/$PR_NUM/reviews" \
    --jq '[.[] | select(.user.login == "coderabbitai[bot]" and .state == "COMMENTED")] | length' 2>/dev/null || echo "0")

TOTAL_UNRESOLVED=$((UNRESOLVED_COMMENTS + UNRESOLVED_REVIEWS))

if [ "$TOTAL_UNRESOLVED" -gt 0 ]; then
    echo "❌ MERGE BLOCKED: $TOTAL_UNRESOLVED unresolved CodeRabbit comments/reviews"
    echo ""
    echo "You must address ALL CodeRabbit feedback before merging:"
    echo "  1. Run '/issue check' to review and address all comments"
    echo "  2. Reply to each comment inline on GitHub"
    echo "  3. Mark conversations as 'Resolved' after addressing"
    echo ""
    echo "View PR comments: https://github.com/rustpoint/repkit/pull/$PR_NUM/files"
    exit 1
fi

echo "  ✓ All CodeRabbit feedback addressed"
echo ""

# Step 4: Check CI status (all checks must pass)
echo "🔄 Checking CI status..."
CI_STATUS=$(gh pr checks "$PR_NUM" --json state,conclusion,name 2>/dev/null)

if [ -z "$CI_STATUS" ] || [ "$CI_STATUS" = "[]" ]; then
    echo "⚠️  Warning: No CI checks found"
    echo "Proceeding, but verify manually that build passes"
else
    # Check if any checks are failing
    FAILED_CHECKS=$(echo "$CI_STATUS" | jq -r '.[] | select(.conclusion != "success" and .conclusion != "skipped" and .conclusion != null) | .name' 2>/dev/null)

    # Check if any checks are still pending
    PENDING_CHECKS=$(echo "$CI_STATUS" | jq -r '.[] | select(.state == "pending" or .state == "in_progress") | .name' 2>/dev/null)

    if [ -n "$FAILED_CHECKS" ]; then
        echo "❌ MERGE BLOCKED: CI checks failed"
        echo ""
        echo "Failed checks:"
        echo "$FAILED_CHECKS" | while read -r check; do
            echo "  - $check"
        done
        echo ""
        echo "View CI status: https://github.com/rustpoint/repkit/pull/$PR_NUM/checks"
        exit 1
    fi

    if [ -n "$PENDING_CHECKS" ]; then
        echo "❌ MERGE BLOCKED: CI checks still running"
        echo ""
        echo "Pending checks:"
        echo "$PENDING_CHECKS" | while read -r check; do
            echo "  - $check"
        done
        echo ""
        echo "Wait for all checks to complete before merging"
        echo "View CI status: https://github.com/rustpoint/repkit/pull/$PR_NUM/checks"
        exit 1
    fi

    echo "  ✓ All CI checks passed"
fi
echo ""

# Step 5: Check PR approval status
echo "👥 Checking PR approval..."
PR_REVIEWS=$(gh pr view "$PR_NUM" --json reviewDecision --jq '.reviewDecision' 2>/dev/null)

# Note: For personal repos, approval might not be required
# This check is informational but doesn't block
if [ "$PR_REVIEWS" = "APPROVED" ]; then
    echo "  ✓ PR approved by reviewers"
elif [ "$PR_REVIEWS" = "REVIEW_REQUIRED" ]; then
    echo "⚠️  Warning: PR not yet approved (continuing for personal repo)"
elif [ "$PR_REVIEWS" = "CHANGES_REQUESTED" ]; then
    echo "❌ MERGE BLOCKED: Changes requested by reviewers"
    echo "Address reviewer feedback before merging"
    exit 1
else
    echo "  ℹ️  No review required (personal repo)"
fi
echo ""

# Step 6: Check for merge conflicts
echo "🔀 Checking for merge conflicts..."
MERGEABLE=$(gh pr view "$PR_NUM" --json mergeable --jq '.mergeable' 2>/dev/null)

if [ "$MERGEABLE" = "CONFLICTING" ]; then
    echo "❌ MERGE BLOCKED: PR has merge conflicts"
    echo "Resolve conflicts first:"
    echo "  git fetch origin"
    echo "  git rebase origin/main"
    echo "  # Resolve conflicts"
    echo "  git rebase --continue"
    echo "  git push --force-with-lease"
    exit 1
fi

echo "  ✓ No merge conflicts"
echo ""

# Step 7: All checks passed - proceed with merge
echo "✅ All pre-merge checks passed!"
echo ""
echo "🚀 Merging PR #$PR_NUM..."

# Merge PR (squash and merge strategy)
if gh pr merge "$PR_NUM" --squash --auto --delete-branch; then
    echo "  ✓ PR merged successfully"
else
    echo "❌ Failed to merge PR"
    echo "Check PR status and try again, or merge manually on GitHub"
    exit 1
fi
echo ""

# Step 8: Cleanup worktree and branch
echo "🧹 Cleaning up worktree..."

# Switch to main repo before removing worktree
cd /Users/jaredhu/code/repkit

# Get branch name for deletion
BRANCH_NAME=$(git -C ~/code/repkit-$ISSUE_NUM branch --show-current 2>/dev/null)

# Remove worktree
if git worktree remove ~/code/repkit-$ISSUE_NUM --force 2>/dev/null; then
    echo "  ✓ Removed worktree ~/code/repkit-$ISSUE_NUM"
else
    echo "⚠️  Warning: Could not remove worktree (may already be removed)"
fi

# Delete local branch (if exists)
if [ -n "$BRANCH_NAME" ]; then
    git branch -D "$BRANCH_NAME" 2>/dev/null && echo "  ✓ Deleted local branch $BRANCH_NAME"
fi
echo ""

# Step 9: Update project board
echo "📊 Updating project board..."
/validate
echo ""

# Step 10: Update development log
echo "📝 Updating development log..."
/log
echo ""

# Final success message
echo "✅ Issue #$ISSUE_NUM completed successfully!"
echo ""
echo "Summary:"
echo "  - PR #$PR_NUM merged and closed"
echo "  - Issue #$ISSUE_NUM closed"
echo "  - Worktree removed"
echo "  - Branch deleted"
echo "  - Project board updated to 'Done'"
echo "  - Development log updated"
```

**What this command enforces:**

1. ✅ **CodeRabbit Feedback** - All comments and reviews from CodeRabbit must be addressed and resolved
2. ✅ **CI Checks** - All CI checks (build, tests, etc.) must pass
3. ✅ **PR Approval** - Changes requested by reviewers blocks merge
4. ✅ **Merge Conflicts** - Must have no conflicts with main branch
5. ✅ **Automated Cleanup** - Removes worktree, deletes branches, updates board

**Error Handling:**

- **Unresolved CodeRabbit comments**: Shows count and link to PR
- **Failed CI checks**: Lists which checks failed
- **Pending CI checks**: Lists which checks are still running
- **Changes requested**: Blocks merge until addressed
- **Merge conflicts**: Provides rebase instructions

**Successful Merge Flow:**

1. Verifies all pre-merge requirements
2. Merges PR with squash strategy
3. Removes worktree automatically
4. Deletes branches (local and remote)
5. Updates project board to "Done"
6. Updates development log via `/log`

**Note**: This command is STRICT - any failed check will block the merge with clear instructions on how to fix it.

### /issue list
List all active worktrees:

```bash
/issue list
# Shows all RepKit worktrees and their issues
```

### /issue cleanup <issue>
Remove worktree without merging:

```bash
/issue cleanup 9
# Removes worktree but keeps branch/PR
```

### /issue abandon <issue>
Completely abandon work:

```bash
# 1. Close any open PR
gh pr close <PR_NUMBER> 2>/dev/null || true

# 2. Remove worktree
git worktree remove ~/code/repkit-<issue>

# 3. Delete branches locally and remotely
git branch -D issue-<issue>-<slug> 2>/dev/null || true
git push origin --delete issue-<issue>-<slug> 2>/dev/null || true

# 4. Run /validate to move issue back to "Todo" and remove labels
/validate
```

**What happens**:
- Worktree removed
- Branch deleted (local and remote)
- PR closed without merging
- Issue status moved back to "Todo" (via `/validate`)
- "status:in-progress" label removed

**Implementation**:
1. Close PR: `gh pr close`
2. Remove worktree: `git worktree remove ~/code/repkit-<issue>`
3. Delete branches: `git branch -D issue-<issue>-<slug> && git push origin --delete issue-<issue>-<slug>`
4. Board cleanup: Run `/validate` - it detects closed PRs and resets status to "Todo"

---

## iOS Expert Agent Integration

RepKit includes a specialized **iOS Expert agent** (`ios-expert`) that provides expert guidance throughout the issue workflow.

### When to Use the iOS Expert Agent

The agent is **automatically suggested** when `/issue start` detects iOS-related work based on:
- Issue title keywords: `Swift`, `iOS`, `SwiftUI`, `watchOS`, `ViewModel`, `Repository`, `GRDB`, `HealthKit`, `@MainActor`, `Actor`, `migration`, etc.
- Issue labels: `ios`, `swift`, `swiftui`, `watchos`, `architecture`

### Agent Modes

Access via `/agents` → select `ios-expert`:

**1. critic** - Architecture Review
- Detects: Singletons, tight coupling, god objects, main-thread I/O
- Proposes: DI patterns, protocol boundaries, module separation
- Use: Before starting implementation, during refactoring

**2. audit** - Memory & Concurrency
- Finds: Retain cycles, weak capture issues, actor violations, data races
- Checks: @MainActor usage, Task patterns, closure memory
- Use: Before `/issue push`, when fixing concurrency bugs

**3. ui** - Animation & Accessibility
- Reviews: Motion timing, spring parameters, accessibility support
- Suggests: Micro-interactions, Reduce Motion gates, haptics
- Use: When implementing UI features, animations

**4. data** - SQLite & Migrations
- Validates: Schema design, migration patterns, GRDB usage
- Enforces: Additive migrations, WAL mode, indices, value types
- Use: When modifying database schema or repositories

**5. intel** - AI Routing
- Decides: On-device vs cloud, prompt caching, token economy
- Plans: Apple Intelligence vs OpenAI, privacy gates
- Use: When integrating LLM features, chat functionality

**6. test** - Testing Strategy
- Designs: Unit, contract, snapshot, property, concurrency tests
- Targets: 80% ViewModels, 70% Repositories coverage
- Use: When writing tests, planning test approach

### Workflow Integration Points

**1. After `/issue start`** (if iOS work detected)
```bash
/issue start 42
# → "💡 iOS/Swift work detected! Consider using /agents → ios-expert"

/agents  # Select ios-expert → critic mode
# Get architecture guidance before coding
```

**2. During Development**
```bash
# Quick architecture check
/agents  # ios-expert → critic
# "Review my ViewModel structure before I continue"

# Memory/concurrency audit
/agents  # ios-expert → audit
# "Check this async code for retain cycles"

# Data layer review
/agents  # ios-expert → data
# "Validate this GRDB migration"
```

**3. Before `/issue push`**
```bash
# Pre-push review
/agents  # ios-expert → critic + audit
# Final check: architecture, memory, concurrency

/issue push
```

**4. During `/issue check`** (reviewing CodeRabbit feedback)
```bash
/issue check
# → Auto-detects iOS-specific comments
# → Suggests consulting ios-expert for:
#    - Concurrency feedback
#    - Memory concerns
#    - Architecture suggestions
#    - SQLite/data patterns

/agents  # ios-expert mode as needed
# Get expert guidance for responding to comments
```

**5. Before `/issue merge`**
```bash
# Final audit
/agents  # ios-expert → audit + test
# Ensure: no leaks, proper isolation, tests complete

/issue merge
```

### Example: iOS Feature Implementation

```bash
# Start work
/issue start 88  # "Add workout template GRDB storage"
# → Detects: GRDB, storage → suggests ios-expert

cd ~/code/repkit-88

# Architecture planning
/agents  # Select ios-expert
# User: "Mode: data steward
#        Goal: Add workout template storage with FTS
#        Context: Current schema uses Exercise + Set tables
#        Risks: Migration path, FTS5 integration"
#
# Agent provides:
# - Migration checklist
# - Schema recommendations
# - Repository pattern
# - Test plan

# Implement based on guidance
git commit -m "[#88] feat: Add WorkoutTemplate schema"

# Pre-push audit
/agents  # ios-expert → critic
# Check: DI compliance, value types, protocol boundaries

/issue push

# Address CodeRabbit feedback
/issue check
# CodeRabbit: "Migration could break old app versions"
# → Consult ios-expert → data mode
# → Get guidance on backwards-compatible migrations
# → Post informed response

/issue merge  # Complete!
```

### Benefits

**Consistency**: All iOS code follows RepKit standards (DI, value types, actor isolation)

**Quality**: Expert review catches issues early (leaks, races, schema problems)

**Learning**: Agent explains WHY, not just WHAT (technical reasoning, tradeoffs)

**Efficiency**: Faster PR reviews (fewer CodeRabbit surprises, better responses)

**Integration**: Works seamlessly with existing workflow (automatic suggestions, `/agents` command)

### Agent Configuration

**Location**: `.claude/agents/ios-expert.md`

**Standards**: Enforces all RepKit guidelines:
- No singletons (DI via protocols)
- Value types first (struct + protocol)
- Actor isolation (@MainActor for UI, isolated actors for data/network)
- Additive migrations (no destructive schema changes)
- Test coverage (80% ViewModels, 70% Repositories)
- i18n-first (5 target languages)

## Implementation

### Directory Structure
```
~/code/
├── repkit/           # Main repository
├── repkit-9/         # Worktree for issue #9
├── repkit-12/        # Worktree for issue #12
└── repkit-25/        # Worktree for issue #25
```

### Branch Naming
```
issue-[number]-[brief-description]
Examples:
- issue-9-setup-xcode
- issue-12-swiftdata-models
- issue-25-healthkit-permissions
```

### Commit Message Format
```
[#ISSUE] Type: Description

Examples:
- [#9] feat: Setup Xcode project structure
- [#12] feat: Implement SwiftData models
- [#25] fix: Resolve HealthKit permission issue
```

### PR Template
```markdown
## Changes
[What was implemented]

## Testing
[How it was tested]

## Screenshots
[If UI changes]

Closes #[ISSUE]
```

## Git Worktree Benefits

1. **Parallel Development**
   - Work on multiple issues simultaneously
   - No context switching overhead
   - Each issue has its own directory

2. **Clean Separation**
   - No uncommitted changes when switching
   - No stash management needed
   - Clear workspace for each issue

3. **Easy Experiments**
   - Try risky changes without affecting main
   - Easy to nuke and start over
   - Compare implementations side-by-side

4. **Better Organization**
   - See all active work at a glance
   - Know exactly what's in progress
   - Clean up completed work easily

## GitHub Integration

### Project Board Automation
- Issues automatically move between columns
- PR links update issue status
- Closing PR completes issue

### Labels Applied
- `in-progress` - When work starts
- `has-pr` - When PR created
- `ready-for-review` - When PR ready

## Example Workflow

```bash
# Monday: Start feature (fully automated setup)
/issue start 12        # Creates worktree, assigns, syncs board
# → Detects iOS work, suggests /agents → ios-expert
cd ~/code/repkit-12

# Use iOS Expert agent for architecture guidance
/agents                # Select ios-expert → critic mode
# → Reviews approach for SwiftData models (DI, protocols, value types)

# Implement SwiftData models...
git add .
git commit -m "[#12] feat: Add WorkoutSession model"
/issue push

# Tuesday: Bug fix (parallel work - automated setup)
/issue start 25        # Creates worktree, assigns, syncs board
# → Detects HealthKit in title, suggests ios-expert
cd ~/code/repkit-25

# Use iOS Expert agent for concurrency check
/agents                # Select ios-expert → audit mode
# → Reviews for async/await patterns, actor isolation

# Fix HealthKit issue...
git commit -m "[#25] fix: Resolve permission request"
/issue push
/issue ready

# Wednesday: Back to feature
cd ~/code/repkit-12
# Continue development...

# Before pushing, quick architecture review
/agents                # Select ios-expert → critic mode
# → Checks: DI compliance, no singletons, protocol boundaries

git commit -m "[#12] feat: Add Exercise model"
/issue push
/issue ready

# Review CodeRabbit feedback with iOS expertise
/issue check
# → For iOS-specific comments, consults ios-expert agent
# → Posts informed responses about concurrency, memory, architecture

# Thursday: Bug merged
cd ~/code/repkit-25
/issue merge  # Auto-cleanup

# Friday: Feature merged
cd ~/code/repkit-12
/issue merge  # Auto-cleanup
```

## Configuration

The ticket commands use these defaults:
- **Worktree location**: `~/code/repkit-[issue]`
- **Branch format**: `issue-[number]-[description]`
- **PR auto-close**: Uses "Closes #[issue]"
- **Project board**: Auto-detected from issue

## Troubleshooting

### "Worktree already exists"
```bash
# Check existing worktrees
git worktree list

# Remove if needed
git worktree remove ~/code/repkit-9
```

### "Cannot create worktree"
```bash
# Ensure you're in main repo
cd ~/code/repkit

# Fetch latest
git fetch origin
```

### "PR already exists"
```bash
# Update existing PR
/issue push  # Will update existing PR
```

### "Cannot merge - conflicts"
```bash
# In worktree
git fetch origin
git rebase origin/main
# Resolve conflicts
git rebase --continue
git push --force-with-lease
```

## Tips

1. **One issue at a time per worktree**
   - Don't mix multiple issues in one worktree
   - Create separate worktree for each issue

2. **Commit frequently**
   - Small, focused commits
   - Always include issue number

3. **Keep worktrees clean**
   - Remove after merging
   - Don't let them accumulate

4. **Use relative paths in code**
   - Worktrees have different absolute paths
   - Test in both main and worktree

## Command Reference

```bash
# Start work (AUTOMATED)
/issue start <issue>

# Check status
/issue status [issue]

# Push changes
/issue push [issue]

# Mark ready
/issue ready [issue]

# Review comments & pipeline (REQUIRED BEFORE MERGE)
/issue check [issue]

# Complete work (requires /issue check first)
/issue merge [issue]

# List all
/issue list

# Cleanup
/issue cleanup <issue>

# Abandon
/issue abandon <issue>
```