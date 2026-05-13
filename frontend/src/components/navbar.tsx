import { Link } from "@tanstack/react-router";
import { CalendarCheck2, Dumbbell, ListChecks, NotebookPen, Scale, User2 } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/nhost/auth-provider";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/workouts", label: "Workouts", Icon: ListChecks },
  { to: "/exercises", label: "Exercises", Icon: Dumbbell },
  { to: "/sessions", label: "Sessions", Icon: CalendarCheck2 },
  { to: "/body", label: "Body", Icon: Scale },
  { to: "/journal", label: "Journal", Icon: NotebookPen },
  { to: "/profile", label: "Profile", Icon: User2 },
] as const;

export function Navbar() {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/50">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link
            to="/"
            aria-label="Home"
            className="flex shrink-0 items-center gap-2 font-semibold tracking-tight"
          >
            <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground">
              <Dumbbell className="h-4 w-4" />
            </span>
            <span className="hidden sm:inline">NeoGym</span>
          </Link>

          <Breadcrumbs />

          {isAuthenticated ? (
            <nav className="hidden shrink-0 items-center gap-1 md:flex">
              {NAV_ITEMS.map(({ to, label, Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="group inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  activeProps={{ className: "bg-accent text-foreground" }}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
            </nav>
          ) : (
            <div className="flex shrink-0 items-center gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link to="/signin">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/signup">Get started</Link>
              </Button>
            </div>
          )}
        </div>
      </header>

      {isAuthenticated ? <MobileTabBar /> : null}
    </>
  );
}

function MobileTabBar() {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {NAV_ITEMS.map(({ to, label, Icon }) => (
          <li key={to} className="flex-1">
            <Link
              to={to}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 px-2 py-2.5 text-[11px] font-medium text-muted-foreground transition-colors",
                "hover:text-foreground active:text-foreground",
              )}
              activeProps={{ className: "text-foreground" }}
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      "grid h-7 w-12 place-items-center rounded-full transition-colors",
                      isActive ? "bg-foreground/10" : "bg-transparent",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span>{label}</span>
                </>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
