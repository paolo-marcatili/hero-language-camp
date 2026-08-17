#!/usr/bin/env node
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { loadModularPack } from "./pack-utils.mjs";

const target = process.argv[2] ?? "content-packs/hy-eastern-it";
const absolutePath = resolve(target);
if (!existsSync(absolutePath)) {
  console.error(`Cannot find content pack: ${target}`);
  process.exit(1);
}

const pack = statSync(absolutePath).isDirectory() ? loadModularPack(absolutePath) : JSON.parse(await import("node:fs/promises").then((fs) => fs.readFile(absolutePath, "utf8")));
const result = validateLanguagePack(pack);

if (result.errors.length > 0) {
  console.error("Content validation failed:");
  for (const error of result.errors) console.error(`- ${error}`);
}

if (result.warnings.length > 0) {
  console.warn("Content validation warnings:");
  for (const warning of result.warnings.slice(0, 80)) console.warn(`- ${warning}`);
  if (result.warnings.length > 80) console.warn(`... ${result.warnings.length - 80} more warnings`);
}

if (!result.ok) process.exit(1);
console.log(`Content validation passed: ${pack.pack_id} (${pack.items.length} words, ${pack.grammar_items?.length ?? 0} sentences, ${pack.letters?.length ?? 0} letters, ${pack.reading_problems?.length ?? 0} reading problems, ${pack.math_problems?.length ?? 0} math problems)`);

