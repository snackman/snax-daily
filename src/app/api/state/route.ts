import { NextResponse } from "next/server";
import { applyAction, getState, type StateAction } from "@/lib/state";

export const dynamic = "force-dynamic";

// Server-side read/star state is the OWNER's, synced across their devices. It's
// gated behind the owner PIN: visitors read/star locally (in their own browser)
// and never touch this store.
function authed(request: Request): boolean {
  const pin = process.env.SETTINGS_PIN;
  return !pin || request.headers.get("x-settings-pin") === pin;
}

export async function GET(request: Request) {
  if (!authed(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const s = await getState();
  return NextResponse.json(
    { read: Object.keys(s.read), starred: Object.keys(s.starred) },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: Request) {
  if (!authed(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  let body: StateAction;
  try {
    body = (await request.json()) as StateAction;
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  try {
    const s = await applyAction(body, new Date().toISOString());
    return NextResponse.json(
      { ok: true, read: Object.keys(s.read), starred: Object.keys(s.starred) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    console.error("[state] failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
