import { useMatches, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { MobileTabBar } from "@/components/shell/mobile-tab-bar";
import { PublicTopBar } from "@/components/shell/public-top-bar";
import { RestTimerCard, RestTimerPill } from "@/components/shell/rest-timer";
import { isSectionLanding } from "@/lib/navigation";
import { useAuth } from "@/lib/nhost/auth-provider";
import { RestTimerProvider } from "@/lib/rest-timer";
import { cn } from "@/lib/utils";

/**
 * Signed-in pages get the five-area shell: a sidebar from 768 px and a bottom
 * tab bar below it. Signed-out pages keep a minimal top bar.
 */
export function AppFrame({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  // Split-view routes (list + detail) show their own context from 1100 px,
  // so the breadcrumb trail is only needed below that width.
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const splitView = useMatches({
    select: (matches) => matches.some((match) => match.staticData?.splitView),
  });

  if (!isAuthenticated || !user) {
    return (
      <div className="flex min-h-dvh flex-col">
        <PublicTopBar />
        <main className="flex-1">{children}</main>
      </div>
    );
  }

  return (
    <RestTimerProvider key={user.id} userId={user.id}>
      <div className="flex min-h-dvh">
        <AppSidebar footer={<RestTimerCard />} />
        <div className="flex min-w-0 flex-1 flex-col">
          <div
            className={cn(
              "px-4 pt-4 empty:hidden md:px-10 md:pt-6",
              splitView && "min-[1100px]:hidden",
            )}
          >
            {isSectionLanding(pathname) ? null : <Breadcrumbs minDepth={2} />}
          </div>
          <main className="flex-1 pb-20 md:pb-0">{children}</main>
        </div>
        <RestTimerPill />
        <MobileTabBar />
      </div>
    </RestTimerProvider>
  );
}
