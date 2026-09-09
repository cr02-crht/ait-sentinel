import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-2xl text-center space-y-8">
        <h1 className="text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          AIT Sentinel
        </h1>
        <p className="text-xl text-zinc-600 dark:text-zinc-400">
          Request new automations with our structured intake form, browse
          existing automations in the catalog, and keep watch over what&apos;s running.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/intake" className={buttonVariants({ size: "lg" })}>
            Start Request
          </Link>
          <Link
            href="/catalog"
            className={buttonVariants({ size: "lg", variant: "outline" })}
          >
            Browse Catalog
          </Link>
        </div>
      </div>
    </main>
  );
}
