# RepKit Web Development Guides

Comprehensive guides for building repkit.app with TypeScript, Next.js, and React best practices.

## Guide Index

### Core Architecture
- **[architecture.md](./architecture.md)** - Next.js app structure, routing, Server/Client components
- **[code_organization.md](./code_organization.md)** - File structure, naming conventions, imports

### Development Patterns
- **[react_patterns.md](./react_patterns.md)** - Component patterns, hooks, composition
- **[state_management.md](./state_management.md)** - React state, context, external state libraries
- **[dependency_injection.md](./dependency_injection.md)** - DI patterns for React, service layer

### Quality & Testing
- **[testing.md](./testing.md)** - Jest, React Testing Library, Playwright, coverage requirements
- **[error_handling.md](./error_handling.md)** - TypeScript error patterns, error boundaries, API errors
- **[typescript_guidelines.md](./typescript_guidelines.md)** - Type safety, strict mode, utility types

---

## Quick Decision Tree

### "I'm building a new..."

**Page:**
1. Read [architecture.md](./architecture.md) (sections 1-3)
2. Read [code_organization.md](./code_organization.md) (section 2)
3. Read [react_patterns.md](./react_patterns.md) (section 1)

**API Route:**
1. Read [architecture.md](./architecture.md) (section 4)
2. Read [error_handling.md](./error_handling.md) (sections 2-3)
3. Read [testing.md](./testing.md) (section 4)

**Component:**
1. Read [react_patterns.md](./react_patterns.md) (sections 1-3)
2. Read [code_organization.md](./code_organization.md) (section 3)
3. Read [testing.md](./testing.md) (section 2)

**Custom Hook:**
1. Read [react_patterns.md](./react_patterns.md) (section 4)
2. Read [testing.md](./testing.md) (section 3)

**Utility Function:**
1. Read [code_organization.md](./code_organization.md) (section 4)
2. Read [typescript_guidelines.md](./typescript_guidelines.md) (section 2)
3. Read [testing.md](./testing.md) (section 5)

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

## Guide Reading Order for New Contributors

1. [architecture.md](./architecture.md) - Understand the overall structure
2. [code_organization.md](./code_organization.md) - Learn file organization
3. [typescript_guidelines.md](./typescript_guidelines.md) - Master type safety
4. [react_patterns.md](./react_patterns.md) - Component patterns
5. [testing.md](./testing.md) - Testing requirements
6. [error_handling.md](./error_handling.md) - Error management
7. [state_management.md](./state_management.md) - State patterns
8. [dependency_injection.md](./dependency_injection.md) - Service layer

---

## When to Consult Guides

**Before starting ANY task:**
- Check this readme for relevant guides
- Read at least 2-3 guides per task
- Follow the Quick Decision Tree above

**During code review:**
- Reference guides when addressing feedback
- Verify code matches guide patterns

**When stuck:**
- Re-read relevant guide sections
- Look for similar patterns in guides
- Ask for clarification with specific guide reference

---

*Last updated: 2025-10-26*
