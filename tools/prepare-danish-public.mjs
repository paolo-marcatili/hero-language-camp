#!/usr/bin/env node
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "apps", "web", "public");
const destination = path.join(root, "apps", "danish-foundations", "public");

await mkdir(destination, { recursive: true });
// Only what the Danish app requests at runtime. apps/web/public/audio holds
// unused placeholder wav effects (the app synthesises its sounds with WebAudio),
// so it is not copied and a stale copy from an earlier run is removed.
await rm(path.join(destination, "audio"), { recursive: true, force: true });
for (const directory of ["assets", "icons"]) {
  await rm(path.join(destination, directory), { recursive: true, force: true });
  await cp(path.join(source, directory), path.join(destination, directory), { recursive: true });
}

const manifest = {
  name: "Ord- og Talheltene",
  short_name: "Ord & Tal",
  description: "Dansk læsestart og matematik i et pixel-eventyr.",
  start_url: "./",
  scope: "./",
  display: "standalone",
  orientation: "any",
  background_color: "#10182d",
  theme_color: "#234a5b",
  lang: "da-DK",
  icons: [
    { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
    { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
  ]
};
await writeFile(path.join(destination, "manifest.webmanifest"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log("Prepared shared game assets for the Danish foundations app.");
