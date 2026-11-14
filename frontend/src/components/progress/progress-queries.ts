import { type Query, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { graphql } from "@/gql";
import { localTimeZone } from "@/lib/dates";
import { gqlRequest } from "@/lib/graphql";
import { useAuth } from "@/lib/nhost/auth-provider";
import { addLocalDateDays } from "@/lib/nutrition";
import { strengthPeriodStart } from "@/lib/strength-progress";
import { useLocalToday } from "@/lib/use-local-today";

// Progress › Overview reads the same queries as the Muscles and Strength
// sections at their default period, so the cards and sections share a cache.

const MuscleSetProgressQuery = graphql(`
  query WebMuscleSetProgress($from: date!, $through: date!, $timeZone: String!) {
    muscleSetProgress(args: { from_day: $from, through_day: $through, time_zone: $timeZone }) {
      day
      muscleGroup
      rollingDirectSets
      rollingIndirectSets
      rollingWeightedSets
    }
  }
`);

const StrengthProgressQuery = graphql(`
  query WebStrengthProgress($from: date!, $through: date!, $timeZone: String!) {
    strengthProgress(args: { from_day: $from, through_day: $through, time_zone: $timeZone }) {
      sessionId
      exerciseId
      startedAt
      volume
      estimatedOneRepMax
      exercise {
        id
        name
      }
    }
  }
`);

/** Muscles and Strength history periods, in weeks: 8 w · 6 m · 1 y. */
export const PROGRESS_PERIODS = [
  { value: 8, label: "8 w" },
  { value: 26, label: "6 m" },
  { value: 52, label: "1 y" },
] as const;
export type ProgressWeeks = (typeof PROGRESS_PERIODS)[number]["value"];
export const DEFAULT_PROGRESS_WEEKS: ProgressWeeks = 8;
/** Search param for a period (`?weeks=26`); absent means the default. */
export const progressWeeksParam = z.union([z.literal(8), z.literal(26), z.literal(52)]).optional();

/** Muscles reads whole local dates: 56, 182 or 364 days ending today. */
export function muscleSetProgressDays(weeks: ProgressWeeks): number {
  return weeks * 7;
}

/**
 * Keeps the previous period's data on screen while another period loads, so
 * the period control stays put; never across accounts (key[4] is the user).
 */
function samePeriodOwner<T>(userId: string | undefined) {
  return (previous: T | undefined, query: Query<T, Error, T, readonly unknown[]> | undefined) =>
    query && query.queryKey[4] === userId ? previous : undefined;
}

export function muscleSetProgressQueryKey(today: string, days: number, userId?: string) {
  return ["progress", "muscles", today, days, userId] as const;
}

export function strengthProgressQueryKey(today: string, weeks: number, userId?: string) {
  return ["progress", "strength", today, weeks, userId] as const;
}

/**
 * Trailing seven-day sets per muscle for each local date of the period. A
 * period change keeps the previous rows on screen until the new ones arrive.
 */
export function useMuscleSetProgress(weeks: ProgressWeeks = DEFAULT_PROGRESS_WEEKS) {
  const today = useLocalToday();
  const { user } = useAuth();
  const days = muscleSetProgressDays(weeks);
  const from = addLocalDateDays(today, -(days - 1));
  const query = useQuery({
    queryKey: muscleSetProgressQueryKey(today, days, user?.id),
    queryFn: () =>
      gqlRequest(MuscleSetProgressQuery, { from, through: today, timeZone: localTimeZone() }),
    enabled: !!user,
    placeholderData: samePeriodOwner(user?.id),
  });
  return { query, today, from };
}

/**
 * Per-session strength points from the Monday that opens the period (see
 * `strengthPeriodStart`) through today, so only the current week is partial.
 */
export function useStrengthProgress(weeks: ProgressWeeks = DEFAULT_PROGRESS_WEEKS) {
  const today = useLocalToday();
  const { user } = useAuth();
  const from = strengthPeriodStart(today, weeks);
  const query = useQuery({
    queryKey: strengthProgressQueryKey(today, weeks, user?.id),
    queryFn: () =>
      gqlRequest(StrengthProgressQuery, { from, through: today, timeZone: localTimeZone() }),
    enabled: !!user,
    placeholderData: samePeriodOwner(user?.id),
  });
  return { query, today, from };
}
