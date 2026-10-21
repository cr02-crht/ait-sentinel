import { NextRequest, NextResponse } from "next/server";
import { sendLongChannelMessage } from "@/lib/discord";
import { buildDailyDigest, isCronAuthorized } from "@/lib/monitor";

// The digest paces its Make API calls to stay under the rate limit, so it takes
// a minute or two with ~80 scenarios.
export const maxDuration = 300;

// Hit by an external scheduler once a day — not user-facing.
// Add ?dryRun=1 to get the digest text back without posting it to Discord.
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  const channelId = process.env.DISCORD_ALERT_CHANNEL_ID;
  if (!channelId && !dryRun) {
    return NextResponse.json({ error: "DISCORD_ALERT_CHANNEL_ID is not set" }, { status: 500 });
  }

  try {
    const { message, summary } = await buildDailyDigest();
    if (message && !dryRun) await sendLongChannelMessage(channelId!, message);
    return NextResponse.json({ ...summary, ...(dryRun ? { message } : {}) });
  } catch (err) {
    // Once a day, so it's safe to post. This is also the canary for the
    // per-interval monitor, which stays quiet when the Make API itself fails.
    console.error("Make daily digest failed:", err);
    const reason = err instanceof Error ? err.message : "unknown error";
    if (!dryRun) {
      await sendLongChannelMessage(channelId!, `⚠️ **Make.com daily health** couldn't run: ${reason.slice(0, 500)}`).catch(
        (sendErr) => console.error("Also failed to report the digest failure to Discord:", sendErr),
      );
    }
    return NextResponse.json({ error: reason }, { status: 502 });
  }
}
