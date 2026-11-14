import { describe, expect, it } from "bun:test";
import {
  ENTRY_HISTORY_PAGE_SIZE,
  entryHistoryWindow,
  needsEntryHistoryPage,
  nextEntryHistoryLimit,
} from "./progress-entries";

const rows = Array.from({ length: 32 }, (_, index) => `row-${index + 1}`);

describe("entry history window", () => {
  it("shows the latest seven of every loaded row", () => {
    const window = entryHistoryWindow(rows, ENTRY_HISTORY_PAGE_SIZE);
    expect(window.visible).toEqual(rows.slice(0, 7));
    expect(window.shown).toBe(7);
    expect(window.total).toBe(32);
    expect(window.canLoadMore).toBe(true);
  });

  it("grows by one page per Load more and stops at the total", () => {
    let limit = ENTRY_HISTORY_PAGE_SIZE;
    const shown: number[] = [];
    for (;;) {
      const window = entryHistoryWindow(rows, limit);
      shown.push(window.shown);
      if (!window.canLoadMore) {
        break;
      }
      limit = nextEntryHistoryLimit(limit);
    }
    expect(shown).toEqual([7, 14, 21, 28, 32]);
  });

  it("counts the server total when rows load in pages", () => {
    const loaded = rows.slice(0, 30);
    const window = entryHistoryWindow(loaded, 35, 41);
    expect(window.shown).toBe(30);
    expect(window.total).toBe(41);
    expect(window.canLoadMore).toBe(true);
  });

  it("never reports fewer rows than it shows", () => {
    const window = entryHistoryWindow(rows.slice(0, 9), 14, 8);
    expect(window.shown).toBe(9);
    expect(window.total).toBe(9);
    expect(window.canLoadMore).toBe(false);
  });

  it("is empty without rows", () => {
    expect(entryHistoryWindow([], ENTRY_HISTORY_PAGE_SIZE)).toEqual({
      visible: [],
      shown: 0,
      total: 0,
      canLoadMore: false,
    });
  });

  it("fetches the next page only when the window passes the loaded rows", () => {
    expect(needsEntryHistoryPage({ limit: 28, loaded: 30, hasMoreRemote: true })).toBe(false);
    expect(needsEntryHistoryPage({ limit: 35, loaded: 30, hasMoreRemote: true })).toBe(true);
    expect(needsEntryHistoryPage({ limit: 35, loaded: 30, hasMoreRemote: false })).toBe(false);
  });
});
