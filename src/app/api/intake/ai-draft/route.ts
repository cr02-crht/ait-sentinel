import { NextRequest, NextResponse } from "next/server";
import { draftAutomationSpec } from "@/lib/automation-draft";

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "A prompt is required." },
        { status: 400 },
      );
    }

    const draft = await draftAutomationSpec(prompt);
    return NextResponse.json({ success: true, draft });
  } catch (err) {
    console.error("AI Draft generation error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to generate AI draft",
      },
      { status: 500 },
    );
  }
}
