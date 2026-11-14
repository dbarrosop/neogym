import { Link, useRouterState } from "@tanstack/react-router";
import { type AreaId, getArea, isSectionActive } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/**
 * Segmented section switcher for an area; mirrors the iOS segmented Picker.
 * Below 640 px the tabs share the full row (five fit in 358 px).
 */
export function AreaTabs({ area, className }: { area: AreaId; className?: string }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const definition = getArea(area);

  if (definition.sections.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label={`${definition.label} sections`}
      className={cn(
        "flex w-full max-w-full gap-0.5 overflow-x-auto rounded-[10px] bg-muted p-[3px] [scrollbar-width:none] sm:w-auto [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {definition.sections.map((section) => {
        const active = isSectionActive(section, pathname);
        return (
          <Link
            key={section.label}
            to={section.to}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-[34px] min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-lg px-1 text-[13px] font-medium text-soft-foreground transition-colors hover:text-foreground sm:flex-none sm:px-4 sm:text-sm",
              active && "bg-segment-thumb font-semibold text-foreground shadow-sm",
            )}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
