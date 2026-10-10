import type { LanguagePack } from "@hero-lang/content-schema";

export type ArmenianPackId = "hy-eastern-it" | "hy-eastern-en";
const PACK_PREFERENCE_KEY = "hero-language-camp:v1:armenian-pack";
const DEFAULT_PACK_ID: ArmenianPackId = "hy-eastern-it";

// Each pack lives in its own module so Vite emits one chunk per pack and a
// page load only downloads and parses the selected pack.
const PACK_LOADERS: Record<ArmenianPackId, () => Promise<LanguagePack>> = {
  "hy-eastern-it": () => import("./armenianPackIt").then((module) => module.buildPack()),
  "hy-eastern-en": () => import("./armenianPackEn").then((module) => module.buildPack())
};

export function isArmenianPackId(value: string | null): value is ArmenianPackId {
  return value === "hy-eastern-it" || value === "hy-eastern-en";
}
export function loadArmenianPack(packId: string): Promise<LanguagePack> {
  return PACK_LOADERS[isArmenianPackId(packId) ? packId : DEFAULT_PACK_ID]();
}
export async function resolveInitialArmenianPack(): Promise<{ pack: LanguagePack; requiresChoice: boolean }> {
  if (typeof window === "undefined") return { pack: await loadArmenianPack(DEFAULT_PACK_ID), requiresChoice: false };
  const requested = new URL(window.location.href).searchParams.get("pack");
  if (isArmenianPackId(requested)) {
    window.localStorage.setItem(PACK_PREFERENCE_KEY, requested);
    return { pack: await loadArmenianPack(requested), requiresChoice: false };
  }
  const stored = window.localStorage.getItem(PACK_PREFERENCE_KEY);
  if (isArmenianPackId(stored)) return { pack: await loadArmenianPack(stored), requiresChoice: false };
  return { pack: await loadArmenianPack(DEFAULT_PACK_ID), requiresChoice: true };
}
export function selectArmenianPack(packId: ArmenianPackId): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PACK_PREFERENCE_KEY, packId);
  const url = new URL(window.location.href);
  url.searchParams.set("pack", packId);
  window.location.assign(url.toString());
}
