import Link from "next/link";
import { notFound } from "next/navigation";
import { cloudRunApiConfigured, consoleUrl, getCustomAutomation, getCustomAutomationState } from "@/lib/cloud-run";
import { ServiceStatusBadge, SourceBadge } from "@/components/status-badge";
import { AiBadge } from "@/components/dependency-list";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr className="border-b border-border/60 last:border-0">
      <th className="px-4 py-2 text-left font-medium text-muted-foreground align-top w-48">{label}</th>
      <td className="px-4 py-2 text-foreground break-all">{children}</td>
    </tr>
  );
}

export default async function CustomAutomationDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const automation = getCustomAutomation(id);
  if (!automation) notFound();

  const { health, details, detailsError, status } = await getCustomAutomationState(automation);

  return (
    <div className="flex-1 max-w-5xl w-full mx-auto px-6 py-16">
      <Link href="/catalog" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
        ← Back to catalog
      </Link>

      <div className="flex items-start justify-between gap-4 mt-4 mb-2">
        <h1 className="text-4xl font-bold text-foreground">{automation.name}</h1>
        <div className="flex shrink-0 items-center gap-2">
          {automation.usage.ai && <AiBadge />}
          <SourceBadge label="Cloud Run" />
          <ServiceStatusBadge up={status === "active"} />
        </div>
      </div>
      <p className="text-muted-foreground mb-10 text-sm">{automation.description}</p>

      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-4 text-foreground">Status</h2>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <tbody>
              <Row label="Health check">
                {health.ok
                  ? `OK (HTTP ${health.httpStatus}) in ${health.ms} ms`
                  : `Failed: ${health.error ?? `HTTP ${health.httpStatus}`}`}
                <span className="text-muted-foreground"> · checked {new Date(health.checkedAt).toLocaleString()}</span>
              </Row>
              {details && (
                <>
                  <Row label="Cloud Run state">
                    {details.condition === "CONDITION_SUCCEEDED" ? "Serving" : details.condition}
                    {details.conditionMessage && <span className="text-muted-foreground"> · {details.conditionMessage}</span>}
                  </Row>
                  <Row label="Latest revision">{details.latestRevision}</Row>
                  <Row label="Last deployed">
                    {new Date(details.updatedAt).toLocaleString()}
                    {details.updatedBy && <span className="text-muted-foreground"> · by {details.updatedBy}</span>}
                  </Row>
                  <Row label="Instances">
                    min {details.minInstances ?? 0} · max {details.maxInstances ?? "default"}
                    {!details.minInstances && (
                      <span className="block text-amber-600 dark:text-amber-400">
                        Min instances is 0, so Cloud Run can scale the bot down and drop its Discord connection and
                        scheduled messages.
                      </span>
                    )}
                  </Row>
                  {details.image && <Row label="Image">{details.image}</Row>}
                </>
              )}
              <Row label="Service">
                {automation.service} · {automation.region}
              </Row>
              <Row label="Links">
                <a href={consoleUrl(automation)} className="underline hover:text-primary" target="_blank" rel="noreferrer">
                  Cloud Run console
                </a>
                {" · "}
                <a href={automation.repo} className="underline hover:text-primary" target="_blank" rel="noreferrer">
                  Source repo
                </a>
              </Row>
            </tbody>
          </table>
        </div>
        {!details && (
          <p className="mt-3 text-sm text-muted-foreground">
            {detailsError
              ? `Deploy details unavailable: ${detailsError}`
              : !cloudRunApiConfigured() &&
                "Deploy details (revision, last deploy, scaling) appear once GCP_SERVICE_ACCOUNT_JSON is set to a service account with Cloud Run Viewer on this project."}
          </p>
        )}
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-4 text-foreground">Schedules</h2>
        <ul className="space-y-2 text-sm">
          {automation.schedules.map((s) => (
            <li key={s.name} className="flex flex-wrap justify-between gap-2 rounded-lg border border-border bg-card px-4 py-2">
              <span className="text-foreground">{s.name}</span>
              <span className="text-muted-foreground">{s.when}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-4 text-foreground">Commands</h2>
        <ul className="space-y-2 text-sm">
          {automation.commands.map((c) => (
            <li key={c.name} className="rounded-lg border border-border bg-card px-4 py-2">
              <code className="text-foreground">{c.name}</code>
              <span className="text-muted-foreground"> — {c.description}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-4 text-foreground">HTTP endpoints</h2>
        <ul className="space-y-2 text-sm">
          {automation.endpoints.map((e) => (
            <li key={`${e.method} ${e.path}`} className="rounded-lg border border-border bg-card px-4 py-2">
              <code className="text-foreground">
                {e.method} {e.path}
              </code>
              <span className="text-muted-foreground"> — {e.description}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4 text-foreground">Services &amp; APIs</h2>
        <ul className="flex flex-wrap gap-2 text-sm">
          {automation.services.map((s) => (
            <li key={s} className="rounded-md border border-border bg-card px-3 py-1 text-foreground">
              {s}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
