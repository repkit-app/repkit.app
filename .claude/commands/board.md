# RepKit.app GitHub Project Board Management

Manage the repkit.app GitHub Project board directly.

## Project Configuration

- **Project ID**: `PVT_kwDODj92184BGb0W`
- **Project Number**: `1`
- **Owner**: `rustpoint`
- **Repo**: `rustpoint/repkit.app`
- **Status Field ID**: `PVTSSF_lADODj92184BGb0Wzg3e1zw`
- **Status Options**:
  - Todo: `f75ad846`
  - In Progress: `47fc9ee4`
  - Done: `98236657`

## Commands

### View Board Status
```bash
# Show current issues
gh project item-list 1 --owner rustpoint --limit 30 --format json | \
  jq -r '.items[] | select(.status == "In Progress" or .status == "Todo") |
  "[\(.status)] #\(.content.number): \(.content.title)"'
```

### Move Issue Status
```bash
# Move issue to different status
PROJECT_ID="PVT_kwDODj92184BGb0W"
STATUS_FIELD_ID="PVTSSF_lADODj92184BGb0Wzg3e1zw"
STATUS_IN_PROGRESS="47fc9ee4"

gh project item-edit --project-id $PROJECT_ID --id [ITEM_ID] \
  --field-id $STATUS_FIELD_ID --single-select-option-id $STATUS_IN_PROGRESS
```

### Sprint Overview
```bash
# Show all open issues
gh issue list -R rustpoint/repkit.app --json number,title,state,labels
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