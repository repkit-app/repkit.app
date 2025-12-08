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

### Environment

Create a `.env.local` (or use `.env.example` as a template) with:

- `OPENAI_API_KEY` – required for OpenAI access
- `HMAC_SECRET` – shared secret used to sign requests
- `LOG_HASH_KEY` – optional; hashes IPs/tokens in logs (set a non-default value in prod)
- `RATE_LIMIT_REQUESTS_PER_HOUR` / `RATE_LIMIT_REQUESTS_PER_HOUR_NO_TOKEN` – optional rate limits
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` – optional; enable shared rate limiting across instances

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

## Ticket Automation

This repo includes a lightweight issue helper inspired by the main RepKit tooling:

```bash
./issue start <number>   # create/switch branch, assign + label
./issue push <number>    # push branch, create/update draft PR
./issue ready <number>   # mark PR ready for review
./issue check <number>   # show PR checks/review/mergeability
./issue status <number>  # summarize branch/PR/CI
./issue merge <number>   # squash-merge PR and delete branch
./issue rebase <number>  # rebase branch onto origin/main
./issue cleanup <number> # delete local/remote branches
./issue abandon <number> # close PR and delete branches
./issue list             # list local issue branches
```

Requirements: `git`, `gh`, `jq`. Use `./issue start <n>` instead of the unavailable `/issue` command.

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
- `X-Request-Signature: <hex-hmac-sha256(body+timestamp)>`
- `X-Request-Timestamp: <unix-seconds>`

**HMAC signing**
- Compute `timestamp = Math.floor(Date.now() / 1000)`
- Compute `signature = HMAC_SHA256(HMAC_SECRET, JSON.stringify(body) + timestamp)` as a hex string
- Send both headers; requests older than 5 minutes or with mismatched signatures are rejected (401)

**Example (Node):**
```ts
const timestamp = Math.floor(Date.now() / 1000).toString();
const signature = createHmac("sha256", process.env.HMAC_SECRET!)
  .update(JSON.stringify(body) + timestamp)
  .digest("hex");

await fetch("/api/ai/chat/mini", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Request-Timestamp": timestamp,
    "X-Request-Signature": signature,
    "X-Device-Token": "my-device-token", // optional but improves rate limit
  },
  body: JSON.stringify(body),
});
```

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

**Rate limiting note:** Limits use Upstash Redis when `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` are set; otherwise they run in-memory and apply per instance only.

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
