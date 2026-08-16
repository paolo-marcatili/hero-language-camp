#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadModularPack } from './pack-utils.mjs';

const ROOT = resolve(process.cwd());
const PACK_DIR = join(ROOT, 'content-packs', 'hy-eastern-en');
const pack = loadModularPack(PACK_DIR);
const errors = [];
const normalize = (text) => String(text ?? '').trim().toLocaleLowerCase('en').replace(/[\s\p{P}\p{S}]+/gu, ' ');

if (pack.pack_id !== 'hy-eastern-en') errors.push(`unexpected pack_id: ${pack.pack_id}`);
if (pack.base_language?.code !== 'en') errors.push(`base_language must be en, got ${pack.base_language?.code}`);

const chapterIds = new Set((pack.story?.chapters ?? []).map((chapter) => chapter.id));
for (const level of pack.levels ?? []) {
  if (!level.chapter_id || !chapterIds.has(level.chapter_id)) errors.push(`level ${level.number} references missing chapter ${level.chapter_id}`);
}
if ((pack.story?.chapters ?? []).length !== (pack.levels ?? []).length) errors.push('story chapter count must match level count');

const items = pack.items ?? [];
const itemById = new Map(items.map((item) => [item.id, item]));
for (const item of items) {
  const answer = normalize(item.translations?.en ?? item.translation);
  if (!answer) errors.push(`${item.id}: missing English translation`);
  for (const distractorId of item.hard_distractor_ids ?? []) {
    const other = itemById.get(distractorId);
    if (!other) continue;
    if (normalize(other.translations?.en ?? other.translation) === answer) errors.push(`${item.id}: distractor ${distractorId} has the same visible English answer`);
  }
}

for (const row of pack.grammar_items ?? []) {
  const correct = normalize(row.translations?.en ?? row.translation);
  const translationDistractors = row.translation_distractors?.en ?? [];
  if (translationDistractors.length !== 3) errors.push(`${row.id}: expected exactly 3 English translation distractors`);
  const seen = new Set([correct]);
  for (const value of translationDistractors) {
    const key = normalize(value);
    if (!key || seen.has(key)) errors.push(`${row.id}: duplicate/correct English translation distractor ${JSON.stringify(value)}`);
    seen.add(key);
  }
  if ((row.distractors ?? []).length !== 1) errors.push(`${row.id}: English pack must use one semantic Armenian distractor so word-order variants are not treated as wrong`);
}

for (const stage of Array.from({ length: 9 }, (_, index) => index)) {
  const count = (pack.grammar_items ?? []).filter((row) => row.tags?.includes(`stage:${stage}`)).length;
  if (count < 2) errors.push(`stage ${stage}: expected at least 2 curated sentence exercises, found ${count}`);
}

const italianMarkers = /\b(?:ciao|grazie|livello|scegli|frase|armeno|italiano|italiana|famiglia|dove|oggi|domani|per favore|non capisco|vado|voglio|ho fame|ho sete|questa|questo|mamma|papà|scuola|lettere|suono|parola|lezione|capitolo|negozio|monete|impostazioni|allenamento|arrivederci|fratello|sorella|madre|padre|noi|loro|voi|io|tu hai|abbiamo|avete|hanno)\b/giu;
function findItalian(text) {
  return [...String(text ?? '').matchAll(italianMarkers)].map((match) => match[0]);
}
for (const item of items) {
  const learnerFacing = [item.concept, item.translation, item.translations?.en, ...(item.meanings ?? [])].filter(Boolean).join('\n');
  const matches = findItalian(learnerFacing);
  if (matches.length) errors.push(`${item.id}: possible Italian learner-facing vocabulary: ${[...new Set(matches)].join(', ')}`);
}
const packTextFiles = ['pack.yaml','interface.yaml','levels.yaml','story.yaml','dictionary/letters.jsonl','dictionary/sentences.jsonl'];
for (const rel of packTextFiles) {
  const text = readFileSync(join(PACK_DIR, rel), 'utf8');
  const matches = findItalian(text);
  if (matches.length) errors.push(`${rel}: possible Italian learner-facing residue: ${[...new Set(matches)].slice(0, 12).join(', ')}`);
}


function sourceFiles(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...sourceFiles(path));
    else if (/\.(?:ts|tsx)$/.test(name)) files.push(path);
  }
  return files;
}
const localizedComponentProofs = new Map([
  ['apps/web/src/components/HeroStatsPanel.tsx', 'A level raises the cap.'],
  ['apps/web/src/components/ParentProgressPanel.tsx', 'title: "Child progress"'],
  ['apps/web/src/components/StoryPanel.tsx', 'story: "Story"'],
  ['apps/web/src/components/StudyBook.tsx', 'title: "Study book"']
]);
const hardcodedItalian = /["'`](?:[^"'`]|\\.)*\b(?:Scegli|Chiudi|Negozio|Impostazioni|Allenamento|Monete|Livello|Domanda|Risposta|Ricomincia|Continua|Ascolta|Compra|Storia)\b/giu;
for (const path of sourceFiles(join(ROOT, 'apps', 'web', 'src'))) {
  const rel = path.replace(ROOT + '/', '');
  if (path.endsWith('/i18n.ts') || path.endsWith('/PackChooser.tsx')) continue;
  const text = readFileSync(path, 'utf8');
  const localizedProof = localizedComponentProofs.get(rel);
  if (localizedProof) {
    if (!text.includes(localizedProof)) errors.push(`${rel}: localized Italian copy exists but the expected English branch/proof is missing`);
    continue;
  }
  const hits = [...text.matchAll(hardcodedItalian)].map((match) => match[0]);
  if (hits.length) errors.push(`${rel}: possible hardcoded Italian UI copy outside an explicit locale table: ${hits.slice(0, 5).join(' | ')}`);
}


if (errors.length) {
  console.error(`English Armenian audit failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`English Armenian audit passed: ${(pack.story?.chapters ?? []).length} chapters, ${items.length} vocabulary items, ${(pack.grammar_items ?? []).length} curated sentence exercises.`);
