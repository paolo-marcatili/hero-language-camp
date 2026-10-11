import { buildLanguagePackFromSources, type LanguagePack } from "@hero-lang/content-schema";
import packYaml from "../../../content-packs/hy-eastern-en/pack.yaml?raw";
import interfaceYaml from "../../../content-packs/hy-eastern-en/interface.yaml?raw";
import tagsYaml from "../../../content-packs/hy-eastern-en/tags.yaml?raw";
import tasksYaml from "../../../content-packs/hy-eastern-en/tasks.yaml?raw";
import levelsYaml from "../../../content-packs/hy-eastern-en/levels.yaml?raw";
import enemiesYaml from "../../../content-packs/hy-eastern-en/enemies.yaml?raw";
import storyYaml from "../../../content-packs/hy-eastern-en/story.yaml?raw";
import labyrinthsYaml from "../../../content-packs/hy-eastern-en/labyrinths.yaml?raw";
import wordsJsonl from "../../../content-packs/hy-eastern-en/dictionary/words.jsonl?raw";
import lettersJsonl from "../../../content-packs/hy-eastern-en/dictionary/letters.jsonl?raw";
import sentencesJsonl from "../../../content-packs/hy-eastern-en/dictionary/sentences.jsonl?raw";

export function buildPack(): LanguagePack {
  return buildLanguagePackFromSources({ packYaml, interfaceYaml, tagsYaml, tasksYaml, levelsYaml, enemiesYaml, storyYaml, labyrinthsYaml, wordsJsonl, lettersJsonl, sentencesJsonl });
}
