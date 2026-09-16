import { notFound } from "next/navigation";
import Link from "next/link";
import { getDigest, listDigestDates } from "@/lib/storage";
import { DigestView, DateNav } from "@/components/digest-view";

export const dynamic = "force-dynamic";

export default async function ArchivePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  const [digest, dates] = await Promise.all([getDigest(date), listDigestDates()]);

  if (!digest) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10">
      <DateNav date={date} dates={dates} />
      <DigestView digest={digest} />
      <div className="mt-6">
        <Link
          href="/"
          className="text-sm text-black/50 hover:underline dark:text-white/50"
        >
          ← Back to today
        </Link>
      </div>
    </main>
  );
}
