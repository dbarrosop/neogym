import { numericOrNull } from "@/lib/rolling-average";
import { type PhotoLabel, photosByDate, type ReadyPhoto } from "./api";

const LABEL_GROUPS = ["front", "side", "back"] as const;

function labelRank(value: string) {
  const index = LABEL_GROUPS.findIndex((group) => value === group || value.startsWith(`${group}_`));
  return index === -1 ? LABEL_GROUPS.length : index;
}

/**
 * Display order for catalog labels: front, side, back, then anything else, each
 * alphabetical (`front_a`, `front_b`, …). Hasura enum tables can't store an order.
 */
export function sortPhotoLabels<T extends { value: string }>(labels: readonly T[]): T[] {
  return [...labels].sort(
    (a, b) => labelRank(a.value) - labelRank(b.value) || a.value.localeCompare(b.value),
  );
}

export type SheetCell = { label: PhotoLabel; photos: ReadyPhoto[] };
export type SheetRow = { date: string; cells: SheetCell[] };

/**
 * The gallery's contact sheet: one row per date taken (server order, newest first) and
 * one column per label used by the loaded photos, in catalog order, so the same label
 * lines up down the page. A cell keeps server order (newest upload first).
 */
export function buildContactSheet(
  photos: readonly ReadyPhoto[],
  catalog: readonly PhotoLabel[],
): { columns: PhotoLabel[]; rows: SheetRow[] } {
  const used = new Map<string, PhotoLabel>();
  for (const photo of photos) {
    used.set(photo.label.value, photo.label);
  }
  const known = sortPhotoLabels(catalog).filter((label) => used.has(label.value));
  const unknown = [...used.values()].filter(
    (label) => !catalog.some((row) => row.value === label.value),
  );
  const columns = [...known, ...sortPhotoLabels(unknown)];
  const rows = photosByDate(photos).map(([date, items]) => ({
    date,
    cells: columns.map((label) => ({
      label,
      photos: items.filter((photo) => photo.label.value === label.value),
    })),
  }));
  return { columns, rows };
}

/**
 * Where a photo sits among its label's photos (server order, newest first): the
 * neighbouring older and newer photos and its position counted from the oldest.
 */
export function poseNeighbors(pose: readonly ReadyPhoto[], id: string) {
  const index = pose.findIndex((photo) => photo.id === id);
  if (index === -1) {
    return null;
  }
  return {
    older: pose[index + 1] ?? null,
    newer: pose[index - 1] ?? null,
    position: pose.length - index,
    total: pose.length,
  };
}

/**
 * Two distinct photos of one label in date order. Unknown or missing IDs default to
 * the newest (`to`) and the oldest (`from`); a reversed pair is put back in order.
 */
export function compareSelection(
  pose: readonly ReadyPhoto[],
  from: string | undefined,
  to: string | undefined,
): { before: ReadyPhoto; after: ReadyPhoto } | null {
  const first = pose[0];
  const last = pose.at(-1);
  if (pose.length < 2 || !first || !last) {
    return null;
  }
  const indexOf = (id: string | undefined) => (id ? pose.findIndex((p) => p.id === id) : -1);
  let after = indexOf(to);
  if (after === -1) {
    after = 0;
  }
  let before = indexOf(from);
  if (before === -1 || before === after) {
    before = after === pose.length - 1 ? 0 : pose.length - 1;
  }
  // Server order is newest first, so the larger index was taken earlier.
  return {
    before: pose[Math.max(after, before)] ?? last,
    after: pose[Math.min(after, before)] ?? first,
  };
}

function utcDay(date: string, offset = 0) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + offset));
}

function shiftDate(date: string, days: number) {
  return utcDay(date, days).toISOString().slice(0, 10);
}

/** Whole calendar days from `earlier` to `later` (both `YYYY-MM-DD`). */
export function daysBetween(earlier: string, later: string) {
  return Math.round((utcDay(later).getTime() - utcDay(earlier).getTime()) / 86_400_000);
}

export type MeasurementRow = { measuredOn: string; weightKg?: unknown; bodyFatPct?: unknown };
export type PhotoMeasurement = {
  measuredOn: string;
  weightKg: number | null;
  bodyFatPct: number | null;
};

/**
 * The body measurement for a photo: the reading on `date`, else the latest one in the
 * previous `maxDays` days (`0` = same day only). Rows without either value are skipped.
 */
export function measurementNear(
  rows: readonly MeasurementRow[],
  date: string,
  maxDays = 7,
): PhotoMeasurement | null {
  const earliest = shiftDate(date, -maxDays);
  let best: PhotoMeasurement | null = null;
  for (const row of rows) {
    const weightKg = numericOrNull(row.weightKg);
    const bodyFatPct = numericOrNull(row.bodyFatPct);
    const inRange = row.measuredOn <= date && row.measuredOn >= earliest;
    if (
      inRange &&
      (weightKg !== null || bodyFatPct !== null) &&
      (!best || row.measuredOn > best.measuredOn)
    ) {
      best = { measuredOn: row.measuredOn, weightKg, bodyFatPct };
    }
  }
  return best;
}

/**
 * The body change between two photos' readings. `null` when either is missing or both
 * photos fall back to the same reading (no change was measured between them); a value
 * is `null` when either reading lacks it.
 */
export function measurementChange(
  before: PhotoMeasurement | null,
  after: PhotoMeasurement | null,
): { weightKg: number | null; bodyFatPct: number | null } | null {
  if (!before || !after || before.measuredOn === after.measuredOn) {
    return null;
  }
  const diff = (from: number | null, to: number | null) =>
    from === null || to === null ? null : to - from;
  return {
    weightKg: diff(before.weightKg, after.weightKg),
    bodyFatPct: diff(before.bodyFatPct, after.bodyFatPct),
  };
}
