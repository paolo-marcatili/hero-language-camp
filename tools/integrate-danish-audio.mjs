#!/usr/bin/env node
import { cp, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.resolve(process.argv[2] ?? "");
if (!process.argv[2]) {
  console.error("Usage: npm run content:audio:danish:integrate -- /path/to/extracted/danish-audio-update");
  process.exit(2);
}
const sourcePack = path.join(sourceRoot, "content-packs", "da-foundations");
try { await stat(sourcePack); }
catch { throw new Error(`Could not find ${sourcePack}. Extract the GitHub Actions artifact before running this command.`); }

const destinationPack = path.join(root, "content-packs", "da-foundations");
await mkdir(destinationPack, { recursive: true });
await cp(sourcePack, destinationPack, { recursive: true, force: true });
console.log("Integrated Danish neural-audio files and metadata into content-packs/da-foundations.");
console.log("Run `npm run content:sync-danish` and `npm run check:danish` next.");
