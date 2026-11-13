import { Link, useRouterState } from "@tanstack/react-router";
import { AREAS, areaForPath } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/** Mobile primary navigation (< 768 px): five areas, never scrolls sideways. */
export function MobileTabBar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const activeArea = areaForPath(pathname);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-glass pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around">
        {AREAS.map(({ id, label, to, Icon }) => {
          const active = activeArea?.id === id;
          return (
            <li key={id} className="flex-1">
              <Link
                to={to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-muted-foreground transition-colors",
                  active && "text-link",
                )}
              >
                <Icon className="size-[22px]" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
