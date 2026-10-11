import test from "node:test";
import assert from "node:assert/strict";
import { fetchWithRetry } from "../neural-audio-utils.mjs";

const quiet = { log: () => {} };

function sequence(...steps) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    const step = steps[Math.min(calls.length - 1, steps.length - 1)];
    if (step instanceof Error) throw step;
    return new Response("x", { status: step.status, headers: step.headers });
  };
  return { fetchImpl, calls };
}

function sleeper() {
  const waits = [];
  return { sleep: async (ms) => { waits.push(ms); }, waits };
}

test("retries a 429 and then succeeds", async () => {
  const { fetchImpl, calls } = sequence({ status: 429 }, { status: 200 });
  const { sleep, waits } = sleeper();
  const response = await fetchWithRetry("https://example.test", { method: "POST" }, { fetchImpl, sleep, ...quiet });
  assert.equal(response.status, 200);
  assert.equal(calls.length, 2);
  assert.deepEqual(waits, [1000]);
});

test("honours Retry-After, then backs off exponentially on 5xx", async () => {
  const { fetchImpl } = sequence({ status: 503, headers: { "retry-after": "2" } }, { status: 500 }, { status: 200 });
  const { sleep, waits } = sleeper();
  const response = await fetchWithRetry("u", {}, { fetchImpl, sleep, baseMs: 100, ...quiet });
  assert.equal(response.status, 200);
  assert.deepEqual(waits, [2000, 200]);
});

test("caps the wait at maxMs", async () => {
  const { fetchImpl } = sequence({ status: 429, headers: { "retry-after": "120" } }, { status: 200 });
  const { sleep, waits } = sleeper();
  await fetchWithRetry("u", {}, { fetchImpl, sleep, ...quiet });
  assert.deepEqual(waits, [30000]);
});

test("does not retry client errors such as a wrong key", async () => {
  const { fetchImpl, calls } = sequence({ status: 401 });
  const { sleep, waits } = sleeper();
  const response = await fetchWithRetry("u", {}, { fetchImpl, sleep, ...quiet });
  assert.equal(response.status, 401);
  assert.equal(calls.length, 1);
  assert.deepEqual(waits, []);
});

test("returns the last retryable response after the final attempt", async () => {
  const { fetchImpl, calls } = sequence({ status: 500 });
  const { sleep, waits } = sleeper();
  const response = await fetchWithRetry("u", {}, { fetchImpl, sleep, attempts: 3, baseMs: 10, ...quiet });
  assert.equal(response.status, 500);
  assert.equal(calls.length, 3);
  assert.deepEqual(waits, [10, 20]);
});

test("retries a network error and then succeeds", async () => {
  const { fetchImpl, calls } = sequence(new TypeError("fetch failed"), { status: 200 });
  const { sleep, waits } = sleeper();
  const response = await fetchWithRetry("u", {}, { fetchImpl, sleep, ...quiet });
  assert.equal(response.status, 200);
  assert.equal(calls.length, 2);
  assert.deepEqual(waits, [1000]);
});

test("throws the network error when every attempt fails", async () => {
  const { fetchImpl, calls } = sequence(new TypeError("fetch failed"));
  const { sleep, waits } = sleeper();
  await assert.rejects(fetchWithRetry("u", {}, { fetchImpl, sleep, attempts: 2, baseMs: 5, ...quiet }), TypeError);
  assert.equal(calls.length, 2);
  assert.deepEqual(waits, [5]);
});
