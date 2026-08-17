#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseYaml } from "./pack-utils.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(ROOT, "content-packs", "hy-eastern-it");
const ENGLISH = join(ROOT, "content-packs", "hy-eastern-en");
const issues = [];

function parseJsonl(path) {
  return readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}
function normalize(value) {
  return String(value ?? "").normalize("NFKC").trim().toLocaleLowerCase("en").replace(/[\s\p{P}\p{S}]+/gu, " ");
}
function tokenSignature(value) {
  return normalize(value).split(" ").filter(Boolean).sort().join("|");
}
function stageOf(row) {
  const tag = (row.tags ?? []).find((value) => /^stage:\d+$/.test(String(value)));
  return tag ? Number(String(tag).slice(6)) : null;
}
function requireLocalized(value, path, languages = ["it", "en"]) {
  if (!value || typeof value !== "object") {
    issues.push(`${path} must be localized`);
    return;
  }
  for (const language of languages) {
    if (typeof value[language] !== "string" || !value[language].trim()) issues.push(`${path}.${language} is missing`);
  }
}
function uniqueNormalized(values) {
  return new Set(values.map(normalize)).size === values.length;
}

const moduleDir = join(SOURCE, "curriculum");
const moduleFiles = existsSync(moduleDir)
  ? readdirSync(moduleDir).filter((name) => /^levels-\d+-\d+\.json$/.test(name)).sort()
  : [];
if (!moduleFiles.includes("levels-09-16.json")) issues.push("curriculum/levels-09-16.json is missing");
const modules = moduleFiles.map((name) => JSON.parse(readFileSync(join(moduleDir, name), "utf8")));
const module = modules.find((entry) => entry.module_id === "levels-09-16");
if (!module) issues.push("levels-09-16 curriculum module cannot be loaded");

const sourceLevelsDoc = parseYaml(readFileSync(join(SOURCE, "levels.yaml"), "utf8"));
const sourceStoryDoc = parseYaml(readFileSync(join(SOURCE, "story.yaml"), "utf8"));
const sourceEnemiesDoc = parseYaml(readFileSync(join(SOURCE, "enemies.yaml"), "utf8"));
const sourceInterfaceDoc = parseYaml(readFileSync(join(SOURCE, "interface.yaml"), "utf8"));
const sourceTagsDoc = parseYaml(readFileSync(join(SOURCE, "tags.yaml"), "utf8"));
const sourceWords = parseJsonl(join(SOURCE, "dictionary", "words.jsonl"));
const sourceSentences = parseJsonl(join(SOURCE, "dictionary", "sentences.jsonl"));

const englishLevelsDoc = parseYaml(readFileSync(join(ENGLISH, "levels.yaml"), "utf8"));
const englishStoryDoc = parseYaml(readFileSync(join(ENGLISH, "story.yaml"), "utf8"));
const englishEnemiesDoc = parseYaml(readFileSync(join(ENGLISH, "enemies.yaml"), "utf8"));
const englishInterfaceDoc = parseYaml(readFileSync(join(ENGLISH, "interface.yaml"), "utf8"));
const englishWords = parseJsonl(join(ENGLISH, "dictionary", "words.jsonl"));
const englishSentences = parseJsonl(join(ENGLISH, "dictionary", "sentences.jsonl"));

const sourceLevels = sourceLevelsDoc.levels ?? [];
const englishLevels = englishLevelsDoc.levels ?? [];
const sourceChapters = sourceStoryDoc.chapters ?? [];
const englishChapters = englishStoryDoc.chapters ?? [];
const sourceEnemies = sourceEnemiesDoc.enemies ?? [];
const englishEnemies = englishEnemiesDoc.enemies ?? [];
const controlledTags = new Set((sourceTagsDoc.controlled_tags ?? []).map((tag) => String(tag.id)));
const sourceWordByTarget = new Map(sourceWords.map((row) => [normalize(row.target), row]));
const englishWordByTarget = new Map(englishWords.map((row) => [normalize(row.target), row]));
const sourceSentenceByTarget = new Map(sourceSentences.map((row) => [normalize(row.target_sentence), row]));
const englishSentenceByTarget = new Map(englishSentences.map((row) => [normalize(row.target_sentence), row]));

