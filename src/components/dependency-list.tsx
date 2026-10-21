import type { Dependency, DependencyKind } from "@/lib/dependencies";
import type { ScenarioUsage } from "@/lib/dependency-index";

const GROUPS: { kind: DependencyKind; title: string; hint: string; chip: string }[] = [
  {
    kind: "ai",
    title: "AI / LLM",
    hint: "Calls a language model or AI agent. Usage is billed per request by the provider.",
    chip: "bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 ring-violet-600/20",
  },
  {
    kind: "api",
    title: "Custom API calls",
    hint: "Raw HTTP requests and incoming webhooks. Breaks if the endpoint or its credentials change.",
    chip: "bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 ring-amber-600/20",
  },
  {
    kind: "app",
    title: "Connected apps",
    hint: "Third-party apps reached through a Make connection.",
    chip: "bg-muted text-foreground ring-border",
  },
];

function humanize(name: string) {
  if (name.includes(".") || name.includes(" ")) return name;
  return name
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function DependencyList({ dependencies }: { dependencies: Dependency[] }) {
  if (dependencies.length === 0) {
    return <p className="text-muted-foreground text-sm">Only Make&apos;s built-in tools; no outside services.</p>;
  }

  return (
    <div className="space-y-5 rounded-lg border border-border bg-card p-6">
      {GROUPS.map(({ kind, title, hint, chip }) => {
        const deps = dependencies.filter((d) => d.kind === kind);
        return (
          <div key={kind}>
            <div className="flex items-baseline gap-2">
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
              <span className="text-xs text-muted-foreground">{deps.length > 0 ? hint : "None"}</span>
            </div>
            {deps.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2">
                {deps.map((d) => (
                  <li
                    key={d.name}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${chip}`}
                  >
                    {humanize(d.name)}
                    {d.details.length > 0 && <span className="opacity-70">· {d.details.join(", ")}</span>}
                    {d.stepCount > 1 && <span className="opacity-70">×{d.stepCount}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function AiBadge() {
  return (
    <span className="inline-flex items-center rounded-md bg-violet-50 dark:bg-violet-950/50 px-2 py-1 text-xs font-medium text-violet-700 dark:text-violet-300 ring-1 ring-inset ring-violet-600/20">
      Uses AI
    </span>
  );
}

export function UsageChips({ usage }: { usage: ScenarioUsage | "pending" | undefined }) {
  if (!usage || usage === "pending" || (!usage.ai && !usage.api)) return null;
  return (
    <>
      {usage.ai && (
        <span className="inline-flex items-center rounded-md bg-violet-50 dark:bg-violet-950/50 px-2 py-1 text-xs font-medium text-violet-700 dark:text-violet-300 ring-1 ring-inset ring-violet-600/20">
          AI
        </span>
      )}
      {usage.api && (
        <span className="inline-flex items-center rounded-md bg-amber-50 dark:bg-amber-950/50 px-2 py-1 text-xs font-medium text-amber-800 dark:text-amber-300 ring-1 ring-inset ring-amber-600/20">
          API
        </span>
      )}
    </>
  );
}
