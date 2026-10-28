import type { DigestStory } from "./types";

// Lead images for digest stories that the feed didn't supply one for: fetch the
// article page and read its og:image / twitter:image. Only runs on the ~30
// stories that make the digest, never the whole candidate pool.

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

// Pages whose og:image is a generic site logo, not the story.
const SKIP_HOSTS = /(^|\.)(reddit\.com|news\.ycombinator\.com|arxiv\.org)$/i;

function metaContent(html: string, key: string): string | undefined {
  const k = key.replace(/:/g, "\\:");
  const a = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]*content=["']([^"']+)["']`, "i"));
  const b = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${k}["']`, "i"));
  return (a ?? b)?.[1];
}

/** og:image (or twitter:image) of a page, resolved to an absolute http(s) URL. */
export async function ogImage(pageUrl: string): Promise<string | undefined> {
  let host: string;
  try {
    host = new URL(pageUrl).hostname;
  } catch {
    return undefined;
  }
  if (SKIP_HOSTS.test(host)) return undefined;
  try {
    const res = await fetch(pageUrl, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    });
    if (!res.ok || !res.headers.get("content-type")?.includes("html")) return undefined;
    // The <head> is all we need; cap the read so huge pages don't stall the run.
    const html = (await res.text()).slice(0, 300_000);
    const raw =
      metaContent(html, "og:image:secure_url") ??
      metaContent(html, "og:image") ??
      metaContent(html, "twitter:image") ??
      metaContent(html, "twitter:image:src");
    if (!raw) return undefined;
    const abs = new URL(raw.replace(/&amp;/g, "&").trim(), res.url || pageUrl).toString();
    return /^https?:\/\//i.test(abs) ? abs : undefined;
  } catch {
    return undefined;
  }
}

/** Fill `image` in place for stories that lack one. Failures just leave it unset. */
export async function fillStoryImages(stories: DigestStory[]): Promise<void> {
  await Promise.all(
    stories
      .filter((s) => !s.image)
      .map(async (s) => {
        const img = await ogImage(s.link);
        if (img) s.image = img;
      }),
  );
}
