import { useQuery } from "@tanstack/react-query";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";
import { useAuth } from "@/lib/nhost/auth-provider";

// Every measurement, newest first: a few hundred rows at most, so Progress ›
// Body plots any period, counts and pages its list from one read.
const BodyMeasurementsQuery = graphql(`
  query BodyMeasurements {
    bodyMeasurements(order_by: { measuredOn: desc }) {
      id
      measuredOn
      weightKg
      bodyFatPct
      notes
    }
  }
`);

/** The cache key for the signed-in user's measurements (under the ["body_measurements"] prefix writers invalidate). */
export function bodyMeasurementsQueryKey(userId: string | undefined) {
  return ["body_measurements", "list", userId] as const;
}

/**
 * The signed-in user's body measurements, newest first. Feed the rows to
 * `buildBodyTrend` for charts and 7-day averages.
 */
export function useBodyMeasurements() {
  const { user } = useAuth();
  return useQuery({
    queryKey: bodyMeasurementsQueryKey(user?.id),
    queryFn: () => gqlRequest(BodyMeasurementsQuery),
    enabled: !!user,
  });
}
