import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Play } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { ChartSwatch } from "@/components/charts/chart-legend";
import { TrendChart, type TrendChartProps } from "@/components/charts/trend-chart";
import type { ChartColor } from "@/components/charts/trend-chart-model";
import { MeterBar, RingMeter, SectionCard, StatTile } from "@/components/patterns/metrics";
import { ActionLabel, PageHeader, PageShell } from "@/components/patterns/page-shell";
import { ErrorState } from "@/components/patterns/query-states";
import { TodayEnergyEstimate } from "@/components/today-energy-estimate";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import type { TodayOverviewQuery as TodayOverviewData } from "@/gql/graphql";
import { type BodyMetricTrend, buildBodyTrend } from "@/lib/body-trend";
import { parseDateOnly } from "@/lib/dates";
import { gqlRequest } from "@/lib/graphql";
import {
  formatChartDate,
  formatKcal,
  formatKcalNumber,
  formatSignedKcal,
  metricFormat,
} from "@/lib/metric-format";
import { useAuth } from "@/lib/nhost/auth-provider";
import {
  addLocalDateDays,
  formatWholeGrams,
  groupPlanEntriesByTimeSlot,
  loggedMacroTotals,
  mergePlanEntriesByTime,
  normalizeNumeric,
  planEntriesMacroTotals,
  timeToInputValue,
} from "@/lib/nutrition";
import { sessionDisplayName } from "@/lib/sessions";
import { formatSetsSummary } from "@/lib/set-summary";
import {
  bodyWeekSummary,
  energySplitLabel,
  todayBalanceCaption,
  todayBalanceSoFar,
} from "@/lib/today-summary";
import { useLocalToday } from "@/lib/use-local-today";

const TodayOverviewQuery = graphql(`
  query TodayOverview(
    $today: date!
    $bodySince: date!
    $dayStart: timestamptz!
    $dayEnd: timestamptz!
    $weekStart: timestamptz!
  ) {
    todaySessions: workoutSessions(
      where: { startedAt: { _gte: $dayStart, _lt: $dayEnd } }
      order_by: { startedAt: asc }
    ) {
      id
      startedAt
      workout {
        id
        name
      }
      workoutSessionExercises(order_by: { position: asc }) {
        id
        exercise {
          id
          name
          kind
          strength {
            doubleWeight
          }
        }
        workoutSessionStrengthSets(order_by: { setNumber: asc }) {
          id
          reps
          weight
        }
        workoutSessionCardioEntries_aggregate {
          aggregate {
            count
          }
        }
      }
    }
    latestSession: workoutSessions(order_by: { startedAt: desc }, limit: 1) {
      id
      startedAt
      workout {
        id
        name
      }
      workoutSessionExercises(order_by: { position: asc }) {
        exercise {
          id
          name
        }
      }
    }
    recentSessions: workoutSessionsAggregate(where: { startedAt: { _gte: $weekStart } }) {
      aggregate {
        count
      }
    }
    todayNutrition: nutritionDays(where: { logDate: { _eq: $today } }, limit: 1) {
      id
      nutritionPlan {
        id
        name
        nutritionPlanMeals {
          id
          slotTime
          label
          position
          meal {
            id
            name
            mealIngredients {
              id
              grams
              food {
                id
                kcalPer100g
                fatPer100g
                carbsPer100g
                proteinPer100g
                fiberPer100g
                sugarPer100g
              }
            }
          }
        }
        nutritionPlanFoods {
          id
          slotTime
          label
          position
          grams
          food {
            id
            name
            kcalPer100g
            fatPer100g
            carbsPer100g
            proteinPer100g
            fiberPer100g
            sugarPer100g
          }
        }
      }
      nutritionLogEntries {
        id
        grams
        snapshotKcalPer100g
        snapshotFatPer100g
        snapshotCarbsPer100g
        snapshotProteinPer100g
        snapshotFiberPer100g
        snapshotSugarPer100g
      }
    }
    todayEnergy: dailyEnergyEntries(where: { energyOn: { _eq: $today } }, limit: 1) {
      id
      activeKcal
      restingKcal
      updatedAt
    }
    bodyMeasurements(where: { measuredOn: { _gte: $bodySince } }, order_by: { measuredOn: asc }) {
      id
      measuredOn
      weightKg
      bodyFatPct
    }
  }
`);

export const Route = createFileRoute("/_authed/today")({
  component: TodayRoute,
});

type Overview = TodayOverviewData;

/** Body readings plotted on Today: the last 21 local dates (three weeks). */
const BODY_WINDOW_DAYS = 21;

function overviewVariables(today: string) {
  const start = parseDateOnly(today) ?? new Date();
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const weekStart = new Date(start);
  weekStart.setDate(weekStart.getDate() - 6);
  return {
    today,
    bodySince: addLocalDateDays(today, 1 - BODY_WINDOW_DAYS),
    dayStart: start.toISOString(),
    dayEnd: end.toISOString(),
    weekStart: weekStart.toISOString(),
  };
}

function TodayRoute() {
  const today = useLocalToday();
  const { user } = useAuth();
  const variables = useMemo(() => overviewVariables(today), [today]);
  const query = useQuery({
    queryKey: ["today", "overview", today, user?.id],
    queryFn: () => gqlRequest(TodayOverviewQuery, variables),
    enabled: !!user,
    // Revalidate on every visit, even inside the app-wide freshness window.
    refetchOnMount: "always",
  });

  const heading = (parseDateOnly(today) ?? new Date()).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const data = query.data;

  return (
    <PageShell maxWidth="6xl">
      <PageHeader
        eyebrow={heading}
        title="Today"
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/nutrition/log/$date" params={{ date: today }}>
                Log food
              </Link>
            </Button>
            <Button asChild>
              <Link to="/train/workouts">
                <Play className="size-3 fill-current" />
                <ActionLabel>Start session</ActionLabel>
              </Link>
            </Button>
          </>
        }
      />

      {query.error ? (
        <ErrorState
          title="Couldn't load today"
          message={query.error.message}
          onRetry={() => void query.refetch()}
          isRetrying={query.isFetching}
        />
      ) : null}

      {data || query.isPending ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(440px,100%),1fr))] items-start gap-5">
          <div className="flex min-w-0 flex-col gap-5">
            {data ? <TrainingCard data={data} /> : <CardSkeleton title="Training" />}
            {data ? <BodyCard data={data} today={today} /> : <CardSkeleton title="Body" />}
          </div>
          <div className="flex min-w-0 flex-col gap-5">
            {data ? (
              <NutritionCard data={data} today={today} />
            ) : (
              <CardSkeleton title="Nutrition" />
            )}
            {data ? (
              <BalanceCard data={data} userId={user?.id} />
            ) : (
              <CardSkeleton title="Balance" />
            )}
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}

function CardSkeleton({ title }: { title: string }) {
  return (
    <SectionCard title={title}>
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-16 w-full" />
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Training

type TodaySession = Overview["todaySessions"][number];
type TodaySessionExercise = TodaySession["workoutSessionExercises"][number];

function setSummary(row: TodaySessionExercise): string {
  if (row.exercise.kind === "cardio") {
    const count = row.workoutSessionCardioEntries_aggregate.aggregate?.count ?? 0;
    return `${count} ${count === 1 ? "entry" : "entries"}`;
  }
  return formatSetsSummary(row.workoutSessionStrengthSets) ?? "No sets yet";
}

function sessionTotals(session: TodaySession) {
  let sets = 0;
  let reps = 0;
  let volume = 0;
  for (const row of session.workoutSessionExercises) {
    const multiplier = row.exercise.strength?.doubleWeight ? 2 : 1;
    for (const set of row.workoutSessionStrengthSets) {
      sets += 1;
      reps += set.reps;
      volume += normalizeNumeric(set.weight) * set.reps * multiplier;
    }
  }
  return { sets, reps, volume };
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function TrainingCard({ data }: { data: Overview }) {
  const recentCount = data.recentSessions.aggregate?.count ?? 0;
  const recentCountLabel = `${recentCount} ${recentCount === 1 ? "session" : "sessions"}`;
  const latest = data.latestSession[0];

  if (data.todaySessions.length === 0) {
    return (
      <SectionCard
        title="Training"
        aria-label="Training"
        link={{ label: "Sessions", to: "/train/sessions" }}
      >
        <p className="text-sm text-muted-foreground">No session logged yet today.</p>
        {latest ? (
          <Link
            to="/train/sessions/$sessionId"
            params={{ sessionId: latest.id }}
            className="flex items-center justify-between gap-3 rounded-[10px] bg-surface-inset px-3 py-2.5 text-sm hover:bg-muted"
          >
            <span className="min-w-0">
              <span className="text-muted-foreground">Last: </span>
              <span className="font-medium">
                {sessionDisplayName({
                  workoutName: latest.workout?.name,
                  exerciseNames: latest.workoutSessionExercises.map((row) => row.exercise.name),
                })}
              </span>
            </span>
            <span className="shrink-0 text-muted-foreground tabular-nums">
              {new Date(latest.startedAt).toLocaleDateString(undefined, {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </span>
          </Link>
        ) : null}
        <div className="grid grid-cols-2 gap-2.5">
          <StatTile label="Last 7 days" value={recentCountLabel} />
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Training"
      aria-label="Training"
      link={{ label: "Sessions", to: "/train/sessions" }}
    >
      {data.todaySessions.map((session) => (
        <TrainingSession key={session.id} session={session} recentCountLabel={recentCountLabel} />
      ))}
    </SectionCard>
  );
}

function TrainingSession({
  session,
  recentCountLabel,
}: {
  session: TodaySession;
  recentCountLabel: string;
}) {
  const totals = sessionTotals(session);
  const name = sessionDisplayName({
    workoutName: session.workout?.name,
    exerciseNames: session.workoutSessionExercises.map((row) => row.exercise.name),
  });
  const exerciseCount = session.workoutSessionExercises.length;
  return (
    <div className="flex flex-col gap-4">
      <Link
        to="/train/sessions/$sessionId"
        params={{ sessionId: session.id }}
        className="group flex items-center gap-3"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <strong className="truncate text-[15px] font-semibold">{name}</strong>
          <span className="text-[13px] text-muted-foreground tabular-nums">
            {timeLabel(session.startedAt)} · {exerciseCount}{" "}
            {exerciseCount === 1 ? "exercise" : "exercises"}
          </span>
        </span>
        <ChevronRight
          aria-hidden="true"
          className="size-4 text-chart-muted transition-colors group-hover:text-foreground"
        />
      </Link>
      {/* Four tiles once the card has room for "12,435 kg", else two by two. */}
      <div className="@container">
        <div className="grid grid-cols-2 gap-2.5 @[30rem]:grid-cols-4">
          <StatTile label="Sets" value={totals.sets} />
          <StatTile label="Reps" value={totals.reps} />
          <StatTile label="Volume" value={metricFormat.volume(totals.volume)} />
          <StatTile label="Last 7 days" value={recentCountLabel} />
        </div>
      </div>
      <ul className="flex flex-col">
        {session.workoutSessionExercises.map((row) => (
          <li
            key={row.id}
            className="flex min-h-9 items-center justify-between gap-3 border-t text-sm"
          >
            <span className="min-w-0 truncate">{row.exercise.name}</span>
            <span className="shrink-0 text-muted-foreground tabular-nums">{setSummary(row)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Nutrition

function currentTimeKey() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

/** The local HH:MM, updated once a minute and when the page regains focus or visibility. */
function useClockMinute() {
  const [now, setNow] = useState(currentTimeKey);
  useEffect(() => {
    const update = () => setNow(currentTimeKey());
    const timer = window.setInterval(update, 60_000);
    update();
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return now;
}

function NutritionCard({ data, today }: { data: Overview; today: string }) {
  const day = data.todayNutrition[0];
  const eaten = loggedMacroTotals(day?.nutritionLogEntries ?? []);
  const plan = day?.nutritionPlan ?? null;
  const planEntries = plan
    ? mergePlanEntriesByTime(plan.nutritionPlanMeals, plan.nutritionPlanFoods)
    : [];
  const planned = plan ? planEntriesMacroTotals(planEntries) : null;
  const now = useClockMinute();
  const nextSlot = plan
    ? groupPlanEntriesByTimeSlot(planEntries).find(
        (slot) => timeToInputValue(slot.sortKey) !== "" && slot.sortKey > now,
      )
    : undefined;

  const grams = (value: number, target: number | undefined) =>
    planned
      ? `${formatWholeGrams(value)} / ${formatWholeGrams(target ?? 0)} g`
      : `${formatWholeGrams(value)} g`;

  return (
    <SectionCard
      aria-label="Nutrition"
      title={
        <>
          Nutrition
          {plan ? (
            <span className="text-[13px] font-medium text-muted-foreground">
              {" "}
              · plan {plan.name}
            </span>
          ) : null}
        </>
      }
      link={{ label: "Open log", to: "/nutrition/log/$date", params: { date: today } }}
    >
      <div className="flex flex-wrap items-center gap-6">
        <RingMeter
          value={eaten.kcal}
          max={planned?.kcal ?? null}
          label={
            planned
              ? `${formatKcalNumber(eaten.kcal)} of ${formatKcalNumber(planned.kcal)} planned kilocalories`
              : `${formatKcalNumber(eaten.kcal)} kilocalories logged`
          }
          center={
            <>
              <strong className="text-xl font-bold tabular-nums">
                {formatKcalNumber(eaten.kcal)}
              </strong>
              <span className="text-[13px] text-muted-foreground tabular-nums">
                {planned ? `of ${formatKcalNumber(planned.kcal)}` : "kcal"}
              </span>
            </>
          }
        />
        <div className="flex min-w-[200px] flex-1 flex-col gap-2.5">
          <MeterBar
            label="Protein"
            value={eaten.protein}
            max={planned?.protein ?? null}
            tone="protein"
            valueLabel={grams(eaten.protein, planned?.protein)}
          />
          <MeterBar
            label="Carbs"
            value={eaten.carbs}
            max={planned?.carbs ?? null}
            tone="carbs"
            valueLabel={grams(eaten.carbs, planned?.carbs)}
          />
          <MeterBar
            label="Fat"
            value={eaten.fat}
            max={planned?.fat ?? null}
            tone="fat"
            valueLabel={grams(eaten.fat, planned?.fat)}
          />
        </div>
      </div>
      {nextSlot ? (
        <Link
          to="/nutrition/log/$date"
          params={{ date: today }}
          className="flex items-center gap-3 rounded-[10px] bg-surface-inset px-3 py-2.5 hover:bg-muted"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[13px] text-muted-foreground">Next in plan</span>
            <strong className="text-sm font-semibold tabular-nums">
              {nextSlot.label} · {slotCountLabel(nextSlot.mealCount, nextSlot.foodCount)} ·{" "}
              {formatKcal(nextSlot.totals.kcal)}
            </strong>
          </span>
          <span className="flex h-8 items-center rounded-full bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground">
            Log
          </span>
        </Link>
      ) : null}
      {day ? null : <p className="text-sm text-muted-foreground">Nothing logged yet today.</p>}
    </SectionCard>
  );
}

function slotCountLabel(meals: number, foods: number) {
  const parts: string[] = [];
  if (meals > 0) {
    parts.push(`${meals} ${meals === 1 ? "meal" : "meals"}`);
  }
  if (foods > 0) {
    parts.push(`${foods} ${foods === 1 ? "food" : "foods"}`);
  }
  return parts.join(", ");
}

// ---------------------------------------------------------------------------
// Energy balance: today so far, then the end-of-day estimate

function BalanceCard({ data, userId }: { data: Overview; userId: string | undefined }) {
  const energy = data.todayEnergy[0] ?? null;
  const caloriesIn = loggedMacroTotals(data.todayNutrition[0]?.nutritionLogEntries ?? []).kcal;
  const balance = todayBalanceSoFar({ caloriesIn, energy });
  const out = balance.caloriesOut;

  return (
    <SectionCard
      title="Balance"
      aria-label="Energy balance"
      link={{ label: "Energy", to: "/progress/energy" }}
    >
      {balance.net !== null && out !== null ? (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-[13px] text-muted-foreground tabular-nums">
                {todayBalanceCaption(balance.energyUpdatedAt)}
              </span>
              <strong className="text-[26px] font-bold tabular-nums">
                {formatSignedKcal(balance.net)}
              </strong>
            </div>
            <span className="text-[13px] text-muted-foreground tabular-nums">
              In {formatKcalNumber(caloriesIn)} · Out {formatKcalNumber(out)}
            </span>
          </div>
          {out > 0 ? (
            <>
              <div
                className="flex h-2.5 gap-0.5 overflow-hidden rounded-full"
                role="img"
                aria-label={energySplitLabel(balance)}
              >
                {balance.restingKcal > 0 ? (
                  <span className="bg-chart-1" style={{ flex: balance.restingKcal }} />
                ) : null}
                {balance.activeKcal > 0 ? (
                  <span className="bg-chart-2" style={{ flex: balance.activeKcal }} />
                ) : null}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted-foreground tabular-nums">
                <Legend className="bg-chart-1">
                  Resting {formatKcalNumber(balance.restingKcal)}
                </Legend>
                <Legend className="bg-chart-2">
                  Active {formatKcalNumber(balance.activeKcal)}
                </Legend>
              </div>
            </>
          ) : null}
        </>
      ) : (
        <div className="flex flex-col gap-0.5">
          <p className="text-sm text-muted-foreground">No energy recorded yet today.</p>
          <p className="text-[13px] text-muted-foreground tabular-nums">
            In {formatKcal(caloriesIn)} so far
          </p>
        </div>
      )}
      {/* The estimate nets the same intake and energy row as the card. */}
      <TodayEnergyEstimate
        variant="today"
        {...(userId ? { balance: { userId, caloriesIn, dailyEnergy: energy } } : {})}
      />
    </SectionCard>
  );
}

function Legend({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className={`size-2 rounded-[2px] ${className}`} />
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Body: raw weight and body-fat readings on start-aligned scales, then a
// column per metric (latest reading, 7-day average, change vs prior week)

function bodySeries(
  name: string,
  color: ChartColor,
  metric: BodyMetricTrend,
  format: (value: number) => string,
): TrendChartProps["series"][number] {
  return { id: name, name, color, points: metric.readings, format };
}

function BodyCard({ data, today }: { data: Overview; today: string }) {
  const body = buildBodyTrend(data.bodyMeasurements, {
    today,
    start: addLocalDateDays(today, 1 - BODY_WINDOW_DAYS),
  });
  const plotted = [
    ...(body.weight.readings.length > 0
      ? [bodySeries("Weight", "chart-1", body.weight, metricFormat.weight)]
      : []),
    ...(body.bodyFat.readings.length > 0
      ? [bodySeries("Body fat", "chart-2", body.bodyFat, metricFormat.bodyFat)]
      : []),
  ].map((series, index) => (index === 1 ? { ...series, axis: "right" as const } : series));
  const dates = plotted.flatMap((series) => series.points.map((point) => point.date)).sort();
  const first = dates[0];
  const last = dates.at(-1);

  return (
    <SectionCard title="Body" aria-label="Body" link={{ label: "Trend", to: "/progress/body" }}>
      {body.isEmpty ? (
        <p className="text-sm text-muted-foreground">No measurements in the last three weeks.</p>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <TrendChart
              title="Weight and body fat"
              series={plotted}
              height={110}
              yAxis="baseline"
              xTicks="none"
              legend={false}
            />
            {first && last ? (
              <div
                aria-hidden="true"
                className="flex justify-between text-xs text-tertiary-foreground tabular-nums"
              >
                <span>{formatChartDate(first)}</span>
                {last === first ? null : <span>{formatChartDate(last)}</span>}
              </div>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-5 border-t pt-3.5">
            {body.weight.latest ? (
              <BodyColumn
                name="Weight"
                color="chart-1"
                metric={body.weight}
                format={metricFormat.weight}
              />
            ) : null}
            {body.bodyFat.latest ? (
              <BodyColumn
                name="Body fat"
                color="chart-2"
                metric={body.bodyFat}
                format={metricFormat.bodyFat}
              />
            ) : null}
          </div>
        </>
      )}
    </SectionCard>
  );
}

function BodyColumn({
  name,
  color,
  metric,
  format,
}: {
  name: string;
  color: ChartColor;
  metric: BodyMetricTrend;
  format: (value: number) => string;
}) {
  const latest = metric.latest;
  if (!latest) {
    return null;
  }
  const summary = bodyWeekSummary(metric);
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground tabular-nums">
        <ChartSwatch color={color} className="w-3" />
        {name} · {formatChartDate(latest.date)}
      </span>
      <strong className="text-[26px] font-bold tabular-nums">{format(latest.value)}</strong>
      {summary ? (
        <span className="text-[13px] font-semibold text-muted-foreground tabular-nums">
          {summary}
        </span>
      ) : null}
    </div>
  );
}
