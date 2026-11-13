import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { type ReactNode, useRef } from "react";
import { Button } from "@/components/ui/button";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";
import { useAuth } from "@/lib/nhost/auth-provider";
import {
  addLocalDateDays,
  isValidLocalDate,
  localDateToDate,
  normalizeNumeric,
} from "@/lib/nutrition";
import { useLocalToday } from "@/lib/use-local-today";
import { cn } from "@/lib/utils";

const NutritionWeekQuery = graphql(`
  query NutritionWeekStrip($from: date!, $through: date!) {
    nutritionDays(where: { logDate: { _gte: $from, _lte: $through } }) {
      id
      logDate
      nutritionLogEntries {
        id
        grams
        snapshotKcalPer100g
      }
    }
  }
`);

const kcalFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

/** Monday of the week that contains `date` (YYYY-MM-DD, local). */
function weekStart(date: string): string {
  const parsed = localDateToDate(date);
  if (!parsed) {
    return date;
  }
  return addLocalDateDays(date, -((parsed.getDay() + 6) % 7));
}

function dayLabel(date: string, options: Intl.DateTimeFormatOptions): string {
  return localDateToDate(date)?.toLocaleDateString(undefined, options) ?? date;
}

/**
 * Day navigation for the nutrition log: previous/next day, a date picker and
 * a week strip with each day's logged kilocalories.
 */
export function DayNavigator({ date, children }: { date: string; children?: ReactNode }) {
  const today = useLocalToday();
  const navigate = useNavigate();
  const pickerRef = useRef<HTMLInputElement | null>(null);
  const parsed = localDateToDate(date);
  const sameYear = parsed?.getFullYear() === new Date().getFullYear();
  const label = dayLabel(date, {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });

  function goTo(next: string) {
    if (isValidLocalDate(next)) {
      navigate({ to: "/nutrition/log/$date", params: { date: next } });
    }
  }

  function openPicker() {
    const input = pickerRef.current;
    if (!input) {
      return;
    }
    try {
      input.showPicker();
    } catch {
      input.focus();
      input.click();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Button asChild size="icon" variant="outline" aria-label="Previous day">
            <Link to="/nutrition/log/$date" params={{ date: addLocalDateDays(date, -1) }}>
              <ChevronLeft />
            </Link>
          </Button>
          <div className="relative">
            <Button
              type="button"
              variant="outline"
              className="min-w-[9.5rem] tabular-nums"
              onClick={openPicker}
              aria-label={`Choose a date. Showing ${date === today ? "today, " : ""}${label}`}
            >
              <CalendarDays />
              {date === today ? `Today · ${label}` : label}
            </Button>
            <input
              ref={pickerRef}
              type="date"
              value={date}
              max="9999-12-31"
              onChange={(event) => goTo(event.target.value)}
              tabIndex={-1}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
            />
          </div>
          <Button asChild size="icon" variant="outline" aria-label="Next day">
            <Link to="/nutrition/log/$date" params={{ date: addLocalDateDays(date, 1) }}>
              <ChevronRight />
            </Link>
          </Button>
          {date === today ? null : (
            <Button asChild size="sm" variant="ghost">
              <Link to="/nutrition/log/$date" params={{ date: today }}>
                Today
              </Link>
            </Button>
          )}
        </div>
        {children}
      </div>
      <WeekStrip date={date} today={today} />
    </div>
  );
}

function WeekStrip({ date, today }: { date: string; today: string }) {
  const { user } = useAuth();
  const from = weekStart(date);
  const through = addLocalDateDays(from, 6);
  const days = Array.from({ length: 7 }, (_, index) => addLocalDateDays(from, index));
  const { data } = useQuery({
    // Lives under ["nutrition", "days", "index"] so log mutations refresh it.
    queryKey: ["nutrition", "days", "index", "week", from, user?.id],
    queryFn: () => gqlRequest(NutritionWeekQuery, { from, through }),
    enabled: !!user,
  });
  const kcalByDay = new Map<string, number>();
  for (const day of data?.nutritionDays ?? []) {
    const kcal = day.nutritionLogEntries.reduce(
      (sum, entry) =>
        sum + (normalizeNumeric(entry.grams) / 100) * normalizeNumeric(entry.snapshotKcalPer100g),
      0,
    );
    kcalByDay.set(day.logDate, kcal);
  }

  return (
    <nav aria-label="Week" className="grid grid-cols-7 gap-1 rounded-xl border bg-card p-1">
      {days.map((day) => {
        const active = day === date;
        const kcal = kcalByDay.get(day);
        return (
          <Link
            key={day}
            to="/nutrition/log/$date"
            params={{ date: day }}
            aria-current={active ? "date" : undefined}
            aria-label={`${dayLabel(day, { weekday: "long", day: "numeric", month: "long" })}${
              kcal ? `, ${kcalFormat.format(kcal)} kilocalories logged` : ", nothing logged"
            }`}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-center transition-colors hover:bg-muted/60",
              active && "bg-primary text-primary-foreground hover:bg-primary",
            )}
          >
            <span className={cn("text-[11px] font-semibold uppercase", !active && "opacity-75")}>
              {dayLabel(day, { weekday: "short" })}
            </span>
            <span
              className={cn(
                "text-[15px] font-semibold tabular-nums",
                day === today && !active && "text-link",
              )}
            >
              {localDateToDate(day)?.getDate()}
            </span>
            <span className={cn("text-[11px] tabular-nums", !active && "text-muted-foreground")}>
              {kcal ? kcalFormat.format(kcal) : "–"}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
