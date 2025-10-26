# repkit.app

Marketing website and OpenAI API proxy for RepKit - AI-powered fitness tracking.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Linting**: ESLint + Prettier
- **Deployment**: Vercel (planned)

## Project Structure

```
├── app/
│   ├── (marketing)/        # Marketing pages (landing, about, etc.)
│   │   └── page.tsx        # Homepage
│   ├── api/                # API routes
│   │   └── ai/
│   │       └── chat/
│   │           ├── mini/   # gpt-4o-mini endpoint
│   │           └── standard/ # gpt-4o endpoint
│   ├── layout.tsx          # Root layout
│   └── globals.css         # Global styles
├── components/             # Reusable React components
├── lib/                    # Utility functions
└── public/
    └── .well-known/
        └── apple-app-site-association  # Universal Links config
```

## Getting Started

### Prerequisites

- Node.js 20.x or later
- npm 10.x or later

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the site.

### Build

```bash
npm run build
npm run start
```

### Linting

```bash
npm run lint
```

## API Endpoints

### `/api/ai/chat/mini` (POST)

OpenAI proxy using `gpt-4o-mini` model (cost-effective for simple queries).

**Request:**
```json
{
  "messages": [
    {"role": "system", "content": "You are a fitness coach."},
    {"role": "user", "content": "Generate a 3-day workout plan"}
  ],
  "temperature": 0.7,
  "max_tokens": 2000
}
```

**Headers:**
- `Content-Type: application/json`
- `X-Device-Token: <optional-device-id>` (for higher rate limits)

**Response:**
```json
{
  "id": "chatcmpl-xyz",
  "model": "gpt-4o-mini",
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "..."
    }
  }],
  "usage": {
    "prompt_tokens": 50,
    "completion_tokens": 300,
    "total_tokens": 350
  }
}
```

**Rate Limits:**
- 100 requests/hour with `X-Device-Token`
- 50 requests/hour without token (fallback to IP)

**Status**: ✅ **Implemented**

---

### `/api/ai/chat/standard` (POST)

OpenAI proxy using `gpt-4o` model (more capable for complex queries).

Same request/response format as `/mini` endpoint.

**Rate Limits:**
- 100 requests/hour with `X-Device-Token`
- 50 requests/hour without token (fallback to IP)

**Status**: ✅ **Implemented**

## Deployment

- **Platform**: Vercel
- **Domain**: repkit.app (GoDaddy DNS → Vercel)
- **Analytics**: Vercel Analytics (planned - issue #7)

## Universal Links

The `.well-known/apple-app-site-association` file enables Universal Links for the iOS app.

**Note**: Update `TEAM_ID` placeholder with actual Apple Developer Team ID before deployment (issue #8).

## Related Issues

- #1: Setup Next.js project (this issue)
- #2: Implement OpenAI API proxy endpoints
- #3: Deploy to Vercel
- #4: Configure DNS
- #5: Add placeholder landing page
- #6: Setup email routing
- #7: Enable Vercel Analytics
- #8: Setup Universal Links AASA file

## License

Private - All rights reserved
