import { NextResponse } from "next/server";
import { GATE_COOKIE, GATE_MAX_AGE_SECONDS, gateToken, safeEqual } from "@/lib/site-gate";

export async function POST(request: Request) {
  const passcode = process.env.SITE_PASSCODE;
  if (!passcode) return NextResponse.json({ ok: true });

  const body = (await request.json().catch(() => null)) as { passcode?: unknown } | null;
  const submitted = typeof body?.passcode === "string" ? body.passcode : "";

  const expected = await gateToken(passcode);
  if (!safeEqual(await gateToken(submitted), expected)) {
    return NextResponse.json({ error: "Incorrect passcode" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(GATE_COOKIE, expected, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: GATE_MAX_AGE_SECONDS,
  });
  return response;
}
