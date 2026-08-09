#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseYaml } from "./pack-utils.mjs";

const nestedFixture = parseYaml(`items:
  - speaker:
      it: Scintilla
      en: Spark
    target: Բարև։
    translation:
      it: Ciao!
      en: Hello!
  - speaker:
      it: Eroe
      en: Hero
    target: Այո։
`);

assert.equal(nestedFixture.items?.length, 2, "nested mappings must not truncate their containing YAML array");
assert.deepEqual(nestedFixture.items?.[0]?.speaker, { it: "Scintilla", en: "Spark" });
assert.equal(nestedFixture.items?.[0]?.target, "Բարև։");
assert.deepEqual(nestedFixture.items?.[0]?.translation, { it: "Ciao!", en: "Hello!" });
assert.equal(nestedFixture.items?.[1]?.speaker?.it, "Eroe");

const story = parseYaml(readFileSync("content-packs/hy-eastern-it/story.yaml", "utf8"));
const levels = parseYaml(readFileSync("content-packs/hy-eastern-it/levels.yaml", "utf8"));
const chapters = Array.isArray(story.chapters) ? story.chapters : [];
const configuredLevels = Array.isArray(levels.levels) ? levels.levels : [];
const chapterIds = new Set(chapters.map((chapter) => chapter?.id).filter(Boolean));

assert.ok(chapters.length > 1, `Armenian story parser returned only ${chapters.length} chapter(s).`);
assert.ok(configuredLevels.length > 1, `Armenian levels parser returned only ${configuredLevels.length} level(s).`);
for (const level of configuredLevels) {
  if (!level?.chapter_id) continue;
  assert.ok(chapterIds.has(level.chapter_id), `Level ${level.number} references missing chapter ${level.chapter_id}.`);
}

const firstDialogue = chapters[0]?.lesson?.dialogue?.[0];
assert.deepEqual(firstDialogue?.speaker, { it: "Scintilla", en: "Spark" });
assert.equal(firstDialogue?.translation?.it, "Ciao!");
assert.ok(chapterIds.has("chapter_stage_3"), "The level-3 Armenian chapter was not parsed.");

console.log(`YAML parser regression passed: ${chapters.length} Armenian chapters cover ${configuredLevels.length} configured levels.`);
