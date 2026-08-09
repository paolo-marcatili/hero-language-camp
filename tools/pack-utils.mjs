import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

export function loadModularPack(packDir) {
  const packYaml = readFileSync(join(packDir, "pack.yaml"), "utf8");
  const meta = parseYaml(packYaml);
  const files = meta.files || {};
  const sourceLanguage = meta.base_language?.code || meta.source_language || "it";
  const uiDoc = files.interface ? parseYaml(readFileSync(join(packDir, files.interface), "utf8")) : {};
  const tagsDoc = files.tags ? parseYaml(readFileSync(join(packDir, files.tags), "utf8")) : {};
  const tasksDoc = files.tasks ? parseYaml(readFileSync(join(packDir, files.tasks), "utf8")) : {};
  const levelsDoc = files.levels ? parseYaml(readFileSync(join(packDir, files.levels), "utf8")) : {};
  const enemiesDoc = files.enemies ? parseYaml(readFileSync(join(packDir, files.enemies), "utf8")) : {};
  const storyDoc = files.story ? parseYaml(readFileSync(join(packDir, files.story), "utf8")) : undefined;
  const labyrinthsDoc = files.labyrinths ? parseYaml(readFileSync(join(packDir, files.labyrinths), "utf8")) : {};
  const items = parseJsonl(readFileSync(join(packDir, files.words || "dictionary/words.jsonl"), "utf8")).map((item) => normalizeItem(item, sourceLanguage));
  const letters = parseJsonl(readOptional(join(packDir, files.letters || "dictionary/letters.jsonl"))).map((item) => normalizeLetter(item, sourceLanguage));
  const grammarItems = parseJsonl(readOptional(join(packDir, files.sentences || "dictionary/sentences.jsonl"))).map((item) => normalizeGrammar(item, sourceLanguage));
  const mathProblems = parseJsonl(readOptional(join(packDir, files.math_problems || "curriculum/math-problems.jsonl"))).map(normalizeMathProblem);
  const readingProblems = parseJsonl(readOptional(join(packDir, files.reading_problems || "curriculum/reading-problems.jsonl"))).map(normalizeReadingProblem);
  const foundationsInstructions = parseJsonl(readOptional(join(packDir, files.instructions || "curriculum/instructions.jsonl"))).map(normalizeFoundationsInstruction);
  return {
    pack_id: meta.pack_id,
    version: meta.version,
    subject: meta.subject || "language",
    title: meta.title,
    description: meta.description || "",
    language: meta.language || {},
    source_language: sourceLanguage,
    base_language: meta.base_language,
    base_languages: meta.base_language ? [meta.base_language] : [{ code: sourceLanguage, name_native: sourceLanguage, name_english: sourceLanguage, is_default: true }],
    target_language: meta.target_language || meta.language?.bcp47 || "",
    age_band: meta.age_band || "children",
    capabilities: meta.capabilities || {},
    lessons: createLessonsFromItems(items, letters, grammarItems),
    items,
    letters,
    grammar_items: grammarItems,
    math_problems: mathProblems,
    reading_problems: readingProblems,
    foundations_instructions: foundationsInstructions,
    story: storyDoc,
    ui_text: uiDoc.text || {},
    controlled_tags: tagsDoc.controlled_tags || [],
    task_config: {
      questions_per_training: Number(tasksDoc.questions_per_training || 10),
      timer_seconds: Number(tasksDoc.timer_seconds || 10),
      training_completion: tasksDoc.training_completion || { max_mistakes: Number(tasksDoc.max_mistakes_for_training_completion || 3) },
      max_mistakes_for_training_completion: Number(tasksDoc.training_completion?.max_mistakes ?? tasksDoc.max_mistakes_for_training_completion ?? 3)
    },
    training_options: tasksDoc.training_options || [],
    levels: levelsDoc.levels || [],
    enemies: enemiesDoc.enemies || [],
    labyrinths: labyrinthsDoc.labyrinths || [],
    files,
    review_status: meta.review_status || "draft",
    license: meta.license || "unknown"
  };
}

