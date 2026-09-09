import { NextRequest, NextResponse, after } from "next/server";
import { verifyKey } from "discord-interactions";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { sendInteractionFollowup } from "@/lib/discord";
import { getScenarios, scenarioStatus } from "@/lib/make";

const DISCORD_PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY || "dummy_key";
const DISCORD_APPLICATION_ID = process.env.DISCORD_APPLICATION_ID || "";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-signature-ed25519");
  const timestamp = req.headers.get("x-signature-timestamp");

  if (!signature || !timestamp) {
    return NextResponse.json({ error: "Missing signatures" }, { status: 401 });
  }

  const rawBody = await req.text();
  const isValidRequest = await verifyKey(
    rawBody,
    signature,
    timestamp,
    DISCORD_PUBLIC_KEY,
  );

  if (!isValidRequest) {
    return NextResponse.json(
      { error: "Invalid request signature" },
      { status: 401 },
    );
  }

  const interaction = JSON.parse(rawBody);

  // Handle Discord PING validation
  if (interaction.type === 1) {
    return NextResponse.json({ type: 1 });
  }

  // Handle Slash Commands (type 2)
  if (interaction.type === 2 && interaction.data.name === "triage") {
    const options: { name: string; value: string }[] =
      interaction.data.options ?? [];
    const automation =
      options.find((o) => o.name === "automation")?.value ??
      "unspecified automation";
    const details = options.find((o) => o.name === "details")?.value ?? "";

    // Gemini can take longer than Discord's 3-second ack window, so we defer
    // now (type 5) and patch the real answer in once runTriage finishes.
    // after() keeps the serverless function alive until this completes —
    // without it, Vercel can freeze the function the instant the response
    // below is sent, killing the follow-up before it ever goes out.
    after(() => runTriage(automation, details, interaction.token));

    return NextResponse.json({ type: 5 });
  }

  if (interaction.type === 2 && interaction.data.name === "status") {
    // Same deferred-response pattern as /triage above.
    after(() => runStatus(interaction.token));

    return NextResponse.json({ type: 5 });
  }

  return NextResponse.json(
    { error: "Unknown interaction type" },
    { status: 400 },
  );
}

async function runStatus(interactionToken: string) {
  try {
    const scenarios = await getScenarios();

    if (scenarios.length === 0) {
      await sendInteractionFollowup(
        DISCORD_APPLICATION_ID,
        interactionToken,
        "No scenarios found for this Make team.",
      );
      return;
    }

    const counts = { active: 0, paused: 0, error: 0, inactive: 0 };
    for (const s of scenarios) counts[scenarioStatus(s)]++;

    const emoji = {
      active: "🟢",
      paused: "⏸️",
      error: "🔴",
      inactive: "⚪",
    } as const;
    const errored = scenarios.filter((s) => scenarioStatus(s) === "error");

    const lines = [
      `**Automation status** — ${scenarios.length} total`,
      `${emoji.active} ${counts.active} active · ${emoji.paused} ${counts.paused} paused · ${emoji.error} ${counts.error} error · ${emoji.inactive} ${counts.inactive} inactive`,
    ];

    if (errored.length > 0) {
      lines.push("", "**Failing right now:**");
      for (const s of errored.slice(0, 15)) {
        lines.push(`${emoji.error} ${s.name} — ${s.dlqCount} queued error(s)`);
      }
      if (errored.length > 15) lines.push(`…and ${errored.length - 15} more.`);
    }

    await sendInteractionFollowup(
      DISCORD_APPLICATION_ID,
      interactionToken,
      lines.join("\n"),
    );
  } catch (err) {
    await sendInteractionFollowup(
      DISCORD_APPLICATION_ID,
      interactionToken,
      `Failed to fetch automation status: ${err instanceof Error ? err.message : "unknown error"}`,
    );
  }
}

async function runTriage(
  automation: string,
  details: string,
  interactionToken: string,
) {
  try {
    const { text } = await generateText({
      model: google("gemini-3.1-flash-lite-preview"),
      system:
        "You triage broken internal automations for PDD. Given the automation's name and a description of what's wrong, respond with exactly three short lines, no preamble: " +
        "Severity (low/medium/high), Likely cause, and Summary — one sentence each.",
      prompt: `Automation: ${automation}\nReported issue: ${details}`,
    });

    await sendInteractionFollowup(
      DISCORD_APPLICATION_ID,
      interactionToken,
      text,
    );
  } catch (err) {
    await sendInteractionFollowup(
      DISCORD_APPLICATION_ID,
      interactionToken,
      `Triage failed to run: ${err instanceof Error ? err.message : "unknown error"}`,
    );
  }
}
