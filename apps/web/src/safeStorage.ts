type BackendName = "localStorage" | "sessionStorage";
const memory: Record<BackendName, Map<string, string>> = { localStorage: new Map(), sessionStorage: new Map() };
const CORRUPT_INFIX = ":corrupt:";
const fullListeners = new Set<() => void>();
let writeFailed = false;
let fullDelivered = false;

function deliverStorageFull(): void {
  if (!writeFailed || fullDelivered || fullListeners.size === 0) return;
  fullDelivered = true;
  for (const listener of [...fullListeners]) {
    try { listener(); } catch { /* a listener must never break a write */ }
  }
}

function backend(name: BackendName): Storage | null {
  try {
    return typeof window === "undefined" ? null : window[name];
  } catch {
    return null; // the getter itself throws when storage is blocked
  }
}

function createSafeStorage(name: BackendName) {
  const fallback = memory[name];
  return {
    getItem(key: string): string | null {
      const override = fallback.get(key);
      if (override !== undefined) return override;
      try { return backend(name)?.getItem(key) ?? null; } catch { return null; }
    },
    setItem(key: string, value: string): boolean {
      try {
        const store = backend(name);
        if (!store) throw new Error("storage unavailable");
        store.setItem(key, value);
        fallback.delete(key);
        return true;
      } catch {
        fallback.set(key, value);
        if (!key.includes(CORRUPT_INFIX)) {
          writeFailed = true;
          deliverStorageFull();
        }
        return false;
      }
    },
    removeItem(key: string): void {
      fallback.delete(key);
      try { backend(name)?.removeItem(key); } catch { /* ignore */ }
    },
    keys(): string[] {
      const result = new Set<string>(fallback.keys());
      try {
        const store = backend(name);
        if (store) for (let i = 0; i < store.length; i += 1) { const key = store.key(i); if (key !== null) result.add(key); }
      } catch { /* ignore */ }
      return [...result];
    }
  };
}

export const safeLocalStorage = createSafeStorage("localStorage");
export const safeSessionStorage = createSafeStorage("sessionStorage");

/** Calls `listener` once per page session, the first time a progress/settings write falls back to memory. */
export function onStorageFull(listener: () => void): () => void {
  fullListeners.add(listener);
  deliverStorageFull();
  return () => { fullListeners.delete(listener); };
}

/** Best-effort copy of an unreadable save under `<key>:corrupt:<timestamp>`; keeps the `keep` newest. Never throws. */
export function backupCorrupt(key: string, raw: string, keep = 2): void {
  try {
    if (!raw) return;
    const prefix = `${key}${CORRUPT_INFIX}`;
    const existing = safeLocalStorage.keys().filter((k) => k.startsWith(prefix)).sort();
    if (!existing.some((k) => safeLocalStorage.getItem(k) === raw)) {
      const stamp = new Date().toISOString().replace(/:/g, "-");
      let name = `${prefix}${stamp}`;
      for (let n = 2; existing.includes(name); n += 1) name = `${prefix}${stamp}-${n}`;
      safeLocalStorage.setItem(name, raw);
      existing.push(name);
      existing.sort();
    }
    for (const old of existing.slice(0, Math.max(0, existing.length - keep))) safeLocalStorage.removeItem(old);
  } catch { /* best effort */ }
}
