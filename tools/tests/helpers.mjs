import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
export const root = resolve(import.meta.dirname, '../..');
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('@hero-lang/')) return next(pathToFileURL(resolve(root, 'packages', specifier.slice(11), 'src/index.ts')).href, context);
  if (specifier.startsWith('.') && context.parentURL && !/\.[a-z]+$/.test(specifier)) {
    const path = resolve(dirname(fileURLToPath(context.parentURL)), specifier + '.ts');
    if (existsSync(path)) return next(pathToFileURL(path).href, context);
  }
  return next(specifier, context);
} });
const { buildLanguagePackFromSources } = await import('../../packages/content-schema/src/index.ts');
export function loadPack(id) {
  const folder = resolve(root, 'content-packs', id);
  const inputs = { packYaml: 'pack.yaml', interfaceYaml:'interface.yaml', tagsYaml:'tags.yaml', tasksYaml:'tasks.yaml', levelsYaml:'levels.yaml', enemiesYaml:'enemies.yaml', storyYaml:'story.yaml', labyrinthsYaml:'labyrinths.yaml', wordsJsonl:'dictionary/words.jsonl', lettersJsonl:'dictionary/letters.jsonl', sentencesJsonl:'dictionary/sentences.jsonl', readingProblemsJsonl:'curriculum/reading-problems.jsonl', mathProblemsJsonl:'curriculum/math-problems.jsonl', instructionsJsonl:'curriculum/instructions.jsonl' };
  return buildLanguagePackFromSources(Object.fromEntries(Object.entries(inputs).map(([key,file]) => [key, existsSync(resolve(folder,file)) ? readFileSync(resolve(folder,file),'utf8') : ''])));
}
export function seededRandom(seed = 42) {
  return () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296; };
}
