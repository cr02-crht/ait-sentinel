export function StatusBadge({
  isActive,
  isPaused,
  dlqCount,
}: {
  isActive: boolean;
  isPaused: boolean;
  dlqCount: number;
}) {
  if (isPaused) {
    return (
      <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-border">
        Paused
      </span>
    );
  }
  if (dlqCount > 0) {
    return (
      <span className="inline-flex items-center rounded-md bg-red-50 dark:bg-red-950/50 px-2 py-1 text-xs font-medium text-red-700 dark:text-red-400 ring-1 ring-inset ring-red-600/20">
        {dlqCount} error{dlqCount === 1 ? "" : "s"}
      </span>
    );
  }
  if (isActive) {
    return (
      <span className="inline-flex items-center rounded-md bg-green-50 dark:bg-green-950/50 px-2 py-1 text-xs font-medium text-green-700 dark:text-green-400 ring-1 ring-inset ring-green-600/20">
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-border">
      Inactive
    </span>
  );
}

// Cloud Run services are either answering their health check or not.
export function ServiceStatusBadge({ up }: { up: boolean }) {
  if (up) {
    return (
      <span className="inline-flex items-center rounded-md bg-green-50 dark:bg-green-950/50 px-2 py-1 text-xs font-medium text-green-700 dark:text-green-400 ring-1 ring-inset ring-green-600/20">
        Running
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md bg-red-50 dark:bg-red-950/50 px-2 py-1 text-xs font-medium text-red-700 dark:text-red-400 ring-1 ring-inset ring-red-600/20">
      Down
    </span>
  );
}

export function SourceBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-sky-50 dark:bg-sky-950/50 px-2 py-1 text-xs font-medium text-sky-700 dark:text-sky-400 ring-1 ring-inset ring-sky-600/20">
      {label}
    </span>
  );
}
