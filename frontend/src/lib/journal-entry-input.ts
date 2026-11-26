import { type JournalEntries_Insert_Input, JournalLabels_Constraint } from "@/gql/graphql";

interface NewJournalEntry {
  entryDate: string;
  title: string;
  body: string;
  labels: readonly { id?: string; name: string }[];
}

export function journalEntryInsert(values: NewJournalEntry): JournalEntries_Insert_Input {
  const object: JournalEntries_Insert_Input = {
    entryDate: values.entryDate,
    title: values.title || null,
    body: values.body,
  };
  // Empty relationships need no insert. Constellation rejects nested data: [].
  if (values.labels.length > 0) {
    object.journalEntryLabels = {
      data: values.labels.map((label) =>
        label.id
          ? { labelId: label.id }
          : {
              label: {
                data: { name: label.name },
                on_conflict: {
                  constraint: JournalLabels_Constraint.JournalLabelsUserNameKey,
                  update_columns: [],
                },
              },
            },
      ),
    };
  }
  return object;
}
