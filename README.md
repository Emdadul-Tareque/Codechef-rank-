# Phitron CodeChef Performance Dashboard

A self-contained web app: upload a roster (Batch, Name, Email, Phone Number,
Institute Name, CodeChef Handle), it bulk-fetches each student's CodeChef
rating, cleans up messy university names, and gives you a batch/university
dashboard plus contest-by-contest gain/loss tracking — with everything
exportable back to Excel.

No database required. Deploys free on Vercel's Hobby plan (the CodeChef data
source itself — see below — has its own paid tiers if you outgrow the free
one).

## What it does

1. **Upload** an `.xlsx` / `.xls` / `.csv` roster with these six columns (any
   header wording/order — auto-detected, confirmed by you in the next step):
   **Batch, Name, Email, Phone Number, Institute Name, CodeChef Handle**.
2. **Confirm column mapping** — you point at which sheet column is which of
   the six fields above, with sensible auto-detection as a starting point
   (works even if your headers don't match exactly, e.g. "Contact No." or
   "Mobile" both match Phone Number). The app blocks continuing if two
   fields end up pointed at the same column — a common copy-paste mistake
   that otherwise silently corrupts every export.
3. **Review university name mapping** — the app groups near-duplicate
   spellings ("BUET", "buet", "B.U.E.T", "Bangladesh University of
   Engineering and Technology") into one canonical name, using a curated
   dictionary of common Bangladeshi universities plus a spelling-similarity
   fallback for anything not in the dictionary. You confirm/rename/merge
   before it's applied — no silent auto-merging on a report leadership will
   read.
4. **Fetch, live** — as soon as university mapping is confirmed you land on
   the dashboard itself, not a separate loading screen. It fetches each
   student's rating through the [Parse.bot CodeChef
   API](https://parse.bot/marketplace/57b88850-0922-4fec-9b43-39f9fa21bd9b/codechef-com-api)
   (see "Data source" below), one handle per request, paced to stay under
   that API's rate limit. Every single result updates the charts/tables the
   instant it comes back — you don't wait for a batch to finish to see
   anything move. A slim progress bar stays pinned at the top until the run
   finishes. Progress is saved to your browser's local storage, so a
   refresh mid-run resumes exactly where it left off — already-resolved
   handles aren't re-fetched, even across a full re-upload (see "Live
   updates" below).
5. **Dashboard** — batch × star-tier breakdown, university × star-tier
   breakdown (bar charts + tables), a leaderboard of top performers, and a
   "needs attention" panel for handles that were blocked, not found, or
   invalid — each retryable with one click, updating live the same way.
6. **Contest analysis** — pick any contest from a dropdown (defaults to the
   most recent), then three tabs: **Rating Increased**, **Rating
   Decreased**, **Did Not Participate**. Each participant row shows rating
   before/after, and — separately — their per-contest **rank** before/after
   and whether their rank specifically improved (rank and rating don't
   always move together). Every row carries the full roster identity:
   Batch, Name, Email, Phone Number, Institute Name, CodeChef Handle.
7. **Export** — three Excel downloads, all identity-first (Batch, Name,
   Email, Phone Number, Institute Name, CodeChef Handle lead every sheet):
   - **Result Excel**: identity columns + Max Rank, Current Rating, Star
     Tier, Status, Notes.
   - **Full Report Excel**: multi-sheet workbook — Summary, Batch Breakdown,
     University Breakdown, University Mapping audit trail, Leaderboard,
     Needs Attention, and Raw Data.
   - **Contest Breakdown Excel**: for whichever contest is selected —
     separate sheets for Summary, Rating Increased, Rating Decreased,
     Rating Unchanged, Did Not Participate, and Unresolved.

## Important terminology note

CodeChef does not store a field literally called "max rank." What it does
track is **Highest Rating** (a student's peak contest rating) and, from
that, a **star tier** (1★–7★) — this is what the dashboard's "Max Rank"
column shows. Separately, **per-contest rank** (a student's placement in one
specific contest) *is* available and is what Contest Analysis's "Rank
Before/After" columns use — it just isn't a stable, cumulative
profile-level stat the way rating is, so it only appears in that
contest-specific view, not the main leaderboard.

## Contest analysis: why contests are grouped, not matched by exact code

CodeChef commonly runs the *same* contest across several rating divisions on
the same day — e.g. "Starters 101 Division 2 (Rated)" and "Starters 101
Division 4 (Rated)" are the same real-world contest; CodeChef auto-assigns a
student to a division based on their current rating. Matching purely by
contest `code` would wrongly mark a Division-4 student as "did not
participate" in a contest their Division-2 classmates played the same day.

`lib/contestAnalysis.ts` groups entries into a logical "event" by a
normalized contest name (division suffix and "(Rated)"/"(Unrated)" stripped)
plus calendar date, so the dropdown lists real contest *events*, and a
student is correctly matched regardless of which division they landed in.
"Rating before" for a student's first-ever contest falls back to their
`initialRating` (CodeChef's starting value, usually 1000) since there's no
earlier entry to compare against; "Rank before" instead stays `null` for a
first contest (there's no meaningful prior placement to fall back to), and
both the UI and every export show that as "N/A (first contest)" rather than
a misleading number.

This only works with the Parse.bot data source (`lib/parseBotScraper.ts`),
since it's the one that returns full per-contest history (rating *and*
rank) — the direct-scrape fallback (`lib/codechefScraper.ts`) only ever
extracted the single highest rating and doesn't populate `contestHistory`.

## Data source: Parse.bot's CodeChef API

CodeChef has no official public ratings API, and fetching `codechef.com`
directly from a Vercel server IP runs into CodeChef's own bot-mitigation
fairly quickly (this app used to scrape the profile page directly — see
`lib/codechefScraper.ts`, still in the repo — until real deployments started
seeing a large share of requests come back `429`). It now goes through
[Parse.bot's managed CodeChef API](https://parse.bot/marketplace/57b88850-0922-4fec-9b43-39f9fa21bd9b/codechef-com-api)
instead (`lib/parseBotScraper.ts`), which fetches the data on its own
infrastructure and hands it back as JSON.

**Setup — one required environment variable:**

| Variable | Required | Where to get it |
|---|---|---|
| `PARSE_BOT_API_KEY` | Yes | Sign up at [parse.bot](https://parse.bot), grab your key from your account |
| `PARSE_BOT_ENDPOINT` | No | Only if you've subscribed to your own pinned copy of the API on Parse.bot |

Locally: copy `.env.local.example` to `.env.local` and fill in the key. On
Vercel: **Project → Settings → Environment Variables** → add
`PARSE_BOT_API_KEY` → redeploy. Without it, every handle comes back with a
clear `error` status telling you the variable is missing, instead of
retrying pointlessly or failing silently.

**Pricing/limits to plan around** (see [parse.bot/pricing](https://parse.bot/pricing) for current numbers):

| Plan | Credits/month | Rate limit |
|---|---|---|
| Free | 200 | 5 req/min |
| Hobby ($30/mo) | 1,000 | 20 req/min |
| Developer ($100/mo) | 5,000 | 100 req/min |

`get_user_info` costs 1 credit per **successful** call. For a one-off run of
Phitron's ~850 handles, the Free tier's 200 credits/month isn't enough in a
single month — Hobby covers it with room to spare. The persistent ratings
cache (see "Live updates" below) means a handle is only ever billed once,
even across re-uploads, so re-running after fixing a mistake doesn't re-burn
credits on handles you already resolved.

**Rate limiting is now mostly Parse.bot's problem, not CodeChef's** — but you
still have to respect *their* per-plan req/min cap, or they'll 429 you. This
is controlled by one constant:

```ts
// pages/index.tsx
const PARSE_BOT_REQUESTS_PER_MINUTE = 5; // set to your actual plan: 5 / 20 / 100 / 300
```

This defaults to the Free tier's 5/min (conservative on purpose) — **update
it to match whichever plan your API key is actually on**, or every run will
be needlessly slow. The app paces requests to exactly this rate
(`CONCURRENT_REQUESTS = 1`, spaced `60000 / PARSE_BOT_REQUESTS_PER_MINUTE`
ms apart), and still backs off further and retries (with the same
Needs-Attention/Retry flow as before) if it gets a 429 anyway.

**Switching back to direct scraping:** `lib/codechefScraper.ts` (the
original CSS-selector-based scraper) is untouched and still works as a
drop-in replacement — both files export the same
`fetchCodeChefProfile(handle)` function. To switch, change the one import
line in `pages/api/fetch-batch.ts`.

**A note on the API key you're using:** if it was ever pasted into a chat,
screenshot, or shared doc, treat it as compromised and regenerate it from
your Parse.bot account — same as any other credential.

## Live updates

The dashboard is driven by one React state object (`results`, keyed by
handle) that every chart/table/summary card reads from via `useMemo`. The
client fetches **one handle per HTTP request** — each response updates
`results` immediately, so the UI reflects that single new data point right
away instead of waiting for a batch.

This was a deliberate choice over having the server stream many results
back over one long-lived response (Server-Sent Events / chunked transfer):
that approach works fine in local dev but is inconsistent on Vercel's
Node.js serverless runtime in practice (buffering/truncation is a commonly
reported issue). Many small, ordinary request/response calls behave
identically in dev and in production, so that's what this app uses.

On top of that, a **persistent ratings cache** (a second, separate
`localStorage` entry, keyed by handle rather than by upload) survives
"Start over" and even a completely different file upload. If you fix a
mistake and re-upload the same roster, every handle that was already
successfully resolved is reused instantly — only genuinely new or
previously-failed handles get fetched again.

## Edge cases handled

- Header synonyms & typos (e.g. "University/Inistitue" still matches
  University).
- Full profile URLs pasted instead of bare handles
  (`https://www.codechef.com/users/foo` → `foo`).
- `@handle`, stray whitespace, invisible/zero-width unicode from
  copy-paste.
- Numeric-looking handles Excel might otherwise mangle into numbers.
- Blank rows, blank handles, blank university/batch (shown as "Unknown"
  rather than crashing).
- Duplicate handles shared by two different students — fetched once,
  applied to both rows, and flagged in the Needs Attention panel for a
  manual look (usually a copy-paste mistake worth catching).
- Handle not found (404), never-rated profile ("Unrated" — this is a real
  outcome, not an error), invalid handle format (rejected before wasting a
  network call), CodeChef page-layout changes (falls back from CSS
  selectors to a raw-HTML regex before giving up).
- Mid-run browser refresh/crash — full session (roster + university mapping
  + fetch progress) is persisted to `localStorage` and offered back as
  "Resume" on reload.

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deploying to Vercel (free)

1. Push this folder to a new GitHub repository.
2. Go to https://vercel.com → **Add New → Project** → import that repo.
3. Framework preset auto-detects as **Next.js** — leave build settings as
   default (`npm run build`).
4. Add the environment variable: **Settings → Environment Variables** →
   `PARSE_BOT_API_KEY` = your key (see "Data source" above).
5. Click **Deploy**. You'll get a `https://<something>.vercel.app` URL.

`vercel.json` already extends the API route's timeout to 60 seconds, which
Hobby supports.

### If you outgrow the free tier(s)

- **Vercel's own limits** rarely matter here: each fetch request carries a
  single handle, so per-request duration is a non-issue even on very large
  rosters. Double-check current numbers at
  https://vercel.com/docs/functions/limitations if you're curious, since
  platform limits change.
- **Parse.bot's plan is the real lever.** Throughput is capped by
  `PARSE_BOT_REQUESTS_PER_MINUTE` matching whatever plan you're paying for —
  raise both together (upgrade the plan, update the constant) for faster
  full-roster runs.
- For a roster in the tens of thousands, consider moving the fetch queue to
  a proper background job (e.g. Vercel Cron + a KV store) instead of the
  client-driven loop used here — this app's approach is intentionally simple
  (no database, no queue service) to stay lightweight for Phitron's actual
  batch sizes (hundreds, not tens of thousands).

## Project structure

```
pages/
  index.tsx            — the whole UI flow (upload → mapping → review → fetch → dashboard)
  api/fetch-batch.ts   — server-side fetch endpoint (concurrency, retries, backoff)
components/            — step screens + dashboard widgets
lib/
  parseBotScraper.ts   — fetches ratings + full contest history via the Parse.bot CodeChef API (server-only, current default)
  codechefScraper.ts   — original direct-scrape implementation (server-only, uses cheerio; kept as a drop-in alternative; no contest history)
  contestAnalysis.ts    — groups multi-division contests into one event and computes gained/lost/didn't-play
  handleUtils.ts        — handle cleaning/validation (safe on client + server)
  excelIO.ts             — reading the upload, writing all three export workbooks
  universityMap.ts       — curated alias dictionary + fuzzy clustering fallback
  stats.ts                — batch/university/leaderboard/summary aggregation
  starTier.ts, tierColors.ts — CodeChef's star-band rules and matching colors (dark-theme-tuned, hues spread apart for distinguishability)
  chartTheme.ts           — shared dark-mode styling constants for recharts (grid/axis/tooltip/legend)
```

## Extending the university dictionary

Add entries to `DICTIONARY` in `lib/universityMap.ts` — canonical display
name as the key, an array of lowercase aliases (abbreviations, common
misspellings) as the value. Anything not in the dictionary still gets
grouped automatically by spelling similarity and shown for your review.
