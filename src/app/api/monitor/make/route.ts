import { NextRequest, NextResponse } from "next/server";
import { sendLongChannelMessage } from "@/lib/discord";
import { isCronAuthorized, runFailureCheck } from "@/lib/monitor";

// Hit by an external scheduler every MONITOR_INTERVAL_MINUTES — not user-facing.
// Add ?dryRun=1 to get the alert text back without posting it to Discord.
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  const channelId = process.env.DISCORD_ALERT_CHANNEL_ID;
  if (!channelId && !dryRun) {
    return NextResponse.json({ error: "DISCORD_ALERT_CHANNEL_ID is not set" }, { status: 500 });
  }

  let result;
  try {
    result = await runFailureCheck();
  } catch (err) {
    // Not posted to Discord: this runs every few minutes, and an outage would
    // flood the channel. The scheduler sees the 502, and the daily digest
    // reports it to the channel once.
    console.error("Make monitor check failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Monitor check failed" }, { status: 502 });
  }

  if (result.message && !dryRun) {
    await sendLongChannelMessage(channelId!, result.message);
  }
  return NextResponse.json({ ...result.summary, ...(dryRun ? { message: result.message } : {}) });
}
