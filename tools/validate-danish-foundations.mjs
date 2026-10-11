#!/usr/bin/env node
import { resolve } from "node:path";
import { loadModularPack } from "./pack-utils.mjs";

const packDir = resolve(process.argv[2] ?? "content-packs/da-foundations");
const pack = loadModularPack(packDir);
const errors = [];
const warnings = [];

const stageOf = (tags = []) => {
  const tag = tags.find((entry) => entry.startsWith("stage:"));
  const stage = tag ? Number(tag.slice("stage:".length)) : Number.NaN;
  return Number.isFinite(stage) ? stage : undefined;
};

const lettersByCharacter = new Map();
const lettersById = new Map();
for (const letter of pack.letters ?? []) {
  const character = letter.lowercase ?? letter.character;
  if (lettersByCharacter.has(character)) errors.push(`Duplicate grapheme: ${character}`);
  lettersByCharacter.set(character, letter);
  lettersById.set(letter.id, letter);
  if (stageOf(letter.tags) === undefined) errors.push(`${letter.id}: missing controlled stage tag.`);
  if (!(letter.example_item_ids?.length || letter.example_word)) errors.push(`${letter.id}: needs an example word for sound-led instruction.`);
  if ((letter.sound_audio ?? []).some((entry) => entry.source_type === "browser_tts")) errors.push(`${letter.id}: isolated phonemes must not use browser speech synthesis.`);
}
for (const required of [..."abcdefghijklmnopqrstuvy", "æ", "ø", "å"]) {
  if (["q", "w", "x", "z"].includes(required)) continue;
  if (!lettersByCharacter.has(required)) errors.push(`Missing expected early-school grapheme: ${required}`);
}
if (lettersByCharacter.size < 25) errors.push("Phase D must contain at least 25 introduced graphemes.");

const itemsById = new Map((pack.items ?? []).map((item) => [item.id, item]));
if ((pack.items ?? []).length < 180) errors.push("Phase E should contain at least 180 reading words.");
for (const item of pack.items ?? []) {
  const itemStage = stageOf(item.tags);
  if (itemStage === undefined) errors.push(`${item.id}: missing controlled stage tag.`);
  const graphemes = item.graphemes ?? [...item.target];
  if (graphemes.join("") !== item.target) errors.push(`${item.id}: graphemes do not reconstruct '${item.target}'.`);
  for (const grapheme of graphemes) {
    const letter = lettersByCharacter.get(grapheme.toLowerCase());
    if (!letter) { errors.push(`${item.id}: grapheme '${grapheme}' has not been introduced.`); continue; }
    const letterStage = stageOf(letter.tags);
    if (itemStage !== undefined && letterStage !== undefined && letterStage > itemStage) errors.push(`${item.id}: grapheme '${grapheme}' is introduced at stage ${letterStage}, after the word at stage ${itemStage}.`);
  }
  if (!item.emoji && !item.image) warnings.push(`${item.id}: picture-supported tasks should have an emoji or image.`);
}

for (const letter of pack.letters ?? []) {
  for (const itemId of letter.example_item_ids ?? []) {
    const item = itemsById.get(itemId);
    if (!item) { errors.push(`${letter.id}: example item '${itemId}' does not exist.`); continue; }
    const character = letter.lowercase ?? letter.character;
    if (item.graphemes?.[0] !== character) errors.push(`${letter.id}: example '${item.target}' does not begin with '${character}'.`);
  }
}

