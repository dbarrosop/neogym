import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import { type VitePluginPWAAPI, VitePWA } from "vite-plugin-pwa";

const pwa = VitePWA({
  registerType: "prompt",
  injectRegister: false,
  includeAssets: ["favicon.ico", "apple-touch-icon-180x180.png", "logo.svg"],
  manifest: {
    name: "NeoGym",
    short_name: "NeoGym",
    description: "Modern training, modern stack.",
    theme_color: "#18181b",
    background_color: "#18181b",
    display: "standalone",
    start_url: "/",
    scope: "/",
    icons: [
      { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
      { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
      {
        src: "maskable-icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  },
  workbox: {
    globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
    navigateFallback: "/index.html",
    navigateFallbackDenylist: [/^\/api\//, /^\/_/],
  },
  devOptions: {
    enabled: false,
  },
});

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
  // Keep prerender fetches on the listener's IP instead of resolving localhost
  // to a different service when IPv4 and IPv6 have separate listeners.
  preview: {
    host: "127.0.0.1",
  },
  build: {
    outDir: ".output/public",
    emptyOutDir: false,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: [
    tailwindcss(),
    tanstackStart({
      srcDirectory: "src",
      spa: {
        enabled: true,
        prerender: {
          outputPath: "/index",
          async onSuccess() {
            // Start writes the SPA shell after Vite's closeBundle hook, so refresh
            // the precache only once index.html exists (including on clean builds).
            const api = pwa.find((plugin) => plugin.name === "vite-plugin-pwa")?.api as
              | VitePluginPWAAPI
              | undefined;
            if (!api) {
              throw new Error("PWA plugin API unavailable after SPA prerender");
            }
            await api.generateSW();
          },
        },
      },
    }),
    viteReact(),
    ...pwa,
    nitro(),
  ],
});
