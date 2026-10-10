import { loadPack } from './helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const schema = await import('../../packages/content-schema/src/index.ts');
test('F-40 strict parser reports unparsable lines with file and line', () => {
  assert.throws(() => schema.parseYaml('pack_id: x\nbad key: z\ntitle: after\n', { strict: true, source: 'pack.yaml' }), /pack\.yaml at line 2/);
  assert.throws(() => schema.parseYaml('items:\n  - a: 1\n    weird.key: 2\n  - a: 4\n', { strict: true, source: 'tasks.yaml' }), /tasks\.yaml at line 3/);
  assert.throws(() => schema.parseYaml('a:\n  b: 1\n   c: 2\nd: 3\n', { strict: true }), /line 3/);
  // lenient mode keeps its historical behaviour
  assert.deepEqual(schema.parseYaml('a: 1\nbad key: z\nb: 2\n'), { a: 1 });
});
test('F-40 numeric-looking version stays a string', () => {
  assert.equal(schema.parseYaml('version: 1.0\n').version, '1.0');
  assert.equal(schema.parseYaml('version: 2\n').version, '2');
  assert.equal(schema.parseYaml('version: 1.0.0\n').version, '1.0.0');
  assert.equal(schema.parseYaml('version: "1.0.0"\n').version, '1.0.0');
  assert.equal(schema.parseYaml('stat_cap: 5\n').stat_cap, 5);
  assert.equal(schema.buildLanguagePackFromSources({ packYaml: 'pack_id: x\nversion: 1.0\n', wordsJsonl: '' }).version, '1.0');
  assert.throws(() => schema.buildLanguagePackFromSources({ packYaml: 'pack_id: x\nbad key: 1\nversion: 1.0.0\n', wordsJsonl: '' }), /pack\.yaml at line 2/);
});
test('F-40 all three bundled packs still load in strict mode', () => {
  for (const id of ['da-foundations','hy-eastern-it','hy-eastern-en']) assert.equal(schema.validateLanguagePack(loadPack(id)).errors.length, 0, id);
});
