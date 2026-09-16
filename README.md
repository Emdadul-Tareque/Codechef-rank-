# Phitron CodeChef Performance Dashboard

A self-contained web app: upload a roster (Name, Batch, CodeChef Handle,
University/Institute), it bulk-fetches each student's CodeChef rating,
cleans up messy university names, and gives you a batch/university
dashboard — with everything exportable back to Excel.

No database, no external services, no paid tier required. Deploys free on
Vercel's Hobby plan.

## What it does

1. **Upload** an `.xlsx` / `.xls` / `.csv` roster.
2. **Confirm column mapping** — you point at which column is Name / Batch /
   CodeChef Handle / University, with sensible auto-detection as a starting
   point (works even if your headers don't match exactly, e.g. "CC Profile /
   Handle" or "Codechef Handle" are both recognized).
3. **Review university name mapping** — the app groups near-duplicate
   spellings ("BUET", "buet", "B.U.E.T", "Bangladesh University of
   Engineering and Technology") into one canonical name, using a curated
   dictionary of common Bangladeshi universities plus a spelling-similarity
   fallback for anything not in the dictionary. You confirm/rename/merge
   before it's applied — no silent auto-merging on a report leadership will
   read.
4. **Fetch, live** — as soon as university mapping is confirmed you land on
   the dashboard itself, not a separate loading screen. It calls CodeChef's
   public profile pages (`codechef.com/users/<handle>`) from its own
   server, one handle per request, several requests in flight at once. Every
   single result updates the charts/tables the instant it comes back — you
   don't wait for a batch to finish to see anything move. A slim progress
   bar stays pinned at the top until the run finishes (see "Live updates"
   below for how this works, and "Rate-limit handling" for the
   retry/backoff behavior). Progress is saved to your browser's local
   storage, so a refresh mid-run resumes exactly where it left off —
   already-resolved handles aren't re-fetched.
5. **Dashboard** — batch × star-tier breakdown, university × star-tier
   breakdown (bar charts + tables), a leaderboard of top performers, and a
   "needs attention" panel for handles that were blocked, not found, or
   invalid — each retryable with one click, updating live the same way.
6. **Export** — two Excel downloads:
   - **Result Excel**: Name, Batch, CodeChef Handle, Max Rank,
     University/Institute (plus bonus columns: Current Rating, Star Tier,
     Status, Notes).
   - **Full Report Excel**: multi-sheet workbook — Summary, Batch Breakdown,
     University Breakdown, University Mapping audit trail, Leaderboard,
     Needs Attention, and Raw Data.

## Important terminology note

CodeChef does not store a field literally called "max rank." What it does
track is **Highest Rating** (a student's peak contest rating) and, from
that, a **star tier** (1★–7★). This app's "Max Rank" column is that Highest
Rating number — the closest real, verifiable equivalent. Live per-contest
**Global Rank** isn't a stable profile-level stat (it resets/archives per
contest, and shows "Inactive" for most past contests), so it isn't part of
this dashboard.

## Live updates

The dashboard is driven by one React state object (`results`, keyed by
handle) that every chart/table/summary card reads from via `useMemo`. The
client fetches **one handle per HTTP request**, with `CONCURRENT_REQUESTS`
(default 4) of those requests in flight at once — each response updates
`results` immediately, so the UI reflects that single new data point right
away instead of waiting for a batch.

This was a deliberate choice over having the server stream many results
back over one long-lived response (Server-Sent Events / chunked transfer):
that approach works fine in local dev but is inconsistent on Vercel's
Node.js serverless runtime in practice (buffering/truncation is a commonly
reported issue). Many small, ordinary request/response calls behave
identically in dev and in production, so that's what this app uses. The
trade-off is more total HTTP requests (one per handle instead of one per
25) — irrelevant at Phitron's roster sizes, and still gentle on CodeChef
since `CONCURRENT_REQUESTS` caps how many are ever in flight at once.

## Rate-limit handling ("CodeChef যেন লিমিট না দেয়")

CodeChef has no official public ratings API, and it fronts the site with
bot-mitigation. This app is defensive about it:

- Small, configurable concurrency per batch (default 4, capped at 8).
- Exponential backoff + jitter, up to 3 attempts per handle.
- Detects both HTTP-level blocks (403/429/503) and 200-status "bot
  challenge" pages.
- Reads `Retry-After` when CodeChef sends one.
- **Adaptive backpressure**: if a batch comes back mostly blocked, the
  server tells the browser to wait much longer (up to 15s) before the next
  batch, instead of hammering away at a fixed interval.
- Batches are capped at 60 handles per server request and given a 45-second
  internal deadline, well inside the 60-second function timeout configured
  in `vercel.json` — so a slow batch always returns partial results instead
  of the platform killing the request outright.
- If CodeChef still blocks a run hard, lower concurrency and raise the delay
  by editing the constants at the top of `pages/api/fetch-batch.ts`
  (`DEFAULT_CONCURRENCY`, `WALL_CLOCK_BUDGET_MS`), then just click **Retry**
  on the "Needs attention" panel — it only re-fetches the handles that
  failed, not the whole roster.

**A note on scraping generally:** this reads the same public HTML page a
browser would show a logged-out visitor. It doesn't touch anything
authenticated or paid, but scraping is still against the letter of most
sites' Terms of Service — worth knowing if you plan to run this often or at
very large scale.

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
4. No environment variables are required.
5. Click **Deploy**. You'll get a `https://<something>.vercel.app` URL.

That's it — the Hobby (free) plan is enough. `vercel.json` already extends
the scraper API route's timeout to 60 seconds, which Hobby supports.

### If you outgrow the free tier

- Vercel's Hobby plan currently defaults function duration to 300s but caps
  configurable `maxDuration` the same as Pro (up to 300s without extended
  limits) — double-check current numbers at
  https://vercel.com/docs/functions/limitations before assuming, since
  platform limits change. Each fetch request now carries a single handle
  (see "Live updates" below), so per-request duration is a non-issue even
  on very large rosters; if you have thousands of students and want faster
  overall throughput, raise `CONCURRENT_REQUESTS` in `pages/index.tsx`
  (keep it modest — this is what determines how hard the app leans on
  CodeChef, not the Vercel timeout).
- For a roster in the tens of thousands, consider moving the fetch queue to
  a proper background job (e.g. Vercel Cron + a KV store) instead of the
  client-driven batch loop used here — this app's approach is intentionally
  simple (no database, no queue service) to stay on the free tier for
  Phitron's actual batch sizes (hundreds, not tens of thousands).

## Project structure

```
pages/
  index.tsx            — the whole UI flow (upload → mapping → review → fetch → dashboard)
  api/fetch-batch.ts   — server-side scraper endpoint (concurrency, retries, backoff)
components/            — step screens + dashboard widgets
lib/
  codechefScraper.ts   — single-profile fetch + parse (server-only, uses cheerio)
  handleUtils.ts        — handle cleaning/validation (safe on client + server)
  excelIO.ts             — reading the upload, writing both export workbooks
  universityMap.ts       — curated alias dictionary + fuzzy clustering fallback
  stats.ts                — batch/university/leaderboard/summary aggregation
  starTier.ts, tierColors.ts — CodeChef's star-band rules and matching colors
```

## Extending the university dictionary

Add entries to `DICTIONARY` in `lib/universityMap.ts` — canonical display
name as the key, an array of lowercase aliases (abbreviations, common
misspellings) as the value. Anything not in the dictionary still gets
grouped automatically by spelling similarity and shown for your review.
