import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { CALORIE_HISTORY_QUERY_KEY } from "@/lib/hooks/use-calorie-history";

/**
 * After a body measurement is created, edited or deleted: every body query
 * (Body list and chart, detail, breadcrumbs, Overview) and the Today overview.
 */
export function useInvalidateBodyMeasurements(): () => void {
  const queryClient = useQueryClient();
  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["body_measurements"] });
    queryClient.invalidateQueries({ queryKey: ["today"] });
  }, [queryClient]);
}

/**
 * After a daily energy row is created, edited or deleted: every energy query
 * (Energy list and chart, detail, breadcrumbs), today's estimate, the calorie
 * history behind the net charts (Energy › Calories, Overview) and Today.
 */
export function useInvalidateDailyEnergy(): () => void {
  const queryClient = useQueryClient();
  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["daily_energy"] });
    queryClient.invalidateQueries({ queryKey: ["nutrition", "energy-projection"] });
    queryClient.invalidateQueries({ queryKey: CALORIE_HISTORY_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: ["today"] });
  }, [queryClient]);
}
