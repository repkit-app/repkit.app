# React Patterns & Best Practices

**Purpose:** Component patterns, hooks usage, composition strategies for repkit.app.

---

## 1. Component Patterns

### 1.1 Named Exports Only

```typescript
// ❌ WRONG - Default export
export default function Button() {}

// ✅ CORRECT - Named export
export function Button() {}
```

**Why:** Better refactoring, explicit imports, tree-shaking

### 1.2 Component Structure

```typescript
'use client' // Only if client component

import { type ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// 1. Types first
type ButtonProps = ComponentProps<'button'> & {
  variant?: 'primary' | 'secondary'
  size?: 'sm' | 'md' | 'lg'
}

// 2. Component
export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'rounded-lg font-medium',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    />
  )
}

// 3. Styles/constants below
const variantStyles = {
  primary: 'bg-blue-600 text-white',
  secondary: 'bg-gray-200 text-gray-900'
}

const sizeStyles = {
  sm: 'px-3 py-1 text-sm',
  md: 'px-4 py-2',
  lg: 'px-6 py-3 text-lg'
}
```

### 1.3 Composition Pattern

```typescript
// components/card/card.tsx
export function Card({ className, ...props }: CardProps) {
  return <div className={cn('rounded-lg border bg-white', className)} {...props} />
}

// components/card/card-header.tsx
export function CardHeader({ className, ...props }: CardHeaderProps) {
  return <div className={cn('p-6', className)} {...props} />
}

// Usage
<Card>
  <CardHeader>
    <h2>Title</h2>
  </CardHeader>
  <CardContent>Content here</CardContent>
</Card>
```

---

## 2. Custom Hooks

### 2.1 Hook Naming

```typescript
// Always start with 'use'
export function useLocalStorage<T>(key: string, initialValue: T) {}
export function useDebounce<T>(value: T, delay: number) {}
export function useMediaQuery(query: string) {}
```

### 2.2 Hook Pattern

```typescript
// hooks/use-local-storage.ts
import { useState, useEffect } from 'react'

export function useLocalStorage<T>(key: string, initialValue: T) {
  // 1. State
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue

    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.error('Error reading localStorage', error)
      return initialValue
    }
  })

  // 2. Effects
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue))
    } catch (error) {
      console.error('Error writing localStorage', error)
    }
  }, [key, storedValue])

  // 3. Return
  return [storedValue, setStoredValue] as const
}
```

---

## 3. Server vs Client Components

### 3.1 Server Component (Default)

```typescript
// No 'use client' directive
export async function ProductList() {
  const products = await fetchProducts()

  return (
    <ul>
      {products.map(p => (
        <li key={p.id}>{p.name}</li>
      ))}
    </ul>
  )
}
```

### 3.2 Client Component (Interactivity)

```typescript
'use client'

import { useState } from 'react'

export function Counter() {
  const [count, setCount] = useState(0)

  return (
    <button onClick={() => setCount(count + 1)}>
      Count: {count}
    </button>
  )
}
```

### 3.3 Hybrid Pattern

```typescript
// app/page.tsx (Server Component)
import { Counter } from '@/components/counter'

export default async function Page() {
  const data = await fetchData() // Server-side

  return (
    <div>
      <h1>{data.title}</h1>
      <Counter /> {/* Client component */}
    </div>
  )
}
```

---

## 4. Error Boundaries

```typescript
// app/error.tsx
'use client'

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={() => reset()}>Try again</button>
    </div>
  )
}
```

---

## 5. Loading States

```typescript
// app/loading.tsx
export default function Loading() {
  return <div>Loading...</div>
}

// Or with Suspense
import { Suspense } from 'react'

<Suspense fallback={<Spinner />}>
  <AsyncComponent />
</Suspense>
```

---

*Last updated: 2025-10-26*
