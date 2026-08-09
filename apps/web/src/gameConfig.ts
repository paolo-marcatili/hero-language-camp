import type { LanguagePack, PackEnemy, PackLevel, PackTrainingOption, StoryChapter } from "@hero-lang/content-schema";
import type { CombatBreakdown, HeroStatKey, HeroStats, ShopItem, TrainingFocus } from "@hero-lang/learning-engine";
import { estimateHeroDamage, getLevelConfig, getLevelStatCap, getLevelTrainingSessions } from "@hero-lang/learning-engine";

export type AppMode = "home" | "training" | "fight";

export type HeroActionName =
  | "walk"
  | "run"
  | "jump"
  | "sword"
  | "move_forward"
  | "stumble"
  | "fall"
  | "hero_hit"
  | "enemy_hit"
  | "super_punch"
  | "fart_attack"
  | "self_punch"
  | "parry"
  | "dagger_throw"
  | "strategy_spell"
  | "monster_defeat"
  | "victory"
  | "training_dummy"
  | "shield_block"
  | "rune_focus"
  | "echo_crystal"
  | "lift_rock"
  | "target_throw"
  | "puzzle_think"
  | "letter_trace";

export interface HeroActionEvent {
  name: HeroActionName;
  serial: number;
}

export interface TrainingOption {
  focus: TrainingFocus;
  titleKey: string;
  shortKey: string;
  bodyKey: string;
  stat: HeroStatKey;
  icon: string;
  encounter: "training_dummy" | "shield_drill" | "rune_gate" | "echo_crystal" | "stone_lift" | "target_throw" | "puzzle_gate" | "letter_gate";
  encounterLabelKey: string;
  stoneId: string;
  stoneLabelKey: string;
  stoneColor: string;
  stoneIcon: string;
}

export interface ShopUiItem extends ShopItem {
  nameKey: string;
  descriptionKey: string;
  icon: string;
  unlockLevel: number;
  category: "weapon" | "skin" | "boots" | "pet" | "magic";
  requiredStats?: Partial<HeroStats>;
}

export interface EnemyConfig {
  id: string;
  level: number;
  nameKey: string;
  maxEnergy: number;
  rewardCoins: number;
  preferredFocus: TrainingFocus;
  sprite: string;
  spriteRow: number;
  visualVariant?: string;
  scale: number;
  tint?: number;
  requiredStats: Partial<HeroStats>;
  tags: string[];
  skillWeaknesses: HeroStatKey[];
}

export interface FightGateRequirement {
  id: string;
  labelKey: string;
  labelVars?: Record<string, string | number>;
  current: number;
  required: number;
  ok: boolean;
}

export interface FightGateResult {
  ok: boolean;
  level: PackLevel | undefined;
  requirements: FightGateRequirement[];
}

export interface StoryChapterProgress {
  unlockedChapters: StoryChapter[];
  currentChapter?: StoryChapter;
}

/**
 * A chapter explicitly linked from levels.yaml unlocks at that level. The
 * chapter's minimum_level remains the fallback for optional/unmapped chapters.
 */
export function getStoryChapterUnlockLevel(pack: LanguagePack, chapter: StoryChapter): number {
  const mappedLevel = (pack.levels ?? []).find((level) => level.chapter_id === chapter.id);
  return mappedLevel?.number ?? chapter.minimum_level ?? 0;
}

/** Keep Story and Study Book on one level-to-chapter progression rule. */
export function getStoryChapterProgress(pack: LanguagePack, learnerLevel: number): StoryChapterProgress {
  const chapters = pack.story?.chapters ?? [];
  if (chapters.length === 0) return { unlockedChapters: [] };

  const level = Math.max(0, Math.floor(learnerLevel));
  const sourceOrder = new Map(chapters.map((chapter, index) => [chapter.id, index]));
  const unlockedChapters = chapters
    .filter((chapter) => getStoryChapterUnlockLevel(pack, chapter) <= level)
    .slice()
    .sort((left, right) => {
      const unlockDifference = getStoryChapterUnlockLevel(pack, left) - getStoryChapterUnlockLevel(pack, right);
      if (unlockDifference !== 0) return unlockDifference;
      return (sourceOrder.get(left.id) ?? 0) - (sourceOrder.get(right.id) ?? 0);
    });

  const currentLevel = getLevelConfig(pack, level);
  const mappedCurrentChapter = currentLevel?.chapter_id
    ? chapters.find((chapter) => chapter.id === currentLevel.chapter_id)
    : undefined;
  const currentChapter = mappedCurrentChapter && getStoryChapterUnlockLevel(pack, mappedCurrentChapter) <= level
    ? mappedCurrentChapter
    : unlockedChapters[unlockedChapters.length - 1];

  return { unlockedChapters, currentChapter };
}

