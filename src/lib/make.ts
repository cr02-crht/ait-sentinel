import { scenarioDependencies, type BlueprintModule, type Dependency } from "./dependencies";

const MAKE_ZONE = process.env.MAKE_ZONE;
const MAKE_API_TOKEN = process.env.MAKE_API_TOKEN;

function zone() {
  if (!MAKE_ZONE) throw new Error('MAKE_ZONE is not set (e.g. "eu1", "us1" — check the subdomain you use to log into Make)');
  return MAKE_ZONE;
}

function baseUrl() {
  return `https://${zone()}.make.com/api/v2`;
}

function headers() {
  if (!MAKE_API_TOKEN) throw new Error("MAKE_API_TOKEN is not set");
  return { Authorization: `Token ${MAKE_API_TOKEN}` };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Make rate-limits per organization (~60 requests/minute on lower plans), and
// the monitor, the digest and the catalog all share that budget. A rate-limited
// call waits and retries a couple of times instead of failing outright.
const RATE_LIMIT_RETRIES = 2;

async function makeGet<T>(path: string, errorContext = ""): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${baseUrl()}${path}`, { headers: headers(), cache: "no-store" });
    if (res.ok) return (await res.json()) as T;

    const body = await res.text();
    const rateLimited = res.status === 429 || /requests limit/i.test(body);
    if (rateLimited && attempt < RATE_LIMIT_RETRIES) {
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep((retryAfter > 0 ? Math.min(retryAfter, 30) : 10) * 1000);
      continue;
    }
    throw new Error(`Make API error${errorContext}: ${res.status} ${body}`);
  }
}

export type Scenario = {
  id: number;
  teamId: number;
  name: string;
  description: string;
  isActive: boolean;
  isPaused: boolean;
  // Set when Make switched the scenario off itself after an error. Make does
  // this straight away when a run fails with no error handler.
  isinvalid: boolean;
  lastEdit: string;
  nextExec: string | null;
  dlqCount: number;
  folderId: number | null;
  scheduling: { type: string };
};

export type ScenarioStatus = "active" | "paused" | "error" | "inactive";

export function scenarioStatus(s: Scenario): ScenarioStatus {
  if (s.isPaused) return "paused";
  if (s.dlqCount > 0) return "error";
  if (s.isActive) return "active";
  return "inactive";
}

// Links into the Make web UI, for alerts.
export function scenarioUrl(s: Pick<Scenario, "id" | "teamId">) {
  return `https://${zone()}.make.com/${s.teamId}/scenarios/${s.id}/edit`;
}

export function runUrl(s: Pick<Scenario, "id" | "teamId">, log: Pick<ScenarioLog, "id">) {
  return `https://${zone()}.make.com/${s.teamId}/scenarios/${s.id}/logs/${log.id}`;
}

export async function getScenarios(): Promise<Scenario[]> {
  const teamId = process.env.MAKE_TEAM_ID;
  if (!teamId) throw new Error("MAKE_TEAM_ID is not set");

  const data = await makeGet<{ scenarios?: Scenario[] }>(`/scenarios?teamId=${teamId}`);
  return data.scenarios ?? [];
}

export type ScenarioFolder = {
  id: number;
  name: string;
  parentId: number | null;
  scenariosTotal: number;
};

export async function getScenarioFolders(): Promise<ScenarioFolder[]> {
  const teamId = process.env.MAKE_TEAM_ID;
  if (!teamId) throw new Error("MAKE_TEAM_ID is not set");

  const data = await makeGet<{ scenariosFolders?: ScenarioFolder[] }>(`/scenarios-folders?teamId=${teamId}`);
  return data.scenariosFolders ?? [];
}

export async function getScenario(scenarioId: number): Promise<Scenario> {
  const data = await makeGet<{ scenario: Scenario }>(`/scenarios/${scenarioId}`, ` for scenario ${scenarioId}`);
  return data.scenario;
}

export type ScenarioLog = {
  imtId: string;
  id: string;
  // "auto"/"manual" are runs. "stop" means the scenario was switched off
  // (authorName says by whom; empty when Make did it itself) and "backoff"
  // means Make is delaying the next attempt after errors. When Make switches a
  // scenario off after a failed run it logs "warning" instead of "stop", with
  // the reason in detail. Only runs carry a status or an error.
  type: "auto" | "manual" | "stop" | "backoff" | (string & {});
  status?: 1 | 2 | 3; // 1 success, 2 warning, 3 error
  timestamp: string;
  authorName?: string | null;
  detail?: { reason?: string };
  error?: { name: string; message: string; causeModule?: { name: string; appName: string } };
};

export async function getScenarioLogHistory(scenarioId: number, limit = 25): Promise<ScenarioLog[]> {
  const data = await makeGet<{ scenarioLogs?: ScenarioLog[] }>(
    `/scenarios/${scenarioId}/logs?pg[limit]=${limit}`,
    ` for scenario ${scenarioId}`,
  );
  return data.scenarioLogs ?? [];
}

export type BlueprintStep = {
  id: number;
  module: string;
};

export async function getScenarioBlueprint(
  scenarioId: number,
): Promise<{ name?: string; steps: BlueprintStep[]; dependencies: Dependency[] }> {
  const data = await makeGet<{ response?: { blueprint?: { name?: string; flow?: BlueprintModule[] } } }>(
    `/scenarios/${scenarioId}/blueprint?draft=false`,
    ` for scenario ${scenarioId}`,
  );
  const flow = data?.response?.blueprint?.flow ?? [];
  return {
    name: data?.response?.blueprint?.name,
    steps: flow.map((step) => ({
      id: step.id,
      module: step.module ?? "unknown",
    })),
    dependencies: scenarioDependencies(flow),
  };
}
