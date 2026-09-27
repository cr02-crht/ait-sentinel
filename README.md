# AIT Sentinel

Intake, catalog, and monitoring for internal automation requests — the tool PDD uses to run the "someone wants an automation built" process end to end.

## What this covers today

Mapped against the automation-request flow (ideation → build → issue-to-PDD → make.com ends here / hosting goes to PDD):

| Stage                                               | Status                                    | Where                                                                                        |
| --------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------- |
| Intake form                                         | ✅ Built                                  | [`/intake`](src/app/intake/page.tsx) → [`POST /api/intake`](src/app/api/intake/route.ts)     |
| AI request-drafting assistant                       | ✅ Built                                  | [`POST /api/intake/ai-draft`](src/app/api/intake/ai-draft/route.ts)                          |
| New-request Discord notification                    | ✅ Built                                  | [`lib/discord.ts`](src/lib/discord.ts) → alert channel                                       |
| Automation catalog (make.com scenarios)             | ✅ Built, make.com only                   | [`/catalog`](src/app/catalog/page.tsx), [`/catalog/[id]`](src/app/catalog/%5Bid%5D/page.tsx) |
| Catalog export (print-to-PDF)                       | ✅ Built                                  | [`/catalog/print`](src/app/catalog/print/page.tsx)                                          |
| Catalog → Notion push/update/remove                 | ✅ Built                                  | [`/catalog/notion`](src/app/catalog/notion/page.tsx) → [`POST/DELETE /api/catalog/notion`](src/app/api/catalog/notion/route.ts) |
| Error monitoring + Discord alert                    | ✅ Built                                  | [`GET /api/monitor/make`](src/app/api/monitor/make/route.ts) (cron-triggered)                |
| Issue triage assistant (`/triage` slash command)    | ✅ Built                                  | [`POST /api/discord`](src/app/api/discord/route.ts)                                          |
| Build copilot (chat)                                | ⚠️ Endpoint exists, not wired to any page | [`POST /api/chat`](src/app/api/chat/route.ts)                                                |
| Persistent registry (all automations, any platform) | ❌ Not built                              | see [NOTION-SCHEMA.md](NOTION-SCHEMA.md)                                                     |
| Request → platform routing / effort triage          | ❌ Not built                              | —                                                                                            |
| Dedup check against existing automations            | ❌ Not built                              | —                                                                                            |
| Validate gate (checklist, secret scan, auto-docs)   | ❌ Not built                              | —                                                                                            |
| Deploy metadata stamping                            | ❌ Not built                              | —                                                                                            |
| Auto-discovery / orphan detector                    | ❌ Not built                              | —                                                                                            |

The catalog currently reads live from the Make.com API rather than from a stored registry, and [`lib/watched-scenarios.ts`](src/lib/watched-scenarios.ts) is an explicit stand-in ("until that's backed by a real database") for monitoring which scenarios matter. Building the registry described in [NOTION-SCHEMA.md](NOTION-SCHEMA.md) unblocks everything still marked ❌.

## Architecture