export function parseJsonl(text) {
  return String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line, index) => {
    try { return JSON.parse(line); }
    catch (error) { throw new Error(`Invalid JSONL at line ${index + 1}: ${error.message}`); }
  });
}

export function writeJsonl(entries) {
  return entries.map((entry) => JSON.stringify(entry)).join("\n") + "\n";
}

export function parseYaml(text) {
  const lines = String(text || "").replace(/\t/g, "  ").split(/\r?\n/).map((raw) => {
    const stripped = stripComment(raw);
    return stripped.trim().length === 0 ? null : { indent: stripped.match(/^ */)?.[0].length || 0, text: stripped.trimEnd() };
  }).filter(Boolean);
  if (lines.length === 0) return {};
  return parseBlock(lines, 0, lines[0].indent)[0];
}

function parseBlock(lines, start, indent) {
  const first = lines[start];
  if (!first || first.indent < indent) return [{}, start];
  if (first.text.trimStart().startsWith("- ")) return parseArray(lines, start, indent);
  return parseObject(lines, start, indent);
}

// Parse nested content at the indentation actually used by its first line.
function parseNestedBlock(lines, start, parentIndent) {
  const next = lines[start];
  if (!next || next.indent <= parentIndent) return [{}, start];
  return parseBlock(lines, start, next.indent);
}

function parseArray(lines, start, indent) {
  const result = [];
  let index = start;
  while (index < lines.length) {
    const line = lines[index];
    if (line.indent !== indent || !line.text.trimStart().startsWith("- ")) break;
    const rest = line.text.trimStart().slice(2).trim();
    if (!rest) {
      const [child, next] = parseNestedBlock(lines, index + 1, indent);
      result.push(child);
      index = next;
      continue;
    }
    const kv = splitKeyValue(rest);
    if (kv) {
      const item = {};
      const [key, valueText] = kv;
      if (valueText === "") {
        const [child, next] = parseNestedBlock(lines, index + 1, indent + 2);
        item[key] = child;
        index = next;
      } else {
        item[key] = scalar(valueText);
        index += 1;
      }
      while (index < lines.length && lines[index].indent === indent + 2 && !lines[index].text.trimStart().startsWith("- ")) {
        const childKv = splitKeyValue(lines[index].text.trim());
        if (!childKv) break;
        const [childKey, childValueText] = childKv;
        if (childValueText === "") {
          const [childValue, next] = parseNestedBlock(lines, index + 1, indent + 2);
          item[childKey] = childValue;
          index = next;
        } else {
          item[childKey] = scalar(childValueText);
          index += 1;
        }
      }
      result.push(item);
      continue;
    }
    result.push(scalar(rest));
    index += 1;
  }
  return [result, index];
}

function parseObject(lines, start, indent) {
  const result = {};
  let index = start;
  while (index < lines.length) {
    const line = lines[index];
    if (line.indent !== indent || line.text.trimStart().startsWith("- ")) break;
    const kv = splitKeyValue(line.text.trim());
    if (!kv) break;
    const [key, valueText] = kv;
    if (valueText === "") {
      const [child, next] = parseNestedBlock(lines, index + 1, indent);
      result[key] = child;
      index = next;
    } else {
      result[key] = scalar(valueText);
      index += 1;
    }
  }
  return [result, index];
}

function splitKeyValue(text) {
  const match = text.match(/^([A-Za-z0-9_\-]+):(?:\s*(.*))?$/);
  return match ? [match[1], match[2] || ""] : null;
}

function scalar(text) {
  const trimmed = String(text).trim();
  if (trimmed === "[]") return [];
  if (trimmed === "{}") return {};
  if (trimmed === "null") return null;
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    try { return JSON.parse(trimmed); } catch { return trimmed.slice(1, -1); }
  }
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try { return JSON.parse(trimmed); } catch { return trimmed; }
  }
  return trimmed;
}

function stripComment(raw) {
  let quoted = false; let quote = "";
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if ((char === '"' || char === "'") && raw[index - 1] !== "\\") {
      if (!quoted) { quoted = true; quote = char; }
      else if (quote === char) { quoted = false; quote = ""; }
    }
    if (char === "#" && !quoted) return raw.slice(0, index);
  }
  return raw;
}

