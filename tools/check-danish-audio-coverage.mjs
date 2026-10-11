#!/usr/bin/env node
// Offline coverage check for the Danish audio. Warn-only unless --strict. Never calls Azure or any network service.
// Usage: node tools/check-danish-audio-coverage.mjs [pack-dir] [--strict] [--include-option-text] [--out=<dir>]
//
// RESIDUAL ALLOWLIST (not counted as failures even though they are spoken by browser speech):
//   numeral_option  option label made only of digits (0-1000+): QuestionCard plays option buttons through browser speech
//                   with an empty audio array and AnswerOption has no audio references. DEFERRED until the engine/UI
//                   can attach recordings to options.
//   emoji_option    option label made only of emoji/pictograms/symbols: nothing meaningful to say aloud.
//   option_text     any other option label ("Ida", "A", "Flere"): residual by default for the same UI reason;
//                   counted as a failure with --include-option-text.
// Everything else (instruction, target = wrong-answer/"Listen again" audio, secondary) must be a neural mp3.
import { registerHooks } from "node:module";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith("@hero-lang/")) return next(pathToFileURL(resolve(root, "packages", specifier.slice(11), "src/index.ts")).href, context);
  if (specifier.startsWith(".") && context.parentURL && !/\.[a-z]+$/.test(specifier)) {
    const path = resolve(dirname(fileURLToPath(context.parentURL)), `${specifier}.ts`);
    if (existsSync(path)) return next(pathToFileURL(path).href, context);
  }
  return next(specifier, context);
} });
const { loadModularPack } = await import("./pack-utils.mjs");
const foundations = await import("../packages/foundations-engine/src/index.ts");
const learning = await import("../packages/learning-engine/src/index.ts");

const argv = process.argv.slice(2);
const strict = argv.includes("--strict");
const includeOptionText = argv.includes("--include-option-text");
const packDir = resolve(argv.find((arg) => !arg.startsWith("--")) ?? "content-packs/da-foundations");
const outDir = resolve(argv.find((arg) => arg.startsWith("--out="))?.slice(6) ?? ".local-data/danish-audio-coverage");
const autoDir = join(packDir, "audio", "auto-neural");
mkdirSync(outDir, { recursive: true });

