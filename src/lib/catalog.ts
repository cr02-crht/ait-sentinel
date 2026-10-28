import { scenarioStatus, type Scenario, type ScenarioFolder, type ScenarioStatus } from "./make";
import type { ScenarioUsage, UsageIndex } from "./dependency-index";
import type { CustomAutomationState } from "./cloud-run";

export type StatusFilter = "all" | ScenarioStatus;

const STATUS_FILTERS: StatusFilter[] = ["all", "active", "paused", "error", "inactive"];

export function parseStatusFilter(value: string | undefined): StatusFilter {
  return value && (STATUS_FILTERS as string[]).includes(value) ? (value as StatusFilter) : "all";
}

// "any" = AI or a custom API call; "none" = only connected apps and Make's own tools.
export type UsageFilter = "all" | "ai" | "api" | "any" | "none";

const USAGE_FILTERS: UsageFilter[] = ["all", "ai", "api", "any", "none"];

export function parseUsageFilter(value: string | undefined): UsageFilter {
  return value && (USAGE_FILTERS as string[]).includes(value) ? (value as UsageFilter) : "all";
}

function matchesUsage(usage: ScenarioUsage, filter: UsageFilter): boolean {
  switch (filter) {
    case "ai":
      return usage.ai;
    case "api":
      return usage.api;
    case "any":
      return usage.ai || usage.api;
    case "none":
      return !usage.ai && !usage.api;
    default:
      return true;
  }
}

export function parseFolderFilter(value: string | undefined): number | null {
  if (!value) return null;
  const id = Number(value);
  return Number.isInteger(id) ? id : null;
}

export function filterScenarios(
  scenarios: Scenario[],
  q: string,
  status: StatusFilter,
  folderId: number | null,
  usage: UsageFilter = "all",
  usageIndex?: UsageIndex
): Scenario[] {
  return scenarios.filter((s) => {
    const matchesQuery = q ? s.name.toLowerCase().includes(q.toLowerCase()) : true;
    const matchesStatus = status === "all" ? true : scenarioStatus(s) === status;
    const matchesFolder = folderId == null ? true : s.folderId === folderId;
    // Scenarios not scanned yet can't be placed, so a usage filter leaves them out.
    const scanned = usageIndex?.get(s.id);
    const matchesUsageFilter =
      usage === "all" ? true : scanned != null && scanned !== "pending" && matchesUsage(scanned, usage);
    return matchesQuery && matchesStatus && matchesFolder && matchesUsageFilter;
  });
}

// Cloud Run automations aren't in any Make folder, so a folder filter hides them.
export function filterCustomAutomations(
  states: CustomAutomationState[],
  q: string,
  status: StatusFilter,
  folderId: number | null,
  usage: UsageFilter = "all"
): CustomAutomationState[] {
  if (folderId != null) return [];
  return states.filter(({ automation, status: s }) => {
    const matchesQuery = q ? automation.name.toLowerCase().includes(q.toLowerCase()) : true;
    const matchesStatus = status === "all" ? true : s === status;
    return matchesQuery && matchesStatus && matchesUsage(automation.usage, usage);
  });
}

export function catalogQueryString(
  q: string,
  status: StatusFilter,
  folderId: number | null,
  usage: UsageFilter = "all"
): string {
  const sp = new URLSearchParams();
  if (q) sp.set("q", q);
  if (status !== "all") sp.set("status", status);
  if (folderId != null) sp.set("folder", String(folderId));
  if (usage !== "all") sp.set("uses", usage);
  return sp.toString();
}

export type FolderGroup = {
  id: number | null;
  name: string;
  scenarios: Scenario[];
};

export function groupScenariosByFolder(scenarios: Scenario[], folders: ScenarioFolder[]): FolderGroup[] {
  const folderById = new Map(folders.map((f) => [f.id, f]));
  const byFolder = new Map<number | null, Scenario[]>();

  for (const s of scenarios) {
    const key = s.folderId != null && folderById.has(s.folderId) ? s.folderId : null;
    const list = byFolder.get(key) ?? [];
    list.push(s);
    byFolder.set(key, list);
  }

  const groups: FolderGroup[] = folders
    .filter((f) => byFolder.has(f.id))
    .map((f) => ({ id: f.id, name: f.name, scenarios: byFolder.get(f.id)! }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const uncategorized = byFolder.get(null);
  if (uncategorized && uncategorized.length > 0) {
    groups.push({ id: null, name: "Uncategorized", scenarios: uncategorized });
  }

  return groups;
}
