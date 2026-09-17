import { getScenarioFolders, getScenarios, scenarioStatus, type Scenario, type ScenarioFolder } from "@/lib/make";
import { filterScenarios, groupScenariosByFolder, parseFolderFilter, parseStatusFilter } from "@/lib/catalog";
import { PrintButton } from "./print-button";

export default async function CatalogPrint({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const status = parseStatusFilter(typeof params.status === "string" ? params.status : undefined);
  const folderId = parseFolderFilter(typeof params.folder === "string" ? params.folder : undefined);

  let scenarios: Scenario[] = [];
  let folders: ScenarioFolder[] = [];
  let error: string | null = null;

  try {
    [scenarios, folders] = await Promise.all([getScenarios(), getScenarioFolders()]);
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load scenarios from Make.";
  }

  const filtered = filterScenarios(scenarios, q, status, folderId);
  const groups = groupScenariosByFolder(filtered, folders);
  const activeFolderName = folderId != null ? folders.find((f) => f.id === folderId)?.name : undefined;

  return (
    <div className="flex-1 max-w-3xl w-full mx-auto px-6 py-12 print:max-w-none print:p-0">
      <div className="mb-8 flex items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Automation Catalog</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Printable view — use the button to save this as a PDF.
          </p>
        </div>
        <PrintButton />
      </div>

      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold">Automation Catalog</h1>
        <p className="text-sm text-muted-foreground">
          Generated {new Date().toLocaleString()} from Make.com
          {q && ` — search "${q}"`}
          {status !== "all" && ` — status: ${status}`}
          {activeFolderName && ` — folder: ${activeFolderName}`}
        </p>
      </div>

      {error && (
        <p className="mb-8 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive print:border-0 print:bg-transparent print:p-0">
          Couldn&apos;t load Make.com scenarios: {error}
        </p>
      )}

      {!error && filtered.length === 0 && <p className="text-muted-foreground">No scenarios match this filter.</p>}

      {!error &&
        groups.map((group) => (
          <section key={group.id ?? "uncategorized"} className="mb-8 print:break-inside-avoid">
            <h2 className="text-lg font-semibold text-foreground mb-2 pb-1 border-b border-border">
              {group.name} <span className="text-muted-foreground font-normal">({group.scenarios.length})</span>
            </h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 pr-4 font-semibold text-foreground">Name</th>
                  <th className="py-2 pr-4 font-semibold text-foreground">Status</th>
                  <th className="py-2 pr-4 font-semibold text-foreground">Last edited</th>
                  <th className="py-2 font-semibold text-foreground">Next run</th>
                </tr>
              </thead>
              <tbody>
                {group.scenarios.map((s) => (
                  <tr key={s.id} className="border-b border-border/60">
                    <td className="py-2 pr-4 text-foreground">{s.name}</td>
                    <td className="py-2 pr-4 text-muted-foreground capitalize">{scenarioStatus(s)}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{new Date(s.lastEdit).toLocaleDateString()}</td>
                    <td className="py-2 text-muted-foreground">
                      {s.nextExec ? new Date(s.nextExec).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
    </div>
  );
}
