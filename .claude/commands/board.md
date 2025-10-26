# RepKit GitHub Project Board Management

Manage the RepKit GitHub Project board directly.

## Instructions

Use GitHub CLI to interact with project #3 and manage issues.

## Commands

### View Board Status
```bash
# Show current sprint issues
gh project item-list 3 --owner jaredhughes --limit 30 --format json | \
  jq -r '.items[] | select(.status == "In Progress" or .status == "Todo") |
  "[\(.status)] #\(.content.number): \(.content.title)"'
```

### Move Issue Status
```bash
# Move issue to different status
gh issue edit [ISSUE_NUMBER] --add-label "in-progress"
gh project item-edit --project-id 3 --id [ITEM_ID] --field-id status --single-select-option-id [STATUS_ID]
```

### Sprint Overview
```bash
# Show sprint progress
gh issue list --label "epic:foundation" --json number,title,state,labels
```

## Quick Actions

1. **Start working on issue**: Move to "In Progress"
2. **Complete issue**: Move to "Done", close issue
3. **Block issue**: Add blocked label, move to "Blocked"
4. **Review PR**: Move to "In Review"

## Usage

```bash
# View board
/board

# Move issue #X to in-progress
/board move 12 in-progress

# Show sprint stats
/board sprint
```