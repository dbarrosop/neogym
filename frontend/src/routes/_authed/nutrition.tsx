import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Apple, CalendarClock, CalendarDays, ChefHat, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authed/nutrition")({
  component: NutritionLayoutRoute,
});

const TABS = [
  { to: "/nutrition", label: "Overview", Icon: ClipboardList, exact: true },
  { to: "/nutrition/days", label: "Days", Icon: CalendarDays, exact: false },
  { to: "/nutrition/plans", label: "Plans", Icon: CalendarClock, exact: false },
  { to: "/nutrition/foods", label: "Foods", Icon: Apple, exact: false },
  { to: "/nutrition/meals", label: "Meals", Icon: ChefHat, exact: false },
] as const;

function NutritionLayoutRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <section className="grid-bg min-h-[calc(100vh-3.5rem)] px-4 pt-6 pb-24 md:pb-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Nutrition
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Calorie intake</h1>
          <p className="text-sm text-muted-foreground">
            Manage your food catalog, reusable private meal templates, daily plan suggestions, and
            historical intake logs.
          </p>
        </header>

        <nav
          aria-label="Nutrition sections"
          className="flex w-full items-center gap-1 overflow-x-auto rounded-lg border border-border/60 bg-muted/40 p-1 text-muted-foreground backdrop-blur [-ms-overflow-style:none] [scrollbar-width:none] supports-[backdrop-filter]:bg-muted/30 [&::-webkit-scrollbar]:hidden"
        >
          {TABS.map(({ to, label, Icon, exact }) => {
            const isActive = exact
              ? pathname === to
              : pathname === to || pathname.startsWith(`${to}/`);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "inline-flex min-w-max flex-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-all hover:text-foreground sm:flex-1",
                  isActive && "bg-background text-foreground shadow-sm",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            );
          })}
        </nav>

        <Outlet />
      </div>
    </section>
  );
}
