export const GATE_COOKIE = "ait-sentinel-gate";
export const GATE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

// The cookie holds a hash derived from SITE_PASSCODE, never the passcode itself.
// Changing SITE_PASSCODE changes the expected token, so every existing session
// is signed out on the next request — that's the "reset".
export async function gateToken(passcode: string): Promise<string> {
  const bytes = new TextEncoder().encode(`ait-sentinel-gate:${passcode}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
