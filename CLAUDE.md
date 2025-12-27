# Claude Code Instructions for RepKit Web (repkit.app)

## Project Overview

**Tech Stack:**
- Next.js 15+ (App Router)
- TypeScript
- Tailwind CSS
- React Server Components
- Vercel deployment

**Purpose:**
1. Marketing website (multi-language landing pages)
2. OpenAI API proxy (`/ai` endpoint)

---

## Session Initialization (REQUIRED)

**At the start of EVERY conversation, run:**

```bash
/validate
```

This command automatically syncs:
- Git worktrees ↔ GitHub issues ↔ Project board
- Detects and fixes inconsistencies
- Reports current state to user

**Do this before anything else.** It takes 5 seconds and prevents workflow confusion.

---

## Communication Pattern for User Input

**CRITICAL:** When waiting for user input, make it unmistakably clear.

**When discrete choices exist:**
```
🛑 CHOOSE ONE OF THESE OPTIONS:

a) [First option description]
b) [Second option description]
c) [Third option description]

(Reply with just the letter)
```

**When open-ended input is needed:**
```
🛑 I NEED YOUR INPUT:

[Clear question about what you need]
```

**Rules:**
- Always use 🛑 emoji to signal waiting state
- Use a/b/c options ONLY when there are discrete choices
- Keep options concise and actionable
- Never leave ambiguity about whether you're still working or waiting

---

## Code Quality Checklist (MANDATORY BEFORE WRITING CODE)

**NEVER write code without completing this checklist:**

### Step 1: Identify Your Task

- [ ] What component am I building? (Page, API Route, Component, Hook, Util)
- [ ] What type of work is this? (new feature, bug fix, refactor, tests)

### Step 2: Load Relevant Guides

**Use `.claude/guides/readme.md` to determine which guides to read.**

Common tasks:
- **Adding Page:** Read architecture.md → code_organization.md → react_patterns.md
- **Adding API Route:** Read architecture.md → error_handling.md → testing.md
- **Adding Component:** Read react_patterns.md → code_organization.md → testing.md
- **Adding Hook:** Read react_patterns.md → testing.md
- **Adding Tests:** Read testing.md (ALWAYS required)

### Step 3: Verify Compliance Before Coding

- [ ] No default exports (use named exports)
- [ ] All props have TypeScript types
- [ ] No `any` types (use `unknown` or proper typing)
- [ ] Tests planned: 80% for utils, 70% for components
- [ ] Error boundaries for client components
- [ ] Server/Client component split is clear
- [ ] File naming: kebab-case for all files
- [ ] Component naming: PascalCase

### Step 3.5: i18n Requirements (MANDATORY FOR USER-FACING FEATURES)

**repkit.app is i18n-first** - See [docs/technical/i18n/](../repkit/docs/technical/i18n/)

**Target languages:** en-US, pt-BR, es-MX, ar-AE, ja-JP

Before coding any user-facing feature, verify:

- [ ] All user-facing strings use next-intl (NOT hardcoded strings)
- [ ] Text supports RTL layout (Arabic): Use CSS logical properties
- [ ] Numbers/dates formatted with Intl API
- [ ] Routing supports locale prefixes (/en/, /pt-br/, /es-mx/, /ar/, /ja/)

**Before merging:**
- [ ] Test in all 5 locales
- [ ] Test RTL layout (ar-AE)
- [ ] Verify translation files complete

### Step 4: Before Committing

- [ ] Build succeeds: `npm run build`
- [ ] All tests pass: `npm test`
- [ ] Linting passes: `npm run lint`
- [ ] Type checking passes: `npm run type-check`
- [ ] No console.log() statements (use proper logging)
- [ ] All imports are organized

### Critical Don'ts Before Code

❌ Don't write code without reading guides first
❌ Don't use default exports
❌ Don't use `any` types
❌ Don't skip test writing
❌ Don't hardcode strings (use next-intl)
❌ Don't mix multiple issues in one feature
❌ Don't use inline styles (use Tailwind)

---

## CodeRabbit Review Feedback Handling - MANDATORY WORKFLOW

**CRITICAL RULE:** When addressing CodeRabbit comments on a PR, you MUST:
1. Reply to **EACH individual comment** in its thread
2. Mark the conversation as **Resolved** after addressing
3. NEVER create a single summary comment - address each comment separately

### Step-by-Step Workflow for Addressing CodeRabbit Feedback

#### Step 1: Fetch All CodeRabbit Comments

