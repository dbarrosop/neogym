import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";
import { useAuth } from "@/lib/nhost/auth-provider";

/** Rows per list request; Progress › Energy shows them seven at a time. */
export const DAILY_ENERGY_LIST_PAGE_SIZE = 30;

const DailyEnergyListQuery = graphql(`
  query DailyEnergyList($limit: Int!, $offset: Int!) {
    dailyEnergyEntries(order_by: { energyOn: desc }, limit: $limit, offset: $offset) {
      id
      energyOn
      activeKcal
      restingKcal
      notes
    }
    dailyEnergyEntriesAggregate {
      aggregate {
        count
      }
    }
  }
`);

// The energy-out chart reads its own date-bounded window, independent of the
// list's pages, so any period plots every day in it.
const DailyEnergyRangeQuery = graphql(`
  query DailyEnergyRange($from: date!, $through: date!) {
    dailyEnergyEntries(
      where: { energyOn: { _gte: $from, _lte: $through } }
      order_by: { energyOn: asc }
    ) {
      id
      energyOn
      activeKcal
      restingKcal
    }
  }
`);

/** The list's cache key (under the ["daily_energy"] prefix that writers invalidate). */
export function dailyEnergyListQueryKey(userId: string | undefined) {
  return ["daily_energy", "list", userId] as const;
}

/** The energy-out chart's cache key for an inclusive date range. */
export function dailyEnergyRangeQueryKey(
  from: string,
  through: string,
  userId: string | undefined,
) {
  return ["daily_energy", "range", from, through, userId] as const;
}

/**
 * The signed-in user's energy days, newest first, in pages of 30 with the
 * total row count (`dailyEnergyEntriesAggregate`) on every page.
 */
export function useDailyEnergyList() {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: dailyEnergyListQueryKey(user?.id),
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      gqlRequest(DailyEnergyListQuery, { limit: DAILY_ENERGY_LIST_PAGE_SIZE, offset: pageParam }),
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + page.dailyEnergyEntries.length, 0);
      const total = lastPage.dailyEnergyEntriesAggregate.aggregate?.count ?? loaded;
      return lastPage.dailyEnergyEntries.length > 0 && loaded < total ? loaded : undefined;
    },
    enabled: !!user,
  });
}

/** Energy rows dated `from` to `through` (inclusive), oldest first. */
export function useDailyEnergyRange(from: string, through: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: dailyEnergyRangeQueryKey(from, through, user?.id),
    queryFn: () => gqlRequest(DailyEnergyRangeQuery, { from, through }),
    enabled: !!user,
  });
}