export const DEFAULT_QUESTIONS_PER_TRAINING = 10;
export const DEFAULT_FIGHT_TIMER_SECONDS = 10;
export const DEFAULT_MAX_MISTAKES_FOR_TRAINING_COMPLETION = 3;
export const MIN_FIGHT_QUESTIONS = 10;

const FALLBACK_TRAINING_OPTIONS: TrainingOption[] = [
  { focus: "vocabulary", titleKey: "vocabularyTitle", shortKey: "vocabularyShort", bodyKey: "vocabularyBody", stat: "strength", icon: "🥊", encounter: "training_dummy", encounterLabelKey: "vocabularyChallenge", stoneId: "word-stone", stoneLabelKey: "wordStone", stoneColor: "red", stoneIcon: "🔺" },
  { focus: "comprehension", titleKey: "comprehensionTitle", shortKey: "comprehensionShort", bodyKey: "comprehensionBody", stat: "defense", icon: "🛡️", encounter: "shield_drill", encounterLabelKey: "shieldChallenge", stoneId: "echo-stone", stoneLabelKey: "echoStone", stoneColor: "blue", stoneIcon: "🔷" },
  { focus: "grammar", titleKey: "grammarTitle", shortKey: "grammarShort", bodyKey: "grammarBody", stat: "precision", icon: "🎯", encounter: "rune_gate", encounterLabelKey: "runeChallenge", stoneId: "rune-stone", stoneLabelKey: "runeStone", stoneColor: "gold", stoneIcon: "🟨" },
  { focus: "pronunciation", titleKey: "pronunciationTitle", shortKey: "pronunciationShort", bodyKey: "pronunciationBody", stat: "stamina", icon: "💎", encounter: "echo_crystal", encounterLabelKey: "echoChallenge", stoneId: "crystal-stone", stoneLabelKey: "crystalStone", stoneColor: "green", stoneIcon: "💚" }
];

export const LANDING_ACTIONS: Array<{ name: HeroActionName; labelKey: string }> = [
  { name: "jump", labelKey: "jump" },
  { name: "sword", labelKey: "sword" },
  { name: "super_punch", labelKey: "superPunch" },
  { name: "fart_attack", labelKey: "fartAttack" }
];

