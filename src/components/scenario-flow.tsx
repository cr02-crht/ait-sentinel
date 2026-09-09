import { ChevronRight } from "lucide-react";
import type { BlueprintStep } from "@/lib/make";

const COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-indigo-500",
  "bg-teal-500",
];

function colorFor(app: string) {
  let hash = 0;
  for (const ch of app) hash = (hash * 31 + ch.charCodeAt(0)) % COLORS.length;
  return COLORS[hash];
}

function humanizeApp(app: string) {
  return app
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function parseModule(module: string) {
  const [rawApp, rawOp] = module.split(":");
  const app = rawApp ?? module;
  const operation = (rawOp ?? "")
    .replace(/^Action/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim();
  return {
    app,
    operation: operation ? operation.charAt(0).toUpperCase() + operation.slice(1) : "Step",
  };
}

export function ScenarioFlow({ steps }: { steps: BlueprintStep[] }) {
  if (steps.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-6">
      <div className="flex items-start gap-1 min-w-max px-6">
        {steps.map((step, i) => {
          const { app, operation } = parseModule(step.module);
          return (
            <div key={step.id} className="flex items-start gap-1">
              <div className="flex flex-col items-center w-28 text-center">
                <div
                  className={`h-14 w-14 rounded-full ${colorFor(app)} flex items-center justify-center text-white font-semibold text-lg shadow-sm`}
                >
                  {humanizeApp(app).charAt(0)}
                </div>
                <span className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-100 leading-tight">
                  {humanizeApp(app)}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 leading-tight">{operation}</span>
              </div>
              {i < steps.length - 1 && (
                <ChevronRight className="h-4 w-4 text-zinc-300 dark:text-zinc-700 shrink-0 mt-6" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