const readingDomains = new Set();
const readingIds = new Set();
for (const problem of pack.reading_problems ?? []) {
  if (readingIds.has(problem.id)) errors.push(`Duplicate reading problem: ${problem.id}`);
  readingIds.add(problem.id);
  readingDomains.add(problem.domain);
  const stage = stageOf(problem.tags);
  if (stage === undefined) errors.push(`${problem.id}: missing controlled stage tag.`);
  if (!problem.text || !problem.answer || !problem.prompt?.da) errors.push(`${problem.id}: incomplete reading task.`);
  if (["sentence_picture", "missing_word", "missing_letter", "mini_story", "initial_sound", "final_sound", "rhyme", "syllable_count"].includes(problem.domain)) {
    if (!Array.isArray(problem.options) || !problem.options.includes(problem.answer) || new Set(problem.options).size < 3) errors.push(`${problem.id}: needs at least three unique options including the answer.`);
  }
  if (["initial_sound", "final_sound", "rhyme", "syllable_count"].includes(problem.domain) && !problem.instruction_id) errors.push(`${problem.id}: phonological-awareness tasks need a reusable instruction id.`);
  if (problem.domain === "sentence_order") {
    const words = problem.words ?? problem.answer.replace(/[.!?]$/u, "").split(/\s+/);
    if (words.length < 3) errors.push(`${problem.id}: sentence-order activity is too short.`);
  }
}
for (const required of ["sentence_picture", "sentence_order", "missing_word", "missing_letter", "mini_story", "initial_sound", "final_sound", "rhyme", "syllable_count"]) if (!readingDomains.has(required)) errors.push(`Missing reading domain: ${required}.`);
if ((pack.reading_problems ?? []).length < 140) errors.push("Phase E should contain at least 140 structured reading tasks.");

const mathIds = new Set();
const mathDomains = new Set();
for (const problem of pack.math_problems ?? []) {
  if (mathIds.has(problem.id)) errors.push(`Duplicate math problem: ${problem.id}`);
  mathIds.add(problem.id);
  mathDomains.add(problem.domain);
  if (stageOf(problem.tags) === undefined) errors.push(`${problem.id}: missing controlled stage tag.`);
  const minimum = problem.number_range?.min ?? 0;
  const maximum = problem.number_range?.max ?? 20;
  const operands = problem.operands ?? [];
  if (problem.domain !== "comparison" && (problem.result < minimum || problem.result > maximum)) errors.push(`${problem.id}: result is outside its number range.`);
  if (operands.some((operand) => operand < minimum || operand > maximum)) errors.push(`${problem.id}: operand is outside its number range.`);
  if (problem.domain === "addition") {
    const [left, right] = operands; if (!Number.isFinite(left) || !Number.isFinite(right) || left + right !== problem.result) errors.push(`${problem.id}: incorrect addition definition.`);
  }
  if (problem.domain === "subtraction") {
    const [left, right] = operands; if (!Number.isFinite(left) || !Number.isFinite(right) || left - right !== problem.result || problem.result < 0) errors.push(`${problem.id}: incorrect subtraction definition.`);
  }
  if (problem.domain === "multiplication" && operands[0] * operands[1] !== problem.result) errors.push(`${problem.id}: incorrect multiplication.`);
  if (problem.domain === "division" && (!operands[1] || operands[0] / operands[1] !== problem.result || !Number.isInteger(problem.result))) errors.push(`${problem.id}: incorrect whole-number division.`);
  if (problem.domain === "number_order") {
    const [before, after] = operands; if (before + 1 !== problem.result || problem.result + 1 !== after) errors.push(`${problem.id}: number-order operands must surround the result.`);
  }
  if (problem.domain === "comparison") {
    const [left, right] = operands; const expected = left > right ? 1 : left < right ? -1 : 0;
    if (!Number.isFinite(left) || !Number.isFinite(right) || problem.result !== expected) errors.push(`${problem.id}: comparison result must be 1, -1, or 0.`);
  }
  if (problem.domain === "number_bond") {
    const [known] = operands; const whole = problem.whole;
    if (!Number.isFinite(known) || !Number.isFinite(whole) || known + problem.result !== whole) errors.push(`${problem.id}: number-bond parts must equal the whole.`);
  }
  if (problem.domain === "story_problem") {
    const [left, right] = operands;
    const expected = problem.operation === "subtraction" ? left - right : left + right;
    if (!Number.isFinite(left) || !Number.isFinite(right) || expected !== problem.result || problem.result < 0) errors.push(`${problem.id}: story-problem operation does not match the result.`);
  }
  if (["shape", "pattern", "sorting", "measurement", "place_value", "data"].includes(problem.domain)) {
    if (!problem.answer || !Array.isArray(problem.options) || !problem.options.includes(problem.answer) || new Set(problem.options).size < 3) errors.push(`${problem.id}: awareness activity needs at least three unique visual options including the answer.`);
    if (problem.domain === "pattern" && (!Array.isArray(problem.sequence) || problem.sequence.length < 4)) errors.push(`${problem.id}: pattern activity needs a visible sequence.`);
  }
}
for (const required of ["counting", "number_match", "number_order", "comparison", "addition", "subtraction", "number_bond", "story_problem", "shape", "pattern", "sorting", "measurement"]) if (!mathDomains.has(required)) errors.push(`Missing math domain: ${required}.`);
if ((pack.math_problems ?? []).length < 240) errors.push("Phase E should contain at least 240 mathematics tasks.");

