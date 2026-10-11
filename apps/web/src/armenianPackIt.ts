import { buildLanguagePackFromSources, type LanguagePack } from "@hero-lang/content-schema";
import packYaml from "../../../content-packs/hy-eastern-it/pack.yaml?raw";
import interfaceYaml from "../../../content-packs/hy-eastern-it/interface.yaml?raw";
import tagsYaml from "../../../content-packs/hy-eastern-it/tags.yaml?raw";
import tasksYaml from "../../../content-packs/hy-eastern-it/tasks.yaml?raw";
import levelsYaml from "../../../content-packs/hy-eastern-it/levels.yaml?raw";
import enemiesYaml from "../../../content-packs/hy-eastern-it/enemies.yaml?raw";
import storyYaml from "../../../content-packs/hy-eastern-it/story.yaml?raw";
import labyrinthsYaml from "../../../content-packs/hy-eastern-it/labyrinths.yaml?raw";
import wordsJsonl from "../../../content-packs/hy-eastern-it/dictionary/words.jsonl?raw";
import lettersJsonl from "../../../content-packs/hy-eastern-it/dictionary/letters.jsonl?raw";
import sentencesJsonl from "../../../content-packs/hy-eastern-it/dictionary/sentences.jsonl?raw";

export function buildPack(): LanguagePack {
  return buildLanguagePackFromSources({ packYaml, interfaceYaml, tagsYaml, tasksYaml, levelsYaml, enemiesYaml, storyYaml, labyrinthsYaml, wordsJsonl, lettersJsonl, sentencesJsonl });
}
