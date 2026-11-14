import { useMemo } from "react";
import {
  OverviewCard,
  OverviewHeadline,
  OverviewMessage,
  OverviewQueryState,
} from "@/components/progress/overview-card";
import { useMuscleSetProgress } from "@/components/progress/progress-queries";
import { metricFormat } from "@/lib/metric-format";
import { type MuscleSets, muscleSetOverview } from "@/lib/muscle-set-progress";

const setsList = (muscles: readonly MuscleSets[], separator: string) =>
  muscles.map((muscle) => `${muscle.name} ${metricFormat.sets(muscle.weighted)}`).join(separator);

function MostTrainedBars({ muscles }: { muscles: MuscleSets[] }) {
  const max = muscles[0]?.weighted ?? 0;
  return (
    <div
      role="img"
      aria-label={`Most trained muscles over the last 7 days: ${setsList(muscles, ", ")}`}
      className="flex flex-col gap-0.5"
    >
      {muscles.map((muscle) => (
        <div
          key={muscle.group}
          className="grid min-h-7 grid-cols-[110px_minmax(0,1fr)_40px] items-center gap-3 tabular-nums"
        >
          <span className="truncate text-sm">{muscle.name}</span>
          <span className="flex h-2.5 overflow-hidden rounded-[3px] bg-muted">
            <span
              className="rounded-[3px] bg-chart-1"
              style={{ width: `${max > 0 ? Math.min(muscle.weighted / max, 1) * 100 : 0}%` }}
            />
          </span>
          <span className="text-right text-sm font-semibold">
            {metricFormat.sets(muscle.weighted)}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Overview › Muscles: this week's weighted sets, the six most-trained muscles
 * and the three least-trained after them (Muscles' default-period query).
 */
export function OverviewMusclesCard() {
  const { query } = useMuscleSetProgress();
  const overview = useMemo(
    () => (query.data ? muscleSetOverview(query.data.muscleSetProgress) : null),
    [query.data],
  );
  return (
    <OverviewCard title="Muscles" to="/progress/muscles">
      <OverviewQueryState query={query} errorTitle="Couldn't load muscle sets" />
      {query.data && !overview ? (
        <OverviewMessage>No strength sets in the last 7 days.</OverviewMessage>
      ) : null}
      {overview ? (
        <>
          <OverviewHeadline
            value={metricFormat.sets(overview.totalWeightedSets)}
            unit="weighted sets · 7 days"
            caption="Direct sets plus half of secondary"
          />
          <MostTrainedBars muscles={overview.mostTrained} />
          {overview.leastTrained.length > 0 ? (
            <p className="text-[13px] text-muted-foreground tabular-nums">
              Lowest: {setsList(overview.leastTrained, " · ")}
            </p>
          ) : null}
        </>
      ) : null}
    </OverviewCard>
  );
}
