import type { NextRequest } from "next/server";
import {
  getScenarioLogHistory,
  getScenarios,
  runUrl,
  scenarioUrl,
  type Scenario,
  type ScenarioLog,
} from "@/lib/make";

// Every active Make scenario is monitored by default. Put this tag anywhere in
// a scenario's description in Make to leave it out of alerts and the digest.
export const NO_MONITOR_TAG = "[no-monitor]";

// How long past its scheduled time a scenario can be before it counts as stuck.
const OVERDUE_GRACE_MINUTES = 30;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Must match how often the external scheduler calls /api/monitor/make, so each
// check covers exactly the stretch since the previous one.
export function monitorIntervalMinutes() {
  const n = Number(process.env.MONITOR_INTERVAL_MINUTES);
  return n > 0 ? n : 15;
}

export function isCronAuthorized(req: NextRequest) {
  const expected = process.env.MONITOR_CRON_SECRET;
  return !!expected && req.nextUrl.searchParams.get("secret") === expected;
}

function isMonitored(s: Scenario) {
  return !(s.description ?? "").toLowerCase().includes(NO_MONITOR_TAG);
}

function minutesOverdue(s: Scenario, now: number): number | null {
  if (!s.isActive || s.isPaused || !s.nextExec) return null;
  const late = (now - Date.parse(s.nextExec)) / 60_000;
  return late > OVERDUE_GRACE_MINUTES ? late : null;
}

const isFailedRun = (log: ScenarioLog) => log.status === 3;

// Make switches a scenario off as soon as a run fails with no error handler,
// so a broken scenario is often inactive by the time the monitor looks at it.
const switchedOffByMake = (s: Scenario) => !s.isActive && s.isinvalid;
const since = (logs: ScenarioLog[], from: number) => logs.filter((l) => Date.parse(l.timestamp) >= from);

// Discord renders <t:…> in each reader's own timezone.
const when = (iso: string, style: "R" | "f" = "R") => `<t:${Math.floor(Date.parse(iso) / 1000)}:${style}>`;
const link = (label: string, url: string) => `[${label}](<${url}>)`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function describeError(log: ScenarioLog) {
  if (!log.error) return "No error detail from Make";
  const where = log.error.causeModule ? ` (${log.error.causeModule.appName} › ${log.error.causeModule.name})` : "";
  return `${log.error.name}: ${log.error.message}${where}`;
}

export type CheckResult = { message: string | null; summary: Record<string, unknown> };

// Runs every MONITOR_INTERVAL_MINUTES. Alerts on anything that went wrong since
// the previous check: failed runs (including the one that made Make switch a
// scenario off), Make backing off after errors, and a scheduled scenario that
// has stopped running on time.
export async function runFailureCheck(): Promise<CheckResult> {
  const interval = monitorIntervalMinutes();
  const now = Date.now();
  const windowStart = now - interval * 60_000;

  const scenarios = (await getScenarios()).filter((s) => (s.isActive || switchedOffByMake(s)) && isMonitored(s));

  const alerts: string[] = [];
  const unreachable: string[] = [];
  const checked: Array<{ scenario: string; runs: number; errors: number }> = [];

  for (const s of scenarios) {
    try {
      const recent = since(await getScenarioLogHistory(s.id, 50), windowStart);
      const failed = recent.filter(isFailedRun);

      if (failed.length > 0) {
        alerts.push(
          [
            `🔴 **${link(s.name, scenarioUrl(s))}** — ${plural(failed.length, "failed run")} in the last ${interval} min`,
            ...failed.slice(0, 3).map((f) => `-# ${describeError(f)} · ${when(f.timestamp)} · ${link("View run", runUrl(s, f))}`),
            ...(switchedOffByMake(s) ? ["⏹️ Make switched this scenario off after the error. It won't run again until someone turns it back on."] : []),
          ].join("\n"),
        );
      }
      if (recent.some((l) => l.type === "backoff")) {
        alerts.push(`🟠 **${link(s.name, scenarioUrl(s))}** — Make is backing off retries after repeated errors.`);
      }
      checked.push({ scenario: s.name, runs: recent.length, errors: failed.length });
    } catch (err) {
      console.error(`Monitor could not read logs for scenario ${s.id}:`, err);
      unreachable.push(s.name);
    }

    // Only alerts on the one check where the delay crosses the grace period,
    // so a stuck scenario pings once rather than every interval. The daily
    // digest keeps listing it until it's fixed.
    const late = minutesOverdue(s, now);
    if (late !== null && late < OVERDUE_GRACE_MINUTES + interval && s.nextExec) {
      alerts.push(`⏰ **${link(s.name, scenarioUrl(s))}** — scheduled run was due ${when(s.nextExec)} and hasn't happened.`);
    }
  }

  if (unreachable.length > 0) {
    alerts.push(`⚠️ Couldn't check ${unreachable.join(", ")} — the Make API returned an error. See server logs.`);
  }

  return {
    message: alerts.length > 0 ? alerts.join("\n\n") : null,
    summary: { intervalMinutes: interval, checked, unreachable },
  };
}

