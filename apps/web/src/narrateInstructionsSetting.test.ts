import type { LanguagePack } from "@hero-lang/content-schema";
import { beforeEach, describe, expect, it } from "vitest";
import * as webStorage from "./storage";
import * as danishStorage from "../../danish-foundations/src/storage";

const pack = { pack_id: "test-pack", items: [] } as unknown as LanguagePack;

const apps = [
  ["web", webStorage, "hero-language-camp:v0.9:settings", false],
  ["danish", danishStorage, "danish-foundations:v0.9:settings", true]
] as const;

beforeEach(() => window.localStorage.clear());

describe.each(apps)("narrateInstructions setting (%s app)", (_name, storage, settingsKey, expectedDefault) => {
  it(`defaults to ${expectedDefault}`, () => {
    expect(storage.loadAppSettings(pack).narrateInstructions).toBe(expectedDefault);
  });

  it("keeps a saved value of either kind", () => {
    storage.saveAppSettings({ ...storage.loadAppSettings(pack), narrateInstructions: !expectedDefault });
    expect(storage.loadAppSettings(pack).narrateInstructions).toBe(!expectedDefault);
    storage.saveAppSettings({ ...storage.loadAppSettings(pack), narrateInstructions: expectedDefault });
    expect(storage.loadAppSettings(pack).narrateInstructions).toBe(expectedDefault);
  });

  it("falls back to the default for a non-boolean saved value", () => {
    window.localStorage.setItem(settingsKey, JSON.stringify({ narrateInstructions: "yes" }));
    expect(storage.loadAppSettings(pack).narrateInstructions).toBe(expectedDefault);
  });

  it("falls back to the default for a save made before the setting existed", () => {
    window.localStorage.setItem(settingsKey, JSON.stringify({ audioMode: "human_only" }));
    const loaded = storage.loadAppSettings(pack);
    expect(loaded.narrateInstructions).toBe(expectedDefault);
    expect(loaded.audioMode).toBe("human_only");
  });
});
