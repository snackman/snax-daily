"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SOURCES, TOPICS } from "@/lib/sources";

interface Settings {
  extraInterests: string;
  blocklist: string[];
  mutedSources: string[];
  hiddenTopics: string[];
  topPicks: number;
  maxGrouped: number;
  podcastSlots: number;
  model: string;
  webSearch: boolean;
  articleHours: number;
  podcastDays: number;
}

const MODELS = ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
        {title}
      </h2>
      <div className="rounded-xl border border-black/10 p-4 dark:border-white/10">{children}</div>
    </section>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
}) {
  return (
    <label className="flex items-center justify-between gap-4 py-1.5 text-sm">
      <span className="text-black/70 dark:text-white/70">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-20 rounded-lg border border-black/15 bg-transparent px-2 py-1 text-right dark:border-white/20"
      />
    </label>
  );
}

const PIN_KEY = "digest:settingsPin:v1";

export default function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pin, setPin] = useState("");

  useEffect(() => {
    try {
      setPin(localStorage.getItem(PIN_KEY) ?? "");
    } catch {
      /* ignore */
    }
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setS(d))
      .catch(() => setStatus("Couldn't load settings."));
  }, []);

  const sourcesByTopic = useMemo(() => {
    const map = new Map<string, { name: string; type: string }[]>();
    for (const src of SOURCES) {
      const arr = map.get(src.topic) ?? [];
      arr.push({ name: src.name, type: src.type });
      map.set(src.topic, arr);
    }
    return map;
  }, []);

  if (!s) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10">
        <p className="text-black/50 dark:text-white/50">{status ?? "Loading settings…"}</p>
      </main>
    );
  }

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v });
  const muted = new Set(s.mutedSources);
  const hidden = new Set(s.hiddenTopics);

  const toggleMute = (name: string) => {
    const next = new Set(muted);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    set("mutedSources", [...next]);
  };
  const toggleHidden = (t: string) => {
    const next = new Set(hidden);
    if (next.has(t)) next.delete(t);
    else next.add(t);
    set("hiddenTopics", [...next]);
  };

  const save = async () => {
    setSaving(true);
    setStatus(null);
    try {
      try {
        localStorage.setItem(PIN_KEY, pin);
      } catch {
        /* ignore */
      }
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "content-type": "application/json", "x-settings-pin": pin },
        body: JSON.stringify(s),
      });
      if (res.status === 401) {
        setStatus("Wrong PIN — settings not saved.");
        return;
      }
      const d = await res.json();
      if (!d.ok) throw new Error(d.error || "failed");
      setS(d.settings);
      setStatus("Saved. Changes apply on the next Restock or morning run.");
    } catch {
      setStatus("Save failed — try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <Link
          href="/"
          className="rounded-lg border border-black/10 px-3 py-1.5 text-sm hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
        >
          ← Back
        </Link>
      </div>

      <Section title="Interests & blocklist">
        <label className="block text-sm">
          <span className="text-black/70 dark:text-white/70">Extra interests / notes for the ranker</span>
          <textarea
            value={s.extraInterests}
            onChange={(e) => set("extraInterests", e.target.value)}
            rows={3}
            placeholder="e.g. I especially care about open-source models and grid-scale storage; downweight crypto price moves."
            className="mt-1 w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 dark:border-white/20"
          />
        </label>
        <label className="mt-3 block text-sm">
          <span className="text-black/70 dark:text-white/70">Blocked terms (one per line)</span>
          <textarea
            value={s.blocklist.join("\n")}
            onChange={(e) => set("blocklist", e.target.value.split("\n").map((t) => t.trim()).filter(Boolean))}
            rows={3}
            placeholder="crypto&#10;celebrity"
            className="mt-1 w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 dark:border-white/20"
          />
        </label>
      </Section>

      <Section title="Counts & model">
        <NumberField label="Top picks" value={s.topPicks} onChange={(n) => set("topPicks", n)} min={0} max={15} />
        <NumberField label="Grouped stories (max)" value={s.maxGrouped} onChange={(n) => set("maxGrouped", n)} min={0} max={60} />
        <NumberField label="Podcast episodes (max)" value={s.podcastSlots} onChange={(n) => set("podcastSlots", n)} min={0} max={40} />
        <label className="flex items-center justify-between gap-4 py-1.5 text-sm">
          <span className="text-black/70 dark:text-white/70">Model</span>
          <select
            value={s.model}
            onChange={(e) => set("model", e.target.value)}
            className="rounded-lg border border-black/15 bg-transparent px-2 py-1 dark:border-white/20"
          >
            {MODELS.map((m) => (
              <option key={m} value={m} className="bg-white dark:bg-neutral-900">
                {m}
              </option>
            ))}
          </select>
        </label>
      </Section>

      <Section title="Web search & windows">
        <label className="flex items-center justify-between gap-4 py-1.5 text-sm">
          <span className="text-black/70 dark:text-white/70">Agentic web-search fill</span>
          <input type="checkbox" checked={s.webSearch} onChange={(e) => set("webSearch", e.target.checked)} className="size-4" />
        </label>
        <NumberField label="Article lookback (hours)" value={s.articleHours} onChange={(n) => set("articleHours", n)} min={6} max={168} />
        <NumberField label="Podcast lookback (days)" value={s.podcastDays} onChange={(n) => set("podcastDays", n)} min={1} max={30} />
      </Section>

      <Section title="Topics">
        <p className="mb-2 text-xs text-black/40 dark:text-white/40">Click to hide a topic entirely from the digest.</p>
        <div className="flex flex-wrap gap-1.5">
          {(TOPICS as readonly string[]).map((t) => {
            const off = hidden.has(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleHidden(t)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  off
                    ? "bg-black/5 text-black/30 line-through dark:bg-white/5 dark:text-white/30"
                    : "bg-sky-500/15 text-sky-600 dark:text-sky-300"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Mute sources">
        <p className="mb-2 text-xs text-black/40 dark:text-white/40">
          Unchecked sources are skipped. {muted.size} muted of {SOURCES.length}.
        </p>
        <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
          {(TOPICS as readonly string[]).map((topic) => {
            const list = sourcesByTopic.get(topic);
            if (!list?.length) return null;
            return (
              <div key={topic}>
                <div className="mb-1 text-xs font-semibold text-black/40 dark:text-white/40">{topic}</div>
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {list.map((src) => (
                    <label key={src.name} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={!muted.has(src.name)}
                        onChange={() => toggleMute(src.name)}
                        className="size-3.5 shrink-0"
                      />
                      <span className={`truncate ${muted.has(src.name) ? "text-black/40 line-through dark:text-white/40" : ""}`}>
                        {src.name}
                        {src.type === "podcast" ? " 🎧" : ""}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <div className="sticky bottom-4 flex flex-wrap items-center gap-3 rounded-xl border border-black/10 bg-[var(--background)]/90 p-3 backdrop-blur dark:border-white/10">
        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="Owner PIN"
          className="w-28 rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20"
        />
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
        {status && <span className="text-sm text-black/50 dark:text-white/50">{status}</span>}
      </div>
      <p className="mt-2 text-xs text-black/40 dark:text-white/40">
        Saving requires the owner PIN, so people you share this with can browse settings but can&apos;t change them.
      </p>
    </main>
  );
}
