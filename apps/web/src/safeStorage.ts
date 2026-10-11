type BackendName = "localStorage" | "sessionStorage";
const memory: Record<BackendName, Map<string, string>> = { localStorage: new Map(), sessionStorage: new Map() };

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
