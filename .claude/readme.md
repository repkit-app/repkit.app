# Claude Code Configuration for RepKit Web

This directory contains Claude Code configuration, guides, and automation for repkit.app (Next.js/TypeScript).

---

## Directory Structure

```
.claude/
├── commands/         # Slash commands (/issue, /validate, etc.)
├── guides/           # Development guides (TypeScript, Next.js, React)
├── logs/             # Development logs (created automatically)
├── reference/        # Reference documentation
├── templates/        # Code templates
├── readme.md         # This file
└── settings.json     # Permissions configuration
```

---

## Key Files

### Root Level
- **[../CLAUDE.md](../CLAUDE.md)** - Main instructions for Claude Code (START HERE)
- **settings.json** - Tool permissions (npm, git, vercel, etc.)

### Guides (`guides/`)
- **[guides/readme.md](./guides/readme.md)** - Guide index and decision tree
- **[guides/architecture.md](./guides/architecture.md)** - Next.js app structure
- **[guides/react_patterns.md](./guides/react_patterns.md)** - Component patterns
- **[guides/testing.md](./guides/testing.md)** - Testing requirements (TODO)
- **[guides/typescript_guidelines.md](./guides/typescript_guidelines.md)** - TypeScript best practices (TODO)

### Commands (`commands/`)
- **issue.md** - `/issue` - Main workflow command (start, push, merge)
- **i.md** - `/i` - Alias for `/issue`
- **validate.md** - `/validate` - Sync worktrees ↔ issues ↔ board
- **log.md** - `/log` - Update development log
- **board.md** - `/board` - View project board status

---

## Quick Start

### For Claude Code

1. **Read** [../CLAUDE.md](../CLAUDE.md) first
2. **Run** `/validate` at start of every session
3. **Use** `/issue start <N>` to begin work
4. **Consult** [guides/readme.md](./guides/readme.md) before coding

### For New Contributors

1. Read [guides/architecture.md](./guides/architecture.md)
2. Read [guides/react_patterns.md](./guides/react_patterns.md)
3. Read [guides/testing.md](./guides/testing.md)
4. Follow workflow in [../CLAUDE.md](../CLAUDE.md)

---

## Tech Stack

- **Framework:** Next.js 15+ (App Router)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS
- **i18n:** next-intl (5 languages)
- **Testing:** Jest + React Testing Library + Playwright
- **Deployment:** Vercel

---

## Core Principles

1. **Type Safety First** - No `any`, use strict TypeScript
2. **Server-First** - Use Server Components by default
3. **Test Coverage** - 80% for utils, 70% for components
4. **Named Exports** - No default exports
5. **i18n-First** - All strings use next-intl
6. **Accessibility** - WCAG 2.1 AA compliance
7. **Performance** - Core Web Vitals optimization

---

## Workflow Commands

```bash
# Start work on issue
/issue start 42

# Push changes and create PR
/issue push

# Merge PR and cleanup
/issue merge

# Check sync status
/validate

# Update dev log
/log

# View project board
/board
```

---

## File Organization

```
repkit.app/
├── .claude/          # This directory
├── app/              # Next.js app directory
│   ├── [locale]/     # i18n routes
│   └── api/          # API routes
├── components/       # React components
│   ├── ui/           # Shared UI
│   └── features/     # Feature-specific
├── lib/              # Utilities, hooks, services
│   ├── utils/
│   ├── hooks/
│   └── services/
├── messages/         # i18n translation files
├── public/           # Static assets
├── CLAUDE.md         # Main instructions
├── package.json
└── tsconfig.json
```

---

## Development Guidelines

### Before Writing Code

1. Read relevant guides from `guides/`
2. Check `CLAUDE.md` for code quality checklist
3. Understand TypeScript/React patterns
4. Plan test coverage

### During Development

1. Use `/issue` workflow for all changes
2. Follow naming conventions (kebab-case files, PascalCase components)
3. Write tests alongside features
4. Keep components small and composable

### Before Committing

1. Run `npm run build` (must pass)
2. Run `npm test` (must pass)
3. Run `npm run lint` (must pass)
4. Run `npm run type-check` (must pass)
5. Address all CodeRabbit feedback

---

## Maintenance

- **Update guides** when patterns change
- **Add examples** to guides regularly
- **Keep commands** synchronized with iOS RepKit when applicable
- **Document decisions** in guides

---

*Last updated: 2025-10-26*
*Related: [iOS RepKit .claude/](../../repkit/.claude/)*
