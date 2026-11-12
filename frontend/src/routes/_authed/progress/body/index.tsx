import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";
import { BodyMetricsChart, type BodyMetricsPoint } from "@/components/body-metrics-chart";
import { PageHeader, PageShell } from "@/components/patterns/page-shell";
import { EmptyState, ErrorState } from "@/components/patterns/query-states";
import { Segmented } from "@/components/patterns/segmented";
import { QuickBodyMeasurementForm } from "@/components/progress/quick-entry-forms";
import { AreaTabs } from "@/components/shell/area-tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import type { BodyMeasurementsQuery as BodyMeasurementsData } from "@/gql/graphql";
import { formatDateShort, parseDateOnly } from "@/lib/dates";
import { gqlRequest } from "@/lib/graphql";
import { addLocalDateDays } from "@/lib/nutrition";
import { useLocalToday } from "@/lib/use-local-today";

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

const PERIODS = [
  { value: 30, label: "30 d" },
  { value: 90, label: "90 d" },
  { value: 365, label: "1 y" },
  { value: 0, label: "All" },
] as const;
type PeriodDays = (typeof PERIODS)[number]["value"];

const searchSchema = z.object({
  days: z.union([z.literal(30), z.literal(90), z.literal(365), z.literal(0)]).optional(),
});

export const Route = createFileRoute("/_authed/progress/body/")({
  validateSearch: searchSchema,
  component: BodyRoute,
});

type Measurement = BodyMeasurementsData["bodyMeasurements"][number];

const TABLE_PAGE = 20;

function numberOrNull(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function average(values: number[]): number | null {
  return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
}

function BodyRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const today = useLocalToday();
  const days: PeriodDays = search.days ?? 90;
  const { data, isLoading, error } = useQuery({
    queryKey: ["body_measurements"],
    queryFn: () => gqlRequest(BodyMeasurementsQuery),
  });
  const measurements = useMemo(() => data?.bodyMeasurements ?? [], [data]);

  const chartPoints = useMemo<BodyMetricsPoint[]>(() => {
    const since = days > 0 ? addLocalDateDays(today, -days) : "";
    return measurements
      .filter((m) => m.measuredOn >= since)
      .map((m) => ({ m, time: parseDateOnly(m.measuredOn)?.getTime() ?? null }))
      .filter((x): x is { m: Measurement; time: number } => x.time !== null)
      .sort((a, b) => a.time - b.time)
      .map(({ m, time }) => ({
        date: time,
        weightKg: numberOrNull(m.weightKg),
        bodyFatPct: numberOrNull(m.bodyFatPct),
      }));
  }, [measurements, days, today]);

  const content = (() => {
    if (isLoading) {
      return (
        <div className="flex flex-col gap-5">
          <Skeleton className="h-80 w-full rounded-xl" />
          <Skeleton className="h-60 w-full rounded-xl" />
        </div>
      );
    }
    if (error) {
      return <ErrorState title="Couldn't load body measurements" message={error.message} />;
    }
    if (measurements.length === 0) {
      return (
        <EmptyState
          title="No measurements yet"
          description="Log weight or body fat to see your trend here."
        />
      );
    }
    return (
      <div className="flex flex-col gap-5">
        <section
          aria-label="Body trend"
          className="flex flex-col gap-4 rounded-xl border bg-card p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <BodyStats measurements={measurements} today={today} />
            <Segmented
              label="Chart period"
              options={PERIODS}
              value={days}
              onChange={(value) =>
                navigate({ search: (prev) => ({ ...prev, days: value }), replace: true })
              }
            />
          </div>
          {chartPoints.length >= 2 ? (
            <BodyMetricsChart points={chartPoints} />
          ) : (
            <p className="rounded-lg bg-surface-inset px-3 py-8 text-center text-sm text-muted-foreground">
              Not enough measurements in this period to draw a trend.
            </p>
          )}
        </section>
        <MeasurementsTable measurements={measurements} />
      </div>
    );
  })();

  return (
    <PageShell maxWidth="6xl">
      <PageHeader
        title="Progress"
        tabs={<AreaTabs area="progress" />}
        actions={
          <Button asChild className="lg:hidden">
            <Link to="/progress/body/new">
              <Plus />
              Log measurement
            </Link>
          </Button>
        }
      />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {content}
        <aside className="hidden lg:sticky lg:top-6 lg:block">
          <QuickBodyMeasurementForm />
        </aside>
      </div>
    </PageShell>
  );
}