- **Next.js (App Router)** — the whole thing, including the "AI proxy" role: API routes call Gemini directly rather than through a separate Cloudflare Worker.
- **Google Gemini** (`gemini-3.1-flash-lite-preview` via `@ai-sdk/google`) — powers the intake draft assistant, the build-copilot chat endpoint, and the Discord `/triage` command. Not Claude — a divergence from the original plan, kept as-is unless there's a reason to switch.
- **Discord** — the interaction surface for alerts (`/api/discord` handles slash commands; `lib/discord.ts` sends channel messages and interaction follow-ups).
- **Make.com** — the automation host being read from (`lib/make.ts`) for the catalog and the error monitor. Not yet the trigger source for a registry pipeline (see [MAKECOM-WIRING.md](MAKECOM-WIRING.md)).
- **No database yet.** `@supabase/supabase-js` is a dependency but unused — worth deciding explicitly whether the registry lands in Supabase (it's already in `package.json`) or Notion (the original plan) before building it. See the note in [NOTION-SCHEMA.md](NOTION-SCHEMA.md).

## Environment variables

| Variable                       | Required by                                             | Notes                                                                                  |
| ------------------------------ | ------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `GOOGLE_GENERATIVE_AI_API_KEY` | `/api/chat`, `/api/intake/ai-draft`, `/api/discord`     | Default env var name read by `@ai-sdk/google`.                                         |
| `DISCORD_BOT_TOKEN`            | `lib/discord.ts`, `/api/intake`                         | Bot token, used with `Authorization: Bot ...`.                                         |
| `DISCORD_ALERT_CHANNEL_ID`     | `/api/intake`, `/api/monitor/make`                      | Channel that receives new-request and failure alerts.                                  |
| `DISCORD_PUBLIC_KEY`           | `/api/discord`                                          | Verifies Discord interaction signatures.                                               |
| `DISCORD_APPLICATION_ID`       | `/api/discord`, `scripts/register-discord-commands.mjs` |                                                                                        |
| `DISCORD_GUILD_ID`             | `scripts/register-discord-commands.mjs` (optional)      | Registers commands to one guild instantly instead of globally (up to 1hr propagation). |
| `MAKE_ZONE`                    | `lib/make.ts`                                           | e.g. `eu1`, `us1` — the subdomain you log into Make with.                              |
| `MAKE_API_TOKEN`               | `lib/make.ts`                                           |                                                                                        |
| `MAKE_TEAM_ID`                 | `lib/make.ts`                                           |                                                                                        |
| `MONITOR_CRON_SECRET`          | `/api/monitor/make`                                     | Shared secret the external scheduler passes as `?secret=`.                             |
| `NOTION_TOKEN`                 | `lib/notion.ts`                                         | Internal integration token from notion.so/my-integrations. Same token would back the registry in [NOTION-SCHEMA.md](NOTION-SCHEMA.md) if that's built with Notion. |
| `NOTION_AUTOMATION_DOCS_PAGE_ID` | `lib/notion.ts`                                       | Page ID of the Notion page to push the catalog sub-page under (e.g. the "Automation Documentation" tracker item). |
| `SITE_PASSCODE`                | `proxy.ts`, `/api/gate`                                 | Plain passcode for the site gate (server-only). Unset = no gate. Change it to reset: every existing session is signed out on its next request. `/api/discord` and `/api/monitor/make` bypass the gate. |

## Setup

```bash
npm install
npm run dev          # http://localhost:3000
npm run register:discord   # registers the /triage slash command (needs .env.local)
```

`/api/monitor/make` is meant to be hit by an external scheduler (Cloud Scheduler, cron-job.org, etc.) on an interval, e.g.:

```
GET https://<deployment>/api/monitor/make?secret=$MONITOR_CRON_SECRET
```

### Pushing the catalog to Notion

[`/catalog/notion`](src/app/catalog/notion/page.tsx) (linked from `/catalog`) shows a preview of the full, unfiltered catalog — exactly what would be pushed — with **Push to Notion** and **Remove from Notion** buttons ([`lib/notion.ts`](src/lib/notion.ts), via [`/api/catalog/notion`](src/app/api/catalog/notion/route.ts)). Push finds the existing "Automation Catalog" sub-page under `NOTION_AUTOMATION_DOCS_PAGE_ID` (if any), archives it, and creates a fresh one — so it stays a single up-to-date page rather than piling up dated duplicates. Remove archives it without recreating.

One-time setup:

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations) → **New integration**. Name it, pick the CRHT workspace, keep it internal. Under capabilities, enable **Read content**, **Insert content**, and **Update content** (update is needed to archive the previous page on each push/remove).
2. Copy the **Internal Integration Token** and set it as `NOTION_TOKEN` in `.env.local`.
3. Open the target Notion page (e.g. the "Automation Documentation" tracker item) → **•••** menu (top right) → **Connections** → add the integration you just created. Without this step the API call gets a 404, not a permissions error.
4. Copy the page's ID from its URL — the 32-character id at the end (Notion accepts it with or without dashes) — and set it as `NOTION_AUTOMATION_DOCS_PAGE_ID` in `.env.local`.
5. Restart `npm run dev` so the new env vars load, then use the buttons on `/catalog/notion`.

## Next build steps

In priority order (each unblocks the next):

1. Pick a datastore for the registry (Supabase, since it's already a dependency, or Notion per the original plan) and stand it up per [NOTION-SCHEMA.md](NOTION-SCHEMA.md).
2. Have `/api/intake` write the submitted request into the registry instead of only notifying Discord.
3. Add a triage endpoint that classifies effort + platform (make.com vs. hosted) and writes the result back to the row — see [MAKECOM-WIRING.md](MAKECOM-WIRING.md) Scenario 1.
4. Wire `/api/chat` into an actual page so the build-copilot is reachable.
5. Add the validate gate and auto-discovery reconciler once there's a registry to check things against.
