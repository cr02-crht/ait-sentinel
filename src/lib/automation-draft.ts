import { generateText } from "ai";
import { llmModel } from "@/lib/llm";

export type AutomationDraftSpec = {
  title?: string;
  department?: string;
  priority?: "low" | "medium" | "high" | "critical";
  triggerType?: string;
  triggerDetails?: string;
  targetApps?: string[];
  frequency?: string;
  businessGoal?: string;
  workflowSteps?: string;
  dataFields?: string;
  alertDestination?: string;
};

const SYSTEM_PROMPT = `You are an expert Automation Systems Architect.
Given a raw or casual description of an automation request, analyze it and output a valid JSON object matching the following structure (do NOT include markdown code fences, only raw JSON):
{
  "title": "Short descriptive name for the automation (e.g., Sync Stripe Disputes to Discord)",
  "department": "Engineering" | "Operations" | "Sales" | "Marketing" | "Customer Support" | "Finance" | "Product" | "Other",
  "priority": "low" | "medium" | "high" | "critical",
  "triggerType": "Webhook / API Event" | "Schedule / Cron" | "Database / CRM Event" | "Form Submission" | "Manual / Chat Trigger" | "Other",
  "triggerDetails": "Specific trigger event or service (e.g. Stripe dispute.created webhook)",
  "targetApps": ["array", "of", "apps", "e.g.", "Discord", "HubSpot", "Make.com"],
  "frequency": "Real-time (Instant)" | "Every 5-15 mins" | "Hourly" | "Daily" | "Weekly" | "On-demand",
  "businessGoal": "Clear explanation of the business objective and manual effort saved.",
  "workflowSteps": "Numbered step-by-step logic and rules.",
  "dataFields": "Key fields to process or extract (comma-separated).",
  "alertDestination": "Suggested error alert channel or email."
}

Only fill a field when the description states it or makes it unambiguous. If the requester did not name an app, a trigger, or a frequency, omit that field entirely rather than guessing — an empty field is more useful to the reviewer than a plausible invention. Never add automation platforms (e.g. Make.com, Zapier, n8n) to targetApps unless the requester named them. "title" is always required.`;

export async function draftAutomationSpec(
  prompt: string,
): Promise<AutomationDraftSpec> {
  const { text } = await generateText({
    model: llmModel,
    system: SYSTEM_PROMPT,
    prompt: `Automation Idea/Requirement:\n${prompt}`,
  });

  const cleanedText = text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  return JSON.parse(cleanedText) as AutomationDraftSpec;
}
