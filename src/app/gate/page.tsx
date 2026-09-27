import { SiteGate } from "@/components/site-gate";

export default async function GatePage({ searchParams }: PageProps<"/gate">) {
  const { next } = await searchParams;
  // Only allow same-site relative paths to avoid an open redirect.
  const target =
    typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  return <SiteGate next={target} />;
}
