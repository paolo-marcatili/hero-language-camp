#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadModularPack, parseYaml } from "./pack-utils.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = join(ROOT, "content-packs", "hy-eastern-it");
const ENGLISH_DIR = join(ROOT, "content-packs", "hy-eastern-en");
const MODULE_DIR = join(SOURCE_DIR, "curriculum");
const issues = [];

function normalize(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en")
    .replace(/[\s\p{P}\p{S}]+/gu, " ");
}
function tokenSignature(value) {
  return normalize(value).split(" ").filter(Boolean).sort().join("|");
}
function stageOf(row) {
  const tags = Array.isArray(row?.tags) ? row.tags.map(String) : [];
  const matches = tags.filter((tag) => /^stage:\d+$/.test(tag));
  return matches.length === 1 ? Number(matches[0].slice(6)) : null;
}
function hasCurriculumTags(row) {
  const tags = Array.isArray(row?.tags) ? row.tags.map(String) : [];
  return tags.includes("tier:core") && tags.includes("curriculum:v2");
}
function requireLocalized(value, path, languages = ["it", "en"]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    issues.push(`${path} must be localized`);
    return;
  }
  for (const language of languages) {
    if (typeof value[language] !== "string" || !value[language].trim()) {
      issues.push(`${path}.${language} is missing`);
    }
  }
}
function uniqueNormalized(values) {
  return new Set(values.map(normalize)).size === values.length;
}
function parseRange(name) {
  const match = name.match(/^levels-(\d+)-(\d+)\.json$/);
  if (!match) return null;
  return { start: Number(match[1]), end: Number(match[2]) };
}
function findByTarget(rows, key, target) {
  const wanted = normalize(target);
  const matches = rows.filter((row) => normalize(row?.[key]) === wanted);
  return matches.sort((left, right) => {
    const score = (row) => {
      const tags = Array.isArray(row?.tags) ? row.tags.map(String) : [];
      let value = 0;
      if (tags.includes("tier:core")) value += 8;
      if (tags.includes("curriculum:v2")) value += 4;
      if (stageOf(row) !== null) value += 2;
      if (Array.isArray(row?.audio)) value += 1;
      return value;
    };
    return score(right) - score(left);
  })[0];
}
function ensureEqual(actual, expected, message) {
  if (actual !== expected) issues.push(`${message}: expected ${expected}, got ${actual}`);
}
function checkChapter(chapter, path) {
  requireLocalized(chapter?.title, `${path}.title`);
  requireLocalized(chapter?.summary, `${path}.summary`);
  requireLocalized(chapter?.fiction, `${path}.fiction`);
  requireLocalized(chapter?.mission, `${path}.mission`);
  requireLocalized(chapter?.cliffhanger, `${path}.cliffhanger`);
  if ((chapter?.story_beats ?? []).length < 1) issues.push(`${path} needs at least one story beat`);
  if ((chapter?.lesson?.objectives ?? []).length < 3) issues.push(`${path} needs at least 3 objectives`);
  if ((chapter?.lesson?.examples ?? []).length < 3) issues.push(`${path} needs at least 3 examples`);
  if ((chapter?.lesson?.dialogue ?? []).length < 2) issues.push(`${path} needs at least 2 dialogue turns`);
  if ((chapter?.lesson?.study_notes ?? []).length < 2) issues.push(`${path} needs at least 2 study notes`);
  if ((chapter?.lesson?.common_mistakes ?? []).length < 1) issues.push(`${path} needs a common-mistake note`);
}

if (!existsSync(MODULE_DIR)) {
  issues.push("curriculum module directory is missing");
}
const moduleFiles = existsSync(MODULE_DIR)
  ? readdirSync(MODULE_DIR).filter((name) => /^levels-\d+-\d+\.json$/.test(name))
  : [];
const moduleEntries = moduleFiles.map((name) => ({
  name,
  range: parseRange(name),
  module: JSON.parse(readFileSync(join(MODULE_DIR, name), "utf8")),
})).sort((a, b) => a.range.start - b.range.start || a.range.end - b.range.end);
if (!moduleEntries.length) issues.push("no levels-NN-MM.json curriculum modules were found");

