import { buildLanguagePackFromSources, type LanguagePack } from "@hero-lang/content-schema";
import itPackYaml from "../../../content-packs/hy-eastern-it/pack.yaml?raw";
import itInterfaceYaml from "../../../content-packs/hy-eastern-it/interface.yaml?raw";
import itTagsYaml from "../../../content-packs/hy-eastern-it/tags.yaml?raw";
import itTasksYaml from "../../../content-packs/hy-eastern-it/tasks.yaml?raw";
import itLevelsYaml from "../../../content-packs/hy-eastern-it/levels.yaml?raw";
import itEnemiesYaml from "../../../content-packs/hy-eastern-it/enemies.yaml?raw";
import itStoryYaml from "../../../content-packs/hy-eastern-it/story.yaml?raw";
import itLabyrinthsYaml from "../../../content-packs/hy-eastern-it/labyrinths.yaml?raw";
import itWordsJsonl from "../../../content-packs/hy-eastern-it/dictionary/words.jsonl?raw";
import itLettersJsonl from "../../../content-packs/hy-eastern-it/dictionary/letters.jsonl?raw";
import itSentencesJsonl from "../../../content-packs/hy-eastern-it/dictionary/sentences.jsonl?raw";
import enPackYaml from "../../../content-packs/hy-eastern-en/pack.yaml?raw";
import enInterfaceYaml from "../../../content-packs/hy-eastern-en/interface.yaml?raw";
import enTagsYaml from "../../../content-packs/hy-eastern-en/tags.yaml?raw";
import enTasksYaml from "../../../content-packs/hy-eastern-en/tasks.yaml?raw";
import enLevelsYaml from "../../../content-packs/hy-eastern-en/levels.yaml?raw";
import enEnemiesYaml from "../../../content-packs/hy-eastern-en/enemies.yaml?raw";
import enStoryYaml from "../../../content-packs/hy-eastern-en/story.yaml?raw";
import enLabyrinthsYaml from "../../../content-packs/hy-eastern-en/labyrinths.yaml?raw";
import enWordsJsonl from "../../../content-packs/hy-eastern-en/dictionary/words.jsonl?raw";
import enLettersJsonl from "../../../content-packs/hy-eastern-en/dictionary/letters.jsonl?raw";
import enSentencesJsonl from "../../../content-packs/hy-eastern-en/dictionary/sentences.jsonl?raw";

export type ArmenianPackId = "hy-eastern-it" | "hy-eastern-en";
const PACK_PREFERENCE_KEY = "hero-language-camp:v1:armenian-pack";

function build(sources: Parameters<typeof buildLanguagePackFromSources>[0]): LanguagePack {
  return buildLanguagePackFromSources(sources);
}
const PACKS: Record<ArmenianPackId, LanguagePack> = {
  "hy-eastern-it": build({ packYaml: itPackYaml, interfaceYaml: itInterfaceYaml, tagsYaml: itTagsYaml, tasksYaml: itTasksYaml, levelsYaml: itLevelsYaml, enemiesYaml: itEnemiesYaml, storyYaml: itStoryYaml, labyrinthsYaml: itLabyrinthsYaml, wordsJsonl: itWordsJsonl, lettersJsonl: itLettersJsonl, sentencesJsonl: itSentencesJsonl }),
  "hy-eastern-en": build({ packYaml: enPackYaml, interfaceYaml: enInterfaceYaml, tagsYaml: enTagsYaml, tasksYaml: enTasksYaml, levelsYaml: enLevelsYaml, enemiesYaml: enEnemiesYaml, storyYaml: enStoryYaml, labyrinthsYaml: enLabyrinthsYaml, wordsJsonl: enWordsJsonl, lettersJsonl: enLettersJsonl, sentencesJsonl: enSentencesJsonl })
};

export function isArmenianPackId(value: string | null): value is ArmenianPackId {
  return value === "hy-eastern-it" || value === "hy-eastern-en";
}
export function getBundledArmenianPack(packId: string): LanguagePack {
  return isArmenianPackId(packId) ? PACKS[packId] : PACKS["hy-eastern-it"];
}
export function resolveInitialArmenianPack(): { pack: LanguagePack; requiresChoice: boolean } {
  if (typeof window === "undefined") return { pack: PACKS["hy-eastern-it"], requiresChoice: false };
  const requested = new URL(window.location.href).searchParams.get("pack");
  if (isArmenianPackId(requested)) {
    window.localStorage.setItem(PACK_PREFERENCE_KEY, requested);
    return { pack: PACKS[requested], requiresChoice: false };
  }
  const stored = window.localStorage.getItem(PACK_PREFERENCE_KEY);
  if (isArmenianPackId(stored)) return { pack: PACKS[stored], requiresChoice: false };
  return { pack: PACKS["hy-eastern-it"], requiresChoice: true };
}
export function selectArmenianPack(packId: ArmenianPackId): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PACK_PREFERENCE_KEY, packId);
  const url = new URL(window.location.href);
  url.searchParams.set("pack", packId);
  window.location.assign(url.toString());
}
