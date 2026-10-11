#!/usr/bin/env node
import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { loadModularPack } from "./pack-utils.mjs";
import process from "node:process";

const root = process.cwd();
const pack = path.join(root, "content-packs", "hy-eastern-it");

async function jsonl(file) {
  const text = await readFile(file, "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line, index) => {
    try { return JSON.parse(line); }
    catch (error) { throw new Error(`${file}:${index + 1}: ${error.message}`); }
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function uniqueIds(rows, label) {
  const ids = new Set();
  for (const row of rows) {
    assert(typeof row.id === "string" && row.id.length > 0, `${label}: missing id`);
    assert(!ids.has(row.id), `${label}: duplicate id ${row.id}`);
    ids.add(row.id);
  }
}

async function pngSize(file) {
  const buffer = await readFile(file);
  assert(buffer.length >= 24 && buffer.toString("ascii", 1, 4) === "PNG", `${file}: not a PNG`);
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

const loadedPack = loadModularPack(pack);
assert(loadedPack.version === "1.0.0", `Expected pack version 1.0.0, got ${loadedPack.version}`);
assert(loadedPack.levels.length === 49, `Expected 49 levels, got ${loadedPack.levels.length}`);
assert((loadedPack.story?.chapters ?? []).length >= loadedPack.levels.length, "Every level needs a structured story chapter.");
for (const level of loadedPack.levels) {
  const chapter = loadedPack.story?.chapters?.find((candidate) => candidate.id === level.chapter_id);
  assert(chapter, `Level ${level.number} is missing chapter ${level.chapter_id ?? "(none)"}`);
  assert(chapter.fiction && chapter.lesson?.explanation && chapter.mission, `Chapter ${chapter.id} is incomplete.`);
}

const words = await jsonl(path.join(pack, "dictionary", "words.jsonl"));
const sentences = await jsonl(path.join(pack, "dictionary", "sentences.jsonl"));
const letters = await jsonl(path.join(pack, "dictionary", "letters.jsonl"));
uniqueIds(words, "words"); uniqueIds(sentences, "sentences"); uniqueIds(letters, "letters");
assert(words.length >= 600, `Expected at least 600 words/phrases, got ${words.length}`);
assert(sentences.length >= 250, `Expected at least 250 sentences, got ${sentences.length}`);
assert(letters.length === 39, `Expected 39 modern Armenian letters, got ${letters.length}`);
assert(letters.every((letter) => typeof letter.spoken_name === "string" && letter.spoken_name.length > 0), "Every letter needs an Armenian spoken_name.");
assert(sentences.every((sentence) => sentence.translation_review_status?.it === "reviewed"), "Every sentence needs reviewed Italian copy.");
assert(sentences.every((sentence) => new Set(sentence.translation_distractors?.it ?? []).size >= 3), "Every sentence needs three Italian alternatives.");

const required = [
  "apps/web/public/manifest.webmanifest",
  "apps/web/public/icons/icon-192.png",
  "apps/web/public/icons/icon-512.png",
  "asset-packs/cc0-pixel-v10/labyrinth/wall-northwest.png",
  "asset-packs/cc0-pixel-v10/labyrinth/wall-northeast.png",
  "asset-packs/cc0-pixel-v10/labyrinth/wall-southwest.png",
  "asset-packs/cc0-pixel-v10/labyrinth/wall-southeast.png",
  "content-packs/hy-eastern-it/sources/content-review-report.md",
  "docs/ARMENIAN_AUDIO_GENERATION.md",
  ".github/workflows/generate-neural-audio.yml",
  "apps/web/src/components/InstallAppButton.tsx"
];
for (const relative of required) await access(path.join(root, relative));
for (const direction of ["northwest", "northeast", "southwest", "southeast"]) {
  const size = await pngSize(path.join(root, "asset-packs", "cc0-pixel-v10", "labyrinth", `wall-${direction}.png`));
  assert(size[0] === 256 && size[1] === 192, `wall-${direction}.png must be 256x192, got ${size.join("x")}`);
}

console.log(`Release verification passed: ${words.length} words, ${sentences.length} sentences, ${letters.length} letters.`);
