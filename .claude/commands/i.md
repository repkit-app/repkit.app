# /i - Quick Issue Command Alias

Short alias for `/issue` command.

## Usage

All `/issue` commands work with `/i`:

```bash
# Start work on issue
/i start 9

# Check status
/i status

# Push changes and create PR
/i push

# Mark ready for review
/i ready

# Review comments & pipeline (REQUIRED BEFORE MERGE)
/i check

# Merge and cleanup
/i merge

# List active worktrees
/i list

# Cleanup worktree
/i cleanup 9

# Abandon work
/i abandon 9
```

## 🚨 Code Review Policy

**Important**: `/i merge` enforces code review policy:
- **`/i check` must be run first** - Reviews all comments and addresses each one
- All CodeRabbit comments must be resolved (not just replied to)
- Build must pass
- All conversations must be marked "Resolved" on GitHub

See [Code Review Policy](./issue.md#-code-review-policy---required-before-merge) for details.
See [/i check documentation](./check.md) for how to address comments systematically.

## Documentation

See [/issue command documentation](./issue.md) for full details.

## Why the Alias?

The `/i` command is a convenience shortcut for frequently-used issue management:
- Faster to type during active development
- Still maintains clear intent (`i` = issue)
- Reduces friction in the development workflow

## Examples

```bash
# Quick workflow (fully automated)
/i start 15          # Automated: creates worktree, assigns, syncs board
cd ~/code/repkit-15
# ... code ...
/i push              # Create PR
/i check             # Review comments & address feedback
/i merge             # Complete (requires check first)

# Check what's active
/i list

# Status check
/i status
```
