import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { graphql } from "@/gql";
import { calculateDailyEnergyProjection, type DailyEnergyNumericValue } from "@/lib/daily-energy";
import { todayLocalISO } from "@/lib/dates";
import { gqlRequest } from "@/lib/graphql";
import { useAuth } from "@/lib/nhost/auth-provider";
import { addLocalDateDays, normalizeNumeric } from "@/lib/nutrition";

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

interface Props {
  date?: string;
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

/** Keep today's identity correct across midnight, foreground returns and DST. */
function useLocalToday() {
  const [today, setToday] = useState(todayLocalISO);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      setToday(todayLocalISO());
      clearTimeout(timer);
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      timer = setTimeout(update, Math.max(1, midnight.getTime() - Date.now()));
    };
    update();
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return today;
}

export function TodayEnergyEstimate({ date, balance }: Props) {
  const today = useLocalToday();
  if (date && date !== today) {
    return null;
  }
  return <TodayEstimateContent today={today} balance={balance} />;
}

function TodayEstimateContent({ today, balance }: { today: string; balance: Props["balance"] }) {
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

  return (
    <Card className="border-border/60 bg-muted/20">
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
