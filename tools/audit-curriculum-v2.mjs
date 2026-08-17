#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseYaml } from "./pack-utils.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PACK = join(ROOT, "content-packs", "hy-eastern-it");
const levelsDoc = parseYaml(readFileSync(join(PACK, "levels.yaml"), "utf8"));
const enemiesDoc = parseYaml(readFileSync(join(PACK, "enemies.yaml"), "utf8"));
const parseJsonl = (path) => readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
const collections = [
  ["words", parseJsonl(join(PACK, "dictionary", "words.jsonl"))],
  ["letters", parseJsonl(join(PACK, "dictionary", "letters.jsonl"))],
  ["sentences", parseJsonl(join(PACK, "dictionary", "sentences.jsonl"))]
];
const issues = [];
const levels = Array.isArray(levelsDoc.levels) ? levelsDoc.levels : [];
const levelNumbers = new Set(levels.map((level) => Number(level.number)));
const progression = levelsDoc.progression ?? {};
if (progression.stat_cap_start !== 5) issues.push("progression.stat_cap_start must be 5");
if (progression.stat_cap_per_level !== 5) issues.push("progression.stat_cap_per_level must be 5");
if (progression.unauthored_level_mode !== "review") issues.push("progression.unauthored_level_mode must be review");
for (const level of levels) {
  const expected = 5 + Number(level.number) * 5;
  if (Number(level.stat_cap) !== expected) issues.push(`level ${level.number} stat_cap ${level.stat_cap} must be ${expected}`);
}
const countByStage = new Map();
for (const [name, rows] of collections) {
  for (const row of rows) {
    const tags = Array.isArray(row.tags) ? row.tags.map(String) : [];
    if (!tags.includes("tier:core")) continue;
    const stageTag = tags.find((tag) => /^stage:\d+$/.test(tag));
    if (!stageTag) { issues.push(`${name}:${row.id} is tier:core without stage:N`); continue; }
    const stage = Number(stageTag.slice(6));
    if (!levelNumbers.has(stage)) issues.push(`${name}:${row.id} references unauthored stage ${stage}`);
    countByStage.set(stage, (countByStage.get(stage) ?? 0) + 1);
  }
}
for (const level of levels) {
  if (level.review_only !== true && !(countByStage.get(Number(level.number)) > 0)) issues.push(`level ${level.number} has no core content and is not review_only`);
}
const enemies = Array.isArray(enemiesDoc.enemies) ? enemiesDoc.enemies : [];
const fallback = enemiesDoc.fallback ?? {};
if (!fallback.enemy_id || !enemies.some((enemy) => enemy.id === fallback.enemy_id)) issues.push("enemy fallback must reference an authored enemy");
for (const key of ["energy_growth_per_level", "reward_growth_per_level", "scale_growth_per_level"]) {
  if (!(Number(fallback[key]) >= 0)) issues.push(`enemy fallback ${key} must be non-negative`);
}
if (!(Number(fallback.max_scale) > 0)) issues.push("enemy fallback max_scale must be positive");
const learning = readFileSync(join(ROOT, "packages", "learning-engine", "src", "index.ts"), "utf8");
const game = readFileSync(join(ROOT, "apps", "web", "src", "gameConfig.ts"), "utf8");
const progress = readFileSync(join(ROOT, "apps", "web", "src", "components", "ParentProgressPanel.tsx"), "utf8");
for (const marker of ["getExactLevelConfig", "applyHeroDamageModifiers", "Hero levels are deliberately open-ended"]) if (!learning.includes(marker)) issues.push(`learning engine marker missing: ${marker}`);
for (const marker of ["pack.enemy_fallback", "applyHeroDamageModifiers(base, weaknessMultiplier * timingMultiplier, 1.5)"]) if (!game.includes(marker)) issues.push(`game config marker missing: ${marker}`);
for (const marker of ["isCurriculumIntroduced", 'tags.includes("tier:extension")', "stage === undefined"]) if (!progress.includes(marker)) issues.push(`progress dashboard marker missing: ${marker}`);
if (issues.length) {
  console.error(`Curriculum v2 audit failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}
const coreCount = [...countByStage.values()].reduce((sum, value) => sum + value, 0);
console.log(`Curriculum v2 audit passed: ${levels.length} authored levels, ${coreCount} explicitly staged core records, fallback enemy ${fallback.enemy_id}.`);
