import { createSign } from "node:crypto";
import type { ScenarioStatus } from "./make";
import type { ScenarioUsage } from "./dependency-index";

// Automations we run ourselves on Cloud Run, outside Make. Cloud Run can say
// whether a service is up and what's deployed, but not what it does, so the
// schedules, commands and endpoints are kept here by hand — update this entry
// when the bot changes.
export type CustomAutomation = {
  id: string;
  name: string;
  description: string;
  repo: string;
  // Where Cloud Run hosts it. projectId takes the project number or ID.
  projectId: string;
  region: string;
  service: string;
  url: string;
  // Path that answers 200 while the process is up.
  healthPath: string;
  usage: ScenarioUsage;
  services: string[];
  schedules: { name: string; when: string }[];
  commands: { name: string; description: string }[];
  endpoints: { method: string; path: string; description: string }[];
};

export const CUSTOM_AUTOMATIONS: CustomAutomation[] = [
  {
    id: "hr-bot",
    name: "CRHT HR Bot",
    description:
      "Discord bot for HR: new-joiner onboarding (Days 1–5), wellbeing check-ins, gratitude reminders, 360 feedback survey DMs and HR Q&A.",
    repo: "https://github.com/croissantSandwich/crht-automation-hr-bot",
    projectId: "313170002458",
    region: "asia-southeast1",
    service: "crht-automation-hr-bot",
    url: "https://crht-automation-hr-bot-313170002458.asia-southeast1.run.app",
    healthPath: "/",
    usage: { ai: true, api: true },
    services: ["Discord", "OpenAI (HR Q&A)", "Google Sheets (feedback and check-ins)"],
    schedules: [
      { name: "Onboarding Days 2–5", when: "Daily, 9am SGT" },
      { name: "Wellbeing check-in", when: "Thursday 3pm SGT, every other week" },
      { name: "Gratitude shout-out reminder", when: "Wednesday 3pm SGT, weekly" },
      { name: "360 survey reminders", when: "Monday 9am SGT, weekly" },
    ],
    commands: [
      { name: "/onboard_user @member", description: "Start onboarding (Day 1)" },
      { name: "/nextday @member", description: "Send the next onboarding day" },
      { name: "/testcheckin", description: "Send yourself a test wellbeing check-in" },
      { name: "DM: feedback: … / checkin: …", description: "Saved to Google Sheets" },
      { name: "DM: any other message", description: "Answered as an HR question via OpenAI" },
    ],
    endpoints: [
      { method: "GET", path: "/", description: "Health check" },
      { method: "POST", path: "/spark/survey-open", description: "DM employees that the 360 survey is open" },
      { method: "POST", path: "/spark/send-nominee-link", description: "DM a nominee their survey link" },
      { method: "POST", path: "/spark/send-reminder", description: "DM a survey reminder" },
    ],
  },
];

export function getCustomAutomation(id: string): CustomAutomation | undefined {
  return CUSTOM_AUTOMATIONS.find((a) => a.id === id);
}

export function consoleUrl(a: Pick<CustomAutomation, "projectId" | "region" | "service">) {
  return `https://console.cloud.google.com/run/detail/${a.region}/${a.service}/metrics?project=${a.projectId}`;
}

export type HealthCheck = {
  ok: boolean;
  // HTTP status, or null when the request never got an answer.
  httpStatus: number | null;
  ms: number;
  error?: string;
  checkedAt: string;
};

const HEALTH_TIMEOUT_MS = 10_000;

