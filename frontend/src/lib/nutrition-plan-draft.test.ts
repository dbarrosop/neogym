import { describe, expect, test } from "bun:test";
import { sortAndRenumberPlanEntriesByTime } from "@/lib/nutrition";
import {
  movePlanDraftEntryToTime,
  planSlotTimeKey,
  reorderPlanDraftEntryWithinSlot,
  retimePlanDraftSlot,
  suggestedPlanSlotTime,
} from "@/lib/nutrition-plan-draft";

type Draft = { id: string; slotTime: string };

const id = (entry: Draft) => entry.id;
const draft = (entryId: string, slotTime: string): Draft => ({ id: entryId, slotTime });

/** Saved order: sorted by time, draft order within a time, as the editor submits it. */
function savedOrder(entries: readonly Draft[]) {
  return sortAndRenumberPlanEntriesByTime(entries).map(
    (entry) => `${entry.slotTime || "-"} ${entry.id}#${entry.position}`,
  );
}

describe("planSlotTimeKey", () => {
  test("normalizes database and input times; legacy values have no key", () => {
    expect(planSlotTimeKey("07:15:00")).toBe("07:15");
    expect(planSlotTimeKey("07:15")).toBe("07:15");
    expect(planSlotTimeKey("")).toBe("");
    expect(planSlotTimeKey(null)).toBe("");
  });
});

describe("retimePlanDraftSlot", () => {
  const entries = [
    draft("bread", "07:15"),
    draft("kvarg", "09:30:00"),
    draft("jam", "07:15:00"),
    draft("dinner", "17:30"),
  ];

  test("retimes every entry of the slot to a free time", () => {
    const result = retimePlanDraftSlot(entries, "07:15", "08:00");
    expect(result.changed).toBe(true);
    expect(result.merged).toBe(false);
    expect(savedOrder(result.entries)).toEqual([
      "08:00 bread#0",
      "08:00 jam#1",
      "09:30:00 kvarg#0",
      "17:30 dinner#0",
    ]);
  });

  test("merges into an existing slot after its own entries, keeping the moved order", () => {
    const result = retimePlanDraftSlot(entries, "07:15:00", "09:30");
    expect(result.merged).toBe(true);
    expect(savedOrder(result.entries)).toEqual([
      "09:30:00 kvarg#0",
      "09:30 bread#1",
      "09:30 jam#2",
      "17:30 dinner#0",
    ]);
  });

  test("ignores an empty, invalid or unchanged target", () => {
    for (const target of ["", "25:00", "07:15", "07:15:00"]) {
      const result = retimePlanDraftSlot(entries, "07:15", target);
      expect(result.changed).toBe(false);
      expect(result.entries).toEqual(entries);
      expect(result.entries).not.toBe(entries);
    }
  });

  test("gives the legacy no-time slot a time", () => {
    const result = retimePlanDraftSlot([draft("a", ""), draft("b", "10:00")], "", "10:00");
    expect(result.merged).toBe(true);
    expect(savedOrder(result.entries)).toEqual(["10:00 b#0", "10:00 a#1"]);
  });

  test("an unknown source slot changes nothing", () => {
    expect(retimePlanDraftSlot(entries, "12:00", "13:00").changed).toBe(false);
  });
});

describe("movePlanDraftEntryToTime", () => {
  const entries = [draft("a", "07:15"), draft("b", "07:15"), draft("c", "09:30")];

  test("joins an existing slot at its end", () => {
    const result = movePlanDraftEntryToTime(entries, "a", "09:30:00", id);
    expect(result).toMatchObject({ changed: true, merged: true });
    expect(savedOrder(result.entries)).toEqual(["07:15 b#0", "09:30 c#0", "09:30 a#1"]);
  });

  test("starts a new slot at a free time", () => {
    const result = movePlanDraftEntryToTime(entries, "b", "12:00", id);
    expect(result).toMatchObject({ changed: true, merged: false });
    expect(savedOrder(result.entries)).toEqual(["07:15 a#0", "09:30 c#0", "12:00 b#0"]);
  });

  test("its own time, an invalid time or an unknown entry change nothing", () => {
    expect(movePlanDraftEntryToTime(entries, "a", "07:15:00", id).changed).toBe(false);
    expect(movePlanDraftEntryToTime(entries, "a", "", id).changed).toBe(false);
    expect(movePlanDraftEntryToTime(entries, "zzz", "12:00", id).changed).toBe(false);
  });
});

describe("reorderPlanDraftEntryWithinSlot", () => {
  const entries = [
    draft("a", "07:15"),
    draft("x", "09:30"),
    draft("b", "07:15"),
    draft("c", "07:15"),
  ];

  test("moves down and up within one slot", () => {
    expect(savedOrder(reorderPlanDraftEntryWithinSlot(entries, "a", "c", id))).toEqual([
      "07:15 b#0",
      "07:15 c#1",
      "07:15 a#2",
      "09:30 x#0",
    ]);
    expect(savedOrder(reorderPlanDraftEntryWithinSlot(entries, "c", "a", id))).toEqual([
      "07:15 c#0",
      "07:15 a#1",
      "07:15 b#2",
      "09:30 x#0",
    ]);
  });

  test("never moves an entry across slots", () => {
    expect(reorderPlanDraftEntryWithinSlot(entries, "a", "x", id)).toEqual(entries);
    expect(reorderPlanDraftEntryWithinSlot(entries, "a", "missing", id)).toEqual(entries);
    expect(reorderPlanDraftEntryWithinSlot(entries, "a", "a", id)).toEqual(entries);
  });
});

describe("suggestedPlanSlotTime", () => {
  test("noon for an empty plan, otherwise an hour after the latest slot", () => {
    expect(suggestedPlanSlotTime([])).toBe("12:00");
    expect(suggestedPlanSlotTime(["", null])).toBe("12:00");
    expect(suggestedPlanSlotTime(["07:15:00", "17:30"])).toBe("18:30");
  });

  test("wraps to the first free half hour past midnight", () => {
    expect(suggestedPlanSlotTime(["23:30"])).toBe("00:00");
    expect(suggestedPlanSlotTime(["00:00", "23:15"])).toBe("00:30");
  });
});
