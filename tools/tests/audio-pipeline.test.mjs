import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadPack } from './helpers.mjs';
const foundations = await import('../../packages/foundations-engine/src/index.ts');
const learning = await import('../../packages/learning-engine/src/index.ts');

const root = resolve(import.meta.dirname, '../..');
function fixture(t) {
  const cache = join(root, '.local-data');
  mkdirSync(cache, { recursive: true });
  const dir = mkdtempSync(join(cache, 'hero-audio-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const name of ['tools', 'packages/content-schema', 'content-packs/hy-eastern-it', 'content-packs/da-foundations']) {
    cpSync(join(root, name), join(dir, name), {
      recursive: true, filter: path => !path.includes('/audio/') && !path.endsWith('/audio') && !path.includes('/tests')
    });
  }
  writeFileSync(join(dir, 'mock-fetch.mjs'), `
    import { appendFileSync } from 'node:fs';
    let calls = 0;
    globalThis.fetch = async (url, options) => {
      calls++;
      if (process.env.FAIL_AFTER && calls > Number(process.env.FAIL_AFTER)) throw new Error('simulated interruption');
      appendFileSync('requests.jsonl', JSON.stringify(options.body) + '\\n');
      return new Response(new Uint8Array([73, 68, 51, 0]));
    };
  `);
  const run = (script, args = [], extra = {}, expected = 0) => {
    const result = spawnSync(process.execPath, ['--import', join(dir, 'mock-fetch.mjs'), join(dir, 'tools', script), ...args], {
      cwd: dir, encoding: 'utf8', env: {
        ...process.env, AZURE_SPEECH_KEY: 'offline-test', AZURE_SPEECH_REGION: 'offline-test',
        AZURE_SPEECH_ENDPOINT: 'https://invalid.test', AZURE_SPEECH_VOICE: '', AZURE_SPEECH_RATE: '', FAIL_AFTER: '', ...extra
      }
    });
    assert.equal(result.status, expected, result.stdout + result.stderr);
    return result.stdout;
  };
  const requests = () => existsSync(join(dir, 'requests.jsonl')) ? readFileSync(join(dir, 'requests.jsonl'), 'utf8').trim().split('\n').length : 0;
  return { dir, run, requests };
}
function rows(path) { return readFileSync(path, 'utf8').trim().split('\n').map(JSON.parse); }
function save(path, data) { writeFileSync(path, data.map(JSON.stringify).join('\n') + '\n'); }

for (const [pack, script, sampleSize, voice] of [
  ['hy-eastern-it', 'generate-automated-audio.mjs', 26, 'hy-AM-HaykNeural'],
  ['da-foundations', 'generate-danish-audio.mjs', 45, 'da-DK-JeppeNeural']
]) test(`${pack}: audio plans are free; interrupted generation resumes; changed text and settings regenerate`, t => {
  const { dir, run, requests } = fixture(t);
  const target = `content-packs/${pack}`;
  run(script, [target, '--sample', '--plan']);
  assert.equal(requests(), 0);
  run(script, [target, '--sample'], { FAIL_AFTER: '2' }, 1);
  assert.equal(requests(), 2);
  run(script, [target, '--sample']);
  assert.equal(requests(), sampleSize, 'completed requests are reused after interruption');
  if (pack === 'da-foundations') {
    const compilation = spawnSync('python3', [join(dir, 'tools/build-danish-school.py')], { cwd: dir, encoding: 'utf8' });
    assert.equal(compilation.status, 0, compilation.stderr);
    const check = spawnSync('python3', [join(dir, 'tools/build-danish-school.py'), '--check'], { cwd: dir, encoding: 'utf8' });
    assert.equal(check.status, 0, check.stderr);
  }
  const wordsPath = join(dir, target, 'dictionary/words.jsonl');
  const before = rows(wordsPath);
  run(script, [target, '--sample']);
  assert.equal(requests(), sampleSize);
  assert.deepEqual(rows(wordsPath), before, 'reusing audio does not relabel it');
  const words = rows(wordsPath);
  const first = words.find(word => word.tags.includes('tier:core'));
  first.target += ' test';
  save(wordsPath, words);
  run(script, [target, '--sample']);
  assert.equal(requests(), sampleSize + 1, 'same ID with changed text needs fresh audio');
  run(script, [target, '--sample'], { AZURE_SPEECH_VOICE: voice });
  assert.equal(requests(), sampleSize * 2 + 1);
  run(script, [target, '--sample'], { AZURE_SPEECH_VOICE: voice, AZURE_SPEECH_RATE: '-12%' });
  assert.equal(requests(), sampleSize * 3 + 1);
  rmSync(join(dir, target, 'audio/auto-neural', `${first.id}.mp3`));
  run(script, [target, '--sample'], { AZURE_SPEECH_VOICE: voice, AZURE_SPEECH_RATE: '-12%' });
  assert.equal(requests(), sampleSize * 3 + 2, 'missing file is regenerated even with matching metadata');
});

test('Armenian curriculum and English sync retain freshly generated sentence audio', t => {
  const { dir, run } = fixture(t);
  const path = join(dir, 'content-packs/hy-eastern-it/dictionary/sentences.jsonl');
  const data = rows(path);
  const definition = JSON.parse(readFileSync(join(dir, 'content-packs/hy-eastern-it/curriculum/levels-25-32.json'), 'utf8')).sentences[0];
  const managed = data.find(row => row.target_sentence === definition.target_sentence);
  assert.ok(managed);
  managed.audio = [{ id: `${managed.id}_azure_neural`, url: `/content-packs/hy-eastern-it/audio/auto-neural/${managed.id}.mp3`,
    source_type: 'automated', text: managed.target_sentence, voice: 'hy-AM-AnahitNeural', rate: '-8%', review_status: 'draft' }];
  save(path, data);
  const bytes = readFileSync(path, 'utf8');
  run('sync-armenian-curriculum.mjs');
  run('activate-armenian-material.mjs');
  run('sync-armenian-curriculum.mjs', ['--check']);
  assert.equal(readFileSync(path, 'utf8'), bytes);
  run('sync-armenian-english-pack.mjs');
  run('sync-armenian-english-pack.mjs', ['--check']);
  const translated = rows(join(dir, 'content-packs/hy-eastern-en/dictionary/sentences.jsonl')).find(row => row.id === managed.id);
  assert.equal(translated.audio[0].rate, '-8%');
  assert.equal(translated.audio[0].text, managed.target_sentence);
});

test('da-foundations: answer sentences match the engine and are shared by identical text', async () => {
  const { answerAudioId, mathAnswerAudioText } = await import('../danish-answer-text.mjs');
  const pack = loadPack('da-foundations');
  const state = learning.createInitialLearnerState(pack, 'Audio');
  const awareness = new Set(['counting', 'number_match', 'number_order', 'comparison', 'shape', 'pattern', 'sorting', 'measurement', 'place_value', 'data']);
  const texts = new Map();
  for (const problem of pack.math_problems) {
    const question = foundations.getNextQuestion({ ...pack, math_problems: [problem] }, state, 'da', awareness.has(problem.domain) ? 'grammar' : 'pronunciation', {});
    assert.equal(mathAnswerAudioText(problem), question.target_audio_text, problem.id);
    texts.set(answerAudioId(mathAnswerAudioText(problem)), mathAnswerAudioText(problem));
  }
  assert.equal(new Set(texts.values()).size, texts.size, 'answer ids are collision free');
  assert.ok(texts.size < pack.math_problems.length, 'identical sentences share one recording');
});

test('da-foundations: full generation shares answer recordings, survives compilation and is then free', t => {
  const { dir, run, requests } = fixture(t);
  const target = 'content-packs/da-foundations';
  const plan = run('generate-danish-audio.mjs', [target, '--plan']);
  const files = Number(/plan: (\d+) files/.exec(plan)[1]);
  const answers = Number(/(\d+) math answer sentences/.exec(plan)[1]);
  assert.ok(answers > 0 && files > answers);
  assert.equal(Number(/Azure requests: (\d+)/.exec(plan)[1]), files, 'fixture has no recordings, so everything is pending');
  run('generate-danish-audio.mjs', [target]);
  assert.equal(requests(), files, 'one request per distinct file, not per row');
  const math = rows(join(dir, target, 'curriculum/math-problems.jsonl'));
  assert.ok(math.every(row => row.answer_audio?.length === 1 && row.answer_audio[0].rate === '-6%' && row.answer_audio[0].voice === 'da-DK-ChristelNeural'));
  assert.equal(new Set(math.map(row => row.answer_audio[0].url)).size, answers);
  const python = args => spawnSync('python3', [join(dir, 'tools/build-danish-school.py'), ...args], { cwd: dir, encoding: 'utf8' });
  assert.equal(python([]).status, 0);
  const check = python(['--check']); assert.equal(check.status, 0, check.stderr);
  assert.equal(rows(join(dir, target, 'curriculum/math-problems.jsonl')).filter(row => row.answer_audio?.length).length, math.length, 'compilation keeps answer recordings');
  run('generate-danish-audio.mjs', [target]);
  assert.equal(requests(), files, 'repeat run reuses everything');
});

test('da-foundations: --adopt-existing stamps the rate only on matching recordings with a file, offline', t => {
  const { dir, run, requests } = fixture(t);
  const target = 'content-packs/da-foundations';
  const lettersPath = join(dir, target, 'dictionary/letters.jsonl');
  // The fixture copies the current pack, which may already carry rates (adoption was run on the real pack):
  // start from the pre-adoption state explicitly.
  const stripped = rows(lettersPath).map(row => ({ ...row, audio: row.audio.map(({ rate, ...rest }) => rest) }));
  writeFileSync(lettersPath, stripped.map(row => JSON.stringify(row)).join('\n') + '\n');
  const [first, second] = rows(lettersPath);
  assert.equal(first.audio.find(a => a.source_type === 'automated').rate, undefined);
  mkdirSync(join(dir, target, 'audio/auto-neural'), { recursive: true });
  writeFileSync(join(dir, target, 'audio/auto-neural', `${first.id}.mp3`), 'ID3');
  run('generate-danish-audio.mjs', [target, '--adopt-existing']);
  const [adopted, untouched] = rows(lettersPath);
  const keys = Object.keys(adopted.audio[0]);
  assert.equal(adopted.audio[0].rate, '-6%');
  assert.equal(keys[keys.indexOf('voice') + 1], 'rate');
  assert.deepEqual(untouched, second, 'no file, no adoption');
  assert.equal(requests(), 0);
  assert.match(run('generate-danish-audio.mjs', [target, '--plan']), /reuse: 1;/);
});

test('da-foundations: coverage check is warn-only by default and strict on request', t => {
  const { dir } = fixture(t);
  const script = join(root, 'tools/check-danish-audio-coverage.mjs');
  const pack = join(dir, 'content-packs/da-foundations');
  const out = join(dir, 'coverage');
  const run = (...extra) => spawnSync(process.execPath, [script, pack, `--out=${out}`, ...extra], { cwd: root, encoding: 'utf8' });
  const lenient = run();
  assert.equal(lenient.status, 0, lenient.stdout + lenient.stderr);
  assert.match(lenient.stdout, /WARN:/);
  const summary = JSON.parse(readFileSync(join(out, 'summary.json'), 'utf8'));
  assert.ok(summary.by_field_and_class.numeral_option, 'numeral option labels are classified, not hidden');
  assert.ok(readFileSync(join(out, 'wrong_answer_audio.csv'), 'utf8').includes('math:addition'));
  assert.equal(run('--strict').status, 1, 'no recordings in the fixture');
});
