/// <reference types="vite/client" />

import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
// import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
// import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { type ReactNode, useEffect, useState } from "react";
import { PhotoCacheGuard } from "@/components/progress-photos/photo-session";
import { PWAUpdatePrompt } from "@/components/pwa-update-prompt";
import { AppFrame, isBarePublicPage } from "@/components/shell/app-frame";
import { Toaster } from "@/components/ui/sonner";
import { isFormPage } from "@/lib/navigation";
import { AuthProvider, useAuth } from "@/lib/nhost/auth-provider";
import { THEME_COLORS, ThemeProvider } from "@/lib/theme/theme-provider";
import { themeInitScript } from "@/lib/theme/theme-script";
import appCss from "@/styles.css?url";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "NeoGym" },
      { name: "description", content: "Training, food and body data in one log." },
      { name: "theme-color", content: THEME_COLORS.dark },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "NeoGym" },
      {
        name: "apple-mobile-web-app-status-bar-style",
        content: "black",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
      },
      { rel: "icon", href: "/favicon.ico" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon-180x180.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: ReactNode }) {
  const { queryClient } = Route.useRouteContext();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/** biome-ignore lint/security/noDangerouslySetInnerHtml: inline theme bootstrap to avoid FOUC; content is a static literal */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <PhotoCacheGuard />
              <AppFrame>{children}</AppFrame>
              <AppToaster />
              <PWAUpdatePrompt />
            </AuthProvider>
          </ThemeProvider>
          {/* <TanStackRouterDevtools position="bottom-right" /> */}
          {/* <ReactQueryDevtools buttonPosition="bottom-left" /> */}
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}

const MOBILE_SHELL_QUERY = "(max-width: 767.98px)";

/** True below 768 px, where signed-in pages show the bottom tab bar. */
function useMobileShell(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(MOBILE_SHELL_QUERY);
    setMobile(media.matches);
    const onChange = () => setMobile(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return mobile;
}

/**
 * Toasts sit bottom right (Web · States). On phones they stack above the
 * signed-in tab bar and the rest timer pill, which form pages raise above
 * their sticky Cancel/Save footer.
 */
function AppToaster() {
  const { isAuthenticated } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const mobile = useMobileShell();
  let bottom = "24px";
  if (mobile && isAuthenticated && !isBarePublicPage(pathname)) {
    bottom = isFormPage(pathname)
      ? "calc(env(safe-area-inset-bottom) + 13rem)"
      : "calc(env(safe-area-inset-bottom) + 8.5rem)";
  } else if (mobile) {
    bottom = "calc(env(safe-area-inset-bottom) + 16px)";
  }
  const side = mobile ? "16px" : "24px";
  return (
    <Toaster
      position="bottom-right"
      offset={{ bottom, right: side, left: side }}
      mobileOffset={{ bottom, right: side, left: side }}
    />
  );
}
