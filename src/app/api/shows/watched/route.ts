import { NextResponse } from "next/server";
import { applyWatchedAction, ValidationError } from "@/lib/shows-watched";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" } as const;

// Same owner-PIN gate as /api/settings and /api/state (see src/app/api/state/route.ts).
// NOTE: this fails open if SETTINGS_PIN isn't set — flagged in plans/shows-tab.md,
// left as-is here since fixing it is a separate task.
function authed(request: Request): boolean {
  const pin = process.env.SETTINGS_PIN;
  return !pin || request.headers.get("x-settings-pin") === pin;
}

export async function POST(request: Request) {
  if (!authed(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401, headers: NO_STORE });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400, headers: NO_STORE });
  }
  try {
    const marks = await applyWatchedAction(body, new Date().toISOString());
    return NextResponse.json({ ok: true, marks }, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 400, headers: NO_STORE });
    }
    console.error("[shows-watched] failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500, headers: NO_STORE },
    );
  }
}
