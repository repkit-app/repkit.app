# Validate Repository State

**Purpose**: Ensure git worktrees, GitHub issues, and project board are in sync.

**Agent Usage**: Run this command automatically when:
- Starting a new conversation
- Before creating new issues/worktrees
- After completing work
- When user asks about progress or status

## What This Validates

1. **Worktree → Issue Sync**
   - Every worktree has a corresponding open GitHub issue
   - Issue numbers match worktree names

2. **Issue → Project Board Sync**
   - All issues with worktrees are in project board
   - Project board status matches reality:
     - "In Progress" if worktree exists
     - "Done" if no worktree and PR merged

3. **Stale Resources**
   - Worktrees for merged/closed issues
   - Branches that should be deleted

## Implementation

```bash
#!/bin/bash
set -e

# repkit.app Web Infrastructure project
PROJECT_ID="PVT_kwDODj92184BGb0W"
PROJECT_NUMBER="1"
OWNER="rustpoint"
REPO="repkit.app"
STATUS_FIELD_ID="PVTSSF_lADODj92184BGb0Wzg3e1zw"
STATUS_IN_PROGRESS="47fc9ee4"
STATUS_DONE="98236657"
MAIN_REPO=~/code/repkit-app

echo "🔍 Validating repository state..."
echo ""

# 1. Find all worktrees (look for worktrees/issue-N pattern)
echo "📂 Checking worktrees..."
WORKTREES=$(git -C $MAIN_REPO worktree list | grep -o 'worktrees/issue-[0-9]*' | grep -o '[0-9]*' | sort -u || true)

if [ -z "$WORKTREES" ]; then
    echo "✓ No active worktrees found"
else
    echo "Found worktrees for issues: $(echo $WORKTREES | tr '\n' ' ')"
fi
echo ""

# 2. For each worktree, validate issue exists and is in project
FIXES_NEEDED=()

for issue in $WORKTREES; do
    echo "Checking issue #$issue..."

    # Check if issue is open
    ISSUE_STATE=$(gh issue view $issue -R $OWNER/$REPO --json state --jq '.state' 2>/dev/null || echo "NOT_FOUND")

    if [ "$ISSUE_STATE" = "NOT_FOUND" ]; then
        echo "  ❌ Issue #$issue does not exist!"
        FIXES_NEEDED+=("remove_worktree:$issue:issue_not_found")
        continue
    fi

    if [ "$ISSUE_STATE" != "OPEN" ]; then
        echo "  ⚠️  Issue #$issue is $ISSUE_STATE (worktree exists)"
        FIXES_NEEDED+=("remove_worktree:$issue:issue_closed")
        continue
    fi

    # Check if issue is in project
    ITEM_DATA=$(gh project item-list $PROJECT_NUMBER --owner $OWNER --format json --limit 100 | \
        jq --arg num "$issue" '.items[] | select(.content.number == ($num | tonumber))')

    if [ -z "$ITEM_DATA" ]; then
        echo "  ❌ Issue #$issue not in project board"
        FIXES_NEEDED+=("add_to_project:$issue")
    else
        # Check status
        STATUS=$(echo "$ITEM_DATA" | jq -r '.status // "null"')
        ITEM_ID=$(echo "$ITEM_DATA" | jq -r '.id')

        if [ "$STATUS" != "In Progress" ]; then
            echo "  ⚠️  Issue #$issue is in project but status is '$STATUS' (should be 'In Progress')"
            FIXES_NEEDED+=("update_status:$issue:$ITEM_ID")
        else
            echo "  ✓ Issue #$issue properly tracked"
        fi
    fi

    # Check if assigned
    ASSIGNED=$(gh issue view $issue -R $OWNER/$REPO --json assignees --jq '.assignees | length')
    if [ "$ASSIGNED" -eq "0" ]; then
        echo "  ⚠️  Issue #$issue not assigned"
        FIXES_NEEDED+=("assign:$issue")
    fi
done

echo ""
echo "🔍 Checking for stale resources..."

# 3. Check for worktrees with merged PRs
git -C $MAIN_REPO worktree list | grep 'worktrees/issue-' | while read -r line; do
    WORKTREE_PATH=$(echo "$line" | awk '{print $1}')
    BRANCH=$(echo "$line" | grep -o '\[.*\]' | tr -d '[]')

    if [[ $BRANCH == issue-* ]]; then
        ISSUE_NUM=$(echo "$BRANCH" | grep -o '[0-9]*' | head -1)

        # Check if PR is merged
        PR_STATE=$(gh pr list -R $OWNER/$REPO --head "$BRANCH" --state merged --json number,state --jq '.[0].state' 2>/dev/null || echo "")

        if [ "$PR_STATE" = "MERGED" ]; then
            echo "  ⚠️  Worktree for #$ISSUE_NUM has merged PR (should be cleaned up)"
            FIXES_NEEDED+=("cleanup_merged:$ISSUE_NUM:$WORKTREE_PATH")
        fi
    fi
done

echo ""

# 4. Summary and auto-fix
if [ ${#FIXES_NEEDED[@]} -eq 0 ]; then
    echo "✅ All systems in sync!"
    echo ""
    echo "📊 Summary:"
    echo "  - Worktrees: $(echo $WORKTREES | wc -w | tr -d ' ')"
    echo "  - All issues properly tracked"
    echo "  - No stale resources found"
    exit 0
fi

echo "⚠️  Found ${#FIXES_NEEDED[@]} issues to fix"
echo ""
echo "🔧 Applying fixes..."

for fix in "${FIXES_NEEDED[@]}"; do
    ACTION=$(echo "$fix" | cut -d: -f1)
    ISSUE=$(echo "$fix" | cut -d: -f2)
    EXTRA=$(echo "$fix" | cut -d: -f3)

    case $ACTION in
        add_to_project)
            echo "  → Adding issue #$ISSUE to project board..."
            gh project item-add $PROJECT_NUMBER --owner $OWNER --url "https://github.com/$OWNER/$REPO/issues/$ISSUE"

            # Get the item ID and set status
            sleep 1
            ITEM_ID=$(gh project item-list $PROJECT_NUMBER --owner $OWNER --format json --limit 100 | \
                jq -r --arg num "$ISSUE" '.items[] | select(.content.number == ($num | tonumber)) | .id')

            if [ -n "$ITEM_ID" ]; then
                gh project item-edit --project-id $PROJECT_ID --id "$ITEM_ID" \
                    --field-id $STATUS_FIELD_ID --single-select-option-id $STATUS_IN_PROGRESS
                echo "    ✓ Added and set to 'In Progress'"
            fi
            ;;

        update_status)
            echo "  → Updating issue #$ISSUE status to 'In Progress'..."
            gh project item-edit --project-id $PROJECT_ID --id "$EXTRA" \
                --field-id $STATUS_FIELD_ID --single-select-option-id $STATUS_IN_PROGRESS
            echo "    ✓ Status updated"
            ;;

        assign)
            echo "  → Assigning issue #$ISSUE to you..."
            gh issue edit $ISSUE -R $OWNER/$REPO --add-assignee @me
            echo "    ✓ Assigned"
            ;;

        remove_worktree)
            echo "  → Removing worktree for #$ISSUE (reason: $EXTRA)..."
            git -C $MAIN_REPO worktree remove $MAIN_REPO/worktrees/issue-$ISSUE --force 2>/dev/null || \
                echo "    ⚠️  Worktree not found at expected location"
            echo "    ✓ Worktree removed"
            ;;

        cleanup_merged)
            echo "  → Cleaning up merged worktree for #$ISSUE..."
            git -C $MAIN_REPO worktree remove "$EXTRA" --force 2>/dev/null || echo "    ⚠️  Already removed"
            git -C $MAIN_REPO branch -d "issue-$ISSUE-"* 2>/dev/null || echo "    ⚠️  Branch already deleted"
            echo "    ✓ Cleaned up"
            ;;
    esac
done

echo ""
echo "✅ All fixes applied!"
echo ""
echo "📊 Final state:"
git -C $MAIN_REPO worktree list
```

