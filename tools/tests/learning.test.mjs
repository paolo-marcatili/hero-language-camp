import { loadPack, seededRandom } from './helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const engine = await import('../../packages/learning-engine/src/index.ts');
const foundations = await import('../../packages/foundations-engine/src/index.ts');
const { normalizeAnswer } = await import('../../packages/learning-engine/src/answers.ts');
const { placeLearner, exportProgress, importProgress } = await import('../../packages/learning-engine/src/placement.ts');
const da = loadPack('da-foundations'), it = loadPack('hy-eastern-it'), en = loadPack('hy-eastern-en');
Math.random = seededRandom();

test('the browser schema accepts every pack and all excluded imports are accounted for', async () => {
  const {validateLanguagePack}=await import('../../packages/content-schema/src/index.ts');
  for(const pack of [da,it,en]) assert.deepEqual(validateLanguagePack(pack).errors,[]);
  const plan=JSON.parse(readFileSync(new URL('../../content-packs/hy-eastern-it/curriculum/activation.json',import.meta.url),'utf8'));
  const excluded=[...it.items,...it.grammar_items].filter(row=>row.tags.includes('tier:extension')).map(row=>row.id).sort();
  assert.deepEqual(plan.excluded.map(row=>row.id).sort(),excluded);
  for(const pack of [it,en]) for(const g of pack.grammar_items.filter(g=>g.tags.includes('tier:core'))) {
    const bag=s=>String(s).toLowerCase().match(/[\p{L}\p{N}]+/gu)?.sort().join(' ');
    const correct=g.translations[pack.source_language];
    for(const wrong of g.translation_distractors[pack.source_language]) assert.notEqual(bag(wrong),bag(correct),g.id);
    for(const q of g.comprehension_questions??[]) {
      const choices=[q.answer[pack.source_language],...q.distractors[pack.source_language]];
      assert.ok(choices.every(Boolean)); assert.equal(new Set(choices.map(normalizeAnswer)).size,choices.length);
    }
  }
});

test('old Danish saves migrate once and retain item memory, possessions and history', () => {
  const state = engine.createInitialLearnerState(da, 'Freja');
  delete state.course_revision;
  state.level = 13; state.coins = 73; state.inventory = ['wooden_shield']; state.xp = 412;
  state.completed_training_sessions_by_level = { 13: { comprehension: 5, grammar: 3 } };
  state.completed_labyrinth_sessions_by_level = { 13: 2 };
  const id = da.reading_problems[0].id;
  const mathId = da.math_problems[0].id;
  state.mastery_by_grammar[id].seen_count = 7; state.mastery_by_grammar[id].mastery = 0.7;
  state.mastery_by_grammar[mathId].seen_count = 4;
  const restored = engine.normalizeLearnerState(da, JSON.parse(JSON.stringify(state)));
  assert.equal(restored.level, 29); assert.equal(restored.coins, 73); assert.equal(restored.xp, 412);
  assert.deepEqual(restored.inventory, state.inventory);
  assert.equal(restored.mastery_by_grammar[id].seen_count, 7);
  assert.equal(restored.mastery_by_grammar[mathId].seen_count, 4);
  assert.equal(restored.completed_training_sessions_by_level[29].grammar, 3);
  assert.equal(restored.completed_labyrinth_sessions_by_level[29], 2);
  assert.deepEqual(engine.normalizeLearnerState(da, restored), restored);
});

test('placement and backup retain progress without inventing mastery', () => {
  const original = engine.createInitialLearnerState(it, 'Aram'); original.coins = 91;
  original.inventory = ['wooden_shield']; original.defeated_enemies = ['star_dragon_level_40'];
  const next = placeLearner(it, original, 40);
  assert.equal(next.level, 40); assert.equal(next.coins, original.coins);
  assert.deepEqual(next.mastery_by_item, original.mastery_by_item);
  assert.deepEqual(next.completed_training_sessions, original.completed_training_sessions);
  assert.ok(!next.defeated_enemies.includes('star_dragon_level_40'));
  assert.equal(importProgress(en, exportProgress(it, next)).level, 40);
  assert.throws(() => importProgress(da, exportProgress(it, next)));
  assert.throws(() => importProgress(it, { format:'hero-language-camp-progress', version:1, pack_id:it.pack_id, state:{level:'40'} }));
  assert.throws(() => placeLearner(it, original, 999));
  const lower = placeLearner(it, next, 3);
  assert.deepEqual(engine.normalizeLearnerState(it, lower).hero_stats, lower.hero_stats);
});

test('accepted sentence variants allow typography but never arbitrary permutations', () => {
  const q = { correct_option_id:'Ես ջուր եմ ուզում։', accepted_option_ids:['Ես ուզում եմ ջուր։'] };
  assert.ok(engine.isCorrectAnswer(q, '  ես   ուզում եմ ջուր  '));
  assert.ok(engine.isCorrectAnswer(q, 'Ես ջուր եմ ուզում։'));
  assert.ok(!engine.isCorrectAnswer(q, 'Ջուր եմ ես ուզում'));
  const full = { ...engine.getNextQuestion(it, engine.createInitialLearnerState(it), 'it', 'grammar', {stage:3}), ...q };
  assert.ok(engine.answerQuestion(full, q.accepted_option_ids[0], engine.createInitialLearnerState(it)).correct);
});