// ---- files on disk and data-level metadata ----
const onDisk = existsSync(autoDir) ? readdirSync(autoDir) : [];
const nfdNames = onDisk.filter((name) => name !== name.normalize("NFC"));
const zeroByte = onDisk.filter((name) => statSync(join(autoDir, name)).size === 0);
const referenced = new Set();
const incomplete = [];
function mp3Exists(url) {
  const relative = String(url).replace(/^.*?content-packs\/[^/]+\//, "");
  referenced.add(relative.split("/").pop().normalize("NFC"));
  return ["NFC", "NFD"].some((form) => { const path = join(packDir, relative.normalize(form)); return existsSync(path) && statSync(path).size > 0; });
}
for (const file of ["dictionary/words.jsonl", "dictionary/letters.jsonl", "dictionary/sentences.jsonl", "curriculum/reading-problems.jsonl", "curriculum/math-problems.jsonl", "curriculum/instructions.jsonl"]) {
  if (!existsSync(join(packDir, file))) continue;
  for (const line of readFileSync(join(packDir, file), "utf8").split("\n").filter(Boolean)) {
    const row = JSON.parse(line);
    for (const [field, value] of Object.entries(row)) {
      if (!/audio/.test(field) || !Array.isArray(value)) continue;
      for (const audio of value) {
        if (String(audio.url).startsWith("browser-tts:")) continue;
        mp3Exists(audio.url);
        if (audio.source_type === "automated" && !(audio.voice && audio.rate && audio.text)) incomplete.push(`${file}:${row.id}.${field}`);
      }
    }
  }
}
const orphans = onDisk.filter((name) => !referenced.has(name.normalize("NFC")));

// ---- classification (mirrors playLearningAudio/chooseAudioCandidates) ----
function classify(refs, text, checkText = true) {
  const list = Array.isArray(refs) ? refs : [];
  if (!list.length) return text ? "runtime_browser_no_ref" : "no_audio";
  const files = list.filter((ref) => ref?.url && !String(ref.url).startsWith("browser-tts:"));
  if (!files.length) return "browser_tts";
  const present = files.filter((ref) => mp3Exists(ref.url));
  if (!present.length) return "mp3_file_missing";
  const stale = checkText && present.every((ref) => ref.source_type === "automated" && ref.text && String(ref.text).trim() !== String(text ?? "").trim());
  return stale ? "neural_stale_text" : "neural_mp3";
}
const EMOJI_ONLY = /^[\p{Extended_Pictographic}\p{Emoji_Modifier}\u200D\uFE0F\u2190-\u21FF\u2205\u2500-\u257F\u25A0-\u25FF\s]+$/u;
const optionKind = (label) => /^\d+$/.test(label.trim()) ? "numeral_option" : EMOJI_ONLY.test(label) ? "emoji_option" : "option_text";

// ---- engine enumeration: one question per row and per random branch ----
const pack = loadModularPack(packDir);
const state = learning.createInitialLearnerState(pack, "Coverage");
const realRandom = Math.random;
const ask = (value, focus, subset) => { Math.random = () => value; try { return foundations.getNextQuestion({ ...pack, ...subset }, state, "da", focus, {}); } finally { Math.random = realRandom; } };
const AWARENESS_FOCUS = new Set(["counting", "number_match", "number_order", "comparison", "shape", "pattern", "sorting", "measurement", "place_value", "data"]);
const PHONOLOGICAL = new Set(["initial_sound", "final_sound", "rhyme", "syllable_count"]);
const strings = new Map(); const wrongAnswer = []; const errors = [];
function record(kind, id, field, text, refs) {
  if (!text && !refs?.length) return;
  // The instruction audio may legitimately be the row's own, more specific prompt: only targets are text-checked.
  const cls = classify(refs, text, field === "target");
  const key = `${field}|${String(text).normalize("NFC").trim()}`;
  if (!strings.has(key)) strings.set(key, { field, text, cls, kinds: new Set(), examples: [] });
  const entry = strings.get(key); entry.kinds.add(kind); if (entry.examples.length < 3) entry.examples.push(id);
  return cls;
}
function collect(kind, id, question) {
  record(kind, id, "instruction", question.instruction_audio_text, question.instruction_audio);
  const cls = record(kind, id, "target", question.target_audio_text, question.audio);
  if (question.secondary_audio_text) record(kind, id, "secondary", question.secondary_audio_text, question.secondary_audio);
  const spoken = question.target_audio_text ?? question.answer_explanation?.target ?? question.options.find((option) => option.id === question.correct_option_id)?.label;
  wrongAnswer.push({ kind, id, text: spoken, cls: question.target_audio_text ? cls : classify(question.audio, spoken), listen_again: Boolean(question.target_audio_text), url: (question.audio ?? []).map((ref) => ref.url).join(" ") });
  if (question.option_audio_lang) for (const option of question.options) record(kind, id, optionKind(String(option.label)), String(option.label), []);
}
const attempt = (kind, id, make) => { try { collect(kind, id, make()); } catch (error) { errors.push(`${kind} ${id}: ${error.message}`); } };
for (const letter of pack.letters ?? []) for (const [value, label] of [[0.1, "letter-sound"], [0.9, "letter-case"]]) attempt(label, letter.id, () => ask(value, "vocabulary", { letters: [letter] }));
for (const item of pack.items ?? []) for (const [value, label] of [[0.1, "word-build"], [0.9, "word-picture"]]) attempt(label, item.id, () => ask(value, "comprehension", { items: [item], reading_problems: [] }));
for (const problem of pack.reading_problems ?? []) attempt(`reading:${problem.domain}`, problem.id, () => ask(0.1, "comprehension", { items: [], reading_problems: [problem] }));
for (const problem of pack.math_problems ?? []) attempt(`math:${problem.domain}`, problem.id, () => ask(0.1, AWARENESS_FOCUS.has(problem.domain) ? "grammar" : "pronunciation", { math_problems: [problem] }));
// Oral levels also voice reading answer choices; their labels are the row options.
for (const problem of pack.reading_problems ?? []) if (problem.oral || PHONOLOGICAL.has(problem.domain)) for (const label of new Set([problem.answer, ...(problem.options ?? [])])) record(`reading:${problem.domain}`, problem.id, optionKind(String(label)), String(label), []);

// ---- report ----
const RESIDUAL = new Set(["numeral_option", "emoji_option", ...(includeOptionText ? [] : ["option_text"])]);
const table = {};
for (const entry of strings.values()) { table[entry.field] ??= {}; table[entry.field][entry.cls] = (table[entry.field][entry.cls] ?? 0) + 1; }
const failing = [...strings.values()].filter((entry) => entry.cls !== "neural_mp3" && !(RESIDUAL.has(entry.field) && entry.cls === "runtime_browser_no_ref"));
const issues = [];
if (failing.length) issues.push(`${failing.length} distinct non-residual strings lack a neural mp3`);
if (errors.length) issues.push(`${errors.length} engine errors`);
if (nfdNames.length) issues.push(`${nfdNames.length} decomposed (NFD) file names`);
if (orphans.length) issues.push(`${orphans.length} orphan mp3 files`);
if (zeroByte.length) issues.push(`${zeroByte.length} zero-byte mp3 files`);
if (incomplete.length) issues.push(`${incomplete.length} automated entries without voice/rate/text`);
const csv = (rows) => rows.map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""').replace(/\n/g, " ")}"`).join(",")).join("\n") + "\n";
writeFileSync(join(outDir, "coverage.csv"), csv([["field", "class", "residual", "kinds", "example_ids", "text"],
  ...[...strings.values()].map((entry) => [entry.field, entry.cls, RESIDUAL.has(entry.field), [...entry.kinds].join(" ; "), entry.examples.join(" ; "), entry.text])]));
writeFileSync(join(outDir, "wrong_answer_audio.csv"), csv([["kind", "id", "class", "listen_again_button", "text", "audio_urls"], ...wrongAnswer.map((row) => [row.kind, row.id, row.cls, row.listen_again, row.text, row.url])]));
const wrongSummary = {}; for (const row of wrongAnswer) { const key = row.kind.split(":")[0]; wrongSummary[key] ??= {}; wrongSummary[key][row.cls] = (wrongSummary[key][row.cls] ?? 0) + 1; }
const summary = { pack: packDir, mp3_on_disk: onDisk.length, nfd_names: nfdNames, orphans, zero_byte: zeroByte, incomplete_metadata: incomplete.length, distinct_strings: strings.size, by_field_and_class: table, wrong_answer_audio_by_kind_and_class: wrongSummary, engine_errors: errors, issues, strict };
writeFileSync(join(outDir, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
console.log(`Danish audio coverage: mp3 on disk ${onDisk.length}; NFD names ${nfdNames.length}; orphans ${orphans.length}; zero-byte ${zeroByte.length}; automated entries without voice/rate/text ${incomplete.length}.`);
console.log(`Distinct spoken strings: ${strings.size}. By field and class: ${JSON.stringify(table)}`);
console.log(`Wrong-answer / Listen-again audio (question.audio) by kind: ${JSON.stringify(wrongSummary)}`);
console.log(`Residual allowlist: ${[...RESIDUAL].join(", ")}. Reports: ${outDir}/{coverage.csv,wrong_answer_audio.csv,summary.json}`);
console.log(issues.length ? `${strict ? "FAIL" : "WARN"}: ${issues.join("; ")}.` : "PASS: every non-residual spoken string has a neural mp3.");
process.exit(strict && issues.length ? 1 : 0);