export const SHOP_ITEMS: ShopUiItem[] = [
  { id: "wooden_sword", price: 70, unlockLevel: 1, category: "weapon", icon: "🗡️", nameKey: "woodenSword", descriptionKey: "woodenSwordDesc", stat_bonus: { strength: 1 }, requiredStats: { strength: 2 } },
  { id: "runner_boots", price: 75, unlockLevel: 1, category: "boots", icon: "🥾", nameKey: "runnerBoots", descriptionKey: "runnerBootsDesc", stat_bonus: { stamina: 1 }, requiredStats: { stamina: 2 } },
  { id: "blue_cape", price: 70, unlockLevel: 1, category: "skin", icon: "🧣", nameKey: "blueCape", descriptionKey: "blueCapeDesc", stat_bonus: { defense: 1 }, requiredStats: { defense: 2 } },
  { id: "star_shield", price: 150, unlockLevel: 2, category: "magic", icon: "🛡️", nameKey: "starShield", descriptionKey: "starShieldDesc", stat_bonus: { defense: 2 }, requiredStats: { defense: 6 } },
  { id: "giggle_wand", price: 165, unlockLevel: 2, category: "magic", icon: "🪄", nameKey: "giggleWand", descriptionKey: "giggleWandDesc", stat_bonus: { precision: 2 }, requiredStats: { precision: 6 } },
  { id: "fox_hat", price: 150, unlockLevel: 2, category: "skin", icon: "🦊", nameKey: "foxHat", descriptionKey: "foxHatDesc", stat_bonus: { stamina: 2 }, requiredStats: { stamina: 6 } },
  { id: "rainbow_sneakers", price: 230, unlockLevel: 3, category: "boots", icon: "🌈", nameKey: "rainbowSneakers", descriptionKey: "rainbowSneakersDesc", stat_bonus: { strength: 2, precision: 1 }, requiredStats: { strength: 8, precision: 7 } },
  { id: "mini_dragon_pet", price: 260, unlockLevel: 3, category: "pet", icon: "🐉", nameKey: "miniDragonPet", descriptionKey: "miniDragonPetDesc", stat_bonus: { defense: 1, stamina: 2 }, requiredStats: { defense: 8, stamina: 8 } },
  { id: "moon_armor", price: 340, unlockLevel: 4, category: "skin", icon: "🌙", nameKey: "moonArmor", descriptionKey: "moonArmorDesc", stat_bonus: { strength: 2, defense: 2 }, requiredStats: { strength: 12, defense: 11 } },
  { id: "thunder_sword", price: 440, unlockLevel: 5, category: "weapon", icon: "⚡", nameKey: "thunderSword", descriptionKey: "thunderSwordDesc", stat_bonus: { strength: 3, precision: 1 }, requiredStats: { strength: 15, precision: 14 } },
  { id: "bubble_helmet", price: 520, unlockLevel: 6, category: "skin", icon: "🫧", nameKey: "bubbleHelmet", descriptionKey: "bubbleHelmetDesc", stat_bonus: { defense: 3, precision: 1 }, requiredStats: { defense: 17, precision: 15 } },
  { id: "comet_cape", price: 560, unlockLevel: 6, category: "skin", icon: "☄️", nameKey: "cometCape", descriptionKey: "cometCapeDesc", stat_bonus: { stamina: 3, strength: 1 }, requiredStats: { stamina: 17, strength: 16 } },
  { id: "pickle_boots", price: 660, unlockLevel: 7, category: "boots", icon: "🥒", nameKey: "pickleBoots", descriptionKey: "pickleBootsDesc", stat_bonus: { precision: 2, stamina: 2 }, requiredStats: { precision: 20, stamina: 19 } },
  { id: "lion_mask", price: 760, unlockLevel: 8, category: "skin", icon: "🦁", nameKey: "lionMask", descriptionKey: "lionMaskDesc", stat_bonus: { strength: 4 }, requiredStats: { strength: 24 } }
];

export function getTrainingOptions(pack: LanguagePack): TrainingOption[] {
  const fromPack = pack.training_options ?? [];
  return fromPack.length > 0 ? fromPack.map(toTrainingOption) : FALLBACK_TRAINING_OPTIONS;
}

export function getQuestionsPerTraining(pack: LanguagePack): number {
  return Math.max(1, Math.floor(pack.task_config?.questions_per_training ?? DEFAULT_QUESTIONS_PER_TRAINING));
}

export function getMaxMistakesForTrainingCompletion(pack: LanguagePack): number {
  const value = pack.task_config?.training_completion?.max_mistakes ?? pack.task_config?.max_mistakes_for_training_completion ?? DEFAULT_MAX_MISTAKES_FOR_TRAINING_COMPLETION;
  return Math.max(0, Math.floor(value));
}

export function getFightTimerSeconds(pack: LanguagePack, level: number): number {
  return getLevelConfig(pack, level)?.fight.timer_seconds ?? pack.task_config?.timer_seconds ?? DEFAULT_FIGHT_TIMER_SECONDS;
}

export function getFightParTimeSeconds(question: { variant: string; activity_type: string; kind?: string }, pack: LanguagePack, level: number): number {
  if (question.variant === "sentence_tap_order") return 40;
  if (question.variant === "sentence_translation" || question.variant === "missing_word" || question.variant === "sentence_choice") return 25;
  if (question.activity_type === "listen_and_choose") return 15;
  if (question.kind === "letter") return 12;
  return Math.max(12, getFightTimerSeconds(pack, level));
}

