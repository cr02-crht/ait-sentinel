# Automation Registry — Schema

Status: **not built**. This is the spec for the piece [README.md](README.md) calls the top-priority next step — nothing in the codebase writes to this yet. `/api/intake` currently only notifies Discord; the catalog reads live from Make.com instead of from a stored registry.

## Before you build this: Notion or Supabase?

The original plan (and this doc's name) assumed Notion — cheap to stand up, no-code form, good for a small team browsing by hand. But `@supabase/supabase-js` is already a dependency in this repo and unused, which suggests someone intended to use it for exactly this. Reasons to prefer one over the other:

- **Notion** — faster to stand up, zero-code intake form option, easiest for non-engineers on other teams to browse/edit rows directly. Weaker for programmatic queries at any real volume (dedup-by-listing-existing-names works fine under a few hundred rows, degrades past that).
- **Supabase** — already a dependency, real SQL, better for the dedup/auto-discovery queries once those exist, but needs a UI built (or Notion-style browsing sacrificed) for non-engineers to inspect rows.

The field list below is the same either way — Notion's "property," Supabase's "column." Pick one before wiring `/api/intake` to write to it; don't build both.

## Fields

The first block matches `AutomationRequestPayload` in [`api/intake/route.ts`](src/app/api/intake/route.ts) exactly — these already exist as form fields today and just need a place to land. The second block is new, needed for triage/deploy/monitor stages that don't exist yet.

### Already collected at intake

| Field | Type | Notes |
|---|---|---|
| Request ID | Title / text | Currently generated client-side as `REQ-XXXXXX` in `api/intake/route.ts` — becomes the row's primary key. |
| Title | Text | |
| Requester Name | Text | |
| Requester Email | Email | |
| Department | Select | Engineering / Operations / Sales / Marketing / Customer Support / Finance / Product / Other |
| Priority | Select | low / medium / high / critical |
| Trigger Type | Select | Webhook / API Event · Schedule / Cron Timer · Database / CRM Trigger · Form Submission · Manual / Discord Slash Command · File / Email Event · Other |
| Trigger Details | Text | |
| Target Apps | Multi-select | Free-taggable in the current form (`POPULAR_APPS` + custom) |
| Frequency | Select | Real-time · Every 5–15 min · Hourly · Daily · Weekly · On-demand |
| Business Goal | Long text | |
| Workflow Steps | Long text | |
| Data Fields | Text | |
| Alert Destination | Text | |
| Auth Notes | Text | Free-text today — do **not** store actual credential values here even if someone pastes one; see Credentials Ref below. |
| Submitted At | Date | |

### New — needed for the stages not built yet

| Field | Type | Notes |
|---|---|---|
| Status | Select | New → Triaged → Building → Validating → Live → Retired |
| Platform | Select | make.com / Cloudflare Worker / Cloud Run / Discord bot / other hosted — set by the triage step (not built) |
| Effort | Select | S / M / L — set by the triage step |
| Owner | Person / text | Who's building or maintaining it |
| Extends Existing | Relation / text | Link to another registry row if this overlaps one — output of the dedup check (not built) |
| Environment / Deploy Ref | Text | make.com org+scenario ID, Worker route, Cloud Run service name, or Discord bot ID — stamped at deploy |
| Credentials Ref | Text (link only) | Pointer into the vault, never the secret itself |
| Deploy Date | Date | |
| Last Reviewed | Date | For the auto-discovery reconciler to flag stale entries |
| Docs / Runbook | URL or long text | Auto-generated at the validate stage (not built) |
| Error Alert Channel | Text | Currently hardcoded as a single `DISCORD_ALERT_CHANNEL_ID` env var in `/api/monitor/make` — move per-automation once this field exists |

## Setup (if choosing Notion)

1. Create the database with the properties above.
2. Create an internal integration at notion.so/my-integrations, copy the token.
3. Share the database with that integration (••• menu → Connections).
4. Set `NOTION_TOKEN` and `NOTION_DATABASE_ID` wherever `/api/intake` runs.

## Setup (if choosing Supabase)

1. Create a table with the columns above (snake_case names).
2. Row Level Security: service-role key only from the API routes, never exposed client-side.
3. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` alongside the existing Make/Discord env vars in [README.md](README.md).

## Recommended views (Notion) / filtered queries (Supabase)

- **Needs triage** — Status = New
- **Awaiting PDD build** — Status = Triaged, Platform = hosted
- **Live catalog** — Status = Live, grouped by Platform
- **Stale — review** — Last Reviewed > 90 days ago
- **By department** — grouped by Department, for reporting back to requesting teams
