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
      <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600 ring-1 ring-inset ring-zinc-500/20 dark:bg-zinc-800 dark:text-zinc-400">
        Paused
      </span>
    );
  }
  if (dlqCount > 0) {
    return (
      <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
        {dlqCount} error{dlqCount === 1 ? "" : "s"}
      </span>
    );
  }
  if (isActive) {
    return (
      <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600 ring-1 ring-inset ring-zinc-500/20 dark:bg-zinc-800 dark:text-zinc-400">
      Inactive
    </span>
  );
}
