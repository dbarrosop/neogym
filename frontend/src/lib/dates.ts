// Helpers for working with naive Postgres `date` values (YYYY-MM-DD) on the
// client. `new Date("YYYY-MM-DD")` parses as UTC midnight, which then displays
// as the previous day for users west of UTC. Always go through these helpers
// when surfacing a date-only value in the UI.

export function todayLocalISO(): string {
  // en-CA locale yields YYYY-MM-DD using the user's local timezone, which is
  // what <input type="date"> expects.
  return new Date().toLocaleDateString("en-CA");
}

export function parseDateOnly(iso: string): Date | null {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) {
    return null;
  }
  return new Date(y, m - 1, d);
}

export function formatDateLong(iso: string): string {
  const date = parseDateOnly(iso);
  if (!date) {
    return iso;
  }
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateShort(iso: string): string {
  const date = parseDateOnly(iso);
  if (!date) {
    return iso;
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
