import { loadPack, seededRandom } from './helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const engine = await import('../../packages/learning-engine/src/index.ts');
const foundations = await import('../../packages/foundations-engine/src/index.ts');
const schema = await import('../../packages/content-schema/src/index.ts');
const { loadLocalPack } = await import('../../apps/web/src/contentMerge.ts');
const da = loadPack('da-foundations'), it = loadPack('hy-eastern-it');
Math.random = seededRandom(11);
const state = engine.createInitialLearnerState(da);
const neural = (text, id = 'n1') => ({ id, url: `/content-packs/da-foundations/audio/auto-neural/${id}.mp3`, source_type: 'automated', provider: 'Microsoft Azure', engine: 'Azure AI Speech', voice: 'da-DK-ChristelNeural', text, license: 'x', review_status: 'draft' });
const isMp3 = (a) => a?.source_type === 'automated' && a.url.endsWith('.mp3');
function withConstantRandom(value, fn) { const real = Math.random; Math.random = () => value; try { return fn(); } finally { Math.random = real; } }

test('F-11(i) math answer_audio is used only when its text matches the spoken answer', () => {
  const row = structuredClone(da.math_problems.find((p) => p.domain === 'addition'));
  const ask = (answer_audio) => foundations.getNextQuestion({ ...da, math_problems: [{ ...row, answer_audio }] }, state, 'da', 'pronunciation', { stage: 59 });
  const base = ask(undefined);
  assert.equal(base.audio[0].source_type, 'browser_tts');                       // unchanged fallback
  assert.ok(isMp3(ask([neural(base.target_audio_text)]).audio[0]));              // neural answer audio wins
  assert.equal(ask([neural('Noget andet.')]).audio[0].source_type, 'browser_tts'); // stale text is ignored
  const built = schema.buildLanguagePackFromSources({ packYaml: 'pack_id: t\nversion: 1.0.0\n', wordsJsonl: '', mathProblemsJsonl: JSON.stringify({ ...row, answer_audio: [neural('x')] }) });
  assert.equal(built.math_problems[0].answer_audio.length, 1);
  built.math_problems[0].answer_audio = [{}];
  assert.ok(schema.validateLanguagePack(built).errors.some((e) => e.includes('answer_audio')));
});

test('F-11(ii) all 28 missing_word/missing_letter tasks play their stored neural mp3', () => {
  const rows = da.reading_problems.filter((p) => ['missing_word', 'missing_letter'].includes(p.domain));
  assert.equal(rows.length, 28);
  for (const row of rows) {
    const pack = { ...da, items: [], reading_problems: [row] };
    const q = foundations.getNextQuestion(pack, state, 'da', 'comprehension', { stage: 59 });
    assert.equal(q.grammar.id, row.id);
    assert.ok(isMp3(q.audio[0]), row.id);
    assert.equal(q.audio[0].text, q.target_audio_text, row.id);
    const stale = { ...row, audio: row.audio.map((a) => (a.source_type === 'automated' ? { ...a, text: 'forkert' } : a)) };
    const q2 = foundations.getNextQuestion({ ...da, items: [], reading_problems: [stale] }, state, 'da', 'comprehension', { stage: 59 });
    assert.ok(q2.audio.every((a) => a.source_type === 'browser_tts'), row.id);
  }
});

test('F-11(iii) picture-word question resolves its stored instruction row', () => {
  const row = { id: 'instruction_listen_written_word', text: { da: 'Lyt til ordet. Hvilket skrevet ord hørte du?' }, audio: [neural('Lyt til ordet. Hvilket skrevet ord hørte du?', 'instruction_listen_written_word')], tags: ['tier:core'], review_status: 'approved' };
  const q = withConstantRandom(0.99, () => foundations.getNextQuestion({ ...da, reading_problems: [], foundations_instructions: [row] }, state, 'da', 'comprehension', { stage: 30 }));
  assert.equal(q.activity_type, 'image_match');
  assert.equal(q.instruction_audio[0].url, row.audio[0].url);
  assert.equal(q.instruction_audio_text, row.text.da);
});

