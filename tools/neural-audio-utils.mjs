import { existsSync, statSync } from 'node:fs';

// A filename alone cannot establish that a recording still matches its lesson.
// Older recordings without a saved rate are regenerated once rather than guessed.
export function reusableNeuralAudio(entry, field, id, text, voice, rate, path) {
  if (!existsSync(path) || statSync(path).size === 0) return undefined;
  return (entry[field] ?? []).find(audio => audio.id === `${id}_azure_neural`
    && audio.source_type === 'automated' && audio.text === text
    && audio.voice === voice && audio.rate === rate);
}

// Azure Speech sometimes answers 429 (rate limit) or 5xx (transient). Retry only those cases, with back-off,
// so one bad response does not discard a long generation run on a CI runner that disappears afterwards.
// Other 4xx answers (bad key, bad request) are returned at once and the caller reports them as before.
export async function fetchWithRetry(url, options, {
  attempts = 6,
  baseMs = 1000,
  maxMs = 30000,
  fetchImpl = globalThis.fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  log = (message) => process.stderr.write(`${message}\n`)
} = {}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const backoff = Math.min(baseMs * 2 ** (attempt - 1), maxMs);
    let response;
    try {
      response = await fetchImpl(url, options);
    } catch (error) {
      if (attempt === attempts) throw error;
      log(`Network error (${error.message}); retrying in ${backoff} ms (attempt ${attempt}/${attempts})`);
      await sleep(backoff);
      continue;
    }
    const retryable = response.status === 429 || (response.status >= 500 && response.status <= 599);
    if (!retryable || attempt === attempts) return response;
    const retryAfter = Number(response.headers.get('retry-after'));
    const wait = retryAfter > 0 ? Math.min(retryAfter * 1000, maxMs) : backoff;
    log(`Azure Speech ${response.status}; retrying in ${wait} ms (attempt ${attempt}/${attempts})`);
    await sleep(wait);
  }
  throw new Error('fetchWithRetry: no attempts were made');
}

