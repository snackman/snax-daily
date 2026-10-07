// Owner-PIN gate shared by every write route (/api/settings, /api/state,
// /api/shows/watched). Fails closed: if SETTINGS_PIN isn't configured, nobody
// is authorized — except under `next dev`, so local work doesn't need a PIN.
export function hasOwnerPin(request: Request): boolean {
  const pin = process.env.SETTINGS_PIN;
  if (!pin) return process.env.NODE_ENV === "development";
  return request.headers.get("x-settings-pin") === pin;
}
