import Link from "next/link";
import { getScenarioFolders, getScenarios, scenarioStatus, type Scenario, type ScenarioFolder } from "@/lib/make";
import { groupScenariosByFolder } from "@/lib/catalog";
import { NotionSyncButtons } from "../notion-sync-buttons";

export default async function CatalogNotion() {
  let scenarios: Scenario[] = [];
  let folders: ScenarioFolder[] = [];
  let error: string | null = null;

  try {
    [scenarios, folders] = await Promise.all([getScenarios(), getScenarioFolders()]);
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load scenarios from Make.";
  }

  const groups = groupScenariosByFolder(scenarios, folders);

  return (
    <div className="flex-1 max-w-3xl w-full mx-auto px-6 py-12">
      <div className="mb-2">
        <Link href="/catalog" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Back to catalog
        </Link>
      </div>

      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Catalog → Notion</h1>
          <p className="text-sm text-muted-foreground mt-1">
            This is exactly what gets pushed to the &quot;Automation Catalog&quot; page in Notion — always the
            full, unfiltered list from Make.com.
          </p>
        </div>
        <NotionSyncButtons />
      </div>

      {error && (
        <p className="mb-8 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Couldn&apos;t load Make.com scenarios: {error}
        </p>
      )}

      {!error &&
        groups.map((group) => (
          <section key={group.id ?? "uncategorized"} className="mb-8">
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
