import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, ChevronRight, Plus } from "lucide-react";
import { MacroSummary } from "@/components/macro-summary";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";
import { formatLocalDate, formatLocalDateLabel, loggedMacroTotals } from "@/lib/nutrition";

const NutritionDaysIndexQuery = graphql(`
  query NutritionDaysIndex {
    nutritionDays(order_by: [{ logDate: desc }], limit: 14) {
      id
      logDate
      nutritionPlan {
        id
        name
      }
      nutritionLogMeals {
        id
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
      nutritionLogEntries(where: { nutritionLogMealId: { _is_null: true } }) {
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
  }
`);

export const Route = createFileRoute("/_authed/nutrition/days/")({
  component: NutritionDaysIndexRoute,
});

type NutritionDay = {
  id: string;
  logDate: string;
  nutritionPlan?: { id: string; name: string } | null;
  nutritionLogMeals: Array<{
    id: string;
    nutritionLogEntries: LoggedEntry[];
  }>;
  nutritionLogEntries: LoggedEntry[];
};

type LoggedEntry = {
  id: string;
  grams: unknown;
  snapshotKcalPer100g: unknown;
  snapshotFatPer100g: unknown;
  snapshotCarbsPer100g: unknown;
  snapshotProteinPer100g: unknown;
  snapshotFiberPer100g: unknown;
  snapshotSugarPer100g: unknown;
};

function NutritionDaysIndexRoute() {
  const today = formatLocalDate();
  const { data, isLoading, error } = useQuery({
    queryKey: ["nutrition", "days", "index"],
    queryFn: () => gqlRequest(NutritionDaysIndexQuery),
  });

  const days: NutritionDay[] = data?.nutritionDays ?? [];

  function renderContent() {
    if (isLoading) {
      return <DaysSkeleton />;
    }
    if (error) {
      return <ErrorCard message={error.message} />;
    }
    if (days.length === 0) {
      return (
        <Card className="border-border/60 border-dashed">
          <CardContent className="space-y-3 py-10 text-center text-sm text-muted-foreground">
            <p>No daily intake logs yet. Open today to start logging foods and meals.</p>
            <Button asChild size="sm">
              <Link to="/nutrition/days/$date" params={{ date: today }}>
                <Plus className="h-4 w-4" />
                Open today
              </Link>
            </Button>
          </CardContent>
        </Card>
      );
    }
    return (
      <Card className="border-border/60 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <CardContent className="px-2 py-2">
          <ul className="divide-y divide-border/50">
            {days.map((day) => (
              <DayRow key={day.id} day={day} />
            ))}
          </ul>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Daily logs</h2>
          <p className="text-sm text-muted-foreground">
            Open a local calendar day to pick plan suggestions, log meals and foods, and edit
            historical entries.
          </p>
        </div>
        <Button asChild size="sm" className="shrink-0">
          <Link to="/nutrition/days/$date" params={{ date: today }}>
            <CalendarDays className="h-4 w-4" />
            <span className="hidden sm:inline">Today</span>
            <span className="sm:hidden">Today</span>
          </Link>
        </Button>
      </div>

      {renderContent()}
    </div>
  );
}

function DayRow({ day }: { day: NutritionDay }) {
  const entries = [
    ...day.nutritionLogEntries,
    ...day.nutritionLogMeals.flatMap((meal) => meal.nutritionLogEntries),
  ];
  const totals = loggedMacroTotals(entries);

  return (
    <li>
      <Link
        to="/nutrition/days/$date"
        params={{ date: day.logDate }}
        className="group flex min-h-16 items-center justify-between gap-3 rounded-md px-3 py-3 transition-colors hover:bg-accent/50"
      >
        <span className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <CalendarDays className="h-4 w-4" />
          </span>
          <span className="min-w-0 space-y-1">
            <span className="truncate text-sm font-medium">
              {formatLocalDateLabel(day.logDate)}
            </span>
            <span className="line-clamp-2 text-xs text-muted-foreground">
              {entries.length} logged entr{entries.length === 1 ? "y" : "ies"}
              {day.nutritionPlan ? ` · Plan: ${day.nutritionPlan.name}` : ""}
            </span>
            <MacroSummary totals={totals} compact />
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-foreground" />
      </Link>
    </li>
  );
}

function DaysSkeleton() {
  return (
    <Card className="border-border/60">
      <CardContent className="space-y-3 p-4">
        {[0, 1, 2].map((item) => (
          <div key={item} className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="py-4">
        <p className="text-sm text-destructive">Failed to load daily logs: {message}</p>
      </CardContent>
    </Card>
  );
}
