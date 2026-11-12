import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { graphql } from "@/gql";
import type { JournalEntries_Bool_Exp } from "@/gql/graphql";
import { gqlRequest } from "@/lib/graphql";

const PAGE_SIZE = 25;

const JournalEntriesQuery = graphql(`
  query JournalEntries($limit: Int!, $offset: Int!, $where: journalEntries_bool_exp) {
    journalEntries(
      where: $where
      order_by: [{ entryDate: desc }, { createdAt: desc }]
      limit: $limit
      offset: $offset
    ) {
      id
      entryDate
      title
      body
      journalEntryLabels {
        labelId
        label {
          id
          name
        }
      }
    }
  }
`);

const JournalLabelsFilterQuery = graphql(`
  query JournalLabelsFilter {
    journalLabels(order_by: { name: asc }) {
      id
      name
    }
  }
`);

export const journalSearchSchema = z.object({
  labels: z.array(z.string()).optional(),
});

export function useJournalLabels() {
  return useQuery({
    queryKey: ["journal_labels", "filter"],
    queryFn: () => gqlRequest(JournalLabelsFilterQuery),
  });
}

/** Journal entries, newest first; selected labels combine with AND. */
export function useJournalEntries(activeLabels: string[]) {
  // AND semantics: each label gets its own clause requiring at least one
  // matching join row. Hasura's array-relationship filters are existential,
  // so combining them with _and means every selected label must be present.
  const where: JournalEntries_Bool_Exp | undefined =
    activeLabels.length === 0
      ? undefined
      : {
          _and: activeLabels.map((labelId) => ({
            journalEntryLabels: { labelId: { _eq: labelId } },
          })),
        };
  return useInfiniteQuery({
    queryKey: ["journal_entries", "index", activeLabels],
    queryFn: ({ pageParam }) =>
      gqlRequest(JournalEntriesQuery, {
        limit: PAGE_SIZE,
        offset: pageParam,
        ...(where ? { where } : {}),
      }),
    initialPageParam: 0 as number,
    getNextPageParam: (lastPage, allPages): number | undefined => {
      if (lastPage.journalEntries.length < PAGE_SIZE) {
        return undefined;
      }
      return allPages.reduce((acc, p) => acc + p.journalEntries.length, 0);
    },
  });
}
