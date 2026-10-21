import { unstable_cache } from "next/cache";
import { getScenarioBlueprint, type Scenario } from "./make";
import type { DependencyKind } from "./dependencies";

// Which kinds of outside service each scenario uses, for the catalog list.
// Building this means one blueprint call per scenario, against a Make rate
// limit (~60/min) shared with the monitor and the digest. So each result is
// cached keyed on the scenario's lastEdit: it is fetched once and again only
// after someone edits the scenario in Make.

export type ScenarioUsage = { ai: boolean; api: boolean };

// "pending" = not scanned yet: this request's budget ran out before reaching it.
export type UsageIndex = Map<number, ScenarioUsage | "pending">;

// Cache misses fetched per page load. A cold cache fills over a few loads
// instead of one load firing 85 calls and running into the rate limit.
const FETCH_BUDGET_PER_REQUEST = 25;
const CONCURRENCY = 5;

class BudgetExhausted extends Error {}

export async function getUsageIndex(scenarios: Scenario[]): Promise<UsageIndex> {
  const index: UsageIndex = new Map();
  let budget = FETCH_BUDGET_PER_REQUEST;

  const lookup = (s: Scenario) =>
    unstable_cache(
      async (): Promise<ScenarioUsage> => {
        // Only runs on a cache miss. Throwing keeps the miss uncached.
        if (budget <= 0) throw new BudgetExhausted();
        budget--;
        const { dependencies } = await getScenarioBlueprint(s.id);
        const has = (kind: DependencyKind) => dependencies.some((d) => d.kind === kind);
        return { ai: has("ai"), api: has("api") };
      },
      ["scenario-usage", String(s.id), s.lastEdit],
    )();

  const queue = [...scenarios];
  async function worker() {
    for (let s = queue.shift(); s; s = queue.shift()) {
      try {
        index.set(s.id, await lookup(s));
      } catch {
        // Over budget, or the blueprint call failed: try again next load.
        index.set(s.id, "pending");
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  return index;
}