test('an authored order activity accepts an alternative assembled from its chips', () => {
  const grammar={...it.grammar_items[0],target_sentence:'Ես ջուր եմ ուզում։',order_exercise:true,
    accepted_sentences:['Ես ուզում եմ ջուր։'], comprehension:undefined, comprehension_questions:undefined};
  const previous=Math.random; Math.random=()=>0.9;
  try {
    const q=engine.getNextQuestion({...it,grammar_items:[grammar]},engine.createInitialLearnerState(it),'it','grammar',{stage:3});
    assert.equal(q.variant,'sentence_tap_order');
    for (const word of ['Ես','ուզում','եմ','ջուր']) assert.ok(q.options.some(o=>o.label===word));
    assert.ok(engine.isCorrectAnswer(q,'Ես ուզում եմ ջուր'));
  } finally {Math.random=previous;}
});

function validateQuestion(q, where) {
  assert.ok(q.prompt && q.correct_answer_label, where);
  if (q.variant === 'sentence_tap_order') return;
  assert.ok(q.options.length >= 2, `${where}: needs meaningful alternatives`);
  assert.equal(new Set(q.options.map(o => o.id)).size, q.options.length, `${where}: repeated IDs`);
  assert.equal(new Set(q.options.map(o => normalizeAnswer(o.label))).size, q.options.length, `${where}: repeated answers`);
  assert.ok(q.options.some(o => engine.isCorrectAnswer(q,o.id)), `${where}: missing correct choice`);
}

test('every authored level and learning area generates usable questions', () => {
  for (const pack of [da,it,en]) {
    const runtime = pack.subject === 'foundations' ? foundations : engine;
    const state = engine.createInitialLearnerState(pack);
    for (const level of pack.levels) for (const focus of ['vocabulary','comprehension','grammar','pronunciation']) {
      const selection = { stage:level.number, reviewChance:0.2 };
      assert.ok(runtime.hasEligibleQuestion(pack,focus,selection), `${pack.pack_id}:${level.number}:${focus}`);
      for (let repeat=0; repeat<12; repeat++) {
        const q = runtime.getNextQuestion(pack, {...state,level:level.number},pack.source_language,focus,selection);
        validateQuestion(q, `${pack.pack_id}:${level.number}:${focus}:${q.id}`);
        if (pack===da && level.number<20 && focus==='comprehension') {
          assert.ok(!['sentence_tap_order','missing_word'].includes(q.variant));
          assert.ok(q.auto_play_target_audio, 'pre-reader tasks speak the source');
          assert.equal(q.option_audio_lang,'da-DK', 'pre-reader can hear answer choices');
        }
        if (pack!==da && q.kind==='grammar') assert.notEqual(q.variant,'sentence_tap_order', 'unreviewed word order must not be graded');
      }
    }
  }
});

test('Armenian passages and activated sentences are reachable in both source languages', () => {
  for (const pack of [it,en]) {
    const state = engine.createInitialLearnerState(pack);
    const active = pack.grammar_items.filter(g => g.tags.includes('tier:core'));
    assert.ok(active.length >= 500);
    assert.equal(active.filter(g => g.comprehension_questions?.length).length,24);
    for (const g of active) {
      const isolated = {...pack, grammar_items:[g]};
      const q = engine.getNextQuestion(isolated,state,pack.source_language,'grammar',{stage:48});
      assert.equal(q.grammar.id,g.id);
      validateQuestion(q,g.id);
      if (g.comprehension_questions?.length) assert.ok(g.comprehension_questions.some(c => c.question[pack.source_language]===q.prompt_hint));
    }
  }
});

test('Danish month map has 20 units per grade and oral year 0', () => {
  assert.equal(da.levels.length,60);
  for (const grade of [0,1,2]) {
    const levels=da.levels.filter(l => l.school_grade===grade);
    assert.equal(levels.length,20);
    for (let month=1;month<=10;month++) assert.equal(levels.filter(l=>l.teaching_month===month).length,2);
  }
  for (const l of da.levels.slice(0,20)) assert.equal(l.reading_mode,'oral');
  for (const domain of ['multiplication','division','place_value','data']) assert.ok(da.math_problems.some(p=>p.domain===domain),domain);
});

test('older monster themes do not hide the current Armenian unit', () => {
  const state=engine.createInitialLearnerState(it);
  for (const focus of ['grammar','vocabulary']) {
    for (let i=0;i<5;i++) {
      const q=engine.getNextQuestion(it,state,'it',focus,{stage:48,tags:['topic:greetings'],reviewChance:0,includeLetters:false});
      assert.ok((q.grammar??q.item).tags.includes('stage:48'));
    }
  }
});

test('local content snapshots receive new curriculum while keeping contributed audio', async () => {
  const { loadLocalPack } = await import('../../apps/web/src/contentMerge.ts');
  const old = structuredClone(da); old.version='0.19.0'; old.levels=old.levels.slice(0,14); old.progression=undefined;
  old.reading_problems=[]; old.math_problems=[];
  old.items[0].audio.push({id:'parent-recording',url:'data:audio/wav;base64,AAAA',license:'CC-BY-4.0',source_type:'human',review_status:'approved'});
  globalThis.window={localStorage:{getItem:()=>JSON.stringify(old)}};
  try {
    const updated=loadLocalPack(da);
    assert.equal(updated.levels.length,60); assert.equal(updated.progression.curriculum_revision,2);
    assert.equal(updated.reading_problems.length,da.reading_problems.length);
    assert.ok(updated.items[0].audio.some(a=>a.id==='parent-recording'));
  } finally { delete globalThis.window; }
});