const expectedNumbers = Array.from({ length: 17 }, (_, index) => index);
const actualNumbers = sourceLevels.map((level) => Number(level.number)).sort((a, b) => a - b);
for (const number of expectedNumbers) if (!actualNumbers.includes(number)) issues.push(`authored level ${number} is missing`);
if (sourceLevelsDoc.progression?.stat_cap_start !== 5 || sourceLevelsDoc.progression?.stat_cap_per_level !== 5) issues.push("source progression must remain +5 per hero level");
if (sourceEnemiesDoc.fallback?.enemy_id !== "star_dragon") issues.push("source enemy fallback must remain star_dragon");
if (englishEnemiesDoc.fallback?.enemy_id !== "star_dragon") issues.push("English enemy fallback must remain star_dragon");

if (module) {
  const moduleLevelNumbers = (module.levels ?? []).map((level) => Number(level.number));
  if (moduleLevelNumbers.join(",") !== "9,10,11,12,13,14,15,16") issues.push("levels-09-16 module must define exactly levels 9 through 16 in order");
  const ids = [];
  const targets = [];
  for (const key of ["words", "sentences", "chapters", "enemies"]) {
    for (const row of module[key] ?? []) if (row.id) ids.push(`${key}:${row.id}`);
  }
  for (const row of module.words ?? []) targets.push(`word:${normalize(row.target)}`);
  for (const row of module.sentences ?? []) targets.push(`sentence:${normalize(row.target_sentence)}`);
  if (new Set(ids).size !== ids.length) issues.push("module contains duplicate IDs");
  if (new Set(targets).size !== targets.length) issues.push("module contains duplicate target text");
}

for (let levelNumber = 9; levelNumber <= 16; levelNumber += 1) {
  const level = sourceLevels.find((entry) => Number(entry.number) === levelNumber);
  const englishLevel = englishLevels.find((entry) => Number(entry.number) === levelNumber);
  if (!level || !englishLevel) continue;
  if (level.cefr !== "a1") issues.push(`level ${levelNumber} must be cefr: a1`);
  if (level.review_only === true) issues.push(`level ${levelNumber} must introduce content, not review_only`);
  if (Number(level.stat_cap) !== 5 + levelNumber * 5) issues.push(`level ${levelNumber} stat cap must be ${5 + levelNumber * 5}`);
  if (level.chapter_id !== `chapter_stage_${levelNumber}`) issues.push(`level ${levelNumber} chapter mapping is wrong`);
  requireLocalized(level.theme, `level ${levelNumber} theme`);
  requireLocalized(level.learning_goal, `level ${levelNumber} learning_goal`);
  if (englishLevel.theme?.en !== level.theme?.en) issues.push(`English level ${levelNumber} theme is out of sync`);
  if (englishLevel.learning_goal?.en !== level.learning_goal?.en) issues.push(`English level ${levelNumber} learning goal is out of sync`);

  const stageWords = sourceWords.filter((row) => stageOf(row) === levelNumber && row.tags?.includes("tier:core") && row.tags?.includes("curriculum:v2"));
  const stageSentences = sourceSentences.filter((row) => stageOf(row) === levelNumber && row.tags?.includes("tier:core") && row.tags?.includes("curriculum:v2"));
  if (stageWords.length < 8) issues.push(`level ${levelNumber} has only ${stageWords.length} new curriculum words; expected at least 8`);
  if (stageSentences.length < 4) issues.push(`level ${levelNumber} has only ${stageSentences.length} curated sentences; expected at least 4`);
  const wordIt = stageWords.map((row) => row.translations?.it ?? row.translation);
  const wordEn = stageWords.map((row) => row.translations?.en);
  if (!uniqueNormalized(wordIt)) issues.push(`level ${levelNumber} has duplicate Italian word answers`);
  if (!uniqueNormalized(wordEn)) issues.push(`level ${levelNumber} has duplicate English word answers`);

  const chapter = sourceChapters.find((entry) => entry.id === level.chapter_id);
  const englishChapter = englishChapters.find((entry) => entry.id === level.chapter_id);
  if (!chapter || !englishChapter) {
    issues.push(`level ${levelNumber} chapter is missing from one or both packs`);
  } else {
    requireLocalized(chapter.title, `chapter ${levelNumber} title`);
    requireLocalized(chapter.summary, `chapter ${levelNumber} summary`);
    requireLocalized(chapter.fiction, `chapter ${levelNumber} fiction`);
    requireLocalized(chapter.mission, `chapter ${levelNumber} mission`);
    requireLocalized(chapter.cliffhanger, `chapter ${levelNumber} cliffhanger`);
    if ((chapter.lesson?.objectives ?? []).length < 3) issues.push(`chapter ${levelNumber} needs at least 3 objectives`);
    if ((chapter.lesson?.examples ?? []).length < 3) issues.push(`chapter ${levelNumber} needs at least 3 examples`);
    if ((chapter.lesson?.dialogue ?? []).length < 2) issues.push(`chapter ${levelNumber} needs at least 2 dialogue turns`);
    if ((chapter.lesson?.study_notes ?? []).length < 2) issues.push(`chapter ${levelNumber} needs at least 2 study notes`);
    if ((chapter.lesson?.common_mistakes ?? []).length < 1) issues.push(`chapter ${levelNumber} needs a common-mistake note`);
    if (englishChapter.title?.en !== chapter.title?.en) issues.push(`English chapter ${levelNumber} title is out of sync`);
  }

  const enemy = sourceEnemies.find((entry) => Number(entry.level) === levelNumber);
  const englishEnemy = englishEnemies.find((entry) => Number(entry.level) === levelNumber);
  if (!enemy || !englishEnemy) issues.push(`level ${levelNumber} exact enemy is missing from one or both packs`);
  else if (enemy.id !== englishEnemy.id) issues.push(`level ${levelNumber} enemy differs between packs`);
}

