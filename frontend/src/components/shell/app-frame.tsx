import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { MobileTabBar } from "@/components/shell/mobile-tab-bar";
import { PublicTopBar } from "@/components/shell/public-top-bar";
import { useAuth } from "@/lib/nhost/auth-provider";

/**
 * Signed-in pages get the five-area shell: a sidebar from 768 px and a bottom
 * tab bar below it. Signed-out pages keep a minimal top bar.
 */
export function AppFrame({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-dvh flex-col">
        <PublicTopBar />
        <main className="flex-1">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="px-4 pt-4 empty:hidden md:px-10 md:pt-6">
          <Breadcrumbs minDepth={2} />
        </div>
        <main className="flex-1 pb-20 md:pb-0">{children}</main>
      </div>
      <MobileTabBar />
    </div>
  );
}
