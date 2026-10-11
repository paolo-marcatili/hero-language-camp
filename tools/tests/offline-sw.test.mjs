import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';

const generator = resolve(import.meta.dirname, '..', 'generate-offline-service-worker.mjs');
const ORIGIN = 'https://example.test';
const BASE = '/app/';

function writeDist(dir, files) {
  rmSync(dir, { recursive: true, force: true });
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), content);
  }
}
function generate(dir) {
  const result = spawnSync(process.execPath, [generator, dir, 'test-'], { encoding: 'utf8', env: { ...process.env, GITHUB_PAGES_BASE: BASE } });
  assert.equal(result.status, 0, result.stderr);
  return readFileSync(join(dir, 'sw.js'), 'utf8');
}
const constant = (source, name) => JSON.parse(new RegExp(`^const ${name} = (.*);$`, 'm').exec(source)[1]);
function release({ js = 'js-1', audio = {} } = {}) {
  const files = {
    'index.html': `<script src="${BASE}assets/index-${js}.js"></script>`,
    'manifest.webmanifest': '{}',
    [`assets/index-${js}.js`]: `app ${js}`,
    'assets/phaser-stable.js': 'phaser'.repeat(100),
    'assets/pixel/hero.png': 'png-bytes'.repeat(50)
  };
  for (let index = 0; index < 5; index += 1) files[`content-packs/p/audio/auto-neural/w${index}.mp3`] = audio[index] ?? `audio-${index}`;
  return files;
}

// Minimal in-memory CacheStorage + fetch so the generated worker runs in Node.
function createBrowser(store, serverFiles) {
  const fetched = [];
  const posted = [];
  const handlers = {};
  const key = (request) => new URL(typeof request === 'string' ? request : request.url, ORIGIN).pathname;
  const makeCache = (entries) => ({
    async match(request) { const hit = entries.get(key(request)); return hit ? hit.clone() : undefined; },
    async put(request, response) { entries.set(key(request), response); },
    async keys() { return [...entries.keys()].map((pathname) => ({ url: ORIGIN + pathname })); }
  });
  const caches = {
    async open(name) { if (!store.has(name)) store.set(name, new Map()); return makeCache(store.get(name)); },
    async keys() { return [...store.keys()]; },
    async delete(name) { return store.delete(name); }
  };
  const self = {
    location: { origin: ORIGIN },
    clients: { matchAll: async () => [{ postMessage: (message) => posted.push(message) }], claim: async () => {} },
    skipWaiting() {},
    addEventListener: (type, handler) => { handlers[type] = handler; }
  };
  const fetchStub = async (url) => {
    const pathname = key(url);
    fetched.push(pathname);
    if (!serverFiles.has(pathname)) return new Response('missing', { status: 404 });
    return new Response(serverFiles.get(pathname), { status: 200, headers: { 'content-type': 'application/octet-stream' } });
  };
  return { self, caches, fetchStub, fetched, posted, handlers };
}
async function runWorker(source, store, serverFiles) {
  const browser = createBrowser(store, serverFiles);
  const context = vm.createContext({
    self: browser.self, caches: browser.caches, fetch: browser.fetchStub, crypto: globalThis.crypto,
    Response, Headers, Request, URL, Date, Promise, Uint8Array, Set, Map, Array, Number, String, JSON, Error, Math, RegExp,
    setTimeout, console
  });
  vm.runInContext(source, context);
  const pending = [];
  const event = (data) => ({ data, waitUntil: (promise) => pending.push(promise) });
  browser.handlers.install(event());
  await Promise.all(pending.splice(0));
  browser.handlers.message(event({ type: 'START_OFFLINE_DOWNLOAD' }));
  await Promise.all(pending.splice(0));
  return browser;
}
const serverOf = (files) => new Map(Object.entries(files).map(([name, content]) => [BASE + name, Buffer.from(content)]));

test('audio cache name only changes when audio changes', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'hlc-sw-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeDist(dir, release({ js: 'a' })); const first = generate(dir);
  writeDist(dir, release({ js: 'b' })); const second = generate(dir);
  writeDist(dir, release({ js: 'b', audio: { 2: 'new voice' } })); const third = generate(dir);
  assert.notEqual(constant(first, 'VERSION'), constant(second, 'VERSION'));
  assert.equal(constant(first, 'AUDIO_VERSION'), constant(second, 'AUDIO_VERSION'));
  assert.notEqual(constant(second, 'AUDIO_VERSION'), constant(third, 'AUDIO_VERSION'));
  assert.equal(constant(second, 'ESSENTIAL_URLS').length, constant(second, 'ESSENTIAL_HASHES').length);
  assert.equal(constant(second, 'AUDIO_URLS').length, constant(second, 'AUDIO_HASHES').length);
  // Deterministic: regenerating the same dist yields identical identifiers.
  assert.equal(constant(generate(dir), 'VERSION'), constant(third, 'VERSION'));
});

test('a new release only downloads files whose bytes changed', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'hlc-sw-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const store = new Map(); // survives across releases like Cache Storage does
  const releases = [release({ js: 'a' }), release({ js: 'b' }), release({ js: 'b', audio: { 2: 'new voice' } })];
  const fetchedByRelease = [];
  for (const files of releases) {
    writeDist(dir, files);
    const source = generate(dir);
    const browser = await runWorker(source, store, serverOf(files));
    fetchedByRelease.push(browser.fetched);
  }
  const audio = (list) => list.filter((url) => url.includes('/audio/'));
  assert.equal(audio(fetchedByRelease[0]).length, 5, 'first install downloads all audio');
  assert.equal(audio(fetchedByRelease[1]).length, 0, 'unchanged audio is not downloaded again');
  assert.deepEqual(audio(fetchedByRelease[2]), [`${BASE}content-packs/p/audio/auto-neural/w2.mp3`], 'only the changed audio file is downloaded');
  assert.ok(!fetchedByRelease[1].includes(`${BASE}assets/phaser-stable.js`), 'unchanged hashed chunk is adopted from the previous cache');
  assert.ok(!fetchedByRelease[1].includes(`${BASE}assets/pixel/hero.png`), 'unchanged image is adopted from the previous cache');
  assert.ok(fetchedByRelease[1].includes(`${BASE}assets/index-b.js`), 'changed entry chunk is downloaded');
  assert.ok(fetchedByRelease[1].includes(`${BASE}index.html`), 'changed index.html is downloaded');
});

test('progress messages are throttled', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'hlc-sw-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const files = release();
  for (let index = 0; index < 200; index += 1) files[`content-packs/p/audio/auto-neural/bulk${index}.mp3`] = `bulk-${index}`;
  writeDist(dir, files);
  const browser = await runWorker(generate(dir), new Map(), serverOf(files));
  const progress = browser.posted.filter((message) => message.type === 'OFFLINE_PROGRESS' && message.group === 'audio');
  assert.ok(progress.length < 50, `expected throttled progress, got ${progress.length} messages`);
  assert.equal(progress.at(-1).completed, progress.at(-1).total, 'the final progress message is always sent');
});
