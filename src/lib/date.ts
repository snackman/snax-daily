/** Today's date as YYYY-MM-DD in the given IANA timezone. */
export function todayInTz(tz = process.env.DIGEST_TZ ?? "America/New_York"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parts; // en-CA formats as YYYY-MM-DD
}
