# Still Here?

A simple Tinder-style guessing game where you decide if famous people are still here or gone.

## Setup

1. Install Node.js 20.11+ or 22+.
2. Install dependencies:

```bash
npm install
```

3. Start the app:

```bash
npm run dev
```

## Celebrity Data Refresh

Normal gameplay stays fast because the app reads from a local celebrity dataset in `lib/italianCelebrities.ts`.
It does not call Wikidata on every game request.

The runtime data flow is:

1. `/api/celebrities` tries to read refreshed celebrity data from `lib/celebrityStore.ts`
2. If stored data exists, that data is returned
3. If no stored data exists, the API falls back to the static `italianCelebrities` dataset

If refresh fails, the game keeps working and never returns an empty dataset.

## Persistent Storage

Production refreshes should use persistent storage under the key:

```txt
still-here:celebrities
```

The store supports:

- `@vercel/kv` when available
- Vercel KV REST credentials via `KV_REST_API_URL` and `KV_REST_API_TOKEN`
- in-memory fallback for local development only

Important:

- The in-memory fallback is not persistent
- It will not survive Vercel serverless restarts
- For production, configure Vercel KV or another persistent backend

## Refresh Secret

Set a refresh secret so only private callers can trigger the refresh route:

```bash
REFRESH_SECRET=your-secret-value
```

The refresh route accepts the secret through:

- `x-refresh-secret` header
- `?secret=...` query param
- `Authorization: Bearer ...` header

## Vercel Cron

The app includes a daily Vercel cron job in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/refresh-celebrities",
      "schedule": "0 3 * * *"
    }
  ]
}
```

For private cron execution on Vercel, set:

```bash
REFRESH_SECRET=your-secret-value
CRON_SECRET=your-secret-value
```

Using the same value allows the route to accept Vercel Cron's bearer token while still supporting manual `x-refresh-secret` refreshes.

## Manual Refresh

Trigger a manual refresh locally or in production with:

```bash
curl -H "x-refresh-secret: YOUR_SECRET" http://localhost:3000/api/refresh-celebrities
```

Or in production:

```bash
curl -H "x-refresh-secret: YOUR_SECRET" https://your-domain.vercel.app/api/refresh-celebrities
```

The response includes:

- `updatedCount`
- `unchangedCount`
- `errors`

## Regenerating the Static Dataset

If you want to regenerate `lib/italianCelebrities.ts` manually from Wikidata, run the existing script:

```bash
tsx scripts/generateItalianCelebrities.ts
```

That script now shares the same Wikidata resolution logic used by the refresh system.
