// Works out which outside services a Make scenario depends on, from its
// blueprint. Covers every step, including ones inside router branches and
// error handlers, which the top-level step list leaves out.

export type BlueprintModule = {
  id: number;
  module?: string;
  mapper?: Record<string, unknown> | null;
  routes?: Array<{ flow?: BlueprintModule[] }>;
  onerror?: BlueprintModule[];
};

export type DependencyKind = "ai" | "api" | "app";

export type Dependency = {
  kind: DependencyKind;
  // The app ("openai-gpt-3") or, for HTTP calls, the host ("graph.facebook.com").
  name: string;
  // Extra detail worth surfacing, such as the LLM model a step is set to.
  details: string[];
  stepCount: number;
};

// Make apps that call an LLM or an AI agent. Matched on the app part of the
// module id ("openai-gpt-3:createModelResponse" -> "openai-gpt-3").
const AI_APPS = [
  /^openai/,
  /^anthropic/,
  /^claude/,
  /^gemini/,
  /^google-gemini/,
  /^google-vertex-ai/,
  /^vertex-ai/,
  /^mistral/,
  /^perplexity/,
  /^deepseek/,
  /^groq/,
  /^cohere/,
  /^hugging-?face/,
  /^replicate/,
  /^stability-ai/,
  /^elevenlabs/,
  /^ai-agent/,
  /^make-ai/,
  /^airtop/,
];

// HTTP calls to these hosts are LLM APIs being called directly.
const AI_HOSTS = [
  /(^|\.)openai\.com$/,
  /(^|\.)anthropic\.com$/,
  /(^|\.)generativelanguage\.googleapis\.com$/,
  /(^|\.)aiplatform\.googleapis\.com$/,
  /(^|\.)openai\.azure\.com$/,
  /(^|\.)mistral\.ai$/,
  /(^|\.)perplexity\.ai$/,
  /(^|\.)deepseek\.com$/,
  /(^|\.)groq\.com$/,
  /(^|\.)cohere\.(ai|com)$/,
  /(^|\.)openrouter\.ai$/,
  /(^|\.)together\.(ai|xyz)$/,
  /(^|\.)huggingface\.co$/,
  /(^|\.)replicate\.com$/,
];

// Make's own tools (routers, variables, iterators, data stores...). They don't
// reach any outside service.
const INTERNAL_APPS = new Set([
  "builtin",
  "util",
  "json",
  "regexp",
  "xml",
  "csv",
  "datastore",
  "scenario-service",
  "placeholder",
]);

const MAKE_WEBHOOK_APPS = new Set(["gateway"]);
const HTTP_APPS = new Set(["http"]);

function walk(flow: BlueprintModule[] | undefined, visit: (m: BlueprintModule) => void) {
  for (const m of flow ?? []) {
    visit(m);
    for (const route of m.routes ?? []) walk(route.flow, visit);
    walk(m.onerror, visit);
  }
}

// Only the host, never the path or query: some scenarios carry access tokens in
// their URLs and this ends up on a page.
function hostOf(url: unknown): string {
  if (typeof url !== "string" || !url.trim()) return "unknown host";
  const match = url.trim().match(/^https?:\/\/([^/?#]+)/i);
  if (!match || match[1].includes("{{")) return "dynamic URL";
  return match[1].replace(/^[^@]*@/, "").toLowerCase();
}

export function scenarioDependencies(flow: BlueprintModule[] | undefined): Dependency[] {
  const byKey = new Map<string, Dependency>();

  function add(kind: DependencyKind, name: string, detail?: string) {
    const key = `${kind}:${name}`;
    const dep = byKey.get(key) ?? { kind, name, details: [], stepCount: 0 };
    dep.stepCount++;
    if (detail && !dep.details.includes(detail)) dep.details.push(detail);
    byKey.set(key, dep);
  }

  walk(flow, (m) => {
    const app = (m.module ?? "").split(":")[0];
    if (!app || INTERNAL_APPS.has(app)) return;

    if (HTTP_APPS.has(app)) {
      const host = hostOf(m.mapper?.url);
      add(AI_HOSTS.some((re) => re.test(host)) ? "ai" : "api", host);
      return;
    }
    if (MAKE_WEBHOOK_APPS.has(app)) {
      add("api", "Incoming webhook");
      return;
    }
    if (AI_APPS.some((re) => re.test(app))) {
      const model = m.mapper?.model;
      add("ai", app, typeof model === "string" && model && !model.includes("{{") ? `model ${model}` : undefined);
      return;
    }
    add("app", app);
  });

  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function isAiModule(module: string): boolean {
  return AI_APPS.some((re) => re.test(module.split(":")[0]));
}
