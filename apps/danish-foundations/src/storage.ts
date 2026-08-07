import type { LanguagePack } from "@hero-lang/content-schema";
import { createInitialLearnerState, normalizeLearnerState, type LearnerState } from "@hero-lang/foundations-engine";
import type { LabyrinthSession } from "../../web/src/labyrinth";

const STATE_KEY_PREFIX = "danish-foundations:v0.9:state";
const LEGACY_STATE_KEYS = ["danish-foundations:v0.8:state", "danish-foundations:v0.7:state", "danish-foundations:v0.6:state", "danish-foundations:v0.3:state", "danish-foundations:v0.2:state", "danish-foundations:state"];
const LANGUAGE_KEY_PREFIX = "danish-foundations:v0.7:base-language";
const LEGACY_LANGUAGE_KEY_PREFIX = "danish-foundations:v0.3:base-language";
const PROFILES_KEY = "danish-foundations:v0.9:profiles";
const ACTIVE_PROFILE_KEY = "danish-foundations:v0.9:active-profile";
const SETTINGS_KEY = "danish-foundations:v0.9:settings";
const VIEWPORT_SETTINGS_KEY = "danish-foundations:v0.12:viewport-settings";
const LABYRINTH_KEY_PREFIX = "danish-foundations:v0.11:labyrinth";

export type GraphicsPack = "forest" | "candy" | "night";
export type LearningAudioMode = "human_only" | "human_and_automatic";
export type ViewportPreset =
  | "auto"
  | "desktop_split"
  | "iphone_portrait"
  | "android_portrait"
  | "small_phone"
  | "tablet_portrait"
  | "phone_landscape";
export type HairStyle = "swoop" | "bob" | "curly" | "spiky";
export type EyeStyle = "bright" | "sleepy" | "wink";
export type HeroSpriteSet = "adventurer";

export interface HeroAppearance {
  spriteSet: HeroSpriteSet;
  skinTone: string;
  hairColor: string;
  hairStyle: HairStyle;
  outfitColor: string;
  pantsColor: string;
  scarfColor: string;
  eyeStyle: EyeStyle;
}

export interface ChildProfile {
  id: string;
  name: string;
  appearance: HeroAppearance;
}

export interface AppSettings {
  graphicsPack: GraphicsPack;
  audioMode: LearningAudioMode;
  debug: boolean;
  debugBypass: boolean;
  speedBonusEnabled: boolean;
  targetPackId: string;
  viewportPreset: ViewportPreset;
  showDeviceFrame: boolean;
}

export const DEFAULT_APPEARANCES: HeroAppearance[] = [
  { spriteSet: "adventurer", skinTone: "#f2bb86", hairColor: "#7a3f1d", hairStyle: "swoop", outfitColor: "#4b8f38", pantsColor: "#4e3828", scarfColor: "#c62828", eyeStyle: "bright" },
  { spriteSet: "adventurer", skinTone: "#ffd0a3", hairColor: "#5a301a", hairStyle: "curly", outfitColor: "#4b8f38", pantsColor: "#4e3828", scarfColor: "#c62828", eyeStyle: "bright" }
];

export function loadChildProfiles(): ChildProfile[] {
  if (typeof window === "undefined") return defaultProfiles();
  const raw = window.localStorage.getItem(PROFILES_KEY);
  if (!raw) {
    const profiles = defaultProfiles();
    saveChildProfiles(profiles);
    return profiles;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return defaultProfiles();
    const profiles = parsed.map(normalizeProfile).filter((profile): profile is ChildProfile => Boolean(profile));
    return profiles.length > 0 ? profiles : defaultProfiles();
  } catch {
    return defaultProfiles();
  }
}

