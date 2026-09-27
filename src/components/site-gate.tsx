"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SiteGate({ next }: { next: string }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setChecking(true);
    const response = await fetch("/api/gate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode: value }),
    }).catch(() => null);
    setChecking(false);

    if (response?.ok) {
      // Full navigation so the proxy sees the new cookie.
      window.location.assign(next);
    } else {
      setError(true);
      setValue("");
    }
  }

  return (
    <div className="flex min-h-svh flex-1 items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-4 text-center">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-foreground">AIT Sentinel</h1>
          <p className="text-sm text-muted-foreground">Enter the passcode to continue.</p>
        </div>
        <input
          type="password"
          autoFocus
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError(false);
          }}
          placeholder="Passcode"
          className={cn(
            "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            error &&
              "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20"
          )}
        />
        {error && <p className="text-sm text-destructive">Incorrect passcode.</p>}
        <Button type="submit" className="w-full" disabled={checking || value.length === 0}>
          {checking ? "Checking…" : "Enter"}
        </Button>
      </form>
    </div>
  );
}