export function getSpeedBonusMultiplier(elapsedSeconds: number, parSeconds: number, enabled = true): number {
  if (!enabled || parSeconds <= 0) return 1;
  const remainingRatio = Math.max(0, Math.min(1, 1 - elapsedSeconds / parSeconds));
  return 1 + remainingRatio * 0.35;
}

export function getEnemyForLevel(pack: LanguagePack, level: number): EnemyConfig {
  const enemies = [...(pack.enemies ?? [])].sort((a, b) => a.level - b.level);
  const exact = enemies.find((enemy) => enemy.level === level);
  if (exact) return toEnemyConfig(pack, exact);

  const reusable = [...enemies].reverse().find((enemy) => enemy.level < level) ?? enemies[enemies.length - 1];
  if (reusable) {
    const extraLevels = Math.max(0, level - reusable.level);
    const growth = 1 + extraLevels * 0.18;
    return toEnemyConfig(pack, {
      ...reusable,
      id: extraLevels > 0 ? `${reusable.id}_level_${level}` : reusable.id,
      level,
      max_energy: Math.round(reusable.max_energy * growth),
      reward_coins: Math.round(reusable.reward_coins * (1 + extraLevels * 0.12)),
      visual_variant: reusable.visual_variant ?? (extraLevels > 0 ? `ascended-${level}` : undefined),
      scale: Math.min(1.45, (reusable.scale ?? 1) * (1 + Math.min(0.2, extraLevels * 0.025)))
    });
  }
  return { id: "mist_goblin", level, nameKey: "mistGoblin", maxEnergy: 50 + level * 50, rewardCoins: 35 + level * 15, preferredFocus: "vocabulary", sprite: "goblin", spriteRow: 0, scale: 1, requiredStats: {}, tags: ["basic"], skillWeaknesses: ["strength"] };
}

export function getVisibleShopItems(level: number, debugBypass = false): ShopUiItem[] {
  return debugBypass ? SHOP_ITEMS : SHOP_ITEMS.filter((item) => item.unlockLevel <= level);
}

export function getNextShopUnlockLevel(level: number): number | null {
  const next = SHOP_ITEMS.find((item) => item.unlockLevel > level);
  return next?.unlockLevel ?? null;
}

export function getOwnedStatBonuses(items: string[]): Partial<HeroStats> {
  return SHOP_ITEMS.filter((item) => items.includes(item.id)).reduce<Partial<HeroStats>>((acc, item) => {
    for (const [key, value] of Object.entries(item.stat_bonus ?? {}) as Array<[HeroStatKey, number]>) acc[key] = (acc[key] ?? 0) + value;
    return acc;
  }, {});
}

export function getFightGate(
  pack: LanguagePack,
  state: {
    level: number;
    coins: number;
    hero_stats: HeroStats;
    completed_training_sessions: Partial<Record<TrainingFocus, number>>;
    completed_training_sessions_by_level?: Record<string, Partial<Record<TrainingFocus, number>>>;
    completed_labyrinth_sessions_by_level?: Record<string, number>;
    total_training_sessions?: number;
  },
  debugBypass = false
): FightGateResult {
  const level = getLevelConfig(pack, state.level);
  const requirements = level?.unlock_requires;
  if (!requirements) return { ok: true, level, requirements: [] };
  const levelSessions = getLevelTrainingSessions(state);
  const checks: FightGateRequirement[] = [
    { id: "training", labelKey: "requirementTrainingSessions", current: levelSessions, required: requirements.completed_training_sessions ?? 0, ok: levelSessions >= (requirements.completed_training_sessions ?? 0) }
  ];
  if (requirements.min_coins && requirements.min_coins > 0) {
    checks.push({ id: "coins", labelKey: "coins", current: state.coins, required: requirements.min_coins, ok: state.coins >= requirements.min_coins });
  }
  for (const key of ["strength", "defense", "precision", "stamina"] as const) {
    const required = requirements.min_stats?.[key] ?? 0;
    if (required > 0) checks.push({ id: key, labelKey: "requirementStat", labelVars: { stat: key, value: required }, current: state.hero_stats[key], required, ok: state.hero_stats[key] >= required });
  }
  return { ok: debugBypass || checks.every((check) => check.ok), level, requirements: debugBypass ? checks.map((check) => ({ ...check, ok: true })) : checks };
}

