# Make.com Wiring

Status check against the codebase: only the monitor piece is actually live today, and it's **not** a make.com scenario — it's a Next.js cron endpoint that reads *from* Make.com. Everything below marked "to build" needs the registry from [NOTION-SCHEMA.md](NOTION-SCHEMA.md) to exist first.

## What's real today

**Error monitoring** — [`GET /api/monitor/make`](src/app/api/monitor/make/route.ts), hit by an external scheduler (Cloud Scheduler, cron-job.org — whatever's already pinging it) on an interval, authenticated by `?secret=MONITOR_CRON_SECRET`. For each entry in [`lib/watched-scenarios.ts`](src/lib/watched-scenarios.ts) it pulls the last 15 minutes of logs via the Make API and posts a Discord alert to `DISCORD_ALERT_CHANNEL_ID` if any run failed. No AI involved — it's a count of `status === 3` (error) log entries.

**Catalog read** — [`/catalog`](src/app/catalog/page.tsx) calls `getScenarios()` ([`lib/make.ts`](src/lib/make.ts)) live against `GET /scenarios?teamId=...` on every page load. No caching, no registry — it's a direct mirror of whatever's in the Make team.

Neither of these needs make.com-side scenario wiring; they're pull, not push. The sections below are what a *push*-based flow (make.com noticing something and calling this app) would look like once there's a registry to write to.

## To build: Scenario 1 — New request → structure → dedup → triage → registry write

Today, `POST /api/intake` does structuring (via `/api/intake/ai-draft`, client-side) and a Discord ping, and stops. Nothing persists. Once the registry exists, extend this — either inside the Next.js route or in make.com if intake moves off this app entirely:

| Step | Module / call | Input | Output |
|---|---|---|---|
| 1. Trigger | Registry row created (Status = New) | — | row |
| 2. Dedup check | Call to Gemini/Claude with the new request's title+goal plus existing registry titles+one-liners | `{new request, existing[]}` | `{possible_duplicates: [row_id, ...]}` |
| 3. Triage | Call with the structured request + a written rubric (see below) | structured request | `{effort: S/M/L, platform: make.com \| hosted, suggested_owner}` |
| 4. Write back | Update the registry row | triage result | Status → Triaged |
| 5. Notify | Discord message to PDD channel, @-mention if `platform = hosted` | row | — |

**Triage rubric (write this yourselves, it's the actual product, not the AI call):**
- `make.com` if: trigger is webhook/schedule, ≤5 logical steps, connectors already exist for the target apps.
- `hosted` if: needs a server endpoint, persistent state, a UI, a live Discord gateway connection, or heavy/high-frequency compute.

AI proposes this classification; a human (PDD) still flips Status from Triaged to Building — don't let this step auto-approve, or triage becomes the new bottleneck one step earlier.

## To build: Scenario 2 — Deploy stamping

| Step | Trigger | Writes |
|---|---|---|
| 1 | Status → Live (set manually or by a deploy pipeline) | — |
| 2 | Deploy pipeline or a manual PDD step posts the environment ref | `Environment / Deploy Ref`, `Owner`, `Deploy Date` on the registry row |

No AI needed here — it's metadata plumbing. Skip building an AI step for this until there's evidence the metadata is messy enough to need normalizing.

## To build: Scenario 3 — Per-automation monitor (extends what exists)

The current `/api/monitor/make` alerts to one shared channel for a hardcoded scenario list. To generalize once the registry exists:

1. Replace `watched-scenarios.ts` with a query against the registry for `Platform = make.com AND Status = Live`.
2. On failure, look up `Error Alert Channel` and `Owner` from that row instead of the single env var, so alerts route per-automation instead of all to one channel.
3. Optionally add the AI severity/cause classification that already exists in the `/triage` Discord command ([`api/discord/route.ts`](src/app/api/discord/route.ts)) — call it automatically on the failure event instead of waiting for a human to type `/triage`.

## To build: Scenario 4 — Auto-discovery reconciler

A scheduled job (reuse the same cron pattern as `/api/monitor/make`) that:
1. Lists all make.com scenarios for the team (`getScenarios()` already does this).
2. Diffs scenario IDs against the registry's `Environment / Deploy Ref` column.
3. Posts a Discord alert for any scenario live in Make but missing from the registry.

This is the cheapest of the four to build — it reuses `lib/make.ts` as-is — but it's listed last because it only becomes useful once the registry is the source of truth to diff against.
