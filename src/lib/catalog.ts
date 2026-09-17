import { scenarioStatus, type Scenario, type ScenarioFolder, type ScenarioStatus } from "./make";

export type StatusFilter = "all" | ScenarioStatus;

const STATUS_FILTERS: StatusFilter[] = ["all", "active", "paused", "error", "inactive"];

export function parseStatusFilter(value: string | undefined): StatusFilter {
  return value && (STATUS_FILTERS as string[]).includes(value) ? (value as StatusFilter) : "all";
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
  folderId: number | null
): Scenario[] {
  return scenarios.filter((s) => {
    const matchesQuery = q ? s.name.toLowerCase().includes(q.toLowerCase()) : true;
    const matchesStatus = status === "all" ? true : scenarioStatus(s) === status;
    const matchesFolder = folderId == null ? true : s.folderId === folderId;
    return matchesQuery && matchesStatus && matchesFolder;
  });
}

export function catalogQueryString(q: string, status: StatusFilter, folderId: number | null): string {
  const sp = new URLSearchParams();
  if (q) sp.set("q", q);
  if (status !== "all") sp.set("status", status);
  if (folderId != null) sp.set("folder", String(folderId));
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