function validateLanguagePack(value) {
  const errors = [];
  const warnings = [];
  if (!isObject(value)) return { ok: false, errors: ["Pack must be an object."], warnings };
  for (const field of ["pack_id", "version", "title", "source_language", "target_language", "license"]) requireString(value, field, errors);
  if (!isObject(value.language)) errors.push("language must be an object.");
  else for (const field of ["name_english", "name_native", "bcp47", "direction"]) requireString(value.language, `language.${field}`, errors, field);
  if (!value.base_language?.code) errors.push("modular pack must define base_language.code.");
  if (!Array.isArray(value.controlled_tags) || value.controlled_tags.length === 0) warnings.push("controlled_tags is empty; semantic grouping will be weak.");
  const tagSet = new Set((value.controlled_tags ?? []).map((tag) => tag.id));
  const authoredStageNumbers = new Set(
    (Array.isArray(value.levels) ? value.levels : [])
      .filter((level) => isObject(level) && Number.isInteger(level.number) && level.number >= 0)
      .map((level) => level.number)
  );
  if (!Array.isArray(value.training_options) || value.training_options.length === 0) errors.push("training_options must be provided by tasks.yaml.");
  if (!Array.isArray(value.levels) || value.levels.length === 0) errors.push("levels must be provided by levels.yaml.");
  if (!Array.isArray(value.enemies) || value.enemies.length === 0) errors.push("enemies must be provided by enemies.yaml.");
  if (!Array.isArray(value.items) || value.items.length === 0) errors.push("items must be a non-empty array.");
  if (!Array.isArray(value.lessons) || value.lessons.length === 0) errors.push("lessons must be a non-empty array.");

  const itemIds = new Set();
  for (const [index, item] of (value.items ?? []).entries()) {
    if (!isObject(item)) { errors.push(`items[${index}] must be an object.`); continue; }
    for (const field of ["id", "concept", "target", "translation", "review_status"]) requireString(item, `items[${index}].${field}`, errors, field);
    if (itemIds.has(item.id)) errors.push(`Duplicate item id: ${item.id}`);
    itemIds.add(item.id);
    if (item.difficulty !== undefined && (typeof item.difficulty !== "number" || item.difficulty < 1)) errors.push(`items[${index}].difficulty must be positive when provided.`);
    if (!Array.isArray(item.tags)) errors.push(`items[${index}].tags must be an array.`);
    else {
      for (const tag of item.tags) if (tagSet.size && !tagSet.has(tag)) warnings.push(`items[${index}] uses uncontrolled tag: ${tag}`);
      validateCurriculumTags(item, `items[${index}]`, errors, authoredStageNumbers);
      if (item.tags.includes("tier:core") && item.translation_review_status?.it !== "reviewed") errors.push(`items[${index}] core Italian translation must be reviewed.`);
    }
    if (!Array.isArray(item.audio)) errors.push(`items[${index}].audio must be an array.`);
    if (item.review_status !== "approved") warnings.push(`items[${index}] is not approved yet: ${item.id}`);
  }

  const letterIds = new Set();
  for (const [index, letter] of (value.letters ?? []).entries()) {
    if (!isObject(letter)) { errors.push(`letters[${index}] must be an object.`); continue; }
    for (const field of ["id", "character", "sound", "review_status"]) requireString(letter, `letters[${index}].${field}`, errors, field);
    const label = letter.names?.[value.source_language] || letter.sound;
    if (letterIds.has(letter.id)) errors.push(`Duplicate letter id: ${letter.id}`);
    letterIds.add(letter.id);
    const duplicateVisible = [...letterIds].filter((id) => id !== letter.id).length;
    void duplicateVisible;
    if (!label) errors.push(`letters[${index}] must have a visible label.`);
    if (Array.isArray(letter.tags)) validateCurriculumTags(letter, `letters[${index}]`, errors, authoredStageNumbers);
    else errors.push(`letters[${index}].tags must be an array.`);
    if (letter.review_status !== "approved") warnings.push(`letters[${index}] is not approved yet: ${letter.id}`);
  }

  const grammarIds = new Set();
  for (const [index, grammar] of (value.grammar_items ?? []).entries()) {
    if (!isObject(grammar)) { errors.push(`grammar_items[${index}] must be an object.`); continue; }
    for (const field of ["id", "target_sentence", "translation", "review_status"]) requireString(grammar, `grammar_items[${index}].${field}`, errors, field);
    if (grammarIds.has(grammar.id)) errors.push(`Duplicate grammar item id: ${grammar.id}`);
    grammarIds.add(grammar.id);
    if (grammar.translation_distractors !== undefined) {
      if (!isObject(grammar.translation_distractors)) errors.push(`grammar_items[${index}].translation_distractors must be an object.`);
      else for (const [code, entries] of Object.entries(grammar.translation_distractors)) {
        if (!Array.isArray(entries) || entries.some((entry) => typeof entry !== "string" || !entry.trim())) errors.push(`grammar_items[${index}].translation_distractors.${code} must contain non-empty strings.`);
      }
    }
    if (!Array.isArray(grammar.distractors) || grammar.distractors.length === 0) errors.push(`grammar_items[${index}].distractors must be non-empty.`);
    if (!Array.isArray(grammar.tags)) errors.push(`grammar_items[${index}].tags must be an array.`);
    else {
      for (const tag of grammar.tags) if (tagSet.size && !tagSet.has(tag)) warnings.push(`grammar_items[${index}] uses uncontrolled tag: ${tag}`);
      validateCurriculumTags(grammar, `grammar_items[${index}]`, errors, authoredStageNumbers);
      if (grammar.tags.includes("tier:core")) {
        if (grammar.translation_review_status?.it !== "reviewed") errors.push(`grammar_items[${index}] core Italian translation must be reviewed.`);
        const italianDistractors = grammar.translation_distractors?.it;
        if (!Array.isArray(italianDistractors) || new Set(italianDistractors).size < 3 || italianDistractors.includes(grammar.translation)) {
          errors.push(`grammar_items[${index}] core sentence must have three unique Italian distractors different from the answer.`);
        }
      }
    }
    if (grammar.review_status !== "approved") warnings.push(`grammar_items[${index}] is not approved yet: ${grammar.id}`);
  }

  const mathIds = new Set();
  for (const [index, problem] of (value.math_problems ?? []).entries()) {
    const path = `math_problems[${index}]`;
    if (!isObject(problem)) { errors.push(`${path} must be an object.`); continue; }
    for (const field of ["id", "domain", "review_status"]) requireString(problem, `${path}.${field}`, errors, field);
    if (mathIds.has(problem.id)) errors.push(`Duplicate math problem id: ${problem.id}`);
    mathIds.add(problem.id);
    if (!["counting", "number_match", "number_order", "comparison", "addition", "subtraction", "number_bond", "story_problem", "shape", "pattern", "sorting", "measurement"].includes(problem.domain)) errors.push(`${path}.domain is unsupported.`);
    if (!isObject(problem.prompt)) errors.push(`${path}.prompt must be localized text.`);
    if (!Number.isFinite(problem.result)) errors.push(`${path}.result must be a number.`);
    if (problem.options !== undefined && (!Array.isArray(problem.options) || problem.options.some((entry) => typeof entry !== "string" || !entry.trim()))) errors.push(`${path}.options must contain non-empty strings.`);
    if (["shape", "pattern", "sorting", "measurement"].includes(problem.domain) && (!problem.answer || !problem.options?.includes(problem.answer))) errors.push(`${path}.answer must be included in options.`);
    if (!Array.isArray(problem.tags)) errors.push(`${path}.tags must be an array.`);
    else for (const tag of problem.tags) if (tagSet.size && !tagSet.has(tag)) warnings.push(`${path} uses uncontrolled tag: ${tag}`);
  }

  const readingIds = new Set();
  for (const [index, problem] of (value.reading_problems ?? []).entries()) {
    const path = `reading_problems[${index}]`;
    if (!isObject(problem)) { errors.push(`${path} must be an object.`); continue; }
    for (const field of ["id", "domain", "text", "answer", "review_status"]) requireString(problem, `${path}.${field}`, errors, field);
    if (readingIds.has(problem.id)) errors.push(`Duplicate reading problem id: ${problem.id}`);
    readingIds.add(problem.id);
    if (!["sentence_picture", "sentence_order", "missing_word", "missing_letter", "mini_story", "initial_sound", "final_sound", "rhyme", "syllable_count"].includes(problem.domain)) errors.push(`${path}.domain is unsupported.`);
    if (!isObject(problem.prompt)) errors.push(`${path}.prompt must be localized text.`);
    if (!Array.isArray(problem.tags)) errors.push(`${path}.tags must be an array.`);
    else { for (const tag of problem.tags) if (tagSet.size && !tagSet.has(tag)) warnings.push(`${path} uses uncontrolled tag: ${tag}`); validateCurriculumTags(problem, path, errors, authoredStageNumbers); }
    if (problem.options !== undefined && (!Array.isArray(problem.options) || problem.options.some((entry) => typeof entry !== "string" || !entry.trim()))) errors.push(`${path}.options must contain non-empty strings.`);
  }

  const instructionIds = new Set();
  for (const [index, instruction] of (value.foundations_instructions ?? []).entries()) {
    const path = `foundations_instructions[${index}]`;
    if (!isObject(instruction)) { errors.push(`${path} must be an object.`); continue; }
    for (const field of ["id", "review_status"]) requireString(instruction, `${path}.${field}`, errors, field);
    if (instructionIds.has(instruction.id)) errors.push(`Duplicate foundations instruction id: ${instruction.id}`);
    instructionIds.add(instruction.id);
    if (!isObject(instruction.text)) errors.push(`${path}.text must be localized text.`);
    if (!Array.isArray(instruction.tags)) errors.push(`${path}.tags must be an array.`);
  }

  // Levels reference Story chapters, so a silently truncated YAML array is an error.
  const storyChapterIds = new Set();
  const storyChapters = isObject(value.story) && Array.isArray(value.story.chapters)
    ? value.story.chapters
    : [];
  if (value.story !== undefined && !isObject(value.story)) {
    errors.push("story must be an object.");
  } else if (isObject(value.story) && !Array.isArray(value.story.chapters)) {
    errors.push("story.chapters must be an array.");
  }
  for (const [index, chapter] of storyChapters.entries()) {
    const path = `story.chapters[${index}]`;
    if (!isObject(chapter)) {
      errors.push(`${path} must be an object.`);
      continue;
    }
    requireString(chapter, `${path}.id`, errors, "id");
    if (typeof chapter.id === "string") {
      if (storyChapterIds.has(chapter.id)) errors.push(`Duplicate story chapter id: ${chapter.id}`);
      storyChapterIds.add(chapter.id);
    }
    if (!isObject(chapter.title)) errors.push(`${path}.title must be localized text.`);
    if (chapter.lesson !== undefined && !isObject(chapter.lesson)) errors.push(`${path}.lesson must be an object.`);
    if (isObject(chapter.lesson) && chapter.lesson.dialogue !== undefined && !Array.isArray(chapter.lesson.dialogue)) errors.push(`${path}.lesson.dialogue must be an array.`);
  }
  for (const [index, level] of (Array.isArray(value.levels) ? value.levels : []).entries()) {
    if (!isObject(level) || typeof level.chapter_id !== "string") continue;
    if (!storyChapterIds.has(level.chapter_id)) {
      errors.push(`levels[${index}].chapter_id references unknown story chapter: ${level.chapter_id}`);
    }
  }

  for (const [index, level] of (value.levels ?? []).entries()) {
    if (!isObject(level)) { errors.push(`levels[${index}] must be an object.`); continue; }
    if (typeof level.number !== "number") errors.push(`levels[${index}].number must be a number.`);
    if (typeof level.stat_cap !== "number") errors.push(`levels[${index}].stat_cap must be a number.`);
    if (!isObject(level.unlock_requires)) errors.push(`levels[${index}].unlock_requires must be an object.`);
    if (!isObject(level.fight)) errors.push(`levels[${index}].fight must be an object.`);
  }

  for (const [index, enemy] of (value.enemies ?? []).entries()) {
    if (!isObject(enemy)) { errors.push(`enemies[${index}] must be an object.`); continue; }
    for (const field of ["id", "name_key", "sprite"]) requireString(enemy, `enemies[${index}].${field}`, errors, field);
    if (!Array.isArray(enemy.semantic_tags)) errors.push(`enemies[${index}].semantic_tags must be an array.`);
    else for (const tag of enemy.semantic_tags) if (tagSet.size && !tagSet.has(tag)) warnings.push(`enemies[${index}] uses uncontrolled tag: ${tag}`);
  }

  const labyrinthIds = new Set();
  for (const [index, labyrinth] of (value.labyrinths ?? []).entries()) {
    const path = `labyrinths[${index}]`;
    if (!isObject(labyrinth)) { errors.push(`${path} must be an object.`); continue; }
    requireString(labyrinth, `${path}.id`, errors, "id");
    if (typeof labyrinth.id === "string") {
      if (labyrinthIds.has(labyrinth.id)) errors.push(`Duplicate labyrinth id: ${labyrinth.id}`);
      labyrinthIds.add(labyrinth.id);
    }
    if (typeof labyrinth.enabled !== "boolean") errors.push(`${path}.enabled must be a boolean.`);
    if (!Number.isInteger(labyrinth.minimum_level) || labyrinth.minimum_level < 0) errors.push(`${path}.minimum_level must be a non-negative integer.`);
    if (!isObject(labyrinth.map)) errors.push(`${path}.map must be an object.`);
    else {
      if (!Number.isInteger(labyrinth.map.width) || labyrinth.map.width < 5) errors.push(`${path}.map.width must be an integer of at least 5.`);
      if (!Number.isInteger(labyrinth.map.height) || labyrinth.map.height < 5) errors.push(`${path}.map.height must be an integer of at least 5.`);
      requireString(labyrinth.map, `${path}.map.theme`, errors, "theme");
      if (labyrinth.map.reveal_mode !== "current_and_adjacent") errors.push(`${path}.map.reveal_mode is unsupported.`);
    }
    if (!isObject(labyrinth.questions)) errors.push(`${path}.questions must be an object.`);
    else {
      const minimum = Number(labyrinth.questions.minimum ?? 0);
      const target = Number(labyrinth.questions.target ?? 0);
      const maximum = Number(labyrinth.questions.maximum ?? 0);
      const perFocus = Number(labyrinth.questions.minimum_per_focus ?? 0);
      if (![minimum, target, maximum].every(Number.isInteger) || !(minimum >= 1 && target >= minimum && maximum >= target)) errors.push(`${path} question counts must be integers satisfying 1 <= minimum <= target <= maximum.`);
      if (!Number.isInteger(perFocus) || perFocus < 1) errors.push(`${path}.questions.minimum_per_focus must be a positive integer.`);
      if (target < perFocus * 4) errors.push(`${path}.questions.target must cover all four focuses.`);
      if (labyrinth.questions.monster_encounters !== undefined && (!Number.isInteger(labyrinth.questions.monster_encounters) || labyrinth.questions.monster_encounters < 1)) errors.push(`${path}.questions.monster_encounters must be a positive integer.`);
    }
    if (labyrinth.events !== undefined) {
      if (!isObject(labyrinth.events)) errors.push(`${path}.events must be an object when provided.`);
      else {
        for (const key of ["trap_encounters", "cache_cells", "healing_cells", "reveal_cells"]) {
          const amount = labyrinth.events[key];
          if (amount !== undefined && (!Number.isInteger(amount) || amount < 0)) {
            errors.push(`${path}.events.${key} must be a non-negative integer when provided.`);
          }
        }
        for (const key of ["trap_heart_loss", "reveal_radius"]) {
          const amount = labyrinth.events[key];
          if (amount !== undefined && (!Number.isInteger(amount) || amount < 1)) {
            errors.push(`${path}.events.${key} must be a positive integer when provided.`);
          }
        }
        for (const key of ["cache_coins_min", "cache_coins_max"]) {
          const amount = labyrinth.events[key];
          if (amount !== undefined && (!Number.isInteger(amount) || amount < 0)) {
            errors.push(`${path}.events.${key} must be a non-negative integer when provided.`);
          }
        }
        if (
          labyrinth.events.cache_coins_min !== undefined &&
          labyrinth.events.cache_coins_max !== undefined &&
          labyrinth.events.cache_coins_max < labyrinth.events.cache_coins_min
        ) {
          errors.push(`${path}.events.cache_coins_max must be >= cache_coins_min.`);
        }
      }
    }
    if (!Number.isInteger(labyrinth.hearts) || labyrinth.hearts < 1) errors.push(`${path}.hearts must be a positive integer.`);
    if (!Array.isArray(labyrinth.semantic_tags) || !labyrinth.semantic_tags.every((tag) => typeof tag === "string")) errors.push(`${path}.semantic_tags must be a string array.`);
    else for (const tag of labyrinth.semantic_tags) if (tagSet.size && !tagSet.has(tag)) warnings.push(`${path} uses uncontrolled tag: ${tag}`);
    if (!isObject(labyrinth.rewards)) errors.push(`${path}.rewards must be an object.`);
    else {
      if (!Number.isInteger(labyrinth.rewards.attribute_points_each) || labyrinth.rewards.attribute_points_each < 0) errors.push(`${path}.rewards.attribute_points_each must be a non-negative integer.`);
      if (!Number.isInteger(labyrinth.rewards.session_credit) || labyrinth.rewards.session_credit < 0) errors.push(`${path}.rewards.session_credit must be a non-negative integer.`);
      if (!isObject(labyrinth.rewards.bonus)) errors.push(`${path}.rewards.bonus must be an object.`);
      else {
        for (const key of ["none_weight", "coins_weight", "item_weight", "coins_min", "coins_max"]) {
          const amount = labyrinth.rewards.bonus[key];
          if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) errors.push(`${path}.rewards.bonus.${key} must be a non-negative number.`);
        }
        if (Number(labyrinth.rewards.bonus.coins_max) < Number(labyrinth.rewards.bonus.coins_min)) errors.push(`${path}.rewards.bonus.coins_max must be >= coins_min.`);
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

function validateCurriculumTags(entry, path, errors, authoredStageNumbers) {
  const tags = entry.tags ?? [];
  const tiers = tags.filter((tag) => tag === "tier:core" || tag === "tier:extension");
  if (tiers.length !== 1) errors.push(`${path} must have exactly one tier:core or tier:extension tag.`);
  if (tiers[0] !== "tier:core") return;

  const stageTags = tags.filter((tag) => typeof tag === "string" && tag.startsWith("stage:"));
  if (stageTags.length !== 1 || !/^stage:(?:0|[1-9]\d*)$/.test(stageTags[0])) {
    errors.push(`${path} core content must have exactly one non-negative stage:N tag.`);
    return;
  }

  const stage = Number(stageTags[0].slice("stage:".length));
  if (authoredStageNumbers.size > 0 && !authoredStageNumbers.has(stage)) {
    errors.push(`${path} core content references unauthored stage:${stage}.`);
  }
}

function isObject(value) { return typeof value === "object" && value !== null && !Array.isArray(value); }
function requireString(obj, path, errors, field = path) { if (typeof obj[field] !== "string" || obj[field] === "") errors.push(`${path} must be a non-empty string.`); }
