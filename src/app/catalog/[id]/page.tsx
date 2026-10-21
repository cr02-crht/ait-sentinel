import Link from "next/link";
import { getScenario, getScenarioBlueprint, getScenarioLogHistory, type ScenarioLog } from "@/lib/make";
import { StatusBadge } from "@/components/status-badge";
import { ScenarioFlow } from "@/components/scenario-flow";

function LogStatus({ log }: { log: ScenarioLog }) {
  // Lifecycle events ("stop", "backoff") are mixed in with runs and have no status.
  const { color, label } =
    log.type === "stop"
      ? { color: "bg-muted-foreground", label: log.authorName ? `Switched off by ${log.authorName}` : "Switched off" }
      : log.type === "backoff"
        ? { color: "bg-amber-500", label: "Retry backoff" }
        : log.status === 3
          ? { color: "bg-red-500", label: "Error" }
          : log.status === 2
            ? { color: "bg-amber-500", label: "Warning" }
            : { color: "bg-green-500", label: "Success" };
  return (
    <span className="inline-flex items-center gap-1.5 text-foreground">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

export default async function ScenarioDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scenarioId = Number(id);

  let scenario: Awaited<ReturnType<typeof getScenario>> | null = null;
  let blueprint: Awaited<ReturnType<typeof getScenarioBlueprint>> | null = null;
  let logs: Awaited<ReturnType<typeof getScenarioLogHistory>> = [];
  let error: string | null = null;

  try {
    [scenario, blueprint, logs] = await Promise.all([
      getScenario(scenarioId),
      getScenarioBlueprint(scenarioId),
      getScenarioLogHistory(scenarioId),
    ]);
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load this scenario from Make.";
  }

  return (
    <div className="flex-1 max-w-5xl w-full mx-auto px-6 py-16">
      <Link href="/catalog" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
        ← Back to catalog
      </Link>

      {error && (
        <p className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Couldn&apos;t load this scenario: {error}
        </p>
      )}

      {scenario && (
        <>
          <div className="flex items-start justify-between gap-4 mt-4 mb-2">
            <h1 className="text-4xl font-bold text-foreground">{scenario.name}</h1>
            <StatusBadge isActive={scenario.isActive} isPaused={scenario.isPaused} dlqCount={scenario.dlqCount} />
          </div>
          <p className="text-muted-foreground mb-10 text-sm">
            Last edited {new Date(scenario.lastEdit).toLocaleString()}
            {scenario.nextExec && <> · Next run {new Date(scenario.nextExec).toLocaleString()}</>}
          </p>

          <section className="mb-10">
            <h2 className="text-lg font-semibold mb-4 text-foreground">Steps</h2>
            {blueprint && blueprint.steps.length > 0 ? (
              <ScenarioFlow steps={blueprint.steps} />
            ) : (
              <p className="text-muted-foreground text-sm">Structure details unavailable.</p>
            )}
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-4 text-foreground">Recent runs</h2>
            {logs.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-border bg-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="px-4 py-2 font-medium">When</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.imtId} className="border-b border-border/60 last:border-0">
                        <td className="px-4 py-2 text-foreground">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-4 py-2">
                          <LogStatus log={log} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No recent runs.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
