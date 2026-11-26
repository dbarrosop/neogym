import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Scale } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { z } from "zod";
import { BodyMetricTrendColumn } from "@/components/body-metrics-chart";
import { HealthSourceTag, isHealthImport, visibleNotes } from "@/components/health-source-tag";
import { ListFooter } from "@/components/patterns/list-footer";
import { ActionLabel, PageHeader, PageShell } from "@/components/patterns/page-shell";
import { EmptyState, ErrorState, SkeletonState } from "@/components/patterns/query-states";
import { Segmented } from "@/components/patterns/segmented";
import { QuickBodyMeasurementForm } from "@/components/progress/quick-entry-forms";
import { AreaTabs } from "@/components/shell/area-tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { BodyMeasurementsQuery } from "@/gql/graphql";
import { buildBodyTrend } from "@/lib/body-trend";
import { formatDateShort } from "@/lib/dates";
import { useBodyMeasurements } from "@/lib/hooks/use-body-measurements";
import { metricFormat } from "@/lib/metric-format";
import {
  ENTRY_HISTORY_PAGE_SIZE,
  entryHistoryWindow,
  nextEntryHistoryLimit,
} from "@/lib/progress-entries";
import { chartWindow, chartWindowFrom, numericOrNull } from "@/lib/rolling-average";
import { useLocalToday } from "@/lib/use-local-today";

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

type Measurement = BodyMeasurementsQuery["bodyMeasurements"][number];

// The side "Log measurement" card sits beside the content once the page has
// room for both (560 + 20 + 280 px, as on the board); below that it follows the
// list and the header carries the Log action instead.
const SIDE_BY_SIDE = "@min-[860px]:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]";
// Wrapped below the content, the card keeps its board width (340 px) unless
// the page is phone-narrow.
const SIDE_COLUMN = "min-w-0 @min-[560px]:max-w-[340px] @min-[860px]:max-w-none";

function BodyRoute() {
  const query = useBodyMeasurements();

  function renderContent() {
    if (query.isPending) {
      return (
        <SkeletonState className="flex flex-col gap-5">
          <Skeleton className="h-[330px] w-full rounded-xl" />
          <Skeleton className="h-60 w-full rounded-xl" />
        </SkeletonState>
      );
    }
    const error = query.error ? (
      <ErrorState
        title="Couldn't load body measurements"
        message={query.error.message}
        onRetry={() => query.refetch()}
        isRetrying={query.isFetching}
      />
    ) : null;
    if (!query.data) {
      return error;
    }
    const measurements = query.data.bodyMeasurements;
    if (measurements.length === 0) {
      return (
        <div className="flex min-w-0 flex-col gap-5">
          {error}
          <EmptyState
            icon={Scale}
            title="No measurements yet"
            description="Log weight or body fat to see your trend here."
          />
        </div>
      );
    }
    return (
      <div className="flex min-w-0 flex-col gap-5">
        {error}
        <BodyTrendCard measurements={measurements} />
        <MeasurementsTable measurements={measurements} />
      </div>
    );
  }

  return (
    <PageShell maxWidth="6xl" contentClassName="@container">
      <PageHeader
        title="Progress"
        tabs={<AreaTabs area="progress" />}
        actions={
          <Button asChild className="@min-[860px]:hidden">
            <Link to="/progress/body/new">
              <Plus />
              <ActionLabel>Log measurement</ActionLabel>
            </Link>
          </Button>
        }
      />
      <Link
        to="/progress/body/photos"
        preload={false}
        className="inline-flex min-h-11 items-center text-sm font-medium text-link underline underline-offset-4"
      >
        Progress photos
      </Link>
      <div className={`grid items-start gap-5 ${SIDE_BY_SIDE}`}>
        {renderContent()}
        <div className={SIDE_COLUMN}>
          <QuickBodyMeasurementForm />
        </div>
      </div>
    </PageShell>
  );
}

function BodyTrendCard({ measurements }: { measurements: Measurement[] }) {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const titleId = useId();
  const today = useLocalToday();
  const days: PeriodDays = search.days ?? 30;
  // "All" starts at the oldest measurement (newest first, so the last row).
  const oldest = measurements.at(-1)?.measuredOn ?? today;
  const range =
    days === 0
      ? chartWindowFrom(oldest.localeCompare(today) < 0 ? oldest : today, today)
      : chartWindow(days, today);
  const trend = useMemo(
    () => buildBodyTrend(measurements, { today, start: range.start, end: range.end }),
    [measurements, today, range.start, range.end],
  );
  return (
    <section
      aria-labelledby={titleId}
      className="flex min-w-0 flex-col gap-[18px] rounded-xl border bg-card p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={titleId} className="text-[15px] font-semibold">
          Weight &amp; body fat
        </h2>
        <Segmented
          label="Period"
          options={PERIODS}
          value={days}
          onChange={(value) =>
            navigate({ search: (prev) => ({ ...prev, days: value }), replace: true })
          }
        />
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-7">
        <BodyMetricTrendColumn kind="weight" metric={trend.weight} domain={range} />
        <BodyMetricTrendColumn kind="bodyFat" metric={trend.bodyFat} domain={range} />
      </div>
    </section>
  );
}

function formatted(value: unknown, format: (value: number) => string) {
  const number = numericOrNull(value);
  return number === null ? "—" : format(number);
}

function MeasurementsTable({ measurements }: { measurements: Measurement[] }) {
  const [limit, setLimit] = useState(ENTRY_HISTORY_PAGE_SIZE);
  const history = entryHistoryWindow(measurements, limit);
  return (
    <section aria-label="Measurements" className="overflow-hidden rounded-xl border bg-card">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th scope="col" className="px-4 py-2.5 font-semibold">
              Date
            </th>
            <th scope="col" className="px-4 py-2.5 text-right font-semibold">
              Weight
            </th>
            <th scope="col" className="px-4 py-2.5 text-right font-semibold">
              Body fat
            </th>
            <th scope="col" className="hidden px-4 py-2.5 font-semibold sm:table-cell">
              Notes
            </th>
          </tr>
        </thead>
        <tbody>
          {history.visible.map((m) => (
            <tr key={m.id} className="h-[46px] border-b last:border-b-0 hover:bg-muted/40">
              <td className="px-4 py-2">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Link
                    to="/progress/body/$id"
                    params={{ id: m.id }}
                    className="font-medium whitespace-nowrap hover:text-link"
                  >
                    {formatDateShort(m.measuredOn)}
                  </Link>
                  {isHealthImport(m.notes) ? <HealthSourceTag /> : null}
                </span>
              </td>
              <td className="px-4 text-right font-semibold whitespace-nowrap">
                {formatted(m.weightKg, metricFormat.weight)}
              </td>
              <td className="px-4 text-right whitespace-nowrap">
                {formatted(m.bodyFatPct, metricFormat.bodyFat)}
              </td>
              <td className="hidden max-w-0 truncate px-4 text-muted-foreground sm:table-cell">
                {visibleNotes(m.notes)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ListFooter
        shown={history.shown}
        total={history.total}
        noun="entries"
        onLoadMore={() => setLimit(nextEntryHistoryLimit)}
      />
    </section>
  );
}
