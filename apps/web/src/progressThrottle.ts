/**
 * Leading + trailing throttle that always delivers the newest value.
 * Used for service-worker download progress so a burst of messages causes at
 * most one React state update per interval instead of one per downloaded file.
 */
export function createLatestThrottle<T>(
  apply: (value: T) => void,
  intervalMs: number,
  now: () => number = () => Date.now()
): { push: (value: T) => void; cancel: () => void } {
  let lastApplied = Number.NEGATIVE_INFINITY;
  let pending: { value: T } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const run = (value: T) => {
    lastApplied = now();
    apply(value);
  };
  const cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    pending = null;
  };
  const push = (value: T) => {
    const wait = intervalMs - (now() - lastApplied);
    if (wait <= 0) {
      cancel();
      run(value);
      return;
    }
    pending = { value }; // newest wins; older queued values are dropped
    if (timer === null) {
      timer = setTimeout(() => {
        timer = null;
        const next = pending;
        pending = null;
        if (next) run(next.value);
      }, wait);
    }
  };
  return { push, cancel };
}
