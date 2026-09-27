import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, gateToken, safeEqual } from "@/lib/site-gate";

export async function proxy(request: NextRequest) {
  const passcode = process.env.SITE_PASSCODE;
  if (!passcode) return NextResponse.next();

  const cookie = request.cookies.get(GATE_COOKIE)?.value;
  if (cookie && safeEqual(cookie, await gateToken(passcode))) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Passcode required" }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/gate";
  url.search = "";
  url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Skip the gate itself, static assets, and endpoints called by external
    // services with their own auth (Discord signatures, monitor cron secret).
    "/((?!gate|api/gate|api/discord|api/monitor|_next/static|_next/image|favicon.ico).*)",
  ],
};
