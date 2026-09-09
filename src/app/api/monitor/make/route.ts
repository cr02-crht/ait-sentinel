import { NextRequest, NextResponse } from "next/server";
import { getRecentScenarioLogs } from "@/lib/make";
import { sendChannelMessage } from "@/lib/discord";
import { watchedScenarios } from "@/lib/watched-scenarios";

// Hit by an external scheduler (Cloud Scheduler, cron-job.org, etc.) — not user-facing.
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!process.env.MONITOR_CRON_SECRET || secret !== process.env.MONITOR_CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const channelId = process.env.DISCORD_ALERT_CHANNEL_ID;
  if (!channelId) {
    return NextResponse.json({ error: "DISCORD_ALERT_CHANNEL_ID is not set" }, { status: 500 });
  }

  const results = [];
  for (const scenario of watchedScenarios) {
    const logs = await getRecentScenarioLogs(scenario.id);
    const errors = logs.filter((log) => log.status === 3);
    if (errors.length > 0) {
      await sendChannelMessage(
        channelId,
        `Automation alert: **${scenario.name}** had ${errors.length} failed run(s) in the last 15 minutes. Check Make.com for details.`
      );
    }
    results.push({ scenario: scenario.name, checked: logs.length, errors: errors.length });
  }

  return NextResponse.json({ checked: results });
}
