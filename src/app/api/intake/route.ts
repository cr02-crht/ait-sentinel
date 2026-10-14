import { NextRequest, NextResponse } from "next/server";
import { sendChannelMessage } from "@/lib/discord";
import { draftAutomationSpec } from "@/lib/automation-draft";

export type AutomationIntakeInput = {
  requesterName: string;
  requesterEmail: string;
  priority: "low" | "medium" | "high" | "critical";
  businessGoal: string;
};

export type AutomationRequestPayload = AutomationIntakeInput & {
  title: string;
  department?: string;
  triggerType?: string;
  triggerDetails?: string;
  targetApps?: string[];
  frequency?: string;
  workflowSteps?: string;
  dataFields?: string;
  alertDestination?: string;
};

export async function POST(req: NextRequest) {
  try {
    const input: AutomationIntakeInput = await req.json();

    if (!input.requesterName || !input.requesterEmail || !input.businessGoal) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: requesterName, requesterEmail, and businessGoal are required.",
        },
        { status: 400 },
      );
    }

    const goal = input.businessGoal.trim();
    const fallbackTitle = goal.length > 60 ? `${goal.slice(0, 60).trim()}…` : goal;

    // Structure the plain-language request into a technical spec for whoever
    // triages it — the requester never sees or edits this. If the AI call
    // fails, submission still succeeds with just the fallback title so
    // intake never blocks on an upstream outage.
    let draft: Awaited<ReturnType<typeof draftAutomationSpec>> | null = null;
    try {
      draft = await draftAutomationSpec(goal);
    } catch (err) {
      console.error("AI structuring failed during intake; continuing with a bare request:", err);
    }

    const payload: AutomationRequestPayload = {
      ...input,
      title: draft?.title || fallbackTitle,
      department: draft?.department,
      triggerType: draft?.triggerType,
      triggerDetails: draft?.triggerDetails,
      targetApps: draft?.targetApps,
      frequency: draft?.frequency,
      workflowSteps: draft?.workflowSteps,
      dataFields: draft?.dataFields,
      alertDestination: draft?.alertDestination,
    };

    const requestId = `REQ-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const timestamp = new Date().toISOString();

    // Optionally notify Discord alert channel if configured
    const channelId = process.env.DISCORD_ALERT_CHANNEL_ID;
    if (channelId && process.env.DISCORD_BOT_TOKEN) {
      try {
        const priorityEmoji =
          payload.priority === "critical"
            ? "🚨"
            : payload.priority === "high"
              ? "🔴"
              : payload.priority === "medium"
                ? "🟡"
                : "🟢";

        // Same wording the requester saw on the form.
        const priorityLabel = {
          low: "Low",
          medium: "Normal",
          high: "High",
          critical: "Urgent",
        }[payload.priority];

        // Only what the requester actually typed goes in the top block. The
        // AI read is a triage aid and is labelled as such, so nobody mistakes
        // a guessed trigger or app list for something the requester asked for.
        const aiLines = [
          payload.triggerType &&
            `Trigger: ${payload.triggerType}${payload.triggerDetails ? ` (${payload.triggerDetails})` : ""}`,
          payload.targetApps?.length && `Apps: ${payload.targetApps.join(", ")}`,
          payload.frequency && `Frequency: ${payload.frequency}`,
        ].filter(Boolean);

        const discordMessage = [
          `📥 **New Automation Request [${requestId}]** — ${payload.title}`,
          `**From:** ${payload.requesterName} (${payload.requesterEmail})`,
          `**Urgency:** ${priorityEmoji} ${priorityLabel}`,
          `**What they want automated:**`,
          `> ${payload.businessGoal.slice(0, 1200).replace(/\n/g, "\n> ")}${payload.businessGoal.length > 1200 ? "…" : ""}`,
          ...(aiLines.length
            ? ["", `-# 🤖 AI first read (not provided by requester; confirm before building)`, ...aiLines.map((l) => `-# ${l}`)]
            : []),
        ].join("\n");

        await sendChannelMessage(channelId, discordMessage);
      } catch (discordErr) {
        console.error(
          "Failed to send Discord alert for new intake request:",
          discordErr,
        );
        // Do not fail the user's request if Discord delivery fails
      }
    }

    return NextResponse.json({
      success: true,
      requestId,
      timestamp,
      message: "Automation request successfully submitted.",
      data: payload,
    });
  } catch (err) {
    console.error("Error processing intake submission:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}
