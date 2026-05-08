import { defineConfig, minimal2023Preset } from "@vite-pwa/assets-generator/config";

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    apple: {
      sizes: [180],
      resizeOptions: { background: "#18181b", fit: "contain" },
      padding: 0,
    },
    maskable: {
      sizes: [512],
      resizeOptions: { background: "#18181b", fit: "contain" },
      padding: 0,
    },
  },
  images: ["public/logo.svg"],
});
