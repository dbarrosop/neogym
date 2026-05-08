/// <reference types="vite/client" />

import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
// import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
// import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import type { ReactNode } from "react";
import { Navbar } from "@/components/navbar";
import { PWAUpdatePrompt } from "@/components/pwa-update-prompt";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/nhost/auth-provider";
import appCss from "@/styles.css?url";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { title: "NeoGym" },
      { name: "description", content: "Modern training, modern stack." },
      { name: "theme-color", content: "#18181b" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "NeoGym" },
      {
        name: "apple-mobile-web-app-status-bar-style",
        content: "black-translucent",
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
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <div className="flex min-h-dvh flex-col">
              <Navbar />
              <main className="flex-1">{children}</main>
            </div>
            <Toaster richColors position="top-right" />
            <PWAUpdatePrompt />
          </AuthProvider>
          {/* <TanStackRouterDevtools position="bottom-right" /> */}
          {/* <ReactQueryDevtools buttonPosition="bottom-left" /> */}
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}
