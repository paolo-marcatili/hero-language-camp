import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildLanguagePackFromSources, parseYaml } from '../packages/content-schema/src/index.ts';

// Authoring tools and the application use exactly the same parsing/normalization.
export { parseYaml, parseJsonl } from '../packages/content-schema/src/index.ts';
export function writeJsonl(rows) { return rows.map(row => JSON.stringify(row)).join('\n') + '\n'; }

export function loadModularPack(packDir) {
  const packYaml = readFileSync(join(packDir, 'pack.yaml'), 'utf8');
  const files = parseYaml(packYaml, { strict: true, source: "pack.yaml" }).files ?? {};
  const sourceFiles = {
    interfaceYaml: files.interface ?? 'interface.yaml',
    tagsYaml: files.tags ?? 'tags.yaml',
    tasksYaml: files.tasks ?? 'tasks.yaml',
    levelsYaml: files.levels ?? 'levels.yaml',
    enemiesYaml: files.enemies ?? 'enemies.yaml',
    storyYaml: files.story ?? 'story.yaml',
    labyrinthsYaml: files.labyrinths ?? 'labyrinths.yaml',
    wordsJsonl: files.words ?? 'dictionary/words.jsonl',
    lettersJsonl: files.letters ?? 'dictionary/letters.jsonl',
    sentencesJsonl: files.sentences ?? 'dictionary/sentences.jsonl',
    readingProblemsJsonl: files.reading_problems ?? 'curriculum/reading-problems.jsonl',
    mathProblemsJsonl: files.math_problems ?? 'curriculum/math-problems.jsonl',
    instructionsJsonl: files.instructions ?? 'curriculum/instructions.jsonl'
  };
  const sources = Object.fromEntries(Object.entries(sourceFiles).map(([key, name]) => {
    const file = join(packDir, name);
    return [key, existsSync(file) ? readFileSync(file, 'utf8') : ''];
  }));
  return buildLanguagePackFromSources({ packYaml, ...sources });
}
