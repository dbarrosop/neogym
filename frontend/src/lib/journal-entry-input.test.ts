import { expect, test } from "bun:test";
import { JournalLabels_Constraint } from "@/gql/graphql";
import { journalEntryInsert } from "./journal-entry-input";

const entry = { entryDate: "2026-11-17", title: "", body: "A good session.", labels: [] };

test("an unlabelled journal entry omits the empty nested insert", () => {
  expect(journalEntryInsert(entry)).toEqual({
    entryDate: entry.entryDate,
    title: null,
    body: entry.body,
  });
});

test("journal inserts preserve existing labels and nested creation of new labels", () => {
  expect(
    journalEntryInsert({
      ...entry,
      title: "Today",
      labels: [{ id: "existing-label", name: "Training" }, { name: "Recovery" }],
    }),
  ).toEqual({
    entryDate: entry.entryDate,
    title: "Today",
    body: entry.body,
    journalEntryLabels: {
      data: [
        { labelId: "existing-label" },
        {
          label: {
            data: { name: "Recovery" },
            on_conflict: {
              constraint: JournalLabels_Constraint.JournalLabelsUserNameKey,
              update_columns: [],
            },
          },
        },
      ],
    },
  });
});
