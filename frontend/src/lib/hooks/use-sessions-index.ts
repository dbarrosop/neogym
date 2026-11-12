import { useInfiniteQuery } from "@tanstack/react-query";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";

export const SESSIONS_PAGE_SIZE = 25;

const SessionsIndexQuery = graphql(`
  query SessionsIndex($limit: Int!, $offset: Int!) {
    workoutSessions(order_by: { startedAt: desc }, limit: $limit, offset: $offset) {
      id
      startedAt
      workout {
        id
        name
      }
      workoutSessionExercises_aggregate {
        aggregate {
          count
        }
      }
      workoutSessionExercises(order_by: { position: asc }) {
        exercise {
          id
          name
        }
        workoutSessionStrengthSets_aggregate {
          aggregate {
            count
          }
        }
        workoutSessionCardioEntries_aggregate {
          aggregate {
            count
          }
        }
      }
    }
  }
`);

/** Shared by the layout list and the index redirect so both read one cache entry. */
export function useSessionsIndex() {
  return useInfiniteQuery({
    queryKey: ["sessions", "index"],
    queryFn: ({ pageParam }) =>
      gqlRequest(SessionsIndexQuery, { limit: SESSIONS_PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0 as number,
    getNextPageParam: (lastPage, allPages): number | undefined => {
      if (lastPage.workoutSessions.length < SESSIONS_PAGE_SIZE) {
        return undefined;
      }
      return allPages.reduce((acc, p) => acc + p.workoutSessions.length, 0);
    },
  });
}
