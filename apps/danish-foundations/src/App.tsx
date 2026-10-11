import GameApp from "../../web/src/GameApp";
import * as storage from "./storage";
import { buildLanguagePackFromSources } from "@hero-lang/content-schema";
import packYaml from "../../../content-packs/da-foundations/pack.yaml?raw";
import interfaceYaml from "../../../content-packs/da-foundations/interface.yaml?raw";
import tagsYaml from "../../../content-packs/da-foundations/tags.yaml?raw";
import tasksYaml from "../../../content-packs/da-foundations/tasks.yaml?raw";
import levelsYaml from "../../../content-packs/da-foundations/levels.yaml?raw";
import enemiesYaml from "../../../content-packs/da-foundations/enemies.yaml?raw";
import storyYaml from "../../../content-packs/da-foundations/story.yaml?raw";
import labyrinthsYaml from "../../../content-packs/da-foundations/labyrinths.yaml?raw";
import wordsJsonl from "../../../content-packs/da-foundations/dictionary/words.jsonl?raw";
import lettersJsonl from "../../../content-packs/da-foundations/dictionary/letters.jsonl?raw";
import sentencesJsonl from "../../../content-packs/da-foundations/dictionary/sentences.jsonl?raw";
import mathProblemsJsonl from "../../../content-packs/da-foundations/curriculum/math-problems.jsonl?raw";
import readingProblemsJsonl from "../../../content-packs/da-foundations/curriculum/reading-problems.jsonl?raw";
import instructionsJsonl from "../../../content-packs/da-foundations/curriculum/instructions.jsonl?raw";
const starterPack = buildLanguagePackFromSources({
  packYaml,
  interfaceYaml,
  tagsYaml,
  tasksYaml,
  levelsYaml,
  enemiesYaml,
  storyYaml,
  labyrinthsYaml,
  wordsJsonl,
  lettersJsonl,
  sentencesJsonl,
  mathProblemsJsonl,
  readingProblemsJsonl,
  instructionsJsonl
});
export default function App() { return <GameApp starterPack={starterPack} storage={storage} />; }