function readOptional(path) {
  try { return readFileSync(path, "utf8"); } catch { return ""; }
}

function normalizeItem(item, sourceLanguage) {
  return { ...item, translations: { ...(item.translations || {}), [sourceLanguage]: item.translation }, difficulty: item.difficulty === undefined ? undefined : Number(item.difficulty), complexity: item.complexity === undefined ? undefined : Number(item.complexity), tags: Array.isArray(item.tags) ? item.tags : [], audio: Array.isArray(item.audio) ? item.audio : [], review_status: item.review_status || "draft" };
}

function normalizeLetter(letter, sourceLanguage) {
  return { ...letter, names: { ...(letter.names || {}), [sourceLanguage]: letter.names?.[sourceLanguage] || letter.sound }, audio: Array.isArray(letter.audio) ? letter.audio : [], similar_letter_ids: Array.isArray(letter.similar_letter_ids) ? letter.similar_letter_ids : [], review_status: letter.review_status || "draft" };
}

function normalizeMathProblem(problem) {
  return { ...problem, operands: Array.isArray(problem.operands) ? problem.operands.map(Number) : undefined, result: Number(problem.result), options: Array.isArray(problem.options) ? problem.options.map(String) : undefined, sequence: Array.isArray(problem.sequence) ? problem.sequence.map(String) : undefined, audio: Array.isArray(problem.audio) ? problem.audio : [], tags: Array.isArray(problem.tags) ? problem.tags : [], review_status: problem.review_status || "draft" };
}

function normalizeReadingProblem(problem) {
  return { ...problem, options: Array.isArray(problem.options) ? problem.options.map(String) : undefined, words: Array.isArray(problem.words) ? problem.words.map(String) : undefined, audio: Array.isArray(problem.audio) ? problem.audio : [], prompt_audio: Array.isArray(problem.prompt_audio) ? problem.prompt_audio : [], tags: Array.isArray(problem.tags) ? problem.tags : [], review_status: problem.review_status || "draft" };
}

function normalizeFoundationsInstruction(instruction) {
  return { ...instruction, text: instruction.text || {}, audio: Array.isArray(instruction.audio) ? instruction.audio : [], tags: Array.isArray(instruction.tags) ? instruction.tags : [], review_status: instruction.review_status || "draft" };
}

function normalizeGrammar(grammar, sourceLanguage) {
  return { ...grammar, translations: { ...(grammar.translations || {}), [sourceLanguage]: grammar.translation }, prompt: { ...(grammar.prompt || {}), [sourceLanguage]: grammar.prompt?.[sourceLanguage] || grammar.translation }, distractors: Array.isArray(grammar.distractors) ? grammar.distractors : [], difficulty: grammar.difficulty === undefined ? undefined : Number(grammar.difficulty), complexity: grammar.complexity === undefined ? undefined : Number(grammar.complexity), tags: Array.isArray(grammar.tags) ? grammar.tags : [], audio: Array.isArray(grammar.audio) ? grammar.audio : [], review_status: grammar.review_status || "draft" };
}

function createLessonsFromItems(items, letters, grammarItems) {
  const groups = new Map();
  for (const item of items) {
    const tag = item.tags?.[0] || "starter";
    groups.set(tag, [...(groups.get(tag) || []), item.id]);
  }
  const result = [...groups.entries()].map(([tag, ids], index) => ({ id: `lesson_${String(index + 1).padStart(2, "0")}_${tag}`, title: tag.replaceAll("_", " "), item_ids: ids, letter_ids: index === 0 ? letters.map((letter) => letter.id) : [], grammar_ids: grammarItems.filter((grammar) => grammar.tags?.includes(tag)).map((grammar) => grammar.id), activity_types: ["select_translation", "listen_and_choose", "repeat_after_me", "letter_recognition", "sentence_order"] }));
  return result.length ? result : [{ id: "lesson_01_starter", title: "Starter", item_ids: items.map((item) => item.id), letter_ids: letters.map((letter) => letter.id), grammar_ids: grammarItems.map((grammar) => grammar.id), activity_types: ["select_translation"] }];
}