```bash
# Get all inline code review comments from CodeRabbit
gh api repos/rustpoint/repkit.app/pulls/{PR_NUM}/comments \
  --jq '.[] | select(.user.login == "coderabbitai[bot]") | {
    id: .id,
    path: .path,
    line: .line,
    body: .body,
    in_reply_to_id: .in_reply_to_id
  }'
```

#### Step 2: Reply to Each Comment in Thread

For **each CodeRabbit comment**, reply using this exact format:

```bash
# Reply to inline code review comment (creates threaded reply)
gh api repos/rustpoint/repkit.app/pulls/{PR_NUM}/comments \
  -X POST \
  -f body="✅ **Fixed in commit abc1234**

**What changed:**
- [Specific change made]

**Why:**
[Reasoning for the change]

**Verification:**
- [How you verified the fix]" \
  -F in_reply_to={COMMENT_ID}
```

#### Step 3: Resolve the Conversation

After replying, manually click "Resolve conversation" on GitHub web UI for each comment.

---

## Core Workflow Rules

### 1. NEVER Use Manual Worktree Commands

❌ **WRONG** (breaks automation):
```bash
git worktree add ~/code/repkit-app/worktrees/issue-42 -b issue-42-feature
gh issue create ...
```

✅ **CORRECT** (automated workflow):
```bash
/issue start 42
```

### 2. ALWAYS Use `/issue` Commands

- `/issue start <N>` - Begin work (creates worktree, updates board, assigns issue)
- `/issue push` - Push code and create/update PR
- `/issue merge` - Complete work (merges PR, cleans up worktree, updates board)
- `/validate` - Check and fix state

**Never use `/ticket` command - only `/issue`.**

### 3. ONE Worktree Per Issue

Each issue gets its own directory:
```
~/code/repkit-app/                      # Main repository
~/code/repkit-app/worktrees/issue-26/   # API proxy implementation
~/code/repkit-app/worktrees/issue-102/  # i18n routing
~/code/repkit-app/worktrees/issue-103/  # Landing page
```

Don't mix work from multiple issues in one worktree.

---

## When User Requests Work

### Scenario: "Let's implement feature X"

**Your response:**
```bash
# 1. Find or create issue
gh issue list | grep "feature X"
# Or: gh issue create --title "..." --body "..."

# 2. Start work using automation
/issue start 42

# 3. Change to worktree
cd ~/code/repkit-app/worktrees/issue-42

# 4. Confirm to user
"✓ Started work on #42. Worktree at ~/code/repkit-app/worktrees/issue-42."
```

---

## TypeScript/Next.js Best Practices

### File Organization

```
app/
├── [locale]/           # i18n routing
│   ├── page.tsx        # Home page (Server Component)
│   ├── layout.tsx      # Root layout
│   └── features/
│       └── page.tsx    # Features page
├── api/
│   └── ai/
│       └── route.ts    # API route handler
components/
├── ui/                 # Shared UI components
│   ├── button.tsx
│   └── card.tsx
├── features/           # Feature-specific components
│   └── hero.tsx
└── layouts/            # Layout components
    └── nav.tsx
lib/
├── utils/              # Utility functions
├── hooks/              # Custom React hooks
└── services/           # API clients, external services
```

### Naming Conventions

- **Files:** kebab-case (e.g., `user-profile.tsx`)
- **Components:** PascalCase (e.g., `UserProfile`)
- **Hooks:** camelCase with `use` prefix (e.g., `useUserData`)
- **Utils:** camelCase (e.g., `formatDate`)
- **Types:** PascalCase (e.g., `UserData`)

### Component Structure

```typescript
'use client' // Only if client component

import { type ComponentProps } from 'react'

// 1. Types
type ButtonProps = ComponentProps<'button'> & {
  variant: 'primary' | 'secondary'
}

// 2. Component
export function Button({ variant, ...props }: ButtonProps) {
  return <button className={cn(styles[variant])} {...props} />
}

// 3. No default export
```

### API Route Structure

```typescript
import { type NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    // Process request
    // Return response

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

---

## Quick Reference

| User Says | You Run |
|-----------|---------|
| Start of conversation | `/validate` |
| "Work on issue 42" | `/issue start 42` |
| "Push this" | `/issue push` |
| "What's in progress?" | `/validate` or `/issue list` |
| "Merge this" | `/issue merge` |
| "Nevermind, abandon" | `/issue abandon <N>` |

---

## The Golden Rule

**Use slash commands for ALL workflow operations.**

The automation handles:
- Worktree creation/deletion
- Project board updates
- Issue assignment
- Label management
- PR creation/merging
- Cleanup after completion

**The user just codes. You automate everything else.**
