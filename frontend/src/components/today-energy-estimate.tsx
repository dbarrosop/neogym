import { useQuery } from "@tanstack/react-query";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { graphql } from "@/gql";
import {
  calculateDailyEnergyProjection,
  type DailyEnergyNumericValue,
  type DailyEnergyProjection,
} from "@/lib/daily-energy";
import { gqlRequest } from "@/lib/graphql";
import { formatApprox, formatKcal, formatSignedKcal } from "@/lib/metric-format";
import { useAuth } from "@/lib/nhost/auth-provider";
import { addLocalDateDays, normalizeNumeric } from "@/lib/nutrition";
import { useLocalToday } from "@/lib/use-local-today";
import { cn } from "@/lib/utils";

const TodayEnergyEstimateQuery = graphql(`
  query TodayEnergyEstimate($today: date!, $since: date!) {
    dailyEnergyEntries(where: { energyOn: { _gte: $since, _lte: $today } }, order_by: { energyOn: desc }) {
      energyOn
      activeKcal
      restingKcal
    }
    nutritionDays(where: { logDate: { _eq: $today } }, limit: 1) {
      nutritionLogEntries(where: { nutritionLogMealId: { _is_null: true } }) {
        grams
        snapshotKcalPer100g
      }
      nutritionLogMeals {
        nutritionLogEntries { grams snapshotKcalPer100g }
      }
    }
  }
`);

/**
 * Where the estimate sits (see the Today, Nutrition › Log and Energy boards):
 * - "default": the original inset card ("Estimated today"); kept until every
 *   caller opts into a board variant.
 * - "today": inset box inside the Balance card, "By end of day, estimated",
 *   Burned ≈ / Net ≈ and "Net counts only food logged so far."
 * - "log": bordered surface card in the day summary rail.
 * - "energy": bordered surface card with a 15 px title and three rows,
 *   including the logged intake.
 */
export type TodayEnergyEstimateVariant = "default" | "today" | "log" | "energy";

interface Props {
  date?: string;
  variant?: TodayEnergyEstimateVariant;
  className?: string;
  /** Owner-scoped live intake totals avoid stale sibling reads after food edits. */
  balance?: {
    userId: string;
    caloriesIn: number;
    dailyEnergy: {
      activeKcal?: DailyEnergyNumericValue;
      restingKcal?: DailyEnergyNumericValue;
    } | null;
  };
}

export function TodayEnergyEstimate({ date, balance, variant = "default", className }: Props) {
  const today = useLocalToday();
  if (date && date !== today) {
    return null;
  }
  return (
    <TodayEstimateContent today={today} balance={balance} variant={variant} className={className} />
  );
}