export function getFightQuestionTarget(pack: LanguagePack, state: { level: number; hero_stats: HeroStats }, enemy: EnemyConfig): number {
  const level = getLevelConfig(pack, state.level);
  const minQuestions = Math.max(MIN_FIGHT_QUESTIONS, level?.fight.min_questions ?? MIN_FIGHT_QUESTIONS, level?.unlock_requires.answered_fight_questions ?? 0);
  const maxQuestions = getFightMaxQuestions(pack, state.level);
  const enemyEnergy = getEffectiveEnemyEnergy(pack, state.level, enemy);
  const estimatedDamage = estimateHeroDamage(state.hero_stats, enemy.requiredStats, getLevelStatCap(state.level, pack), 1).damage;
  return Math.max(minQuestions, Math.min(maxQuestions, Math.ceil(enemyEnergy / Math.max(1, estimatedDamage))));
}

export function getFightMaxQuestions(pack: LanguagePack, levelNumber: number): number {
  const level = getLevelConfig(pack, levelNumber);
  const atMin = level?.fight.at_min_questions ?? 25;
  return Math.max(MIN_FIGHT_QUESTIONS, level?.fight.max_questions ?? Math.max(atMin + 8, 30));
}

export function getEffectiveEnemyEnergy(pack: LanguagePack, levelNumber: number, enemy: EnemyConfig): number {
  const cap = getLevelStatCap(levelNumber, pack);
  return Math.max(enemy.maxEnergy, cap * MIN_FIGHT_QUESTIONS);
}

export function getFightDamageForQuestion(questionStat: HeroStatKey, stats: HeroStats, enemy: EnemyConfig, statCap: number): number {
  const weaknessBoost = enemy.skillWeaknesses.includes(questionStat) ? 1.12 : 1;
  return estimateHeroDamage(stats, enemy.requiredStats, statCap, weaknessBoost).damage;
}

export function getFightDamageDetails(questionStat: HeroStatKey, stats: HeroStats, enemy: EnemyConfig, statCap: number, speedMultiplier = 1) {
  const weaknessBoost = (enemy.skillWeaknesses.includes(questionStat) ? 1.12 : 1) * Math.max(1, speedMultiplier);
  return estimateHeroDamage(stats, enemy.requiredStats, statCap, weaknessBoost);
}

export function getFightHeroEnergy(_pack: LanguagePack, state: { level: number; hero_stats: HeroStats }, _enemy: EnemyConfig): number {
  return Math.max(20, Math.max(1, state.hero_stats.stamina) * 20);
}

export function getFightMistakeDamage(pack: LanguagePack, state: { level: number; hero_stats: HeroStats }, enemy: EnemyConfig, timedOut: boolean): number {
  return getFightMistakeDetails(pack, state, enemy, timedOut).damage;
}

export function getFightMistakeDetails(pack: LanguagePack, state: { level: number; hero_stats: HeroStats }, enemy: EnemyConfig, timedOut: boolean): CombatBreakdown {
  const cap = getLevelStatCap(state.level, pack);
  const heroEnergy = getFightHeroEnergy(pack, state, enemy);
  const maxedHeroEnergy = cap * 20;
  const softestDamage = Math.max(1, Math.ceil(maxedHeroEnergy / 6));
  const defenseRatio = cap <= 1 ? 1 : Math.max(0, Math.min(1, (state.hero_stats.defense - 1) / (cap - 1)));
  const hardestDamage = Math.max(heroEnergy, softestDamage * 3);
  const baseDamage = hardestDamage - (hardestDamage - softestDamage) * defenseRatio;
  const timeoutBoost = timedOut ? 1.15 : 1;
  const damage = Math.max(1, Math.ceil(baseDamage * timeoutBoost));
  const absorbed = Math.max(0, Math.round(hardestDamage - damage));
  const multiplier = Math.max(0, Math.min(1, damage / Math.max(1, hardestDamage)));
  const label_key: CombatBreakdown["label_key"] = damage >= heroEnergy ? "preciseHit" : damage > heroEnergy * 0.6 ? "bigHit" : damage > heroEnergy * 0.32 ? "normalHit" : "weakHit";
  return { damage, multiplier, max_damage: Math.round(hardestDamage), absorbed, label_key };
}