let nextExpectedStart = 9;
const globalIds = new Set();
const globalWordTargets = new Set();
const globalSentenceTargets = new Set();
const globalLevelNumbers = new Set();
const globalChapterIds = new Set();
const globalEnemyIds = new Set();
const globalEnemyLevels = new Set();

for (const entry of moduleEntries) {
  const { name, range, module } = entry;
  const stem = basename(name, ".json");
  if (module.module_id !== stem) issues.push(`${name}: module_id must be ${stem}`);
  if (module.schema_version !== 1) issues.push(`${name}: schema_version must be 1`);
  if (range.start !== nextExpectedStart) {
    issues.push(`${name}: expected the next module to start at level ${nextExpectedStart}`);
  }
  nextExpectedStart = range.end + 1;
  const expectedLevels = Array.from({ length: range.end - range.start + 1 }, (_, index) => range.start + index);
  const actualLevels = (module.levels ?? []).map((level) => Number(level.number));
  if (actualLevels.join(",") !== expectedLevels.join(",")) {
    issues.push(`${name}: levels must exactly cover ${range.start}-${range.end} in order`);
  }
  for (const key of ["levels", "words", "sentences", "chapters", "enemies"]) {
    if (!Array.isArray(module[key])) issues.push(`${name}: ${key} must be an array`);
  }
  for (const level of module.levels ?? []) {
    const number = Number(level.number);
    if (globalLevelNumbers.has(number)) issues.push(`${name}: level ${number} is defined by more than one module`);
    globalLevelNumbers.add(number);
    requireLocalized(level.theme, `${name} level ${number} theme`);
    requireLocalized(level.learning_goal, `${name} level ${number} learning_goal`);
    if (!["pre_a1", "a1", "a2"].includes(level.cefr)) issues.push(`${name} level ${number} has unsupported cefr ${level.cefr}`);
    ensureEqual(Number(level.stat_cap), 5 + number * 5, `${name} level ${number} stat cap`);
    if (typeof level.chapter_id !== "string" || !level.chapter_id.trim()) issues.push(`${name} level ${number} needs chapter_id`);
  }
  for (const [key, idSet] of [["words", globalIds], ["sentences", globalIds], ["chapters", globalIds], ["enemies", globalIds]]) {
    for (const row of module[key] ?? []) {
      if (typeof row.id !== "string" || !row.id.trim()) {
        issues.push(`${name}: ${key} contains an entry without id`);
        continue;
      }
      const combined = `${key}:${row.id}`;
      if (idSet.has(combined)) issues.push(`${name}: duplicate ${combined}`);
      idSet.add(combined);
    }
  }
  for (const row of module.words ?? []) {
    const target = normalize(row.target);
    if (!target) issues.push(`${name}: word ${row.id} has no target`);
    else if (globalWordTargets.has(target)) issues.push(`${name}: word target is defined more than once across modules: ${row.target}`);
    globalWordTargets.add(target);
    requireLocalized(row.translations, `${name} word ${row.id} translations`);
    const stage = stageOf(row);
    if (stage === null || !actualLevels.includes(stage)) issues.push(`${name}: word ${row.id} must have exactly one stage in its module range`);
    if (!hasCurriculumTags(row)) issues.push(`${name}: word ${row.id} must be tier:core curriculum:v2`);
  }
  for (const row of module.sentences ?? []) {
    const target = normalize(row.target_sentence);
    if (!target) issues.push(`${name}: sentence ${row.id} has no target_sentence`);
    else if (globalSentenceTargets.has(target)) issues.push(`${name}: sentence target is defined more than once across modules: ${row.target_sentence}`);
    globalSentenceTargets.add(target);
    requireLocalized(row.translations, `${name} sentence ${row.id} translations`);
    requireLocalized(row.prompt, `${name} sentence ${row.id} prompt`);
    const stage = stageOf(row);
    if (stage === null || !actualLevels.includes(stage)) issues.push(`${name}: sentence ${row.id} must have exactly one stage in its module range`);
    if (!hasCurriculumTags(row)) issues.push(`${name}: sentence ${row.id} must be tier:core curriculum:v2`);
    const distractors = Array.isArray(row.distractors) ? row.distractors.map(String) : [];
    if (distractors.length !== 3) issues.push(`${name}: sentence ${row.id} needs exactly 3 Armenian distractors`);
    if (!uniqueNormalized(distractors)) issues.push(`${name}: sentence ${row.id} has duplicate Armenian distractors`);
    const targetNorm = normalize(row.target_sentence);
    const targetSignature = tokenSignature(row.target_sentence);
    for (const distractor of distractors) {
      if (normalize(distractor) === targetNorm) issues.push(`${name}: sentence ${row.id} repeats its answer as a distractor`);
      if (tokenSignature(distractor) === targetSignature) issues.push(`${name}: sentence ${row.id} has a word-order-only distractor: ${distractor}`);
    }
    for (const language of ["it", "en"]) {
      const correct = row.translations?.[language];
      const alternatives = row.translation_distractors?.[language] ?? [];
      if (!Array.isArray(alternatives) || alternatives.length !== 3) issues.push(`${name}: sentence ${row.id} needs exactly 3 ${language} distractors`);
      else {
        if (!uniqueNormalized(alternatives)) issues.push(`${name}: sentence ${row.id} has duplicate ${language} distractors`);
        if (alternatives.some((value) => normalize(value) === normalize(correct))) issues.push(`${name}: sentence ${row.id} repeats the correct ${language} answer among distractors`);
      }
    }
  }
  for (const chapter of module.chapters ?? []) {
    if (globalChapterIds.has(chapter.id)) issues.push(`${name}: duplicate chapter id ${chapter.id}`);
    globalChapterIds.add(chapter.id);
    checkChapter(chapter, `${name} chapter ${chapter.id}`);
  }
  for (const enemy of module.enemies ?? []) {
    if (globalEnemyIds.has(enemy.id)) issues.push(`${name}: duplicate enemy id ${enemy.id}`);
    globalEnemyIds.add(enemy.id);
    const levelNumber = Number(enemy.level);
    if (globalEnemyLevels.has(levelNumber)) issues.push(`${name}: more than one exact enemy is assigned to level ${levelNumber}`);
    globalEnemyLevels.add(levelNumber);
    if (!actualLevels.includes(levelNumber)) issues.push(`${name}: enemy ${enemy.id} is outside its module range`);
    if (typeof enemy.name_key !== "string" || !enemy.name_key.trim()) issues.push(`${name}: enemy ${enemy.id} needs name_key`);
    for (const language of ["it", "en"]) {
      if (typeof module.enemy_names?.[language]?.[enemy.name_key] !== "string") issues.push(`${name}: enemy ${enemy.id} lacks ${language} name ${enemy.name_key}`);
    }
  }
}

