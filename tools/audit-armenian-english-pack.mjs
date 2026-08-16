#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadModularPack } from './pack-utils.mjs';

const ROOT = resolve(process.cwd());
const PACK_DIR = join(ROOT, 'content-packs', 'hy-eastern-en');
const pack = loadModularPack(PACK_DIR);
const errors = [];
const normalize = (text) => String(text ?? '').trim().toLocaleLowerCase('en').replace(/[\s\p{P}\p{S}]+/gu, ' ');
const wordBag = (text) => normalize(text).split(/\s+/).filter(Boolean).sort().join('|');

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
  const answer = normalize(item.translations?.en ?? item.translation ?? item.concept);
  if (!answer) errors.push(`${item.id}: missing English translation`);
  for (const distractorId of item.hard_distractor_ids ?? []) {
    const other = itemById.get(distractorId);
    if (!other) continue;
    if (normalize(other.translations?.en ?? other.translation ?? other.concept) === answer) errors.push(`${item.id}: distractor ${distractorId} has the same visible English answer`);
  }
}

for (const row of pack.grammar_items ?? []) {
  const correct = normalize(row.translations?.en ?? row.translation);
  if (!correct) errors.push(`${row.id}: missing English sentence translation`);
  if (!String(row.prompt?.en ?? '').trim()) errors.push(`${row.id}: missing English prompt`);
  const translationDistractors = row.translation_distractors?.en ?? [];
  if (translationDistractors.length !== 3) errors.push(`${row.id}: expected exactly 3 English translation distractors`);
  const seen = new Set([correct]);
  for (const value of translationDistractors) {
    const key = normalize(value);
    if (!key || seen.has(key)) errors.push(`${row.id}: duplicate/correct English translation distractor ${JSON.stringify(value)}`);
    seen.add(key);
  }
  if ((row.distractors ?? []).length !== 1) errors.push(`${row.id}: English pack must use one semantic Armenian distractor so word-order variants are not treated as wrong`);
  const targetBag = wordBag(row.target_sentence);
  for (const value of row.distractors ?? []) {
    if (targetBag && wordBag(value) === targetBag) errors.push(`${row.id}: Armenian distractor only rearranges the correct sentence words`);
  }
}

for (const stage of Array.from({ length: 9 }, (_, index) => index)) {
  const count = (pack.grammar_items ?? []).filter((row) => row.tags?.includes(`stage:${stage}`)).length;
  if (count < 2) errors.push(`stage ${stage}: expected at least 2 curated sentence exercises, found ${count}`);
}

const italianMarkers = /\b(?:ciao|grazie|livello|scegli|frase|armeno|italiano|italiana|famiglia|dove|oggi|domani|per favore|non capisco|vado|voglio|ho fame|ho sete|questa|questo|mamma|papà|scuola|lettere|suono|parola|lezione|capitolo|negozio|monete|impostazioni|allenamento|arrivederci|fratello|sorella|madre|padre|noi|loro|voi|io|abbiamo|avete|hanno|compra|chiudi|ascolta|risposta|domanda|storia|quaderno|obiettivi|attenzione|ripasso|bambino|genitori|padronanza|precisione|difesa|forza|resistenza)\b/giu;
function findItalian(text) {
  return [...String(text ?? '').matchAll(italianMarkers)].map((match) => match[0]);
}
function textFiles(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...textFiles(path));
    else if (/\.(?:ya?ml|jsonl?|md|txt)$/i.test(name)) files.push(path);
  }
  return files;
}
for (const path of textFiles(PACK_DIR)) {
  const rel = path.replace(PACK_DIR + '/', '');
  const matches = findItalian(readFileSync(path, 'utf8'));
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

// Explicit multilingual tables are allowed only when an English branch is present.
const localizedComponentProofs = new Map([
  ['apps/web/src/components/HeroStatsPanel.tsx', 'A level raises the cap.'],
  ['apps/web/src/components/ParentProgressPanel.tsx', 'title: "Child progress"'],
  ['apps/web/src/components/StoryPanel.tsx', 'chapterReaderTitle: "Chapter book"'],
  ['apps/web/src/components/StudyBook.tsx', 'title: "Study book"']
]);
const hardcodedItalian = /["'`](?:[^"'`]|\\.)*\b(?:Scegli|Chiudi|Negozio|Impostazioni|Allenamento|Monete|Livello|Domanda|Risposta|Ricomincia|Continua|Ascolta|Compra|Storia|Quaderno|Obiettivi|Attenzione|Genitori|Bambino)\b/giu;
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

// The central UI dictionary must have an English value for every Italian key.
// Parse top-level object keys lexically so text such as "Elemento già presente:"
// cannot be mistaken for a TypeScript property named `presente`.
const i18nText = readFileSync(join(ROOT, 'apps', 'web', 'src', 'i18n.ts'), 'utf8');
function copyBranchKeys(source, branch) {
  const marker = `  ${branch}: {`;
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) return null;

  const keys = new Set();
  let i = markerIndex + marker.length;
  let depth = 1;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  while (i < source.length && depth > 0) {
    const ch = source[i];
    const next = source[i + 1] ?? '';

    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (lineComment) {
      if (ch === '\n') lineComment = false;
      i += 1;
      continue;
    }
    if (blockComment) {
      if (ch === '*' && next === '/') { blockComment = false; i += 2; }
      else i += 1;
      continue;
    }
    if (ch === '/' && next === '/') { lineComment = true; i += 2; continue; }
    if (ch === '/' && next === '*') { blockComment = true; i += 2; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; i += 1; continue; }
    if (ch === '{') { depth += 1; i += 1; continue; }
    if (ch === '}') { depth -= 1; i += 1; continue; }

    if (depth === 1 && /[A-Za-z_]/.test(ch)) {
      let end = i + 1;
      while (end < source.length && /[A-Za-z0-9_]/.test(source[end])) end += 1;
      const key = source.slice(i, end);
      let after = end;
      while (after < source.length && /\s/.test(source[after])) after += 1;
      if (source[after] === ':') keys.add(key);
      i = end;
      continue;
    }
    i += 1;
  }

  return depth === 0 ? keys : null;
}
const itKeys = copyBranchKeys(i18nText, 'it');
const enKeys = copyBranchKeys(i18nText, 'en');
if (!itKeys || !enKeys) {
  errors.push('apps/web/src/i18n.ts: could not locate or parse Italian and English COPY branches');
} else {
  for (const key of itKeys) if (!enKeys.has(key)) errors.push(`apps/web/src/i18n.ts: English COPY is missing key ${key}`);
}

if (errors.length) {
  console.error(`English Armenian audit failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`English Armenian audit passed: ${(pack.story?.chapters ?? []).length} chapters, ${items.length} vocabulary items, ${(pack.grammar_items ?? []).length} curated sentence exercises; English UI key coverage complete.`);
