import Link from "next/link";
import { getScenario, getScenarioBlueprint, getScenarioLogHistory } from "@/lib/make";
import { StatusBadge } from "@/components/status-badge";
import { ScenarioFlow } from "@/components/scenario-flow";

function LogStatus({ status }: { status: 1 | 2 | 3 }) {
  const color = status === 3 ? "bg-red-500" : status === 2 ? "bg-amber-500" : "bg-green-500";
  const label = status === 3 ? "Error" : status === 2 ? "Warning" : "Success";
  return (
    <span className="inline-flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
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
    <div className="p-24 bg-zinc-50 dark:bg-zinc-950 min-h-screen">
      <Link href="/catalog" className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
        ← Back to catalog
      </Link>

      {error && (
        <p className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
          Couldn&apos;t load this scenario: {error}
        </p>
      )}

      {scenario && (
        <>
          <div className="flex items-start justify-between gap-4 mt-4 mb-2">
            <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50">{scenario.name}</h1>
            <StatusBadge isActive={scenario.isActive} isPaused={scenario.isPaused} dlqCount={scenario.dlqCount} />
          </div>
          <p className="text-zinc-500 mb-10 text-sm">
            Last edited {new Date(scenario.lastEdit).toLocaleString()}
            {scenario.nextExec && <> · Next run {new Date(scenario.nextExec).toLocaleString()}</>}
          </p>

          <section className="mb-10">
            <h2 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-zinc-100">Steps</h2>
            {blueprint && blueprint.steps.length > 0 ? (
              <ScenarioFlow steps={blueprint.steps} />
            ) : (
              <p className="text-zinc-500 text-sm">Structure details unavailable.</p>
            )}
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-zinc-100">Recent runs</h2>
            {logs.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 text-left text-zinc-500">
                      <th className="px-4 py-2 font-medium">When</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.imtId} className="border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                        <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-4 py-2">
                          <LogStatus status={log.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-zinc-500 text-sm">No recent runs.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