// Run once a day. A summary of the last 24 hours, including the slow-burn
// problems a per-failure alert can't show: stuck scenarios, queued incomplete
// executions, paused scenarios, and scenarios switched off (by a person or by
// Make after repeated errors).
export async function buildDailyDigest(): Promise<CheckResult> {
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60_000;
  const LOG_LIMIT = 50; // Make's maximum page size

  const monitored = (await getScenarios()).filter(isMonitored);
  const active = monitored.filter((s) => s.isActive);
  const inactive = monitored.filter((s) => !s.isActive);

  const failing: string[] = [];
  const backingOff: string[] = [];
  const switchedOff: string[] = [];
  const unreachable: string[] = [];
  let totalRuns = 0;
  let totalFailed = 0;
  let runCountCapped = false;

  for (const s of active) {
    try {
      const logs = await getScenarioLogHistory(s.id, LOG_LIMIT);
      const recent = since(logs, dayAgo);
      const runs = recent.filter((l) => l.status !== undefined);
      const failed = runs.filter(isFailedRun);
      const capped = logs.length === LOG_LIMIT && recent.length === logs.length;
      runCountCapped ||= capped;
      totalRuns += runs.length;
      totalFailed += failed.length;

      if (failed.length > 0) {
        const latest = failed[0];
        failing.push(
          `• ${link(s.name, scenarioUrl(s))} — ${failed.length} of ${runs.length}${capped ? "+" : ""} runs failed · latest ${when(latest.timestamp)}: ${describeError(latest)}`,
        );
      }
      if (recent.some((l) => l.type === "backoff")) {
        backingOff.push(`• ${link(s.name, scenarioUrl(s))}`);
      }
    } catch (err) {
      console.error(`Digest could not read logs for scenario ${s.id}:`, err);
      unreachable.push(s.name);
    }
  }

  // Only the latest event matters here: was it switched off in the last day?
  // Paced so this pass over every inactive scenario stays well under Make's
  // per-minute rate limit.
  for (const s of inactive) {
    try {
      const [latest] = await getScenarioLogHistory(s.id, 1);
      const recent = !!latest && Date.parse(latest.timestamp) >= dayAgo;
      if (recent && latest.type === "stop") {
        const by = latest.authorName ? `by ${latest.authorName}` : "with no user recorded — likely Make, after repeated errors";
        switchedOff.push(`• ${link(s.name, scenarioUrl(s))} — ${when(latest.timestamp)}, ${by}`);
      } else if (recent && latest.type === "warning" && s.isinvalid) {
        const reason = latest.detail?.reason ? `: ${latest.detail.reason}` : "";
        switchedOff.push(`• ${link(s.name, scenarioUrl(s))} — ${when(latest.timestamp)}, by Make after a failed run${reason}`);
      }
    } catch (err) {
      console.error(`Digest could not read logs for scenario ${s.id}:`, err);
      unreachable.push(s.name);
    }
    await sleep(1000);
  }

  const overdue = active
    .filter((s) => minutesOverdue(s, now) !== null)
    .map((s) => `• ${link(s.name, scenarioUrl(s))} — next run was due ${when(s.nextExec!)}`);
  const queued = monitored
    .filter((s) => s.dlqCount > 0)
    .map((s) => `• ${link(s.name, scenarioUrl(s))} — ${plural(s.dlqCount, "incomplete execution")} waiting`);
  const paused = monitored.filter((s) => s.isPaused).map((s) => `• ${link(s.name, scenarioUrl(s))}`);

  const sections: Array<[string, string[]]> = [
    ["🔴 Failing in the last 24h", failing],
    ["⏰ Stuck — scheduled run is overdue", overdue],
    ["📥 Incomplete executions waiting to be resolved", queued],
    ["🟠 Make backing off retries", backingOff],
    ["⏸️ Paused", paused],
    ["⏹️ Switched off in the last 24h", switchedOff],
    ["⚠️ Couldn't check (Make API error)", unreachable.map((name) => `• ${name}`)],
  ];
  const problems = sections.filter(([, lines]) => lines.length > 0);

  const message = [
    `**Make.com daily health** · ${when(new Date(now).toISOString(), "f")}`,
    `${plural(active.length, "active scenario")} · ${totalRuns}${runCountCapped ? "+" : ""} runs in the last 24h · ${totalFailed} failed`,
    ...(problems.length > 0
      ? problems.flatMap(([title, lines]) => ["", `**${title}**`, ...lines])
      : ["", "✅ No failures, stuck scenarios or queued executions."]),
  ].join("\n");

  return {
    message,
    summary: {
      active: active.length,
      totalRuns,
      totalFailed,
      failing: failing.length,
      overdue: overdue.length,
      queued: queued.length,
      backingOff: backingOff.length,
      paused: paused.length,
      switchedOff: switchedOff.length,
      unreachable,
    },
  };
}
