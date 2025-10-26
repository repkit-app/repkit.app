# Next.js Architecture Guide

**Purpose:** Understand Next.js App Router structure, Server/Client component split, routing, and API design for repkit.app.

---

## 1. App Router Structure

### 1.1 Directory Layout

```
app/
├── [locale]/                # i18n routing wrapper
│   ├── layout.tsx           # Root layout (Server Component)
│   ├── page.tsx             # Home page (Server Component)
│   ├── error.tsx            # Error boundary
│   ├── loading.tsx          # Loading UI
│   ├── not-found.tsx        # 404 page
│   ├── features/
│   │   └── page.tsx         # /features page
│   └── pricing/
│       └── page.tsx         # /pricing page
├── api/
│   └── ai/
│       └── route.ts         # POST /api/ai
└── globals.css              # Global styles (Tailwind)

middleware.ts                # i18n middleware
```

### 1.2 Route Conventions

**Page:** `page.tsx` - Public route (e.g., `/features`)
**Layout:** `layout.tsx` - Shared UI for route segment
**Template:** `template.tsx` - Like layout, but remounts on navigation
**Loading:** `loading.tsx` - Suspense fallback
**Error:** `error.tsx` - Error boundary
**Not Found:** `not-found.tsx` - 404 handling

**Route Groups:** `(marketing)/` - Organize without affecting URL structure
**Dynamic Routes:** `[id]/` - Dynamic segments
**Catch-all:** `[...slug]/` - Catch all segments

---

## 2. Server vs Client Components

### 2.1 Default: Server Components

**Use Server Components by default** unless you need:
- Interactivity (onClick, onChange, etc.)
- Browser APIs (window, localStorage)
- React hooks (useState, useEffect, useContext)
- Event listeners

### 2.2 Server Component Benefits

```typescript
// app/[locale]/page.tsx (Server Component)
import { getTranslations } from 'next-intl/server'

export default async function HomePage() {
  // ✅ Fetch data directly
  const t = await getTranslations('home')

  // ✅ Access environment variables
  const apiUrl = process.env.NEXT_PUBLIC_API_URL

  // ✅ No client-side JavaScript shipped
  return (
    <div>
      <h1>{t('title')}</h1>
      <ServerData />
    </div>
  )
}
```

**Benefits:**
- No client JavaScript sent
- Direct database access
- Better SEO
- Faster initial load

### 2.3 Client Component Usage

```typescript
'use client' // ← Directive at top of file

import { useState } from 'react'

export function InteractiveButton() {
  const [count, setCount] = useState(0)

  return (
    <button onClick={() => setCount(count + 1)}>
      Clicked {count} times
    </button>
  )
}
```

**Use client components for:**
- Forms with state
- Interactive widgets
- Browser API usage
- Third-party libraries requiring `window`

### 2.4 Composition Pattern

Keep client components small and compose into server components:

```typescript
// app/[locale]/features/page.tsx (Server Component)
import { InteractiveDemo } from '@/components/interactive-demo' // Client

export default async function FeaturesPage() {
  const data = await fetchFeatures() // Server-side fetch

  return (
    <div>
      <h1>Features</h1>
      {/* Server-rendered content */}
      <FeatureList features={data} />

      {/* Client-only interactive widget */}
      <InteractiveDemo />
    </div>
  )
}
```

---

## 3. Internationalization (i18n)

### 3.1 Locale Routing

```
/en/features      → English
/pt-br/features   → Portuguese (Brazil)
/es-mx/features   → Spanish (Mexico)
/ar/features      → Arabic (RTL)
/ja/features      → Japanese
```

### 3.2 Middleware Configuration

```typescript
// middleware.ts
import createMiddleware from 'next-intl/middleware'

export default createMiddleware({
  locales: ['en', 'pt-br', 'es-mx', 'ar', 'ja'],
  defaultLocale: 'en',
  localePrefix: 'always' // Always show /en/, /pt-br/, etc.
})

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
}
```

### 3.3 Translation Usage

```typescript
// Server Component
import { getTranslations } from 'next-intl/server'

export default async function Page() {
  const t = await getTranslations('home')
  return <h1>{t('title')}</h1>
}

// Client Component
'use client'
import { useTranslations } from 'next-intl'

export function ClientComponent() {
  const t = useTranslations('features')
  return <p>{t('description')}</p>
}
```

### 3.4 Translation Files

```
messages/
├── en.json
├── pt-br.json
├── es-mx.json
├── ar.json
└── ja.json
```

**Structure:**
```json
{
  "home": {
    "title": "Welcome to RepKit",
    "description": "AI-powered fitness tracking"
  },
  "features": {
    "ai_coaching": "AI Coaching",
    "smart_tracking": "Smart Tracking"
  }
}
```

---

## 4. API Routes

### 4.1 OpenAI Proxy Pattern

