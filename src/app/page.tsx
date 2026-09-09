import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { MessageSquareText, Wrench, Radar } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    icon: MessageSquareText,
    title: "Describe the request",
    description:
      "Fill in a short intake form, or talk it through with the AI assistant if you're not sure how to phrase it yet.",
  },
  {
    icon: Wrench,
    title: "We build & wire it up",
    description:
      "PDD picks up the request, builds the automation, and wires it into Make.com.",
  },
  {
    icon: Radar,
    title: "Watch it run",
    description:
      "Track status, recent runs, and errors for every live automation from the catalog.",
  },
];

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center">
      <section className="w-full max-w-3xl px-6 pt-24 pb-16 text-center space-y-8">
        <h1 className="text-5xl font-bold tracking-tight text-foreground">
          AIT Sentinel
        </h1>
        <p className="text-xl text-muted-foreground text-balance">
          Request new automations with a structured intake form, browse
          what&apos;s already built in the catalog, and keep watch over what&apos;s
          running.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/intake" className={buttonVariants({ size: "lg" })}>
            Start a request
          </Link>
          <Link
            href="/catalog"
            className={buttonVariants({ size: "lg", variant: "outline" })}
          >
            Browse catalog
          </Link>
        </div>
      </section>

      <section className="w-full max-w-5xl px-6 pb-24">
        <div className="grid gap-6 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <div
              key={step.title}
              className={cn(
                "rounded-2xl border border-border bg-card p-6 text-left shadow-sm"
              )}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <step.icon className="h-4 w-4" />
                </div>
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Step {i + 1}
                </span>
              </div>
              <h2 className="text-base font-semibold text-foreground mb-1.5">
                {step.title}
              </h2>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
