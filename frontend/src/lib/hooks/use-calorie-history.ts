import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { graphql } from "@/gql";
import { buildCalorieTrend, type CalorieTrend } from "@/lib/calorie-trend";
import { gqlRequest } from "@/lib/graphql";
import { useAuth } from "@/lib/nhost/auth-provider";
import { addLocalDateDays } from "@/lib/nutrition";
import { WARM_UP_DAYS } from "@/lib/rolling-average";
import { useLocalToday } from "@/lib/use-local-today";

// Range-bound logged snapshots and energy rows, including the warm-up days
// before the window that feed its first 7-day averages. Every log entry of a
// day carries nutritionDayId, grouped meal children included.
const CalorieHistoryQuery = graphql(`
  query CalorieHistory($from: date!, $through: date!) {
    nutritionDays(where: { logDate: { _gte: $from, _lte: $through } }, order_by: { logDate: asc }) {
      id
      logDate
      nutritionLogEntries {
        id
        grams
        snapshotKcalPer100g
      }
    }
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

/**
 * Lives under ["nutrition", "days", "index"], so every nutrition log mutation
 * (which invalidates that prefix or ["nutrition", "days"]) refreshes it.
 * Daily-energy writers must also invalidate this prefix.
 */
export const CALORIE_HISTORY_QUERY_KEY = ["nutrition", "days", "index", "calorie-history"] as const;

/** The cache key for a fetched range (`from` already includes the warm-up days). */
export function calorieHistoryQueryKey(from: string, through: string, userId: string | undefined) {
  return [...CALORIE_HISTORY_QUERY_KEY, from, through, userId] as const;
}

export interface CalorieHistoryRange {
  /** First plotted local date. */
  start: string;
  /** Last plotted local date (usually today). */
  end: string;
}

/**
 * Daily calories consumed and net with 7-day averages for a chart window
 * (see `buildCalorieTrend`). Fetches six warm-up days before `start`; the same
 * window shares one cache entry, so Progress › Energy and Overview reuse it.
 * The raw rows (`query.data.dailyEnergyEntries`) can also feed
 * `buildEnergyTrend` for the same window.
 */
export function useCalorieHistory({ start, end }: CalorieHistoryRange) {
  const { user } = useAuth();
  const today = useLocalToday();
  const from = addLocalDateDays(start, -WARM_UP_DAYS);
  const query = useQuery({
    queryKey: calorieHistoryQueryKey(from, end, user?.id),
    queryFn: () => gqlRequest(CalorieHistoryQuery, { from, through: end }),
    enabled: !!user,
  });
  const trend = useMemo<CalorieTrend | null>(
    () => (query.data ? buildCalorieTrend(query.data, { start, end, today }) : null),
    [query.data, start, end, today],
  );
  return { query, trend, today };
}
