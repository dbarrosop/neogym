import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/shell/brand-mark";
import { AREAS, areaForPath } from "@/lib/navigation";
import { useAuth } from "@/lib/nhost/auth-provider";
import { cn } from "@/lib/utils";

/** Desktop primary navigation (≥ 768 px). The mobile equivalent is MobileTabBar. */
export function AppSidebar({ footer }: { footer?: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const activeArea = areaForPath(pathname);
  const { user } = useAuth();
  const name = user?.displayName?.trim() || user?.email || "Account";
  const initial = name.charAt(0).toUpperCase();

  return (
    <aside
      aria-label="Primary"
      className="sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col gap-1 border-r border-sidebar-border bg-sidebar px-3.5 py-5 md:flex"
    >
      <Link
        to="/today"
        className="mb-4 flex items-center gap-2.5 rounded-lg px-3 py-1 text-[15px] font-semibold text-sidebar-foreground"
      >
        <BrandMark />
        NeoGym
      </Link>
      <nav className="flex flex-col gap-1">
        {AREAS.map(({ id, label, to, Icon }) => {
          const active = activeArea?.id === id;
          return (
            <Link
              key={id}
              to={to}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-10 items-center gap-2.5 rounded-[10px] px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                active &&
                  "bg-sidebar-accent font-semibold text-sidebar-accent-foreground shadow-[0_0_0_1px_var(--sidebar-border)] hover:bg-sidebar-accent",
              )}
            >
              <Icon className={cn("size-[18px]", active && "text-link")} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="flex-1" />
      {footer}
      <Link
        to="/profile"
        className="flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent/60"
      >
        <span className="grid size-[30px] shrink-0 place-items-center rounded-full bg-accent-soft text-[13px] font-bold text-accent-soft-foreground">
          {initial}
        </span>
        <span className="truncate">{name}</span>
      </Link>
    </aside>
  );
}
