#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const packDir = resolve(process.argv[2] ?? "content-packs/hy-eastern-it");
const sentences = readJsonl(join(packDir, "dictionary", "sentences.jsonl"));
const interfaceText = readFileSync(join(packDir, "interface.yaml"), "utf8");
const fallbackUiText = readFileSync(resolve("apps/web/src/i18n.ts"), "utf8");
const errors = [];

for (const [index, sentence] of sentences.entries()) {
  const path = `sentences[${index}](${sentence.id})`;
  const translation = String(sentence.translations?.it ?? sentence.translation ?? "").trim();
  if (!translation) errors.push(`${path}: missing Italian translation.`);
  if (/\b(?:lattè|setè|tèmpo|tristè)\b/i.test(translation)) errors.push(`${path}: contains an incorrect accent: ${translation}`);
  if (/^Voglio\s+(?!d(?:el|ella|ell[’']|ello|ei|egli|elle)\b|un(?:a|o)?[’']?\b|\p{L}+(?:are|ere|ire)\b)/iu.test(translation)) {
    errors.push(`${path}: "Voglio" requires a natural article or partitive: ${translation}`);
  }
  if (/^(?:Questo|Questa) è\s+d(?:el|ella|ell[’']|ello|ei|egli|elle)\b/i.test(translation)) {
    errors.push(`${path}: identification sentence uses an unnatural partitive: ${translation}`);
  }
  if (!/[.!?…]$/.test(translation)) errors.push(`${path}: translation should end with punctuation: ${translation}`);
  const prompt = String(sentence.prompt?.it ?? "");
  if (!sentence.comprehension_questions?.length && !prompt.endsWith(translation)) errors.push(`${path}: Italian prompt is not synchronized with its translation.`);
  for (const question of sentence.comprehension_questions ?? []) {
    if (!question.question?.it || !question.answer?.it || question.distractors?.it?.length < 2) errors.push(`${path}: incomplete Italian comprehension question.`);
    if (question.distractors?.it?.includes(question.answer?.it)) errors.push(`${path}: correct comprehension answer appears among distractors.`);
  }
  const distractors = sentence.translation_distractors?.it ?? [];
  if (distractors.length < 3) errors.push(`${path}: fewer than three Italian translation alternatives.`);
  if (new Set(distractors).size !== distractors.length) errors.push(`${path}: duplicate Italian translation alternatives.`);
  if (distractors.includes(translation)) errors.push(`${path}: correct translation appears among alternatives.`);
  for (const alternative of distractors) {
    if (/\b(?:lattè|setè|tèmpo|tristè)\b/i.test(alternative)) errors.push(`${path}: alternative contains an incorrect accent: ${alternative}`);
    if (!/[.!?…]$/.test(alternative)) errors.push(`${path}: alternative should end with punctuation: ${alternative}`);
  }
}

const uiProblems = [
  [/\bl eroe\b/i, "l eroe"],
  [/\bl energia\b/i, "l energia"],
  [/\bl audio\b/i, "l audio"],
  [/\bl idea\b/i, "l idea"],
  [/\bl avventura\b/i, "l avventura"],
  [/\bpiu\b/i, "piu"],
  [/Che allenamento trova l[’']eroe\?/i, "unnatural training-menu wording"],
  [/\b(?:lattè|setè|tèmpo|tristè)\b/i, "incorrect accent"]
];
for (const [pattern, label] of uiProblems) {
  if (pattern.test(interfaceText)) errors.push(`interface.yaml: ${label}.`);
  if (pattern.test(fallbackUiText)) errors.push(`apps/web/src/i18n.ts: ${label}.`);
}

if (errors.length) {
  console.error(`Italian lint failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`Italian lint passed: ${sentences.length} sentences and interface strings.`);

function readJsonl(file) {
  return readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}