const sourcePack = loadModularPack(SOURCE_DIR);
const englishPack = loadModularPack(ENGLISH_DIR);
const sourceLevelsDoc = parseYaml(readFileSync(join(SOURCE_DIR, "levels.yaml"), "utf8"));
const sourceEnemiesDoc = parseYaml(readFileSync(join(SOURCE_DIR, "enemies.yaml"), "utf8"));
const englishEnemiesDoc = parseYaml(readFileSync(join(ENGLISH_DIR, "enemies.yaml"), "utf8"));
if (sourceLevelsDoc.progression?.stat_cap_start !== 5 || sourceLevelsDoc.progression?.stat_cap_per_level !== 5) {
  issues.push("source progression must remain +5 per hero level");
}
if (sourceEnemiesDoc.fallback?.enemy_id !== "star_dragon") issues.push("source enemy fallback must remain star_dragon");
if (englishEnemiesDoc.fallback?.enemy_id !== "star_dragon") issues.push("English enemy fallback must remain star_dragon");

const maxAuthoredLevel = Math.max(8, ...globalLevelNumbers);
const expectedAuthoredNumbers = Array.from({ length: maxAuthoredLevel + 1 }, (_, index) => index);
for (const [label, levels] of [["source", sourcePack.levels], ["English", englishPack.levels]]) {
  const actual = [...new Set((levels ?? []).map((level) => Number(level.number)))].sort((a, b) => a - b);
  if (actual.join(",") !== expectedAuthoredNumbers.join(",")) {
    issues.push(`${label} pack authored levels must be continuous from 0 through ${maxAuthoredLevel}`);
  }
}

