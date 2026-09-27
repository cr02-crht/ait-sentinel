"use client";

import { useState } from "react";

export function NotionSyncButtons() {
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState<"push" | "delete" | null>(null);

  async function handlePush() {
    setPending("push");
    setStatus(null);
    try {
      const res = await fetch("/api/catalog/notion", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to push to Notion.");
      setStatus(data.replaced ? "Updated the Notion page." : "Created the Notion page.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to push to Notion.");
    } finally {
      setPending(null);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Remove the Automation Catalog page from Notion?")) return;
    setPending("delete");
    setStatus(null);
    try {
      const res = await fetch("/api/catalog/notion", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to remove from Notion.");
      setStatus(data.deleted ? "Removed the Notion page." : "No Notion page found to remove.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to remove from Notion.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handlePush}
          disabled={pending !== null}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:border-ring/50 transition-colors disabled:opacity-50"
        >
          {pending === "push" ? "Pushing…" : "Push to Notion"}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending !== null}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-destructive hover:border-destructive/50 transition-colors disabled:opacity-50"
        >
          {pending === "delete" ? "Removing…" : "Remove from Notion"}
        </button>
      </div>
      {status && <p className="text-xs text-muted-foreground">{status}</p>}
    </div>
  );
}
