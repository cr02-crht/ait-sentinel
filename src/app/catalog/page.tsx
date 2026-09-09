import Link from "next/link";
import { getScenarios, scenarioStatus, type Scenario } from "@/lib/make";
import { StatusBadge } from "@/components/status-badge";

const PAGE_SIZE = 12;

type StatusFilter = "all" | "active" | "paused" | "error" | "inactive";

export default async function Catalog({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const statusParam = typeof params.status === "string" ? params.status : "all";
  const status: StatusFilter = ["all", "active", "paused", "error", "inactive"].includes(statusParam)
    ? (statusParam as StatusFilter)
    : "all";
  const requestedPage = Number(params.page);

  let scenarios: Scenario[] = [];
  let error: string | null = null;

  try {
    scenarios = await getScenarios();
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load scenarios from Make.";
  }

  const filtered = scenarios.filter((s) => {
    const matchesQuery = q ? s.name.toLowerCase().includes(q.toLowerCase()) : true;
    const matchesStatus = status === "all" ? true : scenarioStatus(s) === status;
    return matchesQuery && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1), totalPages);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function pageHref(page: number) {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (status !== "all") sp.set("status", status);
    if (page > 1) sp.set("page", String(page));
    const s = sp.toString();
    return s ? `/catalog?${s}` : "/catalog";
  }

  return (
    <div className="p-24 bg-zinc-50 dark:bg-zinc-950 min-h-screen">
      <h1 className="text-4xl font-bold mb-8 text-zinc-900 dark:text-zinc-50">Automation Catalog</h1>

      <form action="/catalog" className="mb-8 flex flex-wrap gap-3">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search scenarios..."
          className="flex-1 min-w-50 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:focus:ring-zinc-700"
        />
        <select
          name="status"
          defaultValue={status}
          className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:focus:ring-zinc-700"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="error">Errors</option>
          <option value="inactive">Inactive</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
        >
          Filter
        </button>
        {(q || status !== "all") && (
          <Link
            href="/catalog"
            className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            Clear
          </Link>
        )}
      </form>

      {error && (
        <p className="mb-8 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
          Couldn&apos;t load Make.com scenarios: {error}
        </p>
      )}

      {!error && scenarios.length === 0 && <p className="text-zinc-500">No scenarios found for this team.</p>}

      {!error && scenarios.length > 0 && filtered.length === 0 && (
        <p className="text-zinc-500">No scenarios match your filters.</p>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {paged.map((s) => (
          <Link
            key={s.id}
            href={`/catalog/${s.id}`}
            className="block p-6 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
          >
            <h2 className="text-xl font-semibold mb-2 text-zinc-900 dark:text-zinc-100">{s.name}</h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-1 text-sm">
              Last edited {new Date(s.lastEdit).toLocaleDateString()}
            </p>
            {s.nextExec && (
              <p className="text-zinc-600 dark:text-zinc-400 mb-4 text-sm">
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
              className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700"
            >
              Previous
            </Link>
          ) : (
            <span className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-sm text-zinc-300 dark:text-zinc-700">
              Previous
            </span>
          )}
          <span className="text-sm text-zinc-500">
            Page {currentPage} of {totalPages}
          </span>
          {currentPage < totalPages ? (
            <Link
              href={pageHref(currentPage + 1)}
              className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700"
            >
              Next
            </Link>
          ) : (
            <span className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-sm text-zinc-300 dark:text-zinc-700">
              Next
            </span>
          )}
        </div>
      )}
    </div>
  );
}
