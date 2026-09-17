import Link from "next/link";
import { getScenarioFolders, getScenarios, type Scenario, type ScenarioFolder } from "@/lib/make";
import { catalogQueryString, filterScenarios, parseFolderFilter, parseStatusFilter, type StatusFilter } from "@/lib/catalog";
import { StatusBadge } from "@/components/status-badge";

const PAGE_SIZE = 12;

export default async function Catalog({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const status: StatusFilter = parseStatusFilter(typeof params.status === "string" ? params.status : undefined);
  const folderId = parseFolderFilter(typeof params.folder === "string" ? params.folder : undefined);
  const requestedPage = Number(params.page);

  let scenarios: Scenario[] = [];
  let folders: ScenarioFolder[] = [];
  let error: string | null = null;

  try {
    [scenarios, folders] = await Promise.all([getScenarios(), getScenarioFolders()]);
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load scenarios from Make.";
  }

  const folderById = new Map(folders.map((f) => [f.id, f]));
  const sortedFolders = [...folders].sort((a, b) => a.name.localeCompare(b.name));

  const filtered = filterScenarios(scenarios, q, status, folderId);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1), totalPages);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const filterQuery = catalogQueryString(q, status, folderId);
  const printHref = filterQuery ? `/catalog/print?${filterQuery}` : "/catalog/print";

  function pageHref(page: number) {
    const sp = new URLSearchParams(filterQuery);
    if (page > 1) sp.set("page", String(page));
    const s = sp.toString();
    return s ? `/catalog?${s}` : "/catalog";
  }

  return (
    <div className="flex-1 max-w-5xl w-full mx-auto px-6 py-16">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Automation Catalog</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live from Make.com — every automation currently built for the team.
          </p>
        </div>
        <Link
          href={printHref}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:border-ring/50 transition-colors"
        >
          Print / Save as PDF
        </Link>
      </div>

      <form action="/catalog" className="mb-8 flex flex-wrap gap-3">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search scenarios..."
          className="flex-1 min-w-50 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
        />
        <select
          name="status"
          defaultValue={status}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="error">Errors</option>
          <option value="inactive">Inactive</option>
        </select>
        <select
          name="folder"
          defaultValue={folderId != null ? String(folderId) : ""}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
        >
          <option value="">All folders</option>
          {sortedFolders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name} ({f.scenariosTotal})
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors"
        >
          Filter
        </button>
        {(q || status !== "all" || folderId != null) && (
          <Link
            href="/catalog"
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear
          </Link>
        )}
      </form>

      {error && (
        <p className="mb-8 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Couldn&apos;t load Make.com scenarios: {error}
        </p>
      )}

      {!error && scenarios.length === 0 && <p className="text-muted-foreground">No scenarios found for this team.</p>}

      {!error && scenarios.length > 0 && filtered.length === 0 && (
        <p className="text-muted-foreground">No scenarios match your filters.</p>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {paged.map((s) => (
          <Link
            key={s.id}
            href={`/catalog/${s.id}`}
            className="block p-6 bg-card rounded-xl shadow-sm border border-border hover:border-ring/50 transition-colors"
          >
            <h2 className="text-xl font-semibold mb-2 text-foreground">{s.name}</h2>
            {s.folderId != null && folderById.has(s.folderId) && (
              <p className="text-xs text-muted-foreground/80 mb-2 uppercase tracking-wide">
                {folderById.get(s.folderId)!.name}
              </p>
            )}
            <p className="text-muted-foreground mb-1 text-sm">
              Last edited {new Date(s.lastEdit).toLocaleDateString()}
            </p>
            {s.nextExec && (
              <p className="text-muted-foreground mb-4 text-sm">
                Next run {new Date(s.nextExec).toLocaleString()}
              </p>
            )}
            <StatusBadge isActive={s.isActive} isPaused={s.isPaused} dlqCount={s.dlqCount} />
          </Link>
        ))}
      </div>

      {filtered.length > 0 && totalPages > 1 && (
        <div className="mt-10 flex items-center justify-center gap-4">
          {currentPage > 1 ? (
            <Link
              href={pageHref(currentPage - 1)}
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:border-ring/50"
            >
              Previous
            </Link>
          ) : (
            <span className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground/50">
              Previous
            </span>
          )}
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          {currentPage < totalPages ? (
            <Link
              href={pageHref(currentPage + 1)}
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:border-ring/50"
            >
              Next
            </Link>
          ) : (
            <span className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground/50">
              Next
            </span>
          )}
        </div>
      )}
    </div>
  );
}