// A 200 here means the container is up and serving; for the HR bot that's the
// Flask thread, so it can't tell whether the Discord connection is healthy.
export async function checkHealth(a: Pick<CustomAutomation, "url" | "healthPath">): Promise<HealthCheck> {
  const started = Date.now();
  const checkedAt = new Date().toISOString();
  try {
    const res = await fetch(`${a.url}${a.healthPath}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    return { ok: res.ok, httpStatus: res.status, ms: Date.now() - started, checkedAt };
  } catch (err) {
    const error = err instanceof Error && err.name === "TimeoutError" ? "Timed out" : err instanceof Error ? err.message : "Request failed";
    return { ok: false, httpStatus: null, ms: Date.now() - started, error, checkedAt };
  }
}

export function automationStatus(health: HealthCheck, details?: ServiceDetails | null): ScenarioStatus {
  if (!health.ok) return "error";
  if (details && details.condition !== "CONDITION_SUCCEEDED") return "error";
  return "active";
}

// --- Cloud Run Admin API -------------------------------------------------
// Optional. Needs GCP_SERVICE_ACCOUNT_JSON: a service account key (raw JSON or
// base64) holding roles/run.viewer on each automation's project. Without it
// the catalog still shows the health check, just not deploy details.

type ServiceAccount = { client_email: string; private_key: string; token_uri?: string };

function serviceAccount(): ServiceAccount | null {
  const raw = process.env.GCP_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  const json = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  return JSON.parse(json) as ServiceAccount;
}

export function cloudRunApiConfigured() {
  return Boolean(process.env.GCP_SERVICE_ACCOUNT_JSON?.trim());
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function accessToken(sa: ServiceAccount): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;

  const tokenUri = sa.token_uri ?? "https://oauth2.googleapis.com/token";
  const now = Math.floor(Date.now() / 1000);
  const encode = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key, "base64url");

  const res = await fetch(tokenUri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Google auth error: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

export type ServiceDetails = {
  // CONDITION_SUCCEEDED when the latest revision is serving.
  condition: string;
  conditionMessage?: string;
  latestRevision: string;
  updatedAt: string;
  updatedBy?: string;
  image?: string;
  minInstances?: number;
  maxInstances?: number;
};

type RunService = {
  updateTime: string;
  lastModifier?: string;
  latestReadyRevision?: string;
  terminalCondition?: { state?: string; message?: string };
  scaling?: { minInstanceCount?: number };
  template?: { containers?: { image?: string }[]; scaling?: { minInstanceCount?: number; maxInstanceCount?: number } };
};

export async function getServiceDetails(
  a: Pick<CustomAutomation, "projectId" | "region" | "service">,
): Promise<ServiceDetails | null> {
  const sa = serviceAccount();
  if (!sa) return null;

  const token = await accessToken(sa);
  const res = await fetch(
    `https://run.googleapis.com/v2/projects/${a.projectId}/locations/${a.region}/services/${a.service}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Cloud Run API error for ${a.service}: ${res.status} ${await res.text()}`);
  const s = (await res.json()) as RunService;

  return {
    condition: s.terminalCondition?.state ?? "UNKNOWN",
    conditionMessage: s.terminalCondition?.message,
    latestRevision: s.latestReadyRevision?.split("/").pop() ?? "—",
    updatedAt: s.updateTime,
    updatedBy: s.lastModifier,
    image: s.template?.containers?.[0]?.image,
    minInstances: s.template?.scaling?.minInstanceCount ?? s.scaling?.minInstanceCount,
    maxInstances: s.template?.scaling?.maxInstanceCount,
  };
}

export type CustomAutomationState = {
  automation: CustomAutomation;
  health: HealthCheck;
  details: ServiceDetails | null;
  detailsError?: string;
  status: ScenarioStatus;
};

export async function getCustomAutomationState(a: CustomAutomation): Promise<CustomAutomationState> {
  const [health, detailsResult] = await Promise.all([
    checkHealth(a),
    getServiceDetails(a).then(
      (details) => ({ details }),
      (err: unknown) => ({ details: null, detailsError: err instanceof Error ? err.message : "Cloud Run API error" }),
    ),
  ]);
  return {
    automation: a,
    health,
    ...detailsResult,
    status: automationStatus(health, detailsResult.details),
  };
}

export function getCustomAutomationStates(): Promise<CustomAutomationState[]> {
  return Promise.all(CUSTOM_AUTOMATIONS.map(getCustomAutomationState));
}
