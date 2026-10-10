import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const githubPagesBase = process.env.GITHUB_PAGES_BASE ?? "/hero-language-camp/";
const storageNamespace = process.env.VITE_STORAGE_NAMESPACE ?? "hy-eastern-it";
const armenianAppUrl = process.env.VITE_ARMENIAN_APP_URL ?? (process.env.GITHUB_PAGES === "true" ? "/hero-language-camp/armenian/" : "http://127.0.0.1:5173/");
const danishAppUrl = process.env.VITE_DANISH_APP_URL ?? (process.env.GITHUB_PAGES === "true" ? "/hero-language-camp/danish/" : "http://127.0.0.1:5174/");

export default defineConfig({
  // GitHub Pages hosts project sites in a repository subdirectory. Keep `/`
  // for local development and Capacitor, and opt into the Pages base only in
  // the deployment workflow.
  base: process.env.GITHUB_PAGES === "true" ? githubPagesBase : "/",
  define: {
    "import.meta.env.VITE_STORAGE_NAMESPACE": JSON.stringify(storageNamespace),
    "import.meta.env.VITE_ARMENIAN_APP_URL": JSON.stringify(armenianAppUrl),
    "import.meta.env.VITE_DANISH_APP_URL": JSON.stringify(danishAppUrl)
  },
  plugins: [react()],
  build: {
    // Phaser is lazy-loaded (about 1.2 MB minified); keep the warning meaningful for everything else.
    chunkSizeWarningLimit: 2000,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: "phaser", test: /node_modules[\\/]phaser[\\/]/, priority: 20 },
            { name: "react-vendor", test: /node_modules[\\/](?:react|react-dom|scheduler)[\\/]/, priority: 10 }
          ]
        }
      }
    }
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    allowedHosts: ["localhost", "127.0.0.1"]
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
    allowedHosts: ["localhost", "127.0.0.1"]
  }
});
