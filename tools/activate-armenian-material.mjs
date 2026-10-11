#!/usr/bin/env node
// Explicit, reviewable routing decisions for material imported before curriculum v2.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..', 'content-packs/hy-eastern-it');
const plan = JSON.parse(readFileSync(`${root}/curriculum/activation.json`, 'utf8'));
const check = process.argv.includes('--check');
for (const kind of ['words', 'sentences']) {
  const file = `${root}/dictionary/${kind}.jsonl`;
  const before = readFileSync(file, 'utf8');
  const decisions = new Map(plan[kind].map(entry => [entry.id, entry]));
  const rows = before.trim().split(/\r?\n/).map(JSON.parse);
  const seen = new Set();
  for (const row of rows) {
    const decision = decisions.get(row.id);
    if (!decision) continue;
    seen.add(row.id);
    row.tags = [...new Set([...row.tags.filter(tag => !/^stage:|^tier:/.test(tag)), 'tier:core', `stage:${decision.stage}`])];
    row.translations = { ...row.translations, en: decision.en };
    row.translation_review_status = { ...row.translation_review_status, en: 'reviewed' };
    if (kind === 'sentences') {
      row.order_exercise = false;
      row.translation_distractors = { ...row.translation_distractors, en: decision.distractors_en };
      // Preserve the recording and ID, but never use shuffled copies as wrong sentences.
      row.distractors = decision.distractors_hy;
    }
  }
  for (const id of decisions.keys()) if (!seen.has(id)) throw new Error(`Unknown activation ID: ${id}`);
  const after = rows.map(JSON.stringify).join('\n') + '\n';
  if (check && before !== after) throw new Error(`Activation is out of sync: ${kind}`);
  if (!check) writeFileSync(file, after);
}
console.log(`${check ? 'Checked' : 'Applied'} explicit Armenian routing: ${plan.words.length} words, ${plan.sentences.length} sentences; ${plan.excluded.length} entries remain in the documented review queue.`);