## Auto-Fix Behavior

The validation command will automatically:

1. **Add missing issues to project board** → Set to "In Progress"
2. **Update incorrect statuses** → Active worktrees = "In Progress"
3. **Assign issues** → All active issues assigned to you
4. **Remove stale worktrees** → For closed/merged issues

## Output Examples

### ✅ Clean State
```
🔍 Validating repository state...

📂 Checking worktrees...
Found worktrees for issues: 18 19 20

Checking issue #18...
  ✓ Issue #18 properly tracked
Checking issue #19...
  ✓ Issue #19 properly tracked
Checking issue #20...
  ✓ Issue #20 properly tracked

🔍 Checking for stale resources...

✅ All systems in sync!

📊 Summary:
  - Worktrees: 3
  - All issues properly tracked
  - No stale resources found
```

### ⚠️ Fixes Needed
```
🔍 Validating repository state...

📂 Checking worktrees...
Found worktrees for issues: 18 19 20

Checking issue #18...
  ✓ Issue #18 properly tracked
Checking issue #19...
  ❌ Issue #19 not in project board
Checking issue #20...
  ⚠️  Issue #20 is in project but status is 'Todo' (should be 'In Progress')

⚠️  Found 2 issues to fix

🔧 Applying fixes...
  → Adding issue #19 to project board...
    ✓ Added and set to 'In Progress'
  → Updating issue #20 status to 'In Progress'...
    ✓ Status updated

✅ All fixes applied!
```

## Agent Guidelines

**Run this command:**
- ✅ At the start of every conversation
- ✅ Before using `/issue start`
- ✅ After using `/issue merge`
- ✅ When user asks "what's in progress?"
- ✅ When debugging workflow issues

**The command is idempotent:**
- Safe to run multiple times
- Only fixes what's broken
- Never damages good state

**After running:**
- Report summary to user
- If fixes were applied, explain what was corrected
- Suggest using `/issue start` for new work instead of manual worktree creation