export function saveChildProfiles(profiles: ChildProfile[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

export function loadActiveProfileId(profiles: ChildProfile[]): string {
  if (typeof window === "undefined") return profiles[0]?.id ?? "kid_1";
  const stored = window.localStorage.getItem(ACTIVE_PROFILE_KEY);
  if (stored && profiles.some((profile) => profile.id === stored)) return stored;
  return profiles[0]?.id ?? "kid_1";
}

export function saveActiveProfileId(profileId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACTIVE_PROFILE_KEY, profileId);
}

export function createChildProfile(name: string, index: number): ChildProfile {
  return {
    id: `kid_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim() || `Kid ${index + 1}`,
    appearance: DEFAULT_APPEARANCES[index % DEFAULT_APPEARANCES.length]
  };
}

export function loadAppSettings(pack: LanguagePack): AppSettings {
  const fallback: AppSettings = {
    graphicsPack: "forest",
    audioMode: "human_and_automatic",
    debug: false,
    debugBypass: false,
    speedBonusEnabled: true,
    targetPackId: pack.pack_id,
    viewportPreset: "auto",
    showDeviceFrame: false
  };

  if (typeof window === "undefined") return fallback;

  let persisted: Partial<AppSettings> = {};
  let viewport: Partial<Pick<AppSettings, "viewportPreset" | "showDeviceFrame">> = {};

  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    persisted = raw ? JSON.parse(raw) as Partial<AppSettings> : {};
  } catch {
    persisted = {};
  }

  try {
    const raw = window.sessionStorage.getItem(VIEWPORT_SETTINGS_KEY);
    viewport = raw ? JSON.parse(raw) as Partial<Pick<AppSettings, "viewportPreset" | "showDeviceFrame">> : {};
  } catch {
    viewport = {};
  }

  return {
    graphicsPack: persisted.graphicsPack === "candy" || persisted.graphicsPack === "night" ? persisted.graphicsPack : "forest",
    audioMode: persisted.audioMode === "human_only" ? "human_only" : "human_and_automatic",
    debug: Boolean(persisted.debug),
    debugBypass: Boolean(persisted.debugBypass),
    speedBonusEnabled: persisted.speedBonusEnabled !== false,
    targetPackId: typeof persisted.targetPackId === "string" ? persisted.targetPackId : pack.pack_id,
    viewportPreset: isViewportPreset(viewport.viewportPreset) ? viewport.viewportPreset : "auto",
    showDeviceFrame: Boolean(viewport.showDeviceFrame)
  };
}

export function saveAppSettings(settings: AppSettings): void {
  if (typeof window === "undefined") return;

  // Gameplay, audio, and debug preferences remain persistent. Device simulation
  // is deliberately session-scoped so a constrained phone preview can never
  // trap the user after closing and reopening the browser.
  const persistentSettings = {
    graphicsPack: settings.graphicsPack,
    audioMode: settings.audioMode,
    debug: settings.debug,
    debugBypass: settings.debugBypass,
    speedBonusEnabled: settings.speedBonusEnabled,
    targetPackId: settings.targetPackId
  };
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(persistentSettings));

  if (settings.viewportPreset === "auto" && !settings.showDeviceFrame) {
    window.sessionStorage.removeItem(VIEWPORT_SETTINGS_KEY);
  } else {
    window.sessionStorage.setItem(VIEWPORT_SETTINGS_KEY, JSON.stringify({
      viewportPreset: settings.viewportPreset,
      showDeviceFrame: settings.showDeviceFrame
    }));
  }
}

export function getLearnerStateStorageKey(pack: LanguagePack, profileId: string): string {
  return `${STATE_KEY_PREFIX}:${pack.pack_id}:${profileId}`;
}

export function loadLearnerState(pack: LanguagePack, profile: ChildProfile): LearnerState {
  if (typeof window === "undefined") return createInitialLearnerState(pack, profile.name);

  const scopedKey = getLearnerStateStorageKey(pack, profile.id);
  const raw = window.localStorage.getItem(scopedKey)
    ?? LEGACY_STATE_KEYS.map((prefix) => window.localStorage.getItem(`${prefix}:${pack.pack_id}`)).find(Boolean)
    ?? null;

  if (!raw) return createInitialLearnerState(pack, profile.name);

  try {
    return normalizeLearnerState(pack, JSON.parse(raw), profile.name);
  } catch {
    return createInitialLearnerState(pack, profile.name);
  }
}

export function saveLearnerState(pack: LanguagePack, profileId: string, state: LearnerState): void {
  if (typeof window === "undefined") return;
  const key = getLearnerStateStorageKey(pack, profileId);
  const serialized = JSON.stringify(state);
  try {
    if (window.localStorage.getItem(key) !== serialized) {
      window.localStorage.setItem(key, serialized);
    }
  } catch {
    // Keep the active session usable if storage is unavailable or full.
  }
}
export function resetLearnerState(pack: LanguagePack, profile: ChildProfile): LearnerState {
  const fresh = createInitialLearnerState(pack, profile.name);
  saveLearnerState(pack, profile.id, fresh);
  return fresh;
}


export function loadLabyrinthSession(pack: LanguagePack, profileId: string): LabyrinthSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(`${LABYRINTH_KEY_PREFIX}:${pack.pack_id}:${profileId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LabyrinthSession;
  } catch {
    return null;
  }
}

export function saveLabyrinthSession(pack: LanguagePack, profileId: string, session: LabyrinthSession): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `${LABYRINTH_KEY_PREFIX}:${pack.pack_id}:${profileId}`,
      JSON.stringify(session)
    );
  } catch {
    // If device storage is full, the active run remains usable in memory.
  }
}