export function missingRequirements(stats: HeroStats, required: Partial<HeroStats> | undefined): Partial<HeroStats> {
  const missing: Partial<HeroStats> = {};
  if (!required) return missing;
  for (const key of ["strength", "defense", "precision", "stamina"] as const) {
    const needed = required[key] ?? 0;
    if (stats[key] < needed) missing[key] = needed;
  }
  return missing;
}

export function meetsRequirements(stats: HeroStats, required: Partial<HeroStats> | undefined): boolean {
  return Object.keys(missingRequirements(stats, required)).length === 0;
}

function toTrainingOption(option: PackTrainingOption): TrainingOption {
  return {
    focus: normalizeFocus(option.focus),
    titleKey: option.title_key,
    shortKey: option.short_key,
    bodyKey: option.body_key,
    stat: normalizeStat(option.stat),
    icon: option.icon,
    encounter: option.encounter,
    encounterLabelKey: option.encounter_label_key,
    stoneId: option.stone_id ?? `${normalizeFocus(option.focus)}-stone`,
    stoneLabelKey: option.stone_label_key ?? `${normalizeFocus(option.focus)}Stone`,
    stoneColor: option.stone_color ?? "neutral",
    stoneIcon: option.stone_icon ?? "◆"
  };
}

function toEnemyConfig(pack: LanguagePack, enemy: PackEnemy): EnemyConfig {
  const requiredStats = normalizeStats(getLevelConfig(pack, enemy.level)?.unlock_requires.min_stats ?? {});
  return {
    id: enemy.id,
    level: enemy.level,
    nameKey: enemy.name_key,
    maxEnergy: enemy.max_energy,
    rewardCoins: enemy.reward_coins,
    preferredFocus: normalizeFocus(enemy.preferred_focus),
    sprite: enemy.sprite,
    spriteRow: enemy.sprite_row ?? getLegacyMonsterRow(enemy.sprite),
    visualVariant: enemy.visual_variant,
    scale: Math.max(0.6, Math.min(1.8, enemy.scale ?? 1)),
    tint: parseEnemyTint(enemy.tint),
    requiredStats,
    tags: normalizeStringArray(enemy.semantic_tags),
    skillWeaknesses: normalizeStringArray(enemy.skill_weaknesses).map(normalizeStat)
  };
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  if (typeof value !== "string") return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  const unwrapped = trimmed.startsWith("[") && trimmed.endsWith("]")
    ? trimmed.slice(1, -1)
    : trimmed;
  return unwrapped
    .split(",")
    .map((entry) => entry.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
}

function getLegacyMonsterRow(sprite: string): number {
  return ({ goblin: 0, bat: 1, troll: 2, dragon: 3, wizard: 4, blob: 5 } as Record<string, number>)[sprite] ?? 0;
}

function parseEnemyTint(value: string | number | undefined): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.min(0xffffff, Math.floor(value)));
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().replace(/^#/, "").replace(/^0x/i, "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return undefined;
  return Number.parseInt(normalized, 16);
}

function normalizeFocus(value: string): TrainingFocus {
  if (value === "listening") return "comprehension";
  if (value === "letters") return "vocabulary";
  if (value === "comprehension" || value === "grammar" || value === "pronunciation") return value;
  return "vocabulary";
}

function normalizeStat(value: string): HeroStatKey {
  if (value === "power") return "strength";
  if (value === "shield") return "defense";
  if (value === "accuracy") return "precision";
  if (value === "strategy") return "stamina";
  if (value === "defense" || value === "precision" || value === "stamina") return value;
  return "strength";
}

function normalizeStats(stats: Partial<Record<string, number>>): Partial<HeroStats> {
  const result: Partial<HeroStats> = {};
  for (const [key, value] of Object.entries(stats)) {
    result[normalizeStat(key)] = value;
  }
  return result;
}