const instructions = pack.foundations_instructions ?? [];
if (instructions.length < 20) errors.push("Phase E should provide at least 20 reusable narrated instructions.");
const instructionIds = new Set(instructions.map((entry) => entry.id));
for (const problem of [...(pack.reading_problems ?? []), ...(pack.math_problems ?? [])]) {
  if (problem.instruction_id && !instructionIds.has(problem.instruction_id)) errors.push(`${problem.id}: unknown instruction id ${problem.instruction_id}.`);
}

const levels = pack.levels ?? [];
if (levels.length !== 60) errors.push("The 0.–2. klasse course needs exactly 60 authored units.");
for (let expected = 0; expected < 60; expected += 1) {
  const level = levels.find((entry) => entry.number === expected);
  if (!level) { errors.push(`Missing level ${expected}.`); continue; }
  if (!level.chapter_id) errors.push(`Level ${expected}: missing chapter_id.`);
  if (level.school_grade !== Math.floor(expected / 20) || level.teaching_month !== Math.floor(expected % 20 / 2) + 1 || level.fortnight !== expected % 2 + 1) errors.push(`Level ${expected}: incorrect grade/month mapping.`);
  if (expected < 20 && level.reading_mode !== 'oral') errors.push(`Level ${expected}: grade 0 must work without reading.`);
  if (level.objectives?.length < 3) errors.push(`Level ${expected}: language, maths and logic objectives are required.`);
  if (!(pack.reading_problems ?? []).some(p => stageOf(p.tags) === expected)) errors.push(`Level ${expected}: no new comprehension tasks.`);
  if (!(pack.math_problems ?? []).some(p => stageOf(p.tags) === expected)) errors.push(`Level ${expected}: no new maths tasks.`);
  if ((level.unlock_requires?.completed_training_sessions ?? 0) < 6) warnings.push(`Level ${expected}: workload may be too short.`);
  const chapter = pack.story?.chapters?.find((entry) => entry.id === level.chapter_id || entry.minimum_level === level.number);
  if (!chapter?.lesson || !chapter.fiction || !chapter.mission) errors.push(`Level ${expected}: needs fiction, a structured lesson, and a mission.`);
}
if ((pack.enemies ?? []).length !== 60) errors.push("Configure an enemy for every authored Danish level.");
if ((pack.labyrinths ?? []).length < 3) errors.push("Phase D should provide starter, intermediate, and early-1st-grade labyrinth bands.");

if (errors.length) {
  console.error("Danish foundations curriculum validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
for (const warning of warnings) console.warn(`Warning: ${warning}`);
console.log(`Danish foundations Phase E curriculum passed: ${lettersByCharacter.size} graphemes, ${pack.items.length} words, ${pack.reading_problems?.length ?? 0} reading tasks, ${pack.math_problems?.length ?? 0} math problems, ${instructions.length} reusable instructions, ${levels.length} levels.`);
