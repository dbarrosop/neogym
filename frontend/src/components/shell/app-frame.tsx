import { useMatches, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { MobileTabBar } from "@/components/shell/mobile-tab-bar";
import { PublicTopBar } from "@/components/shell/public-top-bar";
import { RestTimerCard, RestTimerPill } from "@/components/shell/rest-timer";
import { isFormPage, isSectionLanding } from "@/lib/navigation";
import { useAuth } from "@/lib/nhost/auth-provider";
import { RestTimerProvider } from "@/lib/rest-timer";
import { cn } from "@/lib/utils";

/**
 * Signed-in pages get the five-area shell: a sidebar from 768 px and a bottom
 * tab bar below it. Signed-out pages keep a minimal top bar.
 */
const BRAND_PANEL_PATHS = new Set(["/signin", "/signup"]);
/** Public flows that keep the brand bar alone, even for a signed-in visitor. */
const BARE_PATHS = new Set(["/oauth2/login", "/verify"]);
const TRAILING_SLASH = /\/$/;

/** Sign in and sign up render their own brand panel, so they skip the top bar. */
function isBrandPanelPage(pathname: string) {
  return BRAND_PANEL_PATHS.has(pathname.replace(TRAILING_SLASH, ""));
}

/** The MCP authorize page and the email-change callback never show the app shell. */
export function isBarePublicPage(pathname: string) {
  return BARE_PATHS.has(pathname.replace(TRAILING_SLASH, ""));
}

export function AppFrame({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  // Split-view routes (list + detail) show their own context from 1100 px,
  // so the breadcrumb trail is only needed below that width.
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const splitView = useMatches({
    select: (matches) => matches.some((match) => match.staticData?.splitView),
  });

  if (!isAuthenticated || !user || isBarePublicPage(pathname)) {
    return (
      <div className="flex min-h-dvh flex-col">
        {isBrandPanelPage(pathname) ? null : <PublicTopBar />}
        {/* A flex column so public pages and auth cards can centre in the remaining height. */}
        <main className="flex flex-1 flex-col">{children}</main>
      </div>
    );
  }

  const formPage = isFormPage(pathname);
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
            {isSectionLanding(pathname) || formPage ? null : <Breadcrumbs minDepth={2} />}
          </div>
          {/*
           * Below 768 px, clear the 4rem tab bar plus the rest timer pill above it.
           * Form pages clear only the tab bar: their sticky footer sits on it and
           * the form page leaves room for the raised pill itself.
           */}
          <main
            className={cn(
              "flex-1 md:pb-0",
              formPage
                ? "pb-[calc(env(safe-area-inset-bottom)+4rem)]"
                : "pb-[calc(env(safe-area-inset-bottom)+8.5rem)]",
            )}
          >
            {children}
          </main>
        </div>
        <RestTimerPill raised={formPage} />
        <MobileTabBar />
      </div>
    </RestTimerProvider>
  );
}
