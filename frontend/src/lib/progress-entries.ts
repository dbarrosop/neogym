// Shared by the Body measurement and daily energy streams on Progress › Body
// and Energy: the entry-history window ("7 of 32 entries" with Load more) and
// the error shape their create/edit forms show inline.

/** Rows the web shows per page of an entry history (iOS shows 5). */
export const ENTRY_HISTORY_PAGE_SIZE = 7;

export interface EntryHistoryWindow<T> {
  /** The rows to render, newest first. */
  visible: T[];
  /** `visible.length`, for the "7 of 32" caption. */
  shown: number;
  /** Every row the user has, never fewer than the rows shown. */
  total: number;
  /** More rows exist beyond the window, loaded or on the server. */
  canLoadMore: boolean;
}

/**
 * The first `limit` loaded rows against the total. `total` defaults to the
 * loaded rows (a list fetched whole); pass the server count when rows load in
 * pages. A stale count never reads below what is shown.
 */
export function entryHistoryWindow<T>(
  items: readonly T[],
  limit: number,
  total: number = items.length,
): EntryHistoryWindow<T> {
  const visible = items.slice(0, Math.max(0, limit));
  const known = Math.max(total, visible.length);
  return {
    visible,
    shown: visible.length,
    total: known,
    canLoadMore: visible.length < known,
  };
}

/** The window after Load more: one more page. */
export function nextEntryHistoryLimit(
  limit: number,
  pageSize: number = ENTRY_HISTORY_PAGE_SIZE,
): number {
  return Math.max(0, limit) + pageSize;
}

/**
 * Whether showing `limit` rows needs another server page: the window passes
 * the loaded rows and the server has more.
 */
export function needsEntryHistoryPage({
  limit,
  loaded,
  hasMoreRemote,
}: {
  limit: number;
  loaded: number;
  hasMoreRemote: boolean;
}): boolean {
  return hasMoreRemote && limit > loaded;
}

/**
 * A failed save shown inside the form: under the Date field for a date that
 * already has an entry, otherwise in the form's error slot.
 */
export interface EntryFormError {
  message: string;
  field: "date" | null;
}
