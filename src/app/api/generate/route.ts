import { NextResponse } from "next/server";
import { generateDigest, todayInTz } from "@/lib/digest";
import { getDigest } from "@/lib/storage";

// Digest generation fans out to ~70 feeds + an LLM call; give it room.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Minimum gap between public ("Restock") regenerations, to cap OpenAI cost/abuse.
const RESTOCK_THROTTLE_MS = 5 * 60 * 1000;

/**
 * Generates today's digest.
 *
 * - Vercel Cron and any caller with the CRON_SECRET bearer token regenerate
 *   unconditionally.
 * - Public callers (the "Restock" button on the site) may also regenerate, but
 *   are throttled: if today's digest was generated within RESTOCK_THROTTLE_MS,
 *   we skip the work and report how long to wait.
 */
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authed = !secret || request.headers.get("authorization") === `Bearer ${secret}`;

  if (!authed) {
    const current = await getDigest(todayInTz());
    if (current) {
      const age = Date.now() - Date.parse(current.generatedAt);
      if (age < RESTOCK_THROTTLE_MS) {
        return NextResponse.json({
          ok: true,
          throttled: true,
          retryAfterSec: Math.ceil((RESTOCK_THROTTLE_MS - age) / 1000),
          date: current.date,
        });
      }
    }
  }

  try {
    const digest = await generateDigest();
    return NextResponse.json({
      ok: true,
      date: digest.date,
      topPicks: digest.topPicks.length,
      stats: digest.stats,
    });
  } catch (err) {
    console.error("[generate] failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
