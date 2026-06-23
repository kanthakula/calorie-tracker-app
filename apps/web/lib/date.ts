// Date helpers. The app's day key is a strict ISO `YYYY-MM-DD` in the user's local
// timezone (so "today" matches what the user sees on the wall clock).

export function todayIso(): string {
  return toIso(new Date());
}

export function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse a YYYY-MM-DD string into a local Date (noon, to avoid DST edge shifts). */
export function fromIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

/** "20 June 2026" style human label. */
export function humanDate(iso: string): string {
  return fromIso(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** "Fri 20" style short label for charts. */
export function shortDate(iso: string): string {
  return fromIso(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
  });
}

export function addDays(iso: string, delta: number): string {
  const d = fromIso(iso);
  d.setDate(d.getDate() + delta);
  return toIso(d);
}

/** Inclusive list of ISO dates from `from` to `to`. */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  // Guard against inverted ranges / runaways.
  for (let i = 0; i < 400 && cur <= to; i++) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}
