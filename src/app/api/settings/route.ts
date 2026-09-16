import { NextResponse } from "next/server";
import { getSettings, saveSettings, type Settings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSettings();
  return NextResponse.json(s, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  // Gate writes behind an owner PIN so demo visitors can't change your config.
  const pin = process.env.SETTINGS_PIN;
  if (pin && request.headers.get("x-settings-pin") !== pin) {
    return NextResponse.json({ ok: false, error: "wrong or missing PIN" }, { status: 401 });
  }

  let body: Partial<Settings>;
  try {
    body = (await request.json()) as Partial<Settings>;
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  try {
    const saved = await saveSettings(body);
    return NextResponse.json({ ok: true, settings: saved }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
