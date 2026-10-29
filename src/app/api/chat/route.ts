import { streamText } from "ai";
import { llmModel } from "@/lib/llm";

// Allow responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: llmModel,
    messages,
    system:
      "You are an Automation Systems Architect. Your job is to help users flesh out their automation ideas. Ask clarifying questions about triggers, actions, and credentials.",
  });

  return result.toTextStreamResponse();
}
