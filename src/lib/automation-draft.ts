import { google } from "@ai-sdk/google";
import { generateText } from "ai";

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
}`;

export async function draftAutomationSpec(
  prompt: string,
): Promise<AutomationDraftSpec> {
  const { text } = await generateText({
    model: google("gemini-3.1-flash-lite-preview"),
    system: SYSTEM_PROMPT,
    prompt: `Automation Idea/Requirement:\n${prompt}`,
  });

  const cleanedText = text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  return JSON.parse(cleanedText) as AutomationDraftSpec;
}
