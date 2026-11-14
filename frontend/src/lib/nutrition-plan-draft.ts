// Pure helpers for the plan editor's time slots (Web · Plan editor). A slot is
// every draft entry that shares one normalized "HH:MM" time; the editor edits
// the slot's time once, which retimes all of its entries, and a slot moved onto
// a time that is already used joins that slot. Mirrors NeoGymKit
// `NutritionPlanFormModel.setSlotTime` / `suggestedSlotTime`.

import { timeToInputValue } from "@/lib/nutrition";

interface TimedDraftEntry {
  slotTime: string;
}

/** "HH:MM" for a slot time, or "" for legacy entries without a valid time. */
export function planSlotTimeKey(value: unknown): string {
  return timeToInputValue(value);
}

export interface RetimePlanSlotResult<TEntry> {
  entries: TEntry[];
  /** True when another slot already used the new time and the entries joined it. */
  merged: boolean;
  /** True when anything changed. */
  changed: boolean;
}

/**
 * Retimes every entry of the slot at `fromTime` to `toTime`. When another slot
 * already uses `toTime`, the moved entries join it after its own entries,
 * keeping their order. An empty or invalid target, or the same time, changes
 * nothing. `fromTime` may be "" to retime the legacy no-time slot.
 */
export function retimePlanDraftSlot<TEntry extends TimedDraftEntry>(
  entries: readonly TEntry[],
  fromTime: string,
  toTime: string,
): RetimePlanSlotResult<TEntry> {
  const source = planSlotTimeKey(fromTime);
  const target = planSlotTimeKey(toTime);
  if (!target || source === target) {
    return { entries: entries.slice(), merged: false, changed: false };
  }
  const kept: TEntry[] = [];
  const moved: TEntry[] = [];
  for (const entry of entries) {
    if (planSlotTimeKey(entry.slotTime) === source) {
      moved.push({ ...entry, slotTime: target });
    } else {
      kept.push(entry);
    }
  }
  if (moved.length === 0) {
    return { entries: entries.slice(), merged: false, changed: false };
  }
  const merged = kept.some((entry) => planSlotTimeKey(entry.slotTime) === target);
  // Draft order breaks ties within a time, so appending puts the moved entries
  // after the target slot's own entries.
  return { entries: [...kept, ...moved], merged, changed: true };
}

/**
 * Moves one entry to `toTime`, after the entries already at that time (a new
 * slot when none uses it). An empty or invalid target, or its current time,
 * changes nothing.
 */
export function movePlanDraftEntryToTime<TEntry extends TimedDraftEntry>(
  entries: readonly TEntry[],
  entryId: string,
  toTime: string,
  getEntryId: (entry: TEntry) => string,
): RetimePlanSlotResult<TEntry> {
  const target = planSlotTimeKey(toTime);
  const entry = entries.find((candidate) => getEntryId(candidate) === entryId);
  if (!entry || !target || planSlotTimeKey(entry.slotTime) === target) {
    return { entries: entries.slice(), merged: false, changed: false };
  }
  const kept = entries.filter((candidate) => candidate !== entry);
  const merged = kept.some((candidate) => planSlotTimeKey(candidate.slotTime) === target);
  return { entries: [...kept, { ...entry, slotTime: target }], merged, changed: true };
}

/**
 * Moves `activeId` to the place of `overId` when both are in the same slot
 * (drag to reorder within a time). Entries in other slots keep their order;
 * a cross-slot pair changes nothing, since a slot's time is edited on the slot.
 */
export function reorderPlanDraftEntryWithinSlot<TEntry extends TimedDraftEntry>(
  entries: readonly TEntry[],
  activeId: string,
  overId: string,
  getEntryId: (entry: TEntry) => string,
): TEntry[] {
  const fromIndex = entries.findIndex((entry) => getEntryId(entry) === activeId);
  const toIndex = entries.findIndex((entry) => getEntryId(entry) === overId);
  const active = entries[fromIndex];
  const over = entries[toIndex];
  if (
    !active ||
    !over ||
    fromIndex === toIndex ||
    planSlotTimeKey(active.slotTime) !== planSlotTimeKey(over.slotTime)
  ) {
    return entries.slice();
  }
  const next = entries.slice();
  next.splice(fromIndex, 1);
  next.splice(toIndex, 0, active);
  return next;
}

/**
 * A free time for a new, empty slot: an hour after the latest used time, or
 * noon when there is none. When the next hour would pass midnight (or is
 * taken), the first free half hour of the day.
 */
export function suggestedPlanSlotTime(existingTimes: readonly unknown[]): string {
  const taken = new Set<number>();
  for (const time of existingTimes) {
    const minutes = minutesOfDay(planSlotTimeKey(time));
    if (minutes !== null) {
      taken.add(minutes);
    }
  }
  if (taken.size === 0) {
    return "12:00";
  }
  const latest = Math.max(...taken);
  const candidates = [latest + 60];
  for (let minutes = 0; minutes < 24 * 60; minutes += 30) {
    candidates.push(minutes);
  }
  const free = candidates.find((minutes) => minutes < 24 * 60 && !taken.has(minutes)) ?? latest;
  return `${String(Math.floor(free / 60)).padStart(2, "0")}:${String(free % 60).padStart(2, "0")}`;
}

function minutesOfDay(value: string): number | null {
  if (!value) {
    return null;
  }
  const [hours, minutes] = value.split(":").map(Number);
  if (hours === undefined || minutes === undefined) {
    return null;
  }
  return hours * 60 + minutes;
}
