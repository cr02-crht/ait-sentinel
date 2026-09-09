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

        const discordMessage = [
          `📥 **New Automation Request Submitted [${requestId}]**`,
          `**Title:** ${payload.title}`,
          `**Priority:** ${priorityEmoji} ${payload.priority.toUpperCase()}`,
          `**Requester:** ${payload.requesterName} (${payload.requesterEmail}) - *${payload.department || "General"}*`,
          `**Trigger:** ${payload.triggerType || "Not specified"}${payload.triggerDetails ? ` (${payload.triggerDetails})` : ""}`,
          `**Targets:** ${payload.targetApps?.length ? payload.targetApps.join(", ") : "Not specified"}`,
          `**Frequency:** ${payload.frequency || "Not specified"}`,
          `**Goal:** ${payload.businessGoal.slice(0, 300)}${payload.businessGoal.length > 300 ? "..." : ""}`,
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
