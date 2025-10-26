# RepKit Development Log

Update the RepKit development log with current progress.

## Instructions

1. **Create/Update Log Entry**:
   - Check for today's log file: `.claude/logs/YYYY-MM-DD.md`
   - If it doesn't exist, create it from the template
   - Update the log with:
     - Current time entry
     - GitHub issues being worked on (with links)
     - Code changes summary
     - Any blockers or decisions made
     - Commit references

2. **Update README Status** (IMPORTANT):
   - Update the "📊 Current Development Status" section in README.md
   - Replace the "Last Updated" timestamp
   - Update Epic progress percentages
   - Update "Recent Activity" with today's work
   - Update velocity metrics if applicable

3. **Track AI Usage & Costs**:
   - Check for today's AI usage file: `.claude/logs/YYYY-MM-DD-ai-usage.md`
   - If running `/log` multiple times today, UPDATE the existing file (don't append)
   - Analyze ALL sessions from today:
     - Check git log for all PRs merged today: `gh pr list --state merged --search "merged:YYYY-MM-DD"`
     - Review each PR's additions/deletions
     - Estimate token usage for each session
     - Calculate costs using Claude Sonnet 4.5 pricing
   - Include:
     - Session breakdown (time, task, tokens, cost)
     - Total token usage (input/output)
     - Total daily cost
     - Work delivered (issues, lines of code, PRs)
     - Efficiency metrics (cost per issue, cost per hour)
     - Comparison to human equivalent

4. **Commit All Files**:
   - Commit the log file
   - Commit the AI usage analysis
   - Commit the updated README
   - Push to main

## Log Entry Template

```markdown
# RepKit Log - [DATE]

## Session: [TIME]

### Working on: #[ISSUE_NUMBER] - [TITLE]
**Status**: [Todo/In Progress/Done/Blocked]

**Changes**:
- [ ] [Specific change or task]
- [ ] [Another change]

**Commits**:
- `[hash]` - [message]

**Notes**:
- [Any decisions, learnings, or context]

**Blockers**:
- [Any impediments]

---

## Daily Summary
**Completed**: #X, #Y
**In Progress**: #Z
**Next**: #A
**Sprint Progress**: X/Y tickets
```

## AI Usage Tracking Guidelines

### Claude Sonnet 4.5 Pricing
- **Input tokens**: $3.00 per 1M tokens
- **Output tokens**: $15.00 per 1M tokens

### Token Estimation by Activity

**Reading/Analysis (Input)**:
- Reading command docs: ~5K-10K per command
- Reading existing code: ~1K per 100 lines
- Build error analysis: ~2K-5K per error
- CodeRabbit feedback: ~3K-5K per comment
- API documentation: ~10K-20K per service
- Context switching: ~5K-15K per switch

**Code Generation (Output)**:
- Swift file boilerplate: ~500-1K per file
- Full component (200 lines): ~3K-5K
- Configuration files (YAML): ~500-1K per file
- Documentation: ~100-500 per page
- Git commit messages: ~50-100 per commit
- PR descriptions: ~200-500 per PR

**Typical Session Patterns**:
- **Simple config change**: 15-25K tokens ($0.08-0.13)
- **Single component**: 40-70K tokens ($0.20-0.36)
- **Complex feature**: 100-150K tokens ($0.50-0.75)
- **Multiple components with refinement**: 120-180K tokens ($0.60-0.90)
- **Full project setup**: 60-80K tokens ($0.30-0.42)

### How to Track
1. **Count merged PRs** for the day
2. **Check additions/deletions** for code volume
3. **Estimate input tokens**:
   - Base context: 20K + (lines read × 1K/100)
   - Add iterations: +20% per revision cycle
4. **Estimate output tokens**:
   - Lines generated × 15 tokens/line (average)
5. **Calculate cost**:
   - (Input tokens × $3/1M) + (Output tokens × $15/1M)

### Example Calculation
```
Session: Created 3 components (600 lines)
Input: 50K (reading docs, design system, previews)
Output: 9K (600 lines × 15 tokens/line)
Cost: (50K × $3/1M) + (9K × $15/1M) = $0.15 + $0.14 = $0.29
```

## Usage

```bash
# Update log with current work and AI usage
/log

# Creates timestamped entries
# Auto-links to GitHub issues
# Tracks AI usage and costs
# Updates AI usage file (replaces if exists today)
# Maintains progress record for sprint tracking
```