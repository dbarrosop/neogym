import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Play } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  MeterBar,
  RingMeter,
  SectionCard,
  Sparkline,
  StatTile,
} from "@/components/patterns/metrics";
import { PageHeader, PageShell } from "@/components/patterns/page-shell";
import { ErrorState } from "@/components/patterns/query-states";
import { TodayEnergyEstimate } from "@/components/today-energy-estimate";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import type { TodayOverviewQuery as TodayOverviewData } from "@/gql/graphql";
import { describeTrend } from "@/lib/chart-trend";
import { formatDateShort, parseDateOnly } from "@/lib/dates";
import { gqlRequest } from "@/lib/graphql";
import { useAuth } from "@/lib/nhost/auth-provider";
import {
  addLocalDateDays,
  groupPlanEntriesByTimeSlot,
  localDateToDate,
  loggedMacroTotals,
  mergePlanEntriesByTime,
  normalizeNumeric,
  planEntriesMacroTotals,
  timeToInputValue,
} from "@/lib/nutrition";
import { sessionDisplayName } from "@/lib/sessions";
import { useLocalToday } from "@/lib/use-local-today";

const TodayOverviewQuery = graphql(`
  query TodayOverview(
    $today: date!
    $yesterday: date!
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
    yesterdayNutrition: nutritionDays(where: { logDate: { _eq: $yesterday } }, limit: 1) {
      id
      nutritionLogEntries {
        id
        grams
        snapshotKcalPer100g
      }
    }
    yesterdayEnergy: dailyEnergyEntries(where: { energyOn: { _eq: $yesterday } }, limit: 1) {
      id
      activeKcal
      restingKcal
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

const kcalFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const signedKcalFormat = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
});

function overviewVariables(today: string) {
  const start = parseDateOnly(today) ?? new Date();
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const weekStart = new Date(start);
  weekStart.setDate(weekStart.getDate() - 6);
  return {
    today,
    yesterday: addLocalDateDays(today, -1),
    bodySince: addLocalDateDays(today, -20),
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
                <Play />
                Start session
              </Link>
            </Button>
          </>
        }
      />

      {query.error ? (
        <div className="space-y-3">
          <ErrorState title="Couldn't load today" message={query.error.message} />
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            Retry
          </Button>
        </div>
      ) : null}

      {data || query.isPending ? (
        <div className="grid items-start gap-5 lg:grid-cols-2">
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
            {data ? <BalanceCard data={data} /> : <CardSkeleton title="Balance" />}
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
  const sets = row.workoutSessionStrengthSets;
  if (row.exercise.kind === "cardio") {
    const count = row.workoutSessionCardioEntries_aggregate.aggregate?.count ?? 0;
    return `${count} ${count === 1 ? "entry" : "entries"}`;
  }
  if (sets.length === 0) {
    return "No sets yet";
  }
  const weightLabel = (weight: number) => (weight === 0 ? "BW" : `${weight} kg`);
  const weights = sets.map((set) => normalizeNumeric(set.weight));
  if (weights.every((weight) => weight === weights[0])) {
    return `${weightLabel(weights[0] ?? 0)} × ${sets.map((set) => set.reps).join(" · ")}`;
  }
  return sets
    .map((set) => `${weightLabel(normalizeNumeric(set.weight))} × ${set.reps}`)
    .join(" · ");
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
      <SectionCard title="Training" link={{ label: "Sessions", to: "/train/sessions" }}>
        <p className="text-sm text-muted-foreground">No session logged yet today.</p>
        {latest ? (
          <Link
            to="/train/sessions/$sessionId"
            params={{ sessionId: latest.id }}
            className="flex items-center justify-between gap-3 rounded-lg bg-surface-inset px-3 py-2.5 text-sm hover:bg-muted"
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
    <SectionCard title="Training" link={{ label: "Sessions", to: "/train/sessions" }}>
      {data.todaySessions.map((session) => {
        const totals = sessionTotals(session);
        const name = sessionDisplayName({
          workoutName: session.workout?.name,
          exerciseNames: session.workoutSessionExercises.map((row) => row.exercise.name),
        });
        return (
          <div key={session.id} className="flex flex-col gap-4">
            <Link
              to="/train/sessions/$sessionId"
              params={{ sessionId: session.id }}
              className="group flex items-center gap-3"
            >
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-[15px] font-semibold">{name}</strong>
                <span className="text-[13px] text-muted-foreground tabular-nums">
                  {timeLabel(session.startedAt)} · {session.workoutSessionExercises.length}{" "}
                  {session.workoutSessionExercises.length === 1 ? "exercise" : "exercises"}
                </span>
              </span>
              <ChevronRight className="size-4 text-chart-muted transition-colors group-hover:text-foreground" />
            </Link>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <StatTile label="Sets" value={totals.sets} />
              <StatTile label="Reps" value={totals.reps} />
              <StatTile label="Volume" value={`${kcalFormat.format(totals.volume)} kg`} />
              <StatTile label="Last 7 days" value={recentCountLabel} />
            </div>
            <ul className="flex flex-col">
              {session.workoutSessionExercises.map((row) => (
                <li
                  key={row.id}
                  className="flex min-h-9 items-center justify-between gap-3 border-t text-sm"
                >
                  <span className="min-w-0 truncate">{row.exercise.name}</span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {setSummary(row)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Nutrition

function currentTimeKey() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function NutritionCard({ data, today }: { data: Overview; today: string }) {
  const day = data.todayNutrition[0];
  const eaten = loggedMacroTotals(day?.nutritionLogEntries ?? []);
  const plan = day?.nutritionPlan ?? null;
  const planEntries = plan
    ? mergePlanEntriesByTime(plan.nutritionPlanMeals, plan.nutritionPlanFoods)
    : [];
  const planned = plan ? planEntriesMacroTotals(planEntries) : null;
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
  const nextSlot = plan
    ? groupPlanEntriesByTimeSlot(planEntries).find(
        (slot) => timeToInputValue(slot.sortKey) !== "" && slot.sortKey > now,
      )
    : undefined;

  const target = (value: number) => (planned ? ` / ${kcalFormat.format(value)} g` : " g");

  return (
    <SectionCard
      title={
        <>
          Nutrition
          {plan ? (
            <span className="font-medium text-muted-foreground"> · plan {plan.name}</span>
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
              ? `${kcalFormat.format(eaten.kcal)} of ${kcalFormat.format(planned.kcal)} planned kilocalories`
              : `${kcalFormat.format(eaten.kcal)} kilocalories logged`
          }
          center={
            <>
              <strong className="text-xl font-semibold tabular-nums">
                {kcalFormat.format(eaten.kcal)}
              </strong>
              <span className="text-[13px] text-muted-foreground tabular-nums">
                {planned ? `of ${kcalFormat.format(planned.kcal)}` : "kcal"}
              </span>
            </>
          }
        />
        <div className="flex min-w-[200px] flex-1 flex-col gap-2.5">
          <MeterBar
            label="Protein"
            value={eaten.protein}
            max={planned?.protein ?? null}
            valueLabel={`${kcalFormat.format(eaten.protein)}${target(planned?.protein ?? 0)}`}
          />
          <MeterBar
            label="Carbs"
            value={eaten.carbs}
            max={planned?.carbs ?? null}
            tone="orange"
            valueLabel={`${kcalFormat.format(eaten.carbs)}${target(planned?.carbs ?? 0)}`}
          />
          <MeterBar
            label="Fat"
            value={eaten.fat}
            max={planned?.fat ?? null}
            tone="neutral"
            valueLabel={`${kcalFormat.format(eaten.fat)}${target(planned?.fat ?? 0)}`}
          />
        </div>
      </div>
      {nextSlot ? (
        <Link
          to="/nutrition/log/$date"
          params={{ date: today }}
          className="flex items-center gap-3 rounded-lg bg-surface-inset px-3 py-2.5 hover:bg-muted"
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[13px] text-muted-foreground">Next in plan</span>
            <strong className="text-sm font-semibold tabular-nums">
              {nextSlot.label} · {slotCountLabel(nextSlot.mealCount, nextSlot.foodCount)} ·{" "}
              {kcalFormat.format(nextSlot.totals.kcal)} kcal
            </strong>
          </span>
          <span className="rounded-full bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground">
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
// Energy balance

function BalanceCard({ data }: { data: Overview }) {
  const energy = data.yesterdayEnergy[0];
  const active = normalizeNumeric(energy?.activeKcal);
  const resting = normalizeNumeric(energy?.restingKcal);
  const out = active + resting;
  const eaten = (data.yesterdayNutrition[0]?.nutritionLogEntries ?? []).reduce(
    (total, entry) =>
      total + (normalizeNumeric(entry.grams) / 100) * normalizeNumeric(entry.snapshotKcalPer100g),
    0,
  );

  return (
    <SectionCard title="Balance" link={{ label: "Energy", to: "/progress/energy" }}>
      {energy ? (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-[13px] text-muted-foreground">Yesterday</span>
              <strong className="text-[26px] font-semibold tabular-nums">
                {signedKcalFormat.format(eaten - out)} kcal
              </strong>
            </div>
            <span className="text-[13px] text-muted-foreground tabular-nums">
              In {kcalFormat.format(eaten)} · Out {kcalFormat.format(out)}
            </span>
          </div>
          {out > 0 ? (
            <>
              <div
                className="flex h-2.5 gap-0.5 overflow-hidden rounded-full"
                role="img"
                aria-label={`Energy out: resting ${kcalFormat.format(resting)}, active ${kcalFormat.format(active)} kilocalories`}
              >
                <span className="bg-primary" style={{ flex: resting }} />
                <span className="bg-chart-2" style={{ flex: active }} />
              </div>
              <div className="flex gap-4 text-[13px] text-muted-foreground tabular-nums">
                <Legend className="bg-primary">Resting {kcalFormat.format(resting)}</Legend>
                <Legend className="bg-chart-2">Active {kcalFormat.format(active)}</Legend>
              </div>
            </>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No energy logged for yesterday.</p>
      )}
      <TodayEnergyEstimate />
    </SectionCard>
  );
}

function Legend({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className={`size-2 rounded-sm ${className}`} />
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Body

function average(values: number[]) {
  return values.length > 0
    ? values.reduce((total, value) => total + value, 0) / values.length
    : null;
}

function BodyCard({ data, today }: { data: Overview; today: string }) {
  const rows = data.bodyMeasurements;
  const weights = rows
    .filter((row) => row.weightKg !== null && row.weightKg !== undefined)
    .map((row) => ({ date: row.measuredOn, value: normalizeNumeric(row.weightKg) }));
  const latestWeight = weights.at(-1);
  const latestFat = [...rows]
    .reverse()
    .find((row) => row.bodyFatPct !== null && row.bodyFatPct !== undefined);
  const weekStart = addLocalDateDays(today, -6);
  const priorStart = addLocalDateDays(today, -13);
  const current = average(weights.filter((w) => w.date >= weekStart).map((w) => w.value));
  const prior = average(
    weights.filter((w) => w.date >= priorStart && w.date < weekStart).map((w) => w.value),
  );
  const rolling = weights.map((point) => {
    const from = addLocalDateDays(point.date, -6);
    return (
      average(weights.filter((w) => w.date >= from && w.date <= point.date).map((w) => w.value)) ??
      point.value
    );
  });

  return (
    <SectionCard title="Body" link={{ label: "Trend", to: "/progress/body" }}>
      {latestWeight || latestFat ? (
        <div className="flex flex-wrap items-end justify-between gap-4">
          {latestWeight ? (
            <div className="flex flex-col gap-0.5">
              <span className="text-[13px] text-muted-foreground">
                Weight · {formatDateShort(latestWeight.date)}
              </span>
              <strong className="text-[26px] font-semibold tabular-nums">
                {latestWeight.value.toFixed(2)} kg
              </strong>
              {current === null ? null : (
                <span className="text-[13px] font-semibold text-muted-foreground tabular-nums">
                  7-day avg {current.toFixed(1)}
                  {prior === null
                    ? ""
                    : ` · ${current - prior >= 0 ? "+" : "−"}${Math.abs(current - prior).toFixed(1)} vs prior week`}
                </span>
              )}
            </div>
          ) : null}
          {latestFat ? (
            <div className="flex flex-col gap-0.5">
              <span className="text-[13px] text-muted-foreground">Body fat</span>
              <strong className="text-[26px] font-semibold tabular-nums">
                {normalizeNumeric(latestFat.bodyFatPct).toFixed(1)} %
              </strong>
            </div>
          ) : null}
          {latestWeight ? (
            <Sparkline
              values={rolling}
              label={describeTrend(
                weights.map((point, index) => ({
                  date: localDateToDate(point.date)?.getTime() ?? Number.NaN,
                  value: rolling[index] ?? null,
                })),
                { label: "Seven-day average weight", unit: "kg" },
              )}
              className="ml-auto"
            />
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No measurements in the last three weeks.</p>
      )}
    </SectionCard>
  );
}