for (const row of sourceSentences.filter((entry) => entry.tags?.includes("curriculum:v2"))) {
  const target = normalize(row.target_sentence);
  const signature = tokenSignature(row.target_sentence);
  const distractors = row.distractors ?? [];
  if (distractors.length < 3) issues.push(`${row.id} needs 3 Armenian distractors`);
  for (const distractor of distractors) {
    if (normalize(distractor) === target) issues.push(`${row.id} contains the correct Armenian answer as a distractor`);
    if (tokenSignature(distractor) === signature) issues.push(`${row.id} contains a word-order-only Armenian distractor: ${distractor}`);
  }
  for (const language of ["it", "en"]) {
    const correct = row.translations?.[language];
    const alternatives = row.translation_distractors?.[language] ?? [];
    if (typeof correct !== "string" || !correct.trim()) issues.push(`${row.id} lacks ${language} translation`);
    if (alternatives.length < 3) issues.push(`${row.id} needs 3 ${language} translation distractors`);
    if (!uniqueNormalized(alternatives)) issues.push(`${row.id} has duplicate ${language} translation distractors`);
    if (alternatives.some((value) => normalize(value) === normalize(correct))) issues.push(`${row.id} repeats its correct ${language} translation among distractors`);
  }
}

if (module) {
  for (const definition of module.words ?? []) {
    const source = sourceWordByTarget.get(normalize(definition.target));
    const english = englishWordByTarget.get(normalize(definition.target));
    if (!source || !english) {
      issues.push(`word ${definition.target} is missing from one or both packs`);
      continue;
    }
    if (english.translations?.en !== definition.translations?.en) issues.push(`English word translation is out of sync for ${definition.target}`);
  }
  for (const definition of module.sentences ?? []) {
    const source = sourceSentenceByTarget.get(normalize(definition.target_sentence));
    const english = englishSentenceByTarget.get(normalize(definition.target_sentence));
    if (!source || !english) {
      issues.push(`sentence ${definition.target_sentence} is missing from one or both packs`);
      continue;
    }
    if (english.translations?.en !== definition.translations?.en) issues.push(`English sentence translation is out of sync for ${definition.id}`);
    if ((english.distractors ?? []).length < 3) issues.push(`English sentence ${definition.id} lost semantic Armenian distractors`);
  }
  for (const [language, interfaceDoc] of [["it", sourceInterfaceDoc], ["en", englishInterfaceDoc]]) {
    for (const [key, value] of Object.entries(module.enemy_names?.[language] ?? {})) {
      if (interfaceDoc.text?.[key] !== value) issues.push(`${language} enemy name ${key} is missing or out of sync`);
    }
  }
}

for (let levelNumber = 9; levelNumber <= 16; levelNumber += 1) {
  if (!controlledTags.has(`stage:${levelNumber}`)) issues.push(`controlled tag stage:${levelNumber} is missing`);
}
if (!controlledTags.has("curriculum:v2")) issues.push("controlled tag curriculum:v2 is missing");

if (issues.length) {
  console.error(`Armenian curriculum 09-16 audit failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}
console.log("Armenian curriculum 09-16 audit passed: 8 authored A1 levels, 8 chapters, 8 exact enemies, and 32 unambiguous sentence exercises are synchronized across Italian and English packs.");
