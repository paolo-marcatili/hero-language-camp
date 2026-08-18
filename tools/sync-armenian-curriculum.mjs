#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseYaml } from "./pack-utils.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PACK = join(ROOT, "content-packs", "hy-eastern-it");
const MODULE_DIR = join(PACK, "curriculum");
const CHECK = process.argv.includes("--check");
const GENERATED_PREFIX = "GENERATED CURRICULUM V2";

function normalizeNewlines(text) {
  return String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}
function readText(path) {
  const raw = readFileSync(path);
  return { text: normalizeNewlines(raw.toString("utf8")), newline: raw.includes(13) ? "\r\n" : "\n" };
}
function encode(text, newline) {
  const normalized = normalizeNewlines(text);
  return Buffer.from(newline === "\r\n" ? normalized.replace(/\n/g, "\r\n") : normalized, "utf8");
}
function writeExpected(path, text, newline) {
  const expected = encode(text.endsWith("\n") ? text : `${text}\n`, newline);
  if (CHECK) {
    if (!existsSync(path) || !readFileSync(path).equals(expected)) {
      throw new Error(`Curriculum source is out of sync: ${path.slice(ROOT.length + 1)}`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, expected);
}
function normalize(value) {
  return String(value ?? "").normalize("NFKC").trim().toLocaleLowerCase("en").replace(/[\s\p{P}\p{S}]+/gu, " ");
}
function yamlScalar(value) {
  if (value === null) return "null";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (value === "") return "''";
  return JSON.stringify(String(value));
}
function isEmptyCollection(value) {
  return (Array.isArray(value) && value.length === 0)
    || (value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0);
}
function inlineCollection(value) { return Array.isArray(value) ? "[]" : "{}"; }
function toYaml(value, indent = 0) {
  const pad = " ".repeat(indent);
  if (Array.isArray(value)) {
    if (!value.length) return `${pad}[]\n`;
    return value.map((item) => {
      if (!item || typeof item !== "object") return `${pad}- ${yamlScalar(item)}\n`;
      if (Array.isArray(item)) return item.length ? `${pad}-\n${toYaml(item, indent + 2)}` : `${pad}- []\n`;
      const entries = Object.entries(item);
      if (!entries.length) return `${pad}- {}\n`;
      const [[firstKey, firstValue], ...rest] = entries;
      let out = "";
      if (firstValue && typeof firstValue === "object") {
        out += isEmptyCollection(firstValue)
          ? `${pad}- ${firstKey}: ${inlineCollection(firstValue)}\n`
          : `${pad}- ${firstKey}:\n${toYaml(firstValue, indent + 4)}`;
      } else out += `${pad}- ${firstKey}: ${yamlScalar(firstValue)}\n`;
      for (const [key, child] of rest) {
        if (child && typeof child === "object") {
          out += isEmptyCollection(child)
            ? `${" ".repeat(indent + 2)}${key}: ${inlineCollection(child)}\n`
            : `${" ".repeat(indent + 2)}${key}:\n${toYaml(child, indent + 4)}`;
        } else out += `${" ".repeat(indent + 2)}${key}: ${yamlScalar(child)}\n`;
      }
      return out;
    }).join("");
  }
  if (value && typeof value === "object") {
    return Object.entries(value).map(([key, item]) => {
      if (item && typeof item === "object") {
        return isEmptyCollection(item)
          ? `${pad}${key}: ${inlineCollection(item)}\n`
          : `${pad}${key}:\n${toYaml(item, indent + 2)}`;
      }
      return `${pad}${key}: ${yamlScalar(item)}\n`;
    }).join("");
  }
  return `${pad}${yamlScalar(value)}\n`;
}
function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function stripGeneratedBlock(text, name, indent = "") {
  const begin = `${indent}# BEGIN ${GENERATED_PREFIX}: ${name}`;
  const end = `${indent}# END ${GENERATED_PREFIX}: ${name}`;
  const pattern = new RegExp(`(?:^|\\n)${escapeRegex(begin)}\\n[\\s\\S]*?\\n${escapeRegex(end)}(?=\\n|$)`, "g");
  return text.replace(pattern, "").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
function withGeneratedBlock(text, name, content, indent = "") {
  const base = stripGeneratedBlock(text, name, indent).trimEnd();
  const begin = `${indent}# BEGIN ${GENERATED_PREFIX}: ${name}`;
  const end = `${indent}# END ${GENERATED_PREFIX}: ${name}`;
  return `${base}\n\n${begin}\n${content.trimEnd()}\n${end}\n`;
}
function loadModules() {
  if (!existsSync(MODULE_DIR)) throw new Error(`Missing curriculum module directory: ${MODULE_DIR}`);
  const files = readdirSync(MODULE_DIR).filter((name) => /^levels-\d+-\d+\.json$/.test(name)).sort();
  if (!files.length) throw new Error("No curriculum modules found.");
  const modules = files.map((name) => {
    const module = JSON.parse(readFileSync(join(MODULE_DIR, name), "utf8"));
    if (!module.module_id || !Array.isArray(module.levels)) throw new Error(`Invalid curriculum module: ${name}`);
    return { name, ...module };
  });
  const seenLevels = new Set();
  const seenChapterIds = new Set();
  const seenEnemyIds = new Set();
  for (const module of modules) {
    for (const level of module.levels ?? []) {
      const number = Number(level.number);
      if (!Number.isInteger(number) || number < 0) throw new Error(`${module.name}: invalid level number`);
      if (seenLevels.has(number)) throw new Error(`Curriculum level ${number} is defined more than once.`);
      seenLevels.add(number);
    }
    for (const chapter of module.chapters ?? []) {
      if (seenChapterIds.has(chapter.id)) throw new Error(`Story chapter ${chapter.id} is defined more than once.`);
      seenChapterIds.add(chapter.id);
    }
    for (const enemy of module.enemies ?? []) {
      if (seenEnemyIds.has(enemy.id)) throw new Error(`Enemy ${enemy.id} is defined more than once.`);
      seenEnemyIds.add(enemy.id);
    }
  }
  return modules;
}
function combine(modules, key) {
  return modules.flatMap((module) => Array.isArray(module[key]) ? module[key] : []);
}
function ensureNoYamlConflicts(path, rootKey, generatedName, managedValues, valueKey) {
  const { text } = readText(path);
  const base = stripGeneratedBlock(text, generatedName, rootKey === "text" ? "  " : "");
  const doc = parseYaml(base);
  const rows = Array.isArray(doc[rootKey]) ? doc[rootKey] : [];
  const existing = new Set(rows.map((row) => String(row?.[valueKey])));
  for (const value of managedValues) {
    if (existing.has(String(value))) throw new Error(`${path.slice(ROOT.length + 1)} already contains managed ${valueKey} ${value} outside the generated block.`);
  }
}
function updateYamlList(path, rootKey, generatedName, rows) {
  ensureNoYamlConflicts(path, rootKey, generatedName, rows.map((row) => row[rootKey === "levels" ? "number" : "id"]), rootKey === "levels" ? "number" : "id");
  const { text, newline } = readText(path);
  writeExpected(path, withGeneratedBlock(text, generatedName, toYaml(rows, 2)), newline);
}
function updateInterface(path, names) {
  const { text, newline } = readText(path);
  const base = stripGeneratedBlock(text, "interface-enemy-names", "  ");
  const parsed = parseYaml(base);
  const existing = parsed?.text ?? {};
  for (const key of Object.keys(names)) {
    if (Object.prototype.hasOwnProperty.call(existing, key)) throw new Error(`${path.slice(ROOT.length + 1)} already contains managed UI key ${key} outside the generated block.`);
  }
  writeExpected(path, withGeneratedBlock(text, "interface-enemy-names", toYaml(names, 2), "  "), newline);
}
function updateTags(path, modules) {
  const ids = new Set(["curriculum:v2"]);
  for (const module of modules) {
    for (const level of module.levels ?? []) {
      ids.add(`stage:${level.number}`);
      for (const tag of level.content_tags ?? []) ids.add(String(tag));
    }
    for (const row of [...(module.words ?? []), ...(module.sentences ?? [])]) {
      for (const tag of row.tags ?? []) ids.add(String(tag));
    }
    for (const enemy of module.enemies ?? []) {
      for (const tag of enemy.semantic_tags ?? []) ids.add(String(tag));
    }
  }
  const additions = [...ids].sort((left, right) => left.localeCompare(right)).map((id) => {
    const suffix = id.includes(":") ? id.slice(id.indexOf(":") + 1) : id;
    const label = id.startsWith("stage:")
      ? suffix
      : suffix.replace(/[-_]+/g, " ");
    return {
      id,
      label,
      description: id === "curriculum:v2"
        ? "Contenuto curato per il curriculum v2"
        : `Tag controllato del curriculum: ${id}`,
    };
  });
  const { text, newline } = readText(path);
  const base = stripGeneratedBlock(text, "controlled-tags", "  ");
  const doc = parseYaml(base);
  const existing = new Set((doc.controlled_tags ?? []).map((tag) => String(tag.id)));
  const missing = additions.filter((tag) => !existing.has(tag.id));
  const output = missing.length
    ? withGeneratedBlock(text, "controlled-tags", toYaml(missing, 2), "  ")
    : stripGeneratedBlock(text, "controlled-tags", "  ");
  writeExpected(path, output, newline);
}
function parseJsonlWithRaw(path) {
  const { text, newline } = readText(path);
  const lines = text.split("\n").filter((line) => line.trim().length > 0);
  return { newline, rows: lines.map((raw, index) => ({ raw, value: JSON.parse(raw), index })) };
}
function stageOf(tags) {
  const stage = (Array.isArray(tags) ? tags : []).find((tag) => /^stage:\d+$/.test(String(tag)));
  return stage ? Number(String(stage).slice(6)) : null;
}
function isEarlierCore(row, wantedStage) {
  const tags = Array.isArray(row?.tags) ? row.tags.map(String) : [];
  const stage = stageOf(tags);
  return tags.includes("tier:core") && stage !== null && stage !== wantedStage;
}
function mergeTags(existing, wanted) {
  const preserved = (Array.isArray(existing) ? existing : []).map(String).filter((tag) => !/^stage:\d+$/.test(tag) && !/^tier:/.test(tag) && !/^curriculum:/.test(tag));
  return [...new Set([...wanted.map(String), ...preserved])];
}
function chooseCandidate(entries, definition, targetKey) {
  const byId = entries.find((entry) => entry.value.id === definition.id);
  if (byId) {
    const sameTarget = normalize(byId.value[targetKey]) === normalize(definition[targetKey]);
    const managed = (byId.value.tags ?? []).includes("curriculum:v2")
      || String(byId.value.source ?? "").startsWith("curriculum-v2");
    if (!sameTarget && !managed) throw new Error(`ID ${definition.id} belongs to a different ${targetKey}.`);
    return byId;
  }
  const matches = entries.filter((entry) => normalize(entry.value[targetKey]) === normalize(definition[targetKey]));
  return matches.sort((a, b) => {
    const score = (entry) => {
      const tags = Array.isArray(entry.value.tags) ? entry.value.tags.map(String) : [];
      if (tags.includes("tier:extension")) return 0;
      if (stageOf(tags) === null) return 1;
      return 2;
    };
    return score(a) - score(b) || a.index - b.index;
  })[0];
}
function mergeWord(existing, definition, moduleId) {
  const wantedStage = stageOf(definition.tags);
  const earlierCore = existing && isEarlierCore(existing, wantedStage);
  const translations = { ...(existing?.translations ?? {}), ...definition.translations };
  if (earlierCore) {
    return {
      ...existing,
      concept: existing.concept ?? definition.concept,
      translation: existing.translation ?? definition.translations.it,
      translations,
      translation_review_status: { ...(existing.translation_review_status ?? {}), it: "reviewed", en: "reviewed" },
    };
  }
  return {
    ...(existing ?? {}),
    ...definition,
    id: existing?.id ?? definition.id,
    audio: Array.isArray(existing?.audio) ? existing.audio : Array.isArray(definition.audio) ? definition.audio : [],
    tags: mergeTags(existing?.tags, definition.tags),
    translation: definition.translations.it,
    base_language: "it",
    meanings: [...new Set([definition.translations.it, ...(existing?.meanings ?? [])])],
    transliterations: [...new Set([definition.transliteration, ...(existing?.transliterations ?? [])].filter(Boolean))],
    translations,
    translation_review_status: { ...(existing?.translation_review_status ?? {}), it: "reviewed", en: "reviewed" },
    review_status: existing?.review_status ?? "needs_native_speaker_review",
    source: existing?.source ?? "curriculum-v2-curated",
    source_location: existing?.source_location ?? `curriculum/${moduleId}.json#words/${definition.id}`,
  };
}
function mergeSentence(existing, definition, moduleId) {
  const wantedStage = stageOf(definition.tags);
  if (existing && isEarlierCore(existing, wantedStage)) {
    return {
      ...existing,
      translations: { ...(existing.translations ?? {}), ...definition.translations },
      translation_review_status: { ...(existing.translation_review_status ?? {}), it: "reviewed", en: "reviewed" },
    };
  }
  return {
    ...(existing ?? {}),
    ...definition,
    id: existing?.id ?? definition.id,
    tags: mergeTags(existing?.tags, definition.tags),
    prompt: definition.prompt,
    translation: definition.translations.it,
    base_language: "it",
    translations: { ...(existing?.translations ?? {}), ...definition.translations },
    translation_review_status: { ...(existing?.translation_review_status ?? {}), it: "reviewed", en: "reviewed" },
    review_status: existing?.review_status ?? "needs_native_speaker_review",
    source: existing?.source ?? "curriculum-v2-curated",
    source_location: existing?.source_location ?? `curriculum/${moduleId}.json#sentences/${definition.id}`,
  };
}
function upsertJsonl(path, modules, key, targetKey, merge) {
  const { rows, newline } = parseJsonlWithRaw(path);
  const definitions = modules.flatMap((module) => (module[key] ?? []).map((definition) => ({ definition, moduleId: module.module_id })));
  const managedIndexes = new Set();
  for (const { definition, moduleId } of definitions) {
    const candidate = chooseCandidate(rows, definition, targetKey);
    if (candidate) {
      candidate.value = merge(candidate.value, definition, moduleId);
      candidate.raw = JSON.stringify(candidate.value);
      managedIndexes.add(candidate.index);
    } else {
      const value = merge(null, definition, moduleId);
      const entry = { value, raw: JSON.stringify(value), index: rows.length };
      rows.push(entry);
      managedIndexes.add(entry.index);
    }
  }
  if (key === "words") {
    const exactByStage = new Map();
    for (const entry of rows) {
      const tags = Array.isArray(entry.value.tags) ? entry.value.tags.map(String) : [];
      if (!tags.includes("tier:core") || !tags.includes("curriculum:v2")) continue;
      const stage = stageOf(tags);
      if (stage === null) continue;
      if (!exactByStage.has(stage)) exactByStage.set(stage, []);
      exactByStage.get(stage).push(entry);
    }
    for (const entries of exactByStage.values()) {
      for (const entry of entries) {
        const own = normalize(entry.value.translations?.it ?? entry.value.translation);
        const alternatives = entries.filter((other) => other !== entry && normalize(other.value.translations?.it ?? other.value.translation) !== own).map((other) => other.value.id).slice(0, 3);
        if (alternatives.length >= 2) {
          entry.value.hard_distractor_ids = alternatives;
          entry.raw = JSON.stringify(entry.value);
        }
      }
    }
  }
  writeExpected(path, rows.map((entry) => entry.raw).join("\n") + "\n", newline);
}

const modules = loadModules();
const levels = combine(modules, "levels").sort((a, b) => a.number - b.number);
const chapters = combine(modules, "chapters").sort((a, b) => a.minimum_level - b.minimum_level);
const enemies = combine(modules, "enemies").sort((a, b) => a.level - b.level);
const enemyNamesIt = Object.assign({}, ...modules.map((module) => module.enemy_names?.it ?? {}));

updateYamlList(join(PACK, "levels.yaml"), "levels", "levels", levels);
updateYamlList(join(PACK, "story.yaml"), "chapters", "story-chapters", chapters);
updateYamlList(join(PACK, "enemies.yaml"), "enemies", "enemies", enemies);
updateInterface(join(PACK, "interface.yaml"), enemyNamesIt);
updateTags(join(PACK, "tags.yaml"), modules);
upsertJsonl(join(PACK, "dictionary", "words.jsonl"), modules, "words", "target", mergeWord);
upsertJsonl(join(PACK, "dictionary", "sentences.jsonl"), modules, "sentences", "target_sentence", mergeSentence);

console.log(`${CHECK ? "Checked" : "Synchronized"} Armenian curriculum modules: ${levels.length} levels, ${combine(modules, "words").length} vocabulary definitions, ${combine(modules, "sentences").length} sentence definitions, ${chapters.length} chapters, ${enemies.length} exact enemies.`);
