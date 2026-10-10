#!/usr/bin/env node
import { cp, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";

const source = path.resolve(process.argv[2] ?? "content-packs/hy-eastern-it");
const packId = path.basename(source);
const destination = path.resolve(process.argv[3] ?? path.join("apps", "web", "public", "content-packs", packId));

// The apps compile the pack's yaml/jsonl into the bundle (?raw imports) and
// never fetch them. At runtime they only request the media referenced by pack
// data as /content-packs/<pack>/audio/... and /content-packs/<pack>/images/...
// Everything else (yaml, jsonl, curriculum JSON, wav previews, TTS probes,
// sources, READMEs) stays out of the deployed site, the service worker cache and the APK/IPA.
const RUNTIME_DIRECTORIES = ["audio/auto-neural", "audio/human", "images"];
const RUNTIME_FILES = ["LICENSE.md"]; // keep the licence next to the shipped media
const MEDIA_EXTENSION = /\.(mp3|m4a|ogg|aac|webm|wav|svg|png|webp|jpe?g)$/i;

async function isDirectory(target) {
  try { return (await stat(target)).isDirectory(); } catch { return false; }
}
async function isFile(target) {
  try { return (await stat(target)).isFile(); } catch { return false; }
}

await mkdir(path.dirname(destination), { recursive: true });
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });

let copiedDirectories = 0;
for (const relative of RUNTIME_DIRECTORIES) {
  const from = path.join(source, relative);
  if (!(await isDirectory(from))) continue;
  await cp(from, path.join(destination, relative), {
    recursive: true,
    force: true,
    // Directories are traversed; files are copied only when they are real media.
    filter: async (entry) => (await isDirectory(entry)) || MEDIA_EXTENSION.test(entry)
  });
  copiedDirectories += 1;
}
for (const relative of RUNTIME_FILES) {
  const from = path.join(source, relative);
  if (await isFile(from)) await cp(from, path.join(destination, relative));
}

console.log(`Synced ${packId} runtime media (${copiedDirectories} directories) to ${path.relative(process.cwd(), destination)}`);
