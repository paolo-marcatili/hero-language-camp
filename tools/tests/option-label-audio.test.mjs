import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadPack, root } from './helpers.mjs';
const foundations = await import('../../packages/foundations-engine/src/index.ts');
const learning = await import('../../packages/learning-engine/src/index.ts');

const neural = id => [{ id, url: `/content-packs/x/audio/auto-neural/${id}.mp3`, source_type: 'automated', text: id }];
const speech = [{ id: 'tts', url: 'browser-tts:da-DK', source_type: 'browser_tts', text: 'x' }];
const fake = (extra = {}) => ({ letters: [], items: [], foundations_instructions: [], ...extra });

test('optionAudioKey ignores emoji, arrows, punctuation, case and spacing', () => {
  const key = foundations.optionAudioKey;
  assert.equal(key('🏠 hus'), 'hus');
  assert.equal(key('Flere ➡️'), 'flere');
  assert.equal(key('⬅️ Flere'), 'flere');
  assert.equal(key('⚖️ Lige   mange'), 'lige mange');
  assert.equal(key('Hvad?'), 'hvad');
  assert.equal(key('•'), '');
  assert.equal(key('Ø'), 'ø');
});

test('findOptionAudio: letter names beat words, words and instruction phrases match, browser speech never counts', () => {
  const pack = fake({
    letters: [{ id: 'letter_i', character: 'i', lowercase: 'i', audio: neural('letter_i') }],
    items: [{ id: 'word_i', target: 'i', audio: neural('word_i') }, { id: 'word_hus', target: 'hus', audio: neural('word_hus') }, { id: 'word_sol', target: 'sol', audio: speech }],
    foundations_instructions: [{ id: 'option_label_x', text: { da: 'Det røde' }, audio: neural('option_label_x') }, { id: 'option_label_y', text: { da: 'Ida' }, audio: speech }]
  });
  assert.equal(foundations.findOptionAudio(pack, 'I')[0].id, 'letter_i');
  assert.equal(foundations.findOptionAudio(pack, '🏠 hus')[0].id, 'word_hus');
  assert.equal(foundations.findOptionAudio(pack, 'det røde')[0].id, 'option_label_x');
  assert.equal(foundations.findOptionAudio(pack, '☀️ sol'), undefined);
  assert.equal(foundations.findOptionAudio(pack, 'Ida'), undefined);
  assert.equal(foundations.findOptionAudio(pack, '5'), undefined);
});

test('first/last-letter questions attach the letter-name clip to every letter button and change nothing else', () => {
  const pack = loadPack('da-foundations');
  const state = learning.createInitialLearnerState(pack, 'Test');
  const problems = pack.reading_problems.filter(problem => problem.domain === 'initial_sound' || problem.domain === 'final_sound');
  assert.ok(problems.length > 20);
  let checked = 0;
  for (const problem of problems) {
    const stage = Number(problem.tags.find(tag => tag.startsWith('stage:')).slice(6));
    if (pack.levels?.find(level => level.number === stage)?.reading_mode !== 'oral') continue;
    const question = foundations.getNextQuestion({ ...pack, items: [], reading_problems: [problem] }, state, 'da', 'comprehension', { stage });
    assert.ok(question.option_audio_lang, problem.id);
    checked += 1;
    for (const option of question.options) {
      const letter = pack.letters.find(entry => entry.lowercase === option.label.toLowerCase());
      assert.ok(letter, `${problem.id}: no letter for ${option.label}`);
      assert.deepEqual(option.audio.map(ref => ref.id), letter.audio.filter(ref => !ref.url.startsWith('browser-tts:')).map(ref => ref.id), `${problem.id}/${option.label}`);
    }
  }
  assert.ok(checked >= 20, `only ${checked} oral questions were checked`);
});

test('numeral labels keep browser speech (no recording is attached)', () => {
  const pack = loadPack('da-foundations');
  for (const label of ['0', '7', '20', '100', '1000']) assert.equal(foundations.findOptionAudio(pack, label), undefined, label);
});

test('school-plan option_labels and the generated pack stay in step', () => {
  const plan = JSON.parse(readFileSync(resolve(root, 'content-packs/da-foundations/curriculum/school-plan.json'), 'utf8'));
  const pack = loadPack('da-foundations');
  const rows = new Map(pack.foundations_instructions.map(row => [row.id, row]));
  assert.ok(plan.option_labels.length > 0);
  assert.equal(new Set(plan.option_labels.map(foundations.optionAudioKey)).size, plan.option_labels.length, 'option_labels must be distinct by spoken text');
  for (const phrase of plan.option_labels) {
    const id = 'option_label_' + createHash('sha1').update(phrase.toLowerCase()).digest('hex').slice(0, 12);
    assert.equal(rows.get(id)?.text.da, phrase, `missing instruction row for ${phrase}`);
    assert.ok(rows.get(id).tags.includes('tier:core'), `${id} must be tier:core so the generator voices it`);
  }
});
