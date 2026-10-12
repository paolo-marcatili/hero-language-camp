import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LanguagePack } from "@hero-lang/content-schema";
import { createInitialLearnerState, normalizeLearnerState } from "@hero-lang/learning-engine";
import * as webStorage from "./storage";
import * as danishStorage from "../../danish-foundations/src/storage";

const pack = { pack_id: "test-pack", items: [] } as unknown as LanguagePack;
const profile = { id: "kid_1", name: "Ani", appearance: webStorage.DEFAULT_APPEARANCES[0] };

const apps = [
  ["web", webStorage],
  ["danish", danishStorage]
] as const;

function corruptKeys(): string[] {
  return Object.keys(window.localStorage)
    .filter((key) => key.includes(":corrupt:"))
    .sort();
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe.each(apps)("corrupt-save backup (%s app)", (_name, storage) => {
  const key = storage.getLearnerStateStorageKey(pack, profile.id);

  it("loads a valid save unchanged and creates no backup", () => {
    const fixture = createInitialLearnerState(pack, "Ani");
    const raw = JSON.stringify(fixture);
    window.localStorage.setItem(key, raw);
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    expect(storage.loadLearnerState(pack, profile)).toEqual(normalizeLearnerState(pack, fixture, "Ani"));
    expect(setItem).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(key)).toBe(raw);
    expect(corruptKeys()).toEqual([]);
  });

  it("does not back up a missing save", () => {
    storage.loadLearnerState(pack, profile);
    expect(corruptKeys()).toEqual([]);
  });

  it("backs up unparsable JSON once and returns a fresh state", () => {
    window.localStorage.setItem(key, "{not json");
    const state = storage.loadLearnerState(pack, profile);
    expect(state.level).toBe(0);
    const backups = corruptKeys();
    expect(backups).toHaveLength(1);
    expect(backups[0].startsWith(`${key}:corrupt:`)).toBe(true);
    expect(window.localStorage.getItem(backups[0])).toBe("{not json");
    storage.loadLearnerState(pack, profile);
    expect(corruptKeys()).toHaveLength(1);
  });

  it("backs up valid JSON of the wrong shape", () => {
    window.localStorage.setItem(key, "[1,2,3]");
    storage.loadLearnerState(pack, profile);
    expect(corruptKeys().map((k) => window.localStorage.getItem(k))).toEqual(["[1,2,3]"]);
  });

  it("keeps only the 2 newest backups after three corruptions", () => {
    for (const raw of ["{a", "{b", "{c"]) {
      window.localStorage.setItem(key, raw);
      storage.loadLearnerState(pack, profile);
    }
    expect(corruptKeys().map((k) => window.localStorage.getItem(k))).toEqual(["{b", "{c"]);
    expect(window.localStorage.getItem(key)).toBe("{c");
  });

  it("backs up corrupt profiles, settings and labyrinth saves", () => {
    const base = key.split(":v0.9:")[0];
    const cases: Array<[string, () => void]> = [
      [`${base}:v0.9:profiles`, () => expect(storage.loadChildProfiles().length).toBeGreaterThan(0)],
      [`${base}:v0.9:settings`, () => expect(storage.loadAppSettings(pack).graphicsPack).toBe("forest")],
      [`${base}:v0.11:labyrinth:${pack.pack_id}:${profile.id}`, () => expect(storage.loadLabyrinthSession(pack, profile.id)).toBeNull()]
    ];
    for (const [storedKey, load] of cases) {
      window.localStorage.clear();
      window.localStorage.setItem(storedKey, "{broken");
      load();
      expect(corruptKeys().map((k) => k.slice(0, storedKey.length + 9))).toEqual([`${storedKey}:corrupt:`]);
    }
  });

  it("calls the storage-full listener once for two failing writes", async () => {
    vi.resetModules();
    const { safeLocalStorage, onStorageFull } = await import("./safeStorage");
    const listener = vi.fn();
    onStorageFull(listener);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    safeLocalStorage.setItem("a", "1");
    safeLocalStorage.setItem("b", "2");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("a failing backup write neither throws nor reports storage full", async () => {
    vi.resetModules();
    const { backupCorrupt, onStorageFull } = await import("./safeStorage");
    const listener = vi.fn();
    onStorageFull(listener);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    expect(() => backupCorrupt("k", "{x")).not.toThrow();
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("corrupt backups and key listing", () => {
  it("the profile list ignores backup keys", () => {
    window.localStorage.setItem("hero-language-camp:v0.9:profiles:corrupt:2026", "{x");
    window.localStorage.setItem("hero-language-camp:v0.9:profiles", JSON.stringify([{ id: "k", name: "Zed" }]));
    expect(webStorage.loadChildProfiles().map((p) => p.name)).toEqual(["Zed"]);
  });
});