export function clearLabyrinthSession(pack: LanguagePack, profileId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(`${LABYRINTH_KEY_PREFIX}:${pack.pack_id}:${profileId}`);
}

export function loadBaseLanguage(pack: LanguagePack, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const stored = window.localStorage.getItem(`${LANGUAGE_KEY_PREFIX}:${pack.pack_id}`)
    ?? window.localStorage.getItem(`${LEGACY_LANGUAGE_KEY_PREFIX}:${pack.pack_id}`);
  return stored ?? fallback;
}

export function saveBaseLanguage(pack: LanguagePack, language: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${LANGUAGE_KEY_PREFIX}:${pack.pack_id}`, language);
}

function defaultProfiles(): ChildProfile[] {
  return [
    { id: "kid_1", name: "Freja", appearance: DEFAULT_APPEARANCES[0] },
    { id: "kid_2", name: "Luca", appearance: DEFAULT_APPEARANCES[1] }
  ];
}

function normalizeProfile(value: unknown): ChildProfile | null {
  if (!isObject(value)) return null;
  const id = typeof value.id === "string" && value.id ? value.id : createChildProfile("Kid", 0).id;
  const name = typeof value.name === "string" && value.name.trim() ? value.name.trim() : "Kid";
  return {
    id,
    name,
    appearance: normalizeAppearance(value.appearance)
  };
}

function normalizeAppearance(value: unknown): HeroAppearance {
  const fallback = DEFAULT_APPEARANCES[0];
  if (!isObject(value)) return fallback;
  return {
    spriteSet: "adventurer",
    skinTone: colorOr(value.skinTone, fallback.skinTone),
    hairColor: colorOr(value.hairColor, fallback.hairColor),
    hairStyle: value.hairStyle === "bob" || value.hairStyle === "curly" || value.hairStyle === "spiky" ? value.hairStyle : fallback.hairStyle,
    outfitColor: colorOr(value.outfitColor, fallback.outfitColor),
    pantsColor: colorOr(value.pantsColor, fallback.pantsColor),
    scarfColor: colorOr(value.scarfColor, fallback.scarfColor),
    eyeStyle: value.eyeStyle === "sleepy" || value.eyeStyle === "wink" ? value.eyeStyle : fallback.eyeStyle
  };
}

function isViewportPreset(value: unknown): value is ViewportPreset {
  return value === "auto"
    || value === "desktop_split"
    || value === "iphone_portrait"
    || value === "android_portrait"
    || value === "small_phone"
    || value === "tablet_portrait"
    || value === "phone_landscape";
}

function colorOr(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