test('F-05 stages past the last authored level keep the school grade and the foundations curriculum stops', () => {
  const last = Math.max(...da.levels.map((l) => l.number));
  for (const stage of [last, last + 1, last + 20]) {
    let reading = 0; for (let i = 0; i < 200; i++) if (foundations.getNextQuestion(da, { ...state, level: stage }, 'da', 'vocabulary', { stage }).kind === 'item') reading++;
    assert.ok(reading > 150, `stage ${stage}: only ${reading}/200 reading questions`);
  }
  assert.equal(engine.markEnemyDefeated({ ...state, level: last }, 'boss', 0, da).level, last);
  assert.equal(engine.markEnemyDefeated({ ...state, level: last + 3 }, 'boss2', 0, da).level, last + 3);
  assert.equal(engine.markEnemyDefeated({ ...state, level: last - 1 }, 'boss3', 0, da).level, last);
  const armenian = engine.createInitialLearnerState(it); armenian.level = 48;
  assert.equal(engine.markEnemyDefeated(armenian, 'x', 0, it).level, 49);       // open-ended packs unchanged
});

test('F-07 the legacy level map applies once, not again after a later revision bump', () => {
  const pack = structuredClone(da); pack.progression.curriculum_revision = 3; pack.progression.legacy_level_map_revision = 2;
  const make = (level, revision) => { const s = { ...engine.createInitialLearnerState(da), level, curriculum_version: 3 }; if (revision === undefined) delete s.course_revision; else s.course_revision = revision; return s; };
  assert.equal(engine.normalizeLearnerState(pack, make(5, 2)).level, 5);        // already new numbering
  assert.equal(engine.normalizeLearnerState(pack, make(5, 1)).level, 10);       // genuine legacy save
  assert.equal(engine.normalizeLearnerState(pack, make(5, undefined)).level, 10);
  for (const level of [14, 20, 28]) assert.equal(engine.normalizeLearnerState(da, make(level, undefined)).level, 29);
  assert.equal(engine.normalizeLearnerState(da, make(30, undefined)).level, 30);
  const counts = { ...make(5, 2), completed_training_sessions_by_level: { 5: { grammar: 2 } } };
  assert.equal(engine.normalizeLearnerState(pack, counts).completed_training_sessions_by_level[5].grammar, 2);
});

test('F-54 a snapshot older than the bundled pack never keeps stale bundled fields', () => {
  const bundled = structuredClone(da); bundled.version = '1.1.0';
  const stale = structuredClone(da); stale.version = '1.0.1'; stale.letters[0].tags = ['stage:99'];
  globalThis.window = { localStorage: { getItem: () => JSON.stringify(stale) } };
  try { assert.deepEqual(loadLocalPack(bundled).letters[0].tags, da.letters[0].tags); } finally { delete globalThis.window; }
});

test('F-55 vocabulary eligibility mirrors routing', () => {
  const sel = { stage: 25, reviewChance: 0.3 };
  const noItems = { ...da, items: [] };
  assert.ok(foundations.hasEligibleQuestion(noItems, 'vocabulary', sel));
  for (let i = 0; i < 40; i++) assert.equal(foundations.getNextQuestion(noItems, state, 'da', 'vocabulary', sel).kind, 'letter');
  const noLetters = { ...da, letters: [] };
  assert.ok(foundations.hasEligibleQuestion(noLetters, 'vocabulary', sel));
  for (let i = 0; i < 40; i++) assert.equal(foundations.getNextQuestion(noLetters, state, 'da', 'vocabulary', sel).kind, 'item');
  assert.equal(foundations.hasEligibleQuestion({ ...da, letters: [] }, 'vocabulary', { stage: 0 }), false);
  assert.equal(foundations.hasEligibleQuestion({ ...da, items: [], letters: [] }, 'vocabulary', sel), false);
});

test('F-52 ranking no longer reads the clock inside sort comparators', () => {
  const realNow = Date.now; let nows = 0; Date.now = () => { nows++; return realNow(); };
  try { for (const focus of ['vocabulary', 'comprehension', 'grammar']) engine.getNextQuestion(it, engine.createInitialLearnerState(it), 'it', focus, { stage: 20, reviewChance: 0.3 }); }
  finally { Date.now = realNow; }
  assert.ok(nows <= 20, `Date.now called ${nows} times`);
});