function TodayEstimateContent({
  today,
  balance,
  variant,
  className,
}: {
  today: string;
  balance: Props["balance"];
  variant: TodayEnergyEstimateVariant;
  className: string | undefined;
}) {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["nutrition", "energy-projection", today, user?.id],
    queryFn: () =>
      gqlRequest(TodayEnergyEstimateQuery, { today, since: addLocalDateDays(today, -7) }),
    enabled: !!user,
    refetchOnMount: "always",
  });
  if (!user) {
    return null;
  }
  const ownedBalance = balance?.userId === user.id ? balance : undefined;
  const history = query.data?.dailyEnergyEntries ?? [];
  const energy = ownedBalance
    ? ownedBalance.dailyEnergy
    : history.find((entry) => entry.energyOn === today);
  const day = query.data?.nutritionDays[0];
  const caloriesIn =
    ownedBalance?.caloriesIn ??
    [
      ...(day?.nutritionLogEntries ?? []),
      ...(day?.nutritionLogMeals.flatMap((meal) => meal.nutritionLogEntries) ?? []),
    ].reduce(
      (total, entry) =>
        total + (normalizeNumeric(entry.grams) / 100) * normalizeNumeric(entry.snapshotKcalPer100g),
      0,
    );
  const projection = calculateDailyEnergyProjection({
    date: today,
    today,
    caloriesIn,
    dailyEnergy: energy ? { ...energy, energyOn: today } : null,
    history,
  });

  if (variant !== "default") {
    return (
      <EstimatePanel
        variant={variant}
        className={className}
        projection={projection}
        caloriesIn={caloriesIn}
        error={!!query.error}
        pending={query.isPending}
        onRetry={() => query.refetch()}
      />
    );
  }

  return (
    <Card className={cn("bg-surface-inset py-0 shadow-none", className)}>
      <CardContent className="space-y-3 p-4">
        <h3 className="text-sm font-medium">Estimated today</h3>
        {query.error ? (
          <div className="text-xs text-muted-foreground">
            Estimate unavailable.{" "}
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => query.refetch()}
            >
              Retry
            </Button>
          </div>
        ) : null}
        {!query.error && projection ? (
          <dl className="grid grid-cols-2 gap-3">
            <EstimateMetric label="Estimated burned today" value={projection.estimatedBurnedKcal} />
            <EstimateMetric
              label="Estimated net today"
              value={projection.estimatedNetKcal}
              signed
            />
          </dl>
        ) : null}
        {!query.error && !projection ? (
          <p className="text-xs text-muted-foreground">
            {query.isPending ? "Loading estimate…" : "Not enough energy data."}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function EstimateMetric({
  label,
  value,
  signed = false,
}: {
  label: string;
  value: number;
  signed?: boolean;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">
        ≈
        {value.toLocaleString(undefined, {
          maximumFractionDigits: 0,
          signDisplay: signed ? "exceptZero" : "auto",
        })}{" "}
        kcal
      </dd>
    </div>
  );
}

const PANEL_CLASS = {
  today: "gap-3 rounded-[12px] border bg-surface-inset p-4",
  log: "gap-3 rounded-[14px] border bg-card p-4",
  energy: "gap-3 rounded-[14px] border bg-card px-5 py-[18px]",
} as const;

const PANEL_TITLE = {
  today: "By end of day, estimated",
  log: "Estimated today",
  energy: "Estimated today",
} as const;

/** "≈ 2,312 kcal"; signed values add "+" or U+2212 ("≈ −851 kcal"). */
export function formatApproxKcal(value: number, signed = false): string {
  return formatApprox(signed ? formatSignedKcal(value) : formatKcal(value));
}

function EstimatePanel({
  variant,
  className,
  projection,
  caloriesIn,
  error,
  pending,
  onRetry,
}: {
  variant: Exclude<TodayEnergyEstimateVariant, "default">;
  className: string | undefined;
  projection: DailyEnergyProjection | null;
  caloriesIn: number;
  error: boolean;
  pending: boolean;
  onRetry: () => void;
}) {
  const Heading = variant === "energy" ? "h2" : "h3";
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className={cn("flex flex-col tabular-nums", PANEL_CLASS[variant], className)}
    >
      <Heading
        id={headingId}
        className={
          variant === "energy" ? "text-[15px] font-bold" : "text-sm font-medium text-foreground"
        }
      >
        {PANEL_TITLE[variant]}
      </Heading>
      {error ? (
        <div className="text-xs text-muted-foreground">
          Estimate unavailable.{" "}
          <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : null}
      {!error && projection ? (
        <EstimateRows variant={variant} projection={projection} caloriesIn={caloriesIn} />
      ) : null}
      {!error && !projection ? (
        <p className="text-xs text-muted-foreground">
          {pending ? "Loading estimate…" : "Not enough energy data."}
        </p>
      ) : null}
      {variant === "today" && !error && projection ? (
        <p className="text-xs text-tertiary-foreground">Net counts only food logged so far.</p>
      ) : null}
    </section>
  );
}

function EstimateRows({
  variant,
  projection,
  caloriesIn,
}: {
  variant: Exclude<TodayEnergyEstimateVariant, "default">;
  projection: DailyEnergyProjection;
  caloriesIn: number;
}) {
  const burned = formatApproxKcal(projection.estimatedBurnedKcal);
  const net = formatApproxKcal(projection.estimatedNetKcal, true);
  if (variant === "energy") {
    return (
      <dl className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-2 text-sm">
        <dt className="text-[13px] text-muted-foreground">Estimated burned today</dt>
        <dd className="text-right font-semibold">{burned}</dd>
        <dt className="text-[13px] text-muted-foreground">Logged intake</dt>
        <dd className="text-right font-semibold">{formatKcal(caloriesIn)}</dd>
        <dt className="text-[13px] text-muted-foreground">Estimated net today</dt>
        <dd className="text-right font-semibold">{net}</dd>
      </dl>
    );
  }
  const labels =
    variant === "today"
      ? { burned: "Burned", net: "Net" }
      : { burned: "Estimated burned today", net: "Estimated net today" };
  return (
    <dl className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-1">
        <dt className="text-xs text-muted-foreground">{labels.burned}</dt>
        <dd className="font-medium">{burned}</dd>
      </div>
      <div className="flex flex-col gap-1">
        <dt className="text-xs text-muted-foreground">{labels.net}</dt>
        <dd className="font-medium">{net}</dd>
      </div>
    </dl>
  );
}
