const MAKE_ZONE = process.env.MAKE_ZONE;
const MAKE_API_TOKEN = process.env.MAKE_API_TOKEN;

function baseUrl() {
  if (!MAKE_ZONE) throw new Error('MAKE_ZONE is not set (e.g. "eu1", "us1" — check the subdomain you use to log into Make)');
  return `https://${MAKE_ZONE}.make.com/api/v2`;
}

function headers() {
  if (!MAKE_API_TOKEN) throw new Error("MAKE_API_TOKEN is not set");
  return { Authorization: `Token ${MAKE_API_TOKEN}` };
}

export type Scenario = {
  id: number;
  name: string;
  isActive: boolean;
  isPaused: boolean;
  lastEdit: string;
  nextExec: string | null;
  dlqCount: number;
};

export type ScenarioStatus = "active" | "paused" | "error" | "inactive";

export function scenarioStatus(s: Scenario): ScenarioStatus {
  if (s.isPaused) return "paused";
  if (s.dlqCount > 0) return "error";
  if (s.isActive) return "active";
  return "inactive";
}

export async function getScenarios(): Promise<Scenario[]> {
  const teamId = process.env.MAKE_TEAM_ID;
  if (!teamId) throw new Error("MAKE_TEAM_ID is not set");

  const res = await fetch(`${baseUrl()}/scenarios?teamId=${teamId}`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Make API error: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return (data.scenarios ?? []) as Scenario[];
}

export async function getScenario(scenarioId: number): Promise<Scenario> {
  const res = await fetch(`${baseUrl()}/scenarios/${scenarioId}`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Make API error for scenario ${scenarioId}: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.scenario as Scenario;
}

export type ScenarioLog = {
  imtId: number;
  status: 1 | 2 | 3; // 1 success, 2 warning, 3 error
  timestamp: string;
  type: string;
};

export async function getScenarioLogHistory(scenarioId: number, limit = 25): Promise<ScenarioLog[]> {
  const res = await fetch(`${baseUrl()}/scenarios/${scenarioId}/logs?pg[limit]=${limit}`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Make API error for scenario ${scenarioId}: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return (data.scenarioLogs ?? []) as ScenarioLog[];
}

export async function getRecentScenarioLogs(scenarioId: number, sinceMinutes = 15): Promise<ScenarioLog[]> {
  const logs = await getScenarioLogHistory(scenarioId, 25);
  const cutoff = Date.now() - sinceMinutes * 60_000;
  return logs.filter((log) => new Date(log.timestamp).getTime() >= cutoff);
}

export type BlueprintStep = {
  id: number;
  module: string;
};

export async function getScenarioBlueprint(scenarioId: number): Promise<{ name?: string; steps: BlueprintStep[] }> {
  const res = await fetch(`${baseUrl()}/scenarios/${scenarioId}/blueprint?draft=false`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Make API error for scenario ${scenarioId}: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const flow = data?.response?.blueprint?.flow ?? [];
  return {
    name: data?.response?.blueprint?.name,
    steps: (flow as Array<{ id: number; module?: string }>).map((step) => ({
      id: step.id,
      module: step.module ?? "unknown",
    })),
  };
}
