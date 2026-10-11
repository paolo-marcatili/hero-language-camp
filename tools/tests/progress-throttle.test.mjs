import test from 'node:test';
import assert from 'node:assert/strict';
import { createLatestThrottle } from '../../apps/web/src/progressThrottle.ts';

function clock(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let time = 1000;
  return { now: () => time, advance(ms) { time += ms; t.mock.timers.tick(ms); } };
}

test('applies the first value immediately and coalesces a burst to the newest value', (t) => {
  const { now, advance } = clock(t);
  const seen = [];
  const throttle = createLatestThrottle((value) => seen.push(value), 250, now);
  for (let value = 1; value <= 100; value += 1) throttle.push(value);
  assert.deepEqual(seen, [1], 'leading edge only; the rest are queued');
  advance(250);
  assert.deepEqual(seen, [1, 100], 'trailing edge delivers the newest value only');
});

test('a burst over one second renders about four times', (t) => {
  const { now, advance } = clock(t);
  let renders = 0;
  const throttle = createLatestThrottle(() => { renders += 1; }, 250, now);
  for (let step = 0; step < 100; step += 1) { throttle.push(step); advance(10); }
  advance(250);
  assert.ok(renders >= 4 && renders <= 6, `renders=${renders}`);
});

test('cancel drops queued progress so a later COMPLETE message cannot be overwritten', (t) => {
  const { now, advance } = clock(t);
  const seen = [];
  const throttle = createLatestThrottle((value) => seen.push(value), 250, now);
  throttle.push('a'); throttle.push('b');
  throttle.cancel();
  advance(1000);
  assert.deepEqual(seen, ['a']);
});