```typescript
// app/api/ai/route.ts
import { type NextRequest, NextResponse } from 'next/server'
import { OpenAI } from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request: NextRequest) {
  try {
    // 1. Validate request
    const body = await request.json()

    if (!body.messages || !Array.isArray(body.messages)) {
      return NextResponse.json(
        { error: 'Invalid request: messages required' },
        { status: 400 }
      )
    }

    // 2. Rate limiting (implement with Upstash Redis)
    // const rateLimitResult = await ratelimit.limit(clientId)

    // 3. Call OpenAI API
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: body.messages,
      stream: true
    })

    // 4. Stream response back
    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of response) {
          const content = chunk.choices[0]?.delta?.content
          if (content) {
            controller.enqueue(new TextEncoder().encode(content))
          }
        }
        controller.close()
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    })

  } catch (error) {
    console.error('OpenAI API error:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### 4.2 API Route Best Practices

**✅ DO:**
- Validate all input
- Use environment variables for secrets
- Implement rate limiting
- Return proper HTTP status codes
- Log errors with structured logging
- Use TypeScript for request/response types

**❌ DON'T:**
- Expose API keys in responses
- Skip input validation
- Return stack traces to clients
- Use `any` types
- Mix business logic with API handlers

### 4.3 Error Handling Pattern

```typescript
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate
    const validationError = validateInput(body)
    if (validationError) {
      return NextResponse.json(
        { error: validationError },
        { status: 400 }
      )
    }

    // Process
    const result = await processRequest(body)

    return NextResponse.json({ success: true, data: result })

  } catch (error) {
    // Log error (use proper logging service)
    console.error('API error:', error)

    // Return generic error to client
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
```

---

## 5. Data Fetching

### 5.1 Server Component Fetching

```typescript
// Direct async/await in Server Components
export default async function Page() {
  // Fetch is automatically cached
  const data = await fetch('https://api.example.com/data', {
    next: { revalidate: 60 } // Revalidate every 60s
  })

  return <div>{/* Render data */}</div>
}
```

### 5.2 Caching Strategies

**Force Cache (default):**
```typescript
fetch(url) // Cached indefinitely
```

**Revalidate:**
```typescript
fetch(url, { next: { revalidate: 60 } }) // Revalidate every 60s
```

**No Store (always fresh):**
```typescript
fetch(url, { cache: 'no-store' }) // Never cache
```

**Dynamic:**
```typescript
export const dynamic = 'force-dynamic' // Opt out of caching for entire route
```

### 5.3 Parallel Fetching

```typescript
export default async function Page() {
  // Execute in parallel
  const [user, posts] = await Promise.all([
    fetchUser(),
    fetchPosts()
  ])

  return <div>{/* Render */}</div>
}
```

---

## 6. Metadata & SEO

### 6.1 Static Metadata

```typescript
import { type Metadata } from 'next'

export const metadata: Metadata = {
  title: 'RepKit - AI Fitness Tracking',
  description: 'AI-powered workout tracking on your wrist',
  openGraph: {
    title: 'RepKit',
    description: 'AI-powered fitness tracking',
    url: 'https://repkit.app',
    images: ['/og-image.png']
  }
}
```

### 6.2 Dynamic Metadata

```typescript
export async function generateMetadata(): Promise<Metadata> {
  const locale = getLocale()
  const t = await getTranslations({ locale, namespace: 'metadata' })

  return {
    title: t('title'),
    description: t('description')
  }
}
```

---

## 7. Performance Optimization

### 7.1 Image Optimization

```typescript
import Image from 'next/image'

<Image
  src="/hero.png"
  alt="Hero image"
  width={1200}
  height={600}
  priority // Above fold
/>
```

### 7.2 Font Optimization

```typescript
// app/layout.tsx
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({ children }: LayoutProps) {
  return (
    <html className={inter.className}>
      <body>{children}</body>
    </html>
  )
}
```

### 7.3 Code Splitting

```typescript
import dynamic from 'next/dynamic'

// Lazy load heavy components
const HeavyComponent = dynamic(() => import('@/components/heavy'), {
  loading: () => <p>Loading...</p>
})
```

---

## 8. Deployment (Vercel)

### 8.1 Environment Variables

**Production:**
- `OPENAI_API_KEY` - OpenAI API key
- `DATABASE_URL` - Database connection (if using)
- `NEXT_PUBLIC_API_URL` - Public API URL

**Preview:**
- Same as production (use separate keys)

### 8.2 Build Configuration

```typescript
// next.config.ts
const config = {
  experimental: {
    serverActions: true
  },
  images: {
    domains: ['cdn.example.com']
  }
}

export default config
```

---

## 9. Architecture Decision Records

### Why Server Components First?

**Rationale:**
- Better performance (no client JS for static content)
- Improved SEO
- Direct access to backend resources
- Smaller bundle sizes

**Trade-off:** Requires thoughtful client/server boundary design

### Why App Router over Pages Router?

**Rationale:**
- Better streaming and loading states
- Improved layouts and nested routing
- Server Components support
- Future of Next.js

---

*Last updated: 2025-10-26*
*Reference: Next.js 15 Documentation, Vercel Best Practices*