function BodyStats({ measurements, today }: { measurements: Measurement[]; today: string }) {
  const weekStart = addLocalDateDays(today, -6);
  const priorStart = addLocalDateDays(today, -13);
  const weights = measurements
    .filter((m) => m.weightKg !== null && m.weightKg !== undefined)
    .map((m) => ({ day: m.measuredOn, value: Number(m.weightKg) }));
  const current = average(weights.filter((w) => w.day >= weekStart).map((w) => w.value));
  const prior = average(
    weights.filter((w) => w.day >= priorStart && w.day < weekStart).map((w) => w.value),
  );
  const latestWeight = weights[0];
  const latestFat = measurements.find((m) => m.bodyFatPct !== null && m.bodyFatPct !== undefined);
  return (
    <dl className="flex flex-wrap gap-x-10 gap-y-3">
      <div className="flex flex-col gap-0.5">
        <dt className="text-[13px] text-muted-foreground">
          {current === null ? "Weight · latest" : "Weight · 7-day avg"}
        </dt>
        <dd className="text-[28px] leading-tight font-semibold tabular-nums">
          {current === null
            ? `${latestWeight ? latestWeight.value.toFixed(1) : "—"} kg`
            : `${current.toFixed(1)} kg`}
        </dd>
        {current !== null && prior !== null ? (
          <dd className="text-[13px] font-medium text-muted-foreground tabular-nums">
            {current - prior >= 0 ? "+" : "−"}
            {Math.abs(current - prior).toFixed(1)} kg vs prior 7 days
          </dd>
        ) : null}
      </div>
      {latestFat ? (
        <div className="flex flex-col gap-0.5">
          <dt className="text-[13px] text-muted-foreground">Body fat · latest</dt>
          <dd className="text-[28px] leading-tight font-semibold tabular-nums">
            {Number(latestFat.bodyFatPct).toFixed(1)} %
          </dd>
          <dd className="text-[13px] text-muted-foreground">
            {formatDateShort(latestFat.measuredOn)}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

function MeasurementsTable({ measurements }: { measurements: Measurement[] }) {
  const [limit, setLimit] = useState(TABLE_PAGE);
  const visible = measurements.slice(0, limit);
  return (
    <section aria-label="Measurements" className="overflow-hidden rounded-xl border bg-card">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="text-left text-[12px] text-muted-foreground">
            <th scope="col" className="py-2.5 pl-4 font-medium">
              Date
            </th>
            <th scope="col" className="text-right font-medium">
              Weight
            </th>
            <th scope="col" className="pr-4 text-right font-medium sm:pr-0">
              Body fat
            </th>
            <th scope="col" className="hidden pr-4 pl-6 font-medium sm:table-cell">
              Notes
            </th>
          </tr>
        </thead>
        <tbody>
          {visible.map((m) => (
            <tr key={m.id} className="border-t hover:bg-muted/40">
              <td className="py-2.5 pl-4">
                <Link
                  to="/progress/body/$id"
                  params={{ id: m.id }}
                  className="font-medium hover:text-link"
                >
                  {formatDateShort(m.measuredOn)}
                </Link>
              </td>
              <td className="text-right">
                {m.weightKg === null || m.weightKg === undefined
                  ? "—"
                  : `${Number(m.weightKg).toFixed(2)} kg`}
              </td>
              <td className="pr-4 text-right sm:pr-0">
                {m.bodyFatPct === null || m.bodyFatPct === undefined
                  ? "—"
                  : `${Number(m.bodyFatPct).toFixed(1)} %`}
              </td>
              <td className="hidden max-w-0 truncate pr-4 pl-6 text-muted-foreground sm:table-cell">
                {m.notes ?? ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {measurements.length > limit ? (
        <div className="border-t px-4 py-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setLimit((v) => v + 40)}>
            Show more
          </Button>
        </div>
      ) : null}
    </section>
  );
}
