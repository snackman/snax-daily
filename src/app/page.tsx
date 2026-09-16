import { getLatestDigest, listDigestDates } from "@/lib/storage";
import { DigestView, DateNav } from "@/components/digest-view";
import { SOURCE_COUNT } from "@/lib/digest";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [digest, dates] = await Promise.all([getLatestDigest(), listDigestDates()]);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10">
      {digest ? (
        <>
          <DateNav date={digest.date} dates={dates} />
          <DigestView digest={digest} />
        </>
      ) : (
        <div className="py-20 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Snax Daily 🍿</h1>
          <p className="mx-auto mt-3 max-w-md text-black/60 dark:text-white/60">
            No digest yet. Tracking {SOURCE_COUNT} sources across AI, tech, science,
            biotech, nuclear, blockchain, Apple, and Nintendo.
          </p>
          <p className="mt-4 text-sm text-black/40 dark:text-white/40">
            Run{" "}
            <code className="rounded bg-black/10 px-1.5 py-0.5 dark:bg-white/10">
              npm run generate
            </code>{" "}
            locally, or hit{" "}
            <code className="rounded bg-black/10 px-1.5 py-0.5 dark:bg-white/10">
              /api/generate
            </code>{" "}
            to build today&apos;s digest.
          </p>
        </div>
      )}
    </main>
  );
}
