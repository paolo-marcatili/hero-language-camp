#!/usr/bin/env node
// Renames audio files whose names use decomposed Unicode (NFD) to precomposed (NFC), because the JSONL URLs are NFC
// and Linux (CI, GitHub Pages) does not treat the two forms as the same file. Dry run unless --write.
import { existsSync, readdirSync, renameSync } from "node:fs";
import { join, resolve } from "node:path";

const dir = resolve(process.argv[2] ?? "content-packs/da-foundations", "audio", "auto-neural");
const write = process.argv.includes("--write");
const bad = readdirSync(dir).filter((name) => name !== name.normalize("NFC"));
for (const name of bad) {
  const fixed = name.normalize("NFC");
  console.log(`${write ? "rename" : "would rename"}: ${[...name].map((c) => c.codePointAt(0).toString(16)).join(" ")} -> ${fixed}`);
  if (!write) continue;
  // Two steps through an ASCII name: some filesystems treat NFD/NFC as the same name and would ignore a direct rename.
  const temporary = join(dir, `.normalize-${process.pid}.tmp`);
  renameSync(join(dir, name), temporary);
  if (existsSync(join(dir, fixed))) throw new Error(`${fixed} already exists; resolve manually.`);
  renameSync(temporary, join(dir, fixed));
}
console.log(bad.length ? `${bad.length} file name(s) ${write ? "normalized" : "need normalizing (re-run with --write)"}.` : "All audio file names are NFC.");