const sourceControlledTags = new Set((sourcePack.controlled_tags ?? []).map((tag) => String(tag.id)));
const sourceChapterById = new Map((sourcePack.story?.chapters ?? []).map((chapter) => [String(chapter.id), chapter]));
const englishChapterById = new Map((englishPack.story?.chapters ?? []).map((chapter) => [String(chapter.id), chapter]));
const sourceEnemyByLevel = new Map((sourcePack.enemies ?? []).map((enemy) => [Number(enemy.level), enemy]));
const englishEnemyByLevel = new Map((englishPack.enemies ?? []).map((enemy) => [Number(enemy.level), enemy]));
const sourceLevelByNumber = new Map((sourcePack.levels ?? []).map((level) => [Number(level.number), level]));
const englishLevelByNumber = new Map((englishPack.levels ?? []).map((level) => [Number(level.number), level]));

for (const entry of moduleEntries) {
  const { name, module } = entry;
  for (const level of module.levels ?? []) {
    const number = Number(level.number);
    const sourceLevel = sourceLevelByNumber.get(number);
    const englishLevel = englishLevelByNumber.get(number);
    if (!sourceLevel || !englishLevel) {
      issues.push(`${name}: level ${number} is missing from one or both materialized packs`);
      continue;
    }
    ensureEqual(Number(sourceLevel.stat_cap), 5 + number * 5, `source level ${number} stat cap`);
    ensureEqual(Number(englishLevel.stat_cap), 5 + number * 5, `English level ${number} stat cap`);
    if (sourceLevel.chapter_id !== level.chapter_id || englishLevel.chapter_id !== level.chapter_id) {
      issues.push(`${name}: level ${number} chapter mapping is out of sync`);
    }
    if (sourceLevel.theme?.en !== level.theme?.en || englishLevel.theme?.en !== level.theme?.en) issues.push(`${name}: level ${number} English theme is out of sync`);
    if (sourceLevel.learning_goal?.en !== level.learning_goal?.en || englishLevel.learning_goal?.en !== level.learning_goal?.en) issues.push(`${name}: level ${number} English learning goal is out of sync`);

    const moduleWords = (module.words ?? []).filter((row) => stageOf(row) === number);
    const moduleSentences = (module.sentences ?? []).filter((row) => stageOf(row) === number);
    if (level.review_only === true) {
      if (moduleWords.length || moduleSentences.length) issues.push(`${name}: review-only level ${number} must not introduce module words or sentences`);
    } else if (moduleSentences.length < 4) {
      issues.push(`${name}: level ${number} has only ${moduleSentences.length} sentences; expected at least 4`);
    }
    for (const language of ["it", "en"]) {
      const labels = moduleWords.map((row) => row.translations?.[language]);
      if (!uniqueNormalized(labels)) issues.push(`${name}: level ${number} has duplicate ${language} word answers`);
    }
    let exactIntroducedWords = 0;
    for (const definition of moduleWords) {
      const source = findByTarget(sourcePack.items, "target", definition.target);
      const english = findByTarget(englishPack.items, "target", definition.target);
      if (!source || !english) {
        issues.push(`${name}: word ${definition.target} is missing from one or both packs`);
        continue;
      }
      const sourceStage = stageOf(source);
      const englishStage = stageOf(english);
      const sourceTags = Array.isArray(source.tags) ? source.tags.map(String) : [];
      const englishTags = Array.isArray(english.tags) ? english.tags.map(String) : [];
      if (!sourceTags.includes("tier:core") || !englishTags.includes("tier:core") || sourceStage === null || englishStage === null || sourceStage > number || englishStage > number) {
        issues.push(`${name}: word ${definition.target} must be core content introduced no later than stage:${number}`);
      }
      if (sourceStage === number && englishStage === number) {
        exactIntroducedWords += 1;
        if (!sourceTags.includes("curriculum:v2") || !englishTags.includes("curriculum:v2")) {
          issues.push(`${name}: newly introduced word ${definition.target} must be tagged curriculum:v2`);
        }
      }
      if (source.translations?.it !== definition.translations?.it) issues.push(`${name}: Italian word translation is out of sync for ${definition.target}`);
      if (english.translations?.en !== definition.translations?.en) issues.push(`${name}: English word translation is out of sync for ${definition.target}`);
      if (!Array.isArray(source.audio) || !Array.isArray(english.audio)) issues.push(`${name}: word ${definition.target} must retain an audio array in both packs`);
    }
    if (level.review_only !== true && exactIntroducedWords < 8) {
      issues.push(`${name}: level ${number} introduces only ${exactIntroducedWords} genuinely new core words; expected at least 8`);
    }
    for (const definition of moduleSentences) {
      const source = findByTarget(sourcePack.grammar_items, "target_sentence", definition.target_sentence);
      const english = findByTarget(englishPack.grammar_items, "target_sentence", definition.target_sentence);
      if (!source || !english) {
        issues.push(`${name}: sentence ${definition.target_sentence} is missing from one or both packs`);
        continue;
      }
      if (stageOf(source) !== number || stageOf(english) !== number || !hasCurriculumTags(source) || !hasCurriculumTags(english)) {
        issues.push(`${name}: sentence ${definition.id} was not materialized as stage:${number} core curriculum content`);
      }
      if (source.translations?.it !== definition.translations?.it) issues.push(`${name}: Italian sentence translation is out of sync for ${definition.id}`);
      if (english.translations?.en !== definition.translations?.en) issues.push(`${name}: English sentence translation is out of sync for ${definition.id}`);
      if ((english.distractors ?? []).length < 3) issues.push(`${name}: English sentence ${definition.id} lost Armenian distractors`);
    }

    const sourceChapter = sourceChapterById.get(level.chapter_id);
    const englishChapter = englishChapterById.get(level.chapter_id);
    if (!sourceChapter || !englishChapter) issues.push(`${name}: chapter ${level.chapter_id} is missing from one or both packs`);
    else if (englishChapter.title?.en !== sourceChapter.title?.en) issues.push(`${name}: English chapter ${level.chapter_id} is out of sync`);

    const moduleEnemy = (module.enemies ?? []).find((enemy) => Number(enemy.level) === number);
    if (moduleEnemy) {
      const sourceEnemy = sourceEnemyByLevel.get(number);
      const englishEnemy = englishEnemyByLevel.get(number);
      if (!sourceEnemy || !englishEnemy || sourceEnemy.id !== moduleEnemy.id || englishEnemy.id !== moduleEnemy.id) {
        issues.push(`${name}: exact enemy for level ${number} is missing or out of sync`);
      }
      for (const language of ["it", "en"]) {
        const pack = language === "it" ? sourcePack : englishPack;
        if (pack.ui_text?.[moduleEnemy.name_key] !== module.enemy_names?.[language]?.[moduleEnemy.name_key]) {
          issues.push(`${name}: ${language} enemy name ${moduleEnemy.name_key} is missing or out of sync`);
        }
      }
    }
  }
  const usedTags = new Set();
  for (const level of module.levels ?? []) for (const tag of level.content_tags ?? []) usedTags.add(String(tag));
  for (const row of [...(module.words ?? []), ...(module.sentences ?? [])]) for (const tag of row.tags ?? []) usedTags.add(String(tag));
  for (const enemy of module.enemies ?? []) for (const tag of enemy.semantic_tags ?? []) usedTags.add(String(tag));
  for (const tag of usedTags) if (!sourceControlledTags.has(tag)) issues.push(`${name}: controlled tag is missing: ${tag}`);
}

if (issues.length) {
  console.error(`Armenian modular curriculum audit failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}
const totalWords = moduleEntries.reduce((sum, entry) => sum + (entry.module.words?.length ?? 0), 0);
const totalSentences = moduleEntries.reduce((sum, entry) => sum + (entry.module.sentences?.length ?? 0), 0);
const totalChapters = moduleEntries.reduce((sum, entry) => sum + (entry.module.chapters?.length ?? 0), 0);
const exactEnemies = moduleEntries.reduce((sum, entry) => sum + (entry.module.enemies?.length ?? 0), 0);
console.log(`Armenian modular curriculum audit passed: ${moduleEntries.length} modules cover levels 9-${maxAuthoredLevel} with ${totalWords} vocabulary definitions, ${totalSentences} unambiguous sentence exercises, ${totalChapters} chapters, and ${exactEnemies} exact enemies synchronized across Italian and English packs.`);
