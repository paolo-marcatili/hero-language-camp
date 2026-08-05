import type {
  ActivityType,
  AudioReference,
  GrammarItem,
  LanguagePack,
  PackLevel,
  LearningItem,
  LetterItem
} from "@hero-lang/content-schema";
import { getGrammarTranslation, getItemTranslation, getLetterLabel, getLocalizedText } from "@hero-lang/content-schema";

export type TrainingFocus = "vocabulary" | "comprehension" | "grammar" | "pronunciation";

export type TrainingStoneInventory = Record<TrainingFocus, number>;

export interface LabyrinthDoorRequirement {
  config_id: string;
  required_stones: TrainingFocus[];
  created_at: string;
}

export type HeroStatKey = "strength" | "defense" | "precision" | "stamina";

export interface HeroStats {
  strength: number;
  defense: number;
  precision: number;
  stamina: number;
}

export interface PracticeMemory {
  seen_count: number;
  correct_count: number;
  wrong_count: number;
  mastery: number;
  last_result?: "correct" | "incorrect";
  last_asked_at?: string;
  last_was_wrong?: boolean;
  success_streak: number;
  next_review_at?: string;
}

export interface ItemMastery extends PracticeMemory {
  item_id: string;
}

export interface LetterMastery extends PracticeMemory {
  letter_id: string;
}

export interface GrammarMastery extends PracticeMemory {
  grammar_id: string;
}

export interface LearnerState {
  curriculum_version: number;
  hero_name: string;
  level: number;
  xp: number;
  coins: number;
  streak: number;
  max_energy: number;
  hero_stats: HeroStats;
  /** Item bonuses that could not fit under the current level cap. */
  pending_item_stat_bonuses?: HeroStats;
  mastery_by_item: Record<string, ItemMastery>;
  mastery_by_letter: Record<string, LetterMastery>;
  mastery_by_grammar: Record<string, GrammarMastery>;
  completed_training_sessions: Partial<Record<TrainingFocus, number>>;
  completed_training_sessions_by_level?: Record<string, Partial<Record<TrainingFocus, number>>>;
  completed_labyrinth_sessions?: number;
  completed_labyrinth_sessions_by_level?: Record<string, number>;
  training_stones: TrainingStoneInventory;
  labyrinth_door_requirements: Record<string, LabyrinthDoorRequirement>;
  inventory: string[];
  defeated_enemies: string[];
  path_seed: number;
  path_distance: number;
  total_training_sessions?: number;
}

export interface AnswerOption {
  id: string;
  label: string;
  is_hard_distractor?: boolean;
}

export interface AnswerGloss {
  target: string;
  translation: string;
}

export interface AnswerExplanation {
  target: string;
  transliteration?: string;
  translation?: string;
  word_glosses?: AnswerGloss[];
}

export type QuestionVariant =
  | "target_to_base"
  | "base_to_target"
  | "target_to_visual"
  | "visual_to_target"
  | "audio_to_base"
  | "letter_sound"
  | "sentence_choice"
  | "sentence_translation"
  | "missing_word"
  | "sentence_tap_order"
  | "transliteration_match"
  | "syllable_match";

export interface TrainingQuestion {
  id: string;
  kind: "item" | "letter" | "grammar";
  activity_type: ActivityType;
  skill: TrainingFocus;
  stat: HeroStatKey;
  variant: QuestionVariant;
  item?: LearningItem;
  letter?: LetterItem;
  grammar?: GrammarItem;
  prompt: string;
  prompt_hint: string;
  options: AnswerOption[];
  correct_option_id: string;
  correct_answer_label: string;
  expected_answer_length?: number;
  answer_explanation?: AnswerExplanation;
  /** Spoken instruction for pre-readers. It is distinct from the target/answer audio. */
  instruction_audio_text?: string;
  instruction_audio_lang?: string;
  instruction_audio?: AudioReference[];
  /** Automatically attempt to narrate the task when the question appears. */
  auto_narrate?: boolean;
  /** Use one linear replay control instead of separate instruction/target buttons. */
  single_audio_control?: boolean;
  /** Play target audio immediately after the spoken instruction. */
  auto_play_target_audio?: boolean;
  /** Include target/story audio when the learner presses the single replay control. */
  replay_target_audio?: boolean;
  /** Keep answers disabled until the first required narration attempt finishes. */
  requires_audio_before_answer?: boolean;
  /** Hide answer-revealing target audio until feedback is shown. */
  allow_target_audio_before_answer?: boolean;
  target_audio_text?: string;
  target_audio_lang?: string;
  secondary_audio?: AudioReference[];
  secondary_audio_text?: string;
  secondary_audio_label_key?: string;
  audio?: AudioReference[];
}

export interface QuestionSelectionOptions {
  /** Current curriculum stage. Items use controlled tags such as stage:0. */
  stage?: number;
  /** Include tier:extension material. Normal training keeps this disabled. */
  includeExtension?: boolean;
  /** Probability of selecting earlier-stage review instead of current-stage material. */
  reviewChance?: number;
  maxComplexity?: number;
  tags?: string[];
  requireHumanAudio?: boolean;
  /** Require an audio reference usable under automatic-audio mode. Synthetic draft previews are allowed because the parent explicitly opted in. */
  requirePlayableAudio?: boolean;
  includeLetters?: boolean;
}

export interface CombatBreakdown {
  damage: number;
  multiplier: number;
  max_damage: number;
  absorbed: number;
  label_key: "weakHit" | "normalHit" | "bigHit" | "preciseHit" | "blockedHit";
}

export interface AnswerResult {
  correct: boolean;
  timed_out: boolean;
  xp_delta: number;
  coins_delta: number;
  damage: number;
  energy_loss: number;
  absorbed_damage: number;
  damage_multiplier: number;
  combat_label_key?: CombatBreakdown["label_key"] | "monsterHit" | "heroBlocked";
  stat_gains: Partial<HeroStats>;
  stat_cap_reached: boolean;
  message: string;
  updated_state: LearnerState;
}

export interface ShopItem {
  id: string;
  price: number;
  stat_bonus?: Partial<HeroStats>;
}

export const HERO_STAT_KEYS: HeroStatKey[] = ["strength", "defense", "precision", "stamina"];

const REVIEW_INTERVALS_MS = [5 * 60_000, 20 * 60_000, 24 * 60 * 60_000, 3 * 24 * 60 * 60_000, 7 * 24 * 60 * 60_000, 14 * 24 * 60 * 60_000];
export const CURRENT_CURRICULUM_VERSION = 3;
const LEVEL_ZERO_MIGRATION_VERSION = 1;
export const TRAINING_STONE_CAP = 3;
const TRAINING_FOCUSES: readonly TrainingFocus[] = ["vocabulary", "comprehension", "grammar", "pronunciation"];

export function createInitialLearnerState(pack: LanguagePack, heroName = "Ani"): LearnerState {
  const baseStats: HeroStats = { strength: 1, defense: 1, precision: 1, stamina: 1 };
  const pathSeed = Math.floor(Math.random() * 1_000_000);

  return {
    curriculum_version: CURRENT_CURRICULUM_VERSION,
    hero_name: heroName,
    level: 0,
    xp: 0,
    coins: 0,
    streak: 0,
    max_energy: getMaxEnergy(0, baseStats),
    hero_stats: baseStats,
    pending_item_stat_bonuses: zeroDeferredItemBonuses(),
    mastery_by_item: Object.fromEntries(pack.items.map((item) => [item.id, createItemMastery(item.id)])),
    mastery_by_letter: Object.fromEntries((pack.letters ?? []).map((letter) => [letter.id, createLetterMastery(letter.id)])),
    mastery_by_grammar: Object.fromEntries((pack.grammar_items ?? []).map((grammar) => [grammar.id, createGrammarMastery(grammar.id)])),
    completed_training_sessions: {},
    completed_training_sessions_by_level: {},
    completed_labyrinth_sessions: 0,
    completed_labyrinth_sessions_by_level: {},
    training_stones: emptyTrainingStones(),
    labyrinth_door_requirements: {},
    inventory: [],
    defeated_enemies: [],
    path_seed: pathSeed,
    path_distance: 0,
    total_training_sessions: 0
  };
}

export function normalizeLearnerState(pack: LanguagePack, maybeState: unknown, heroName = "Ani"): LearnerState {
  const fresh = createInitialLearnerState(pack, heroName);
  if (!isObject(maybeState)) return fresh;

  const storedCurriculumVersion = Math.max(0, Math.floor(numberOr(maybeState.curriculum_version, 0)));
  // Only curriculum version 0 used the old Level 1 starting point. Future
  // curriculum migrations must not shift a learner down another level.
  const migrateLegacyLevels = storedCurriculumVersion < LEVEL_ZERO_MIGRATION_VERSION;
  const storedLevel = Math.max(0, Math.floor(numberOr(maybeState.level, migrateLegacyLevels ? 1 : 0)));
  const level = migrateLegacyLevels ? Math.max(0, storedLevel - 1) : storedLevel;
  const oldStats = isObject(maybeState.hero_stats) ? maybeState.hero_stats : {};
  const heroStats: HeroStats = clampStatsToLevel(
    {
      strength: numberOr(oldStats.strength, numberOr(oldStats.power, 1)),
      defense: numberOr(oldStats.defense, numberOr(oldStats.shield, 1)),
      precision: numberOr(oldStats.precision, numberOr(oldStats.strategy, numberOr(oldStats.accuracy, 1))),
      stamina: numberOr(oldStats.stamina, numberOr(oldStats.accuracy, numberOr(oldStats.shield, 1)))
    },
    level,
    pack
  );

  const normalizedDeferredItemBonuses = normalizeDeferredItemBonuses(maybeState.pending_item_stat_bonuses);
  const deferredAtCurrentCap = applyDeferredItemBonuses(heroStats, normalizedDeferredItemBonuses, level, pack);

  const completed = mergeTrainingCounts(maybeState.completed_training_sessions);
  const completedLabyrinthSessions = Math.max(0, Math.floor(numberOr(maybeState.completed_labyrinth_sessions, 0)));
  return {
    ...fresh,
    curriculum_version: CURRENT_CURRICULUM_VERSION,
    hero_name: typeof maybeState.hero_name === "string" && maybeState.hero_name.trim() ? maybeState.hero_name : fresh.hero_name,
    level,
    xp: Math.max(0, Math.floor(numberOr(maybeState.xp, 0))),
    coins: Math.max(0, Math.floor(numberOr(maybeState.coins, 0))),
    streak: Math.max(0, Math.floor(numberOr(maybeState.streak, 0))),
    hero_stats: deferredAtCurrentCap.heroStats,
    pending_item_stat_bonuses: deferredAtCurrentCap.pending,
    max_energy: getMaxEnergy(level, deferredAtCurrentCap.heroStats),
    mastery_by_item: mergeItemMastery(fresh.mastery_by_item, maybeState.mastery_by_item),
    mastery_by_letter: mergeLetterMastery(fresh.mastery_by_letter, maybeState.mastery_by_letter),
    mastery_by_grammar: mergeGrammarMastery(fresh.mastery_by_grammar, maybeState.mastery_by_grammar),
    completed_training_sessions: completed,
    completed_training_sessions_by_level: normalizeLevelTrainingCounts(maybeState.completed_training_sessions_by_level, migrateLegacyLevels),
    completed_labyrinth_sessions: completedLabyrinthSessions,
    completed_labyrinth_sessions_by_level: normalizeLevelLabyrinthCounts(maybeState.completed_labyrinth_sessions_by_level, migrateLegacyLevels),
    training_stones: normalizeTrainingStones(maybeState.training_stones),
    labyrinth_door_requirements: normalizeLabyrinthDoorRequirements(maybeState.labyrinth_door_requirements),
    inventory: stringArray(maybeState.inventory),
    defeated_enemies: stringArray(maybeState.defeated_enemies),
    path_seed: Math.floor(numberOr(maybeState.path_seed, fresh.path_seed)),
    path_distance: Math.max(0, Math.floor(numberOr(maybeState.path_distance, 0))),
    total_training_sessions: getTotalTrainingSessions(completed, maybeState.total_training_sessions, completedLabyrinthSessions)
  };
}

export function getNextQuestion(pack: LanguagePack, state: LearnerState, baseLanguage = "it", focus: TrainingFocus = "vocabulary", selection: QuestionSelectionOptions = {}): TrainingQuestion {
  if (focus === "vocabulary" && getLetterCandidatesForSelection(pack.letters ?? [], selection).length > 0 && shouldUseLetterQuestion(state, selection)) {
    return getLetterQuestion(pack, state, baseLanguage, selection);
  }

  if (focus === "grammar" && (pack.grammar_items?.length ?? 0) > 0) {
    return getGrammarQuestion(pack, state, baseLanguage, selection);
  }

  return getItemQuestion(pack, state, baseLanguage, focus, selection);
}

/** Returns whether a focus can produce a valid question under the selection rules. */
export function hasEligibleQuestion(
  pack: LanguagePack,
  focus: TrainingFocus,
  selection: QuestionSelectionOptions = {}
): boolean {
  if (focus === "vocabulary" && selection.includeLetters !== false && getLetterCandidatesForSelection(pack.letters ?? [], selection).length > 0) return true;
  if (focus === "grammar" && (pack.grammar_items?.length ?? 0) > 0) {
    return getGrammarCandidatesForSelection(pack.grammar_items ?? [], selection).length > 0;
  }
  return getItemCandidatesForSelection(pack.items, selection).length > 0;
}

export function answerQuestion(
  question: TrainingQuestion,
  selectedOptionId: string,
  state: LearnerState,
  context: { mode?: "training" | "fight"; timedOut?: boolean; enemyRequirements?: Partial<HeroStats>; enemyLevel?: number; statCap?: number; weaknessStats?: HeroStatKey[] } = {}
): AnswerResult {
  // The fight meter is deliberately soft: reaching zero may remove the speed
  // bonus, but it never changes correctness or increases incoming damage. The
  // optional timedOut flag remains in the public context for compatibility
  // with older callers and is intentionally ignored.
  const correct = selectedOptionId === question.correct_option_id;
  const timedOut = false;
  const mode = context.mode ?? "training";
  const statName = question.stat;
  const cap = context.statCap ?? getLevelStatCap(state.level);
  const statAlreadyCapped = state.hero_stats[statName] >= cap;
  // Training sessions now award exactly one stat point only when the whole
  // session is completed with few enough mistakes. Individual answers update
  // item memory, XP, and coins inside the temporary practice state only.
  const statGains: Partial<HeroStats> = {};

  const streak = correct ? state.streak + 1 : 0;
  const xp_delta = correct ? (mode === "fight" ? 12 : 10) + Math.min(streak, 5) : 1;
  const coins_delta = 0;
  const nextStats = addStatGains(state.hero_stats, statGains, state.level, context.statCap);
  const masteryUpdate = getMasteryUpdate(question, state, correct);
  const pathDelta = correct ? (mode === "fight" ? 16 : 8) : 2;
  const hit = estimateHeroDamage(nextStats, context.enemyRequirements, cap, context.weaknessStats?.includes(statName) ? 1.12 : 1);
  const incoming = estimateMonsterDamage(state.hero_stats, context.enemyRequirements, cap, false);

  const updated_state: LearnerState = {
    ...state,
    xp: state.xp + xp_delta,
    coins: state.coins + coins_delta,
    streak,
    max_energy: getMaxEnergy(state.level, nextStats),
    hero_stats: nextStats,
    mastery_by_item: masteryUpdate.mastery_by_item,
    mastery_by_letter: masteryUpdate.mastery_by_letter,
    mastery_by_grammar: masteryUpdate.mastery_by_grammar,
    completed_training_sessions: state.completed_training_sessions,
    completed_training_sessions_by_level: state.completed_training_sessions_by_level ?? {},
    completed_labyrinth_sessions: state.completed_labyrinth_sessions ?? 0,
    completed_labyrinth_sessions_by_level: state.completed_labyrinth_sessions_by_level ?? {},
    total_training_sessions: state.total_training_sessions ?? getTotalTrainingSessions(state.completed_training_sessions, undefined, state.completed_labyrinth_sessions ?? 0),
    path_distance: state.path_distance + pathDelta
  };

  return {
    correct,
    timed_out: timedOut,
    xp_delta,
    coins_delta,
    damage: correct ? hit.damage : 0,
    energy_loss: correct ? 0 : incoming.damage,
    absorbed_damage: correct ? hit.absorbed : incoming.absorbed,
    damage_multiplier: correct ? hit.multiplier : incoming.multiplier,
    combat_label_key: correct ? hit.label_key : incoming.absorbed > 0 ? "heroBlocked" : "monsterHit",
    stat_gains: statGains,
    stat_cap_reached: correct && mode === "training" && statAlreadyCapped,
    message: correct ? `Correct: ${question.correct_answer_label}.` : `Answer: ${question.correct_answer_label}.`,
    updated_state
  };
}

export function markTrainingSessionCompleted(
  state: LearnerState,
  focus: TrainingFocus,
  pack?: LanguagePack,
  awardAttributePoint = true
): LearnerState {
  const nextFocusCount = Math.floor(state.completed_training_sessions[focus] ?? 0) + 1;
  const completed_training_sessions = { ...state.completed_training_sessions, [focus]: nextFocusCount };
  const levelKey = String(state.level);
  const previousLevelCounts = state.completed_training_sessions_by_level?.[levelKey] ?? {};
  const nextLevelCounts = { ...previousLevelCounts, [focus]: Math.floor(previousLevelCounts[focus] ?? 0) + 1 };
  const completed_training_sessions_by_level = { ...(state.completed_training_sessions_by_level ?? {}), [levelKey]: nextLevelCounts };
  const stat = focusToStat(focus);
  const nextStats = awardAttributePoint
    ? addStatGains(state.hero_stats, { [stat]: 1 }, state.level, getLevelStatCap(state.level, pack))
    : state.hero_stats;
  const training_stones = {
    ...state.training_stones,
    [focus]: Math.min(TRAINING_STONE_CAP, Math.max(0, Math.floor(state.training_stones[focus] ?? 0)) + 1)
  };
  return {
    ...state,
    completed_training_sessions,
    completed_training_sessions_by_level,
    total_training_sessions: getTotalTrainingSessions(completed_training_sessions, undefined, state.completed_labyrinth_sessions ?? 0),
    coins: state.coins + 2,
    hero_stats: nextStats,
    training_stones,
    max_energy: getMaxEnergy(state.level, nextStats),
    path_distance: state.path_distance + 18
  };
}

export function ensureLabyrinthDoorRequirement(
  state: LearnerState,
  configId: string
): LearnerState {
  const existing = state.labyrinth_door_requirements[configId];
  if (existing && isValidDoorRequirement(existing, configId)) return state;
  const completed = Math.max(0, Math.floor(state.completed_labyrinth_sessions ?? 0));
  const totalSessions = Math.max(0, Math.floor(state.total_training_sessions ?? 0));
  const seed = Math.abs(Math.floor(state.path_seed + completed * 997 + totalSessions * 31 + hashString(configId)));
  const requiredCount = 2 + (seed % 2);
  const required_stones = deterministicShuffle([...TRAINING_FOCUSES], seed).slice(0, requiredCount);
  return {
    ...state,
    labyrinth_door_requirements: {
      ...state.labyrinth_door_requirements,
      [configId]: {
        config_id: configId,
        required_stones,
        created_at: new Date().toISOString()
      }
    }
  };
}

export function getLabyrinthDoorRequirement(
  state: LearnerState,
  configId: string
): LabyrinthDoorRequirement | undefined {
  const requirement = state.labyrinth_door_requirements[configId];
  return requirement && isValidDoorRequirement(requirement, configId) ? requirement : undefined;
}

export function getMissingLabyrinthStones(
  state: LearnerState,
  configId: string
): TrainingFocus[] {
  const requirement = getLabyrinthDoorRequirement(state, configId);
  if (!requirement) return [];
  return requirement.required_stones.filter((focus) => (state.training_stones[focus] ?? 0) < 1);
}

export function consumeLabyrinthDoorStones(
  state: LearnerState,
  configId: string
): { ok: boolean; state: LearnerState; missing: TrainingFocus[] } {
  const requirement = getLabyrinthDoorRequirement(state, configId);
  if (!requirement) return { ok: false, state, missing: [...TRAINING_FOCUSES] };
  const missing = getMissingLabyrinthStones(state, configId);
  if (missing.length > 0) return { ok: false, state, missing };
  const training_stones = { ...state.training_stones };
  for (const focus of requirement.required_stones) {
    training_stones[focus] = Math.max(0, Math.floor(training_stones[focus] ?? 0) - 1);
  }
  const labyrinth_door_requirements = { ...state.labyrinth_door_requirements };
  delete labyrinth_door_requirements[configId];
  return {
    ok: true,
    missing: [],
    state: {
      ...state,
      training_stones,
      labyrinth_door_requirements
    }
  };
}


export function markLabyrinthCompleted(
  state: LearnerState,
  pack?: LanguagePack,
  attributePointsEach = 1,
  sessionCredit = 1
): LearnerState {
  const levelKey = String(state.level);
  const completedLabyrinthSessions = Math.max(0, Math.floor(state.completed_labyrinth_sessions ?? 0)) + Math.max(0, Math.floor(sessionCredit));
  const completedByLevel = {
    ...(state.completed_labyrinth_sessions_by_level ?? {}),
    [levelKey]: Math.max(0, Math.floor(state.completed_labyrinth_sessions_by_level?.[levelKey] ?? 0)) + Math.max(0, Math.floor(sessionCredit))
  };
  const points = Math.max(0, Math.floor(attributePointsEach));
  const nextStats = addStatGains(
    state.hero_stats,
    { strength: points, defense: points, precision: points, stamina: points },
    state.level,
    getLevelStatCap(state.level, pack)
  );

  return {
    ...state,
    hero_stats: nextStats,
    max_energy: getMaxEnergy(state.level, nextStats),
    completed_labyrinth_sessions: completedLabyrinthSessions,
    completed_labyrinth_sessions_by_level: completedByLevel,
    total_training_sessions: getTotalTrainingSessions(
      state.completed_training_sessions,
      undefined,
      completedLabyrinthSessions
    ),
    xp: state.xp + 40,
    path_distance: state.path_distance + 45
  };
}

// LEARNING_APP_RELEASE_AB_2026_08: deferred item bonuses
function zeroDeferredItemBonuses(): HeroStats {
  return { strength: 0, defense: 0, precision: 0, stamina: 0 };
}

function normalizeDeferredItemBonuses(value: unknown): HeroStats {
  const source = isObject(value) ? value : {};
  return {
    strength: Math.max(0, Math.floor(numberOr(source.strength, 0))),
    defense: Math.max(0, Math.floor(numberOr(source.defense, 0))),
    precision: Math.max(0, Math.floor(numberOr(source.precision, 0))),
    stamina: Math.max(0, Math.floor(numberOr(source.stamina, 0)))
  };
}

function mergeDeferredItemBonuses(current: HeroStats | undefined, added: Partial<HeroStats>): HeroStats {
  const normalized = normalizeDeferredItemBonuses(current);
  return {
    strength: normalized.strength + Math.max(0, Math.floor(added.strength ?? 0)),
    defense: normalized.defense + Math.max(0, Math.floor(added.defense ?? 0)),
    precision: normalized.precision + Math.max(0, Math.floor(added.precision ?? 0)),
    stamina: normalized.stamina + Math.max(0, Math.floor(added.stamina ?? 0))
  };
}

function applyDeferredItemBonuses(
  current: HeroStats,
  pending: HeroStats | undefined,
  level: number,
  pack?: LanguagePack
): { heroStats: HeroStats; pending: HeroStats } {
  const cap = getLevelStatCap(level, pack);
  const normalized = normalizeDeferredItemBonuses(pending);
  const heroStats = { ...current };
  const remaining = zeroDeferredItemBonuses();

  for (const key of HERO_STAT_KEYS) {
    const available = Math.max(0, cap - heroStats[key]);
    const applied = Math.min(available, normalized[key]);
    heroStats[key] += applied;
    remaining[key] = normalized[key] - applied;
  }

  return { heroStats, pending: remaining };
}

export function markEnemyDefeated(state: LearnerState, enemyId: string, bonusCoins: number, pack?: LanguagePack): LearnerState {
  const alreadyDefeated = state.defeated_enemies.includes(enemyId);
  const maxLevel = pack?.levels?.reduce((maximum, level) => Math.max(maximum, level.number), state.level + 1) ?? state.level + 1;
  const nextLevel = alreadyDefeated ? state.level : Math.min(maxLevel, state.level + 1);
  const cappedStats = clampStatsToLevel(state.hero_stats, nextLevel, pack);
  const deferred = applyDeferredItemBonuses(cappedStats, state.pending_item_stat_bonuses, nextLevel, pack);

  return {
    ...state,
    level: nextLevel,
    xp: state.xp + (alreadyDefeated ? 10 : 45),
    coins: state.coins + bonusCoins,
    max_energy: getMaxEnergy(nextLevel, deferred.heroStats),
    hero_stats: deferred.heroStats,
    pending_item_stat_bonuses: deferred.pending,
    defeated_enemies: alreadyDefeated ? state.defeated_enemies : [...state.defeated_enemies, enemyId],
    path_seed: alreadyDefeated ? state.path_seed : state.path_seed + 137,
    path_distance: state.path_distance + 40
  };
}

export function buyShopItem(state: LearnerState, item: ShopItem, pack?: LanguagePack): { ok: boolean; state: LearnerState; reason?: "owned" | "coins" } {
  if (state.inventory.includes(item.id)) return { ok: false, state, reason: "owned" };
  if (state.coins < item.price) return { ok: false, state, reason: "coins" };

  const queuedBonuses = mergeDeferredItemBonuses(state.pending_item_stat_bonuses, item.stat_bonus ?? {});
  const deferred = applyDeferredItemBonuses(state.hero_stats, queuedBonuses, state.level, pack);

  return {
    ok: true,
    state: {
      ...state,
      coins: state.coins - item.price,
      inventory: [...state.inventory, item.id],
      hero_stats: deferred.heroStats,
      pending_item_stat_bonuses: deferred.pending,
      max_energy: getMaxEnergy(state.level, deferred.heroStats)
    }
  };
}
export function getAverageMastery(state: LearnerState): number {
  const itemValues = Object.values(state.mastery_by_item).map((item) => item.mastery);
  const letterValues = Object.values(state.mastery_by_letter).map((letter) => letter.mastery);
  const grammarValues = Object.values(state.mastery_by_grammar).map((grammar) => grammar.mastery);
  const values = [...itemValues, ...letterValues, ...grammarValues];
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function getStatValue(stats: HeroStats, statName: HeroStatKey): number {
  return stats[statName];
}

export function getLevelConfig(pack: LanguagePack | undefined, level: number): PackLevel | undefined {
  return pack?.levels?.find((entry) => entry.number === level) ?? pack?.levels?.slice().sort((a, b) => b.number - a.number).find((entry) => entry.number <= level);
}

export function getLevelStatCap(level: number, pack?: LanguagePack): number {
  return getLevelConfig(pack, level)?.stat_cap ?? Math.max(1, level) * 5;
}

export function getMaxComplexityForLevel(level: number, pack?: LanguagePack): number {
  return getLevelConfig(pack, level)?.max_complexity ?? Math.max(1, Math.min(5, Math.ceil(Math.max(1, level) / 2)));
}

export function getMaxEnergy(_level: number, stats: HeroStats): number {
  return Math.max(20, Math.max(1, stats.stamina) * 20);
}

export function focusToActivityType(focus: TrainingFocus): ActivityType {
  if (focus === "comprehension") return "listen_and_choose";
  if (focus === "pronunciation") return "transliteration_match";
  if (focus === "grammar") return "sentence_order";
  return "select_translation";
}

export function focusToStat(focus: TrainingFocus): HeroStatKey {
  if (focus === "vocabulary") return "strength";
  if (focus === "comprehension") return "defense";
  if (focus === "grammar") return "precision";
  return "stamina";
}

export function estimateHeroDamage(stats: HeroStats, enemyStats: Partial<HeroStats> | undefined, statCap: number, weaknessBoost = 1): CombatBreakdown {
  const maxDamage = Math.max(1, stats.strength);
  const enemyDefense = enemyStats?.defense ?? Math.max(1, Math.round(statCap * 0.5));
  const multiplier = sigmoidMultiplier(stats.precision, enemyDefense, statCap);
  const raw = maxDamage * multiplier * weaknessBoost;
  const damage = Math.max(1, Math.min(maxDamage, Math.round(raw)));
  const absorbed = Math.max(0, Math.round(maxDamage - damage));
  return { damage, multiplier, max_damage: maxDamage, absorbed, label_key: hitLabel(multiplier) };
}

export function estimateMonsterDamage(heroStats: HeroStats, enemyStats: Partial<HeroStats> | undefined, statCap: number, timedOut = false): CombatBreakdown {
  const monsterStrength = enemyStats?.strength ?? Math.max(2, Math.round(statCap * 0.45));
  const monsterPrecision = enemyStats?.precision ?? Math.max(2, Math.round(statCap * 0.45));
  const multiplier = sigmoidMultiplier(monsterPrecision, heroStats.defense, statCap) * (timedOut ? 1.18 : 1);
  const raw = monsterStrength * multiplier;
  const damage = Math.max(1, Math.round(raw));
  const absorbed = Math.max(0, Math.round(monsterStrength - damage));
  return { damage, multiplier: Math.min(1, multiplier), max_damage: monsterStrength, absorbed, label_key: hitLabel(multiplier) };
}

export function sigmoidMultiplier(attackerPrecision: number, defenderDefense: number, statCap: number, k = 2.2): number {
  const window = Math.max(1, statCap * 0.25);
  const x = k * ((attackerPrecision - defenderDefense) / window);
  return 1 / (1 + Math.exp(-x));
}

function getItemQuestion(pack: LanguagePack, state: LearnerState, baseLanguage: string, focus: TrainingFocus, selection: QuestionSelectionOptions): TrainingQuestion {
  const activityType = focusToActivityType(focus);
  const item = chooseWeakestItem(pack, state, selection);
  const distractors = chooseItemDistractors(pack, item, 3);
  const variant = getItemQuestionVariant(item, focus);
  const options = buildItemOptions(pack, item, distractors, baseLanguage, variant);
  const correctLabel = getCorrectItemOptionLabel(item, baseLanguage, variant);

  return {
    id: `${activityType}:${variant}:${item.id}:${Date.now()}:${Math.random().toString(16).slice(2)}`,
    kind: "item",
    activity_type: activityType,
    skill: focus,
    stat: focusToStat(focus),
    variant,
    item,
    prompt: getItemPrompt(item, baseLanguage, focus, variant),
    prompt_hint: getItemPromptHint(item, baseLanguage, focus, variant),
    options,
    correct_option_id: item.id,
    correct_answer_label: correctLabel,
    answer_explanation: buildItemExplanation(item, baseLanguage),
    allow_target_audio_before_answer: ["target_to_base", "target_to_visual", "audio_to_base"].includes(variant),
    target_audio_text: item.target,
    target_audio_lang: pack.language.bcp47,
    audio: item.audio
  };
}

function getLetterQuestion(pack: LanguagePack, state: LearnerState, baseLanguage: string, selection: QuestionSelectionOptions): TrainingQuestion {
  const letters = getLetterCandidatesForSelection(pack.letters ?? [], selection);
  const letter = chooseWeakestLetter(letters, state, selection);
  const distractors = chooseLetterDistractors(letters, letter, 3, baseLanguage);
  const options = shuffle([
    { id: letter.id, label: getLetterAnswerLabel(letter, baseLanguage) },
    ...distractors.map((candidate, index) => ({
      id: candidate.id,
      label: getLetterAnswerLabel(candidate, baseLanguage),
      is_hard_distractor: index === 0
    }))
  ]);

  return {
    id: `letter_recognition:${letter.id}:${Date.now()}:${Math.random().toString(16).slice(2)}`,
    kind: "letter",
    activity_type: "letter_recognition",
    skill: "vocabulary",
    stat: "strength",
    variant: "letter_sound",
    letter,
    prompt: letter.character,
    prompt_hint: baseLanguage === "it" ? "Scegli il suono della lettera armena." : "Choose the Armenian letter sound.",
    options,
    correct_option_id: letter.id,
    correct_answer_label: getLetterAnswerLabel(letter, baseLanguage),
    answer_explanation: buildLetterExplanation(letter, baseLanguage),
    allow_target_audio_before_answer: false,
    target_audio_text: letter.spoken_name ?? letter.character,
    target_audio_lang: pack.language.bcp47,
    audio: letter.audio,
    secondary_audio: letter.sound_audio,
    secondary_audio_text: letter.sound
  };
}

function getGrammarQuestion(pack: LanguagePack, state: LearnerState, baseLanguage: string, selection: QuestionSelectionOptions): TrainingQuestion {
  const grammarItems = pack.grammar_items ?? [];
  const grammar = chooseWeakestGrammar(grammarItems, state, selection);
  const variant = chooseGrammarVariant(grammar);

  if (variant === "missing_word") {
    const words = splitSentenceWords(grammar.target_sentence);
    const missingIndex = chooseMissingWordIndex(words);
    const missingWord = words[missingIndex] ?? words[0] ?? grammar.target_sentence;
    const promptWords = words.map((word, index) => (index === missingIndex ? "____" : word));
    const distractors = chooseMissingWordDistractors(pack, grammar, missingWord, 3);
    const options = shuffle([
      { id: missingWord, label: missingWord },
      ...distractors.map((word, index) => ({ id: word, label: word, is_hard_distractor: index === 0 }))
    ]);
    return {
      id: `missing_word:${grammar.id}:${Date.now()}:${Math.random().toString(16).slice(2)}`,
      kind: "grammar",
      activity_type: "sentence_order",
      skill: "grammar",
      stat: "precision",
      variant,
      grammar,
      prompt: promptWords.join(" "),
      prompt_hint: baseLanguage === "it" ? "Scegli la parola armena che manca." : "Choose the missing Armenian word.",
      options,
      correct_option_id: missingWord,
      correct_answer_label: grammar.target_sentence,
      answer_explanation: buildGrammarExplanation(pack, grammar, baseLanguage),
      allow_target_audio_before_answer: false,
      target_audio_text: grammar.target_sentence,
      target_audio_lang: pack.language.bcp47,
      audio: grammar.audio
    };
  }

  if (variant === "sentence_tap_order") {
    const words = splitSentenceWords(grammar.target_sentence);
    const decoys = chooseTapOrderDecoys(pack, grammarItems, grammar, words, getTapOrderDecoyCount(grammar));
    const options = shuffle([
      ...words.map((word, index) => ({ id: `chip:answer:${index}:${word}`, label: word })),
      ...decoys.map((word, index) => ({ id: `chip:decoy:${index}:${word}`, label: word, is_hard_distractor: index === 0 }))
    ]);
    return {
      id: `sentence_tap_order:${grammar.id}:${Date.now()}:${Math.random().toString(16).slice(2)}`,
      kind: "grammar",
      activity_type: "sentence_order",
      skill: "grammar",
      stat: "precision",
      variant,
      grammar,
      prompt: getGrammarTranslation(grammar, baseLanguage),
      prompt_hint: baseLanguage === "it" ? "Costruisci la frase. Alcune parole non servono." : "Build the sentence. Some words are extra.",
      options,
      correct_option_id: grammar.target_sentence,
      correct_answer_label: grammar.target_sentence,
      expected_answer_length: words.length,
      answer_explanation: buildGrammarExplanation(pack, grammar, baseLanguage),
      allow_target_audio_before_answer: false,
      target_audio_text: grammar.target_sentence,
      target_audio_lang: pack.language.bcp47,
      audio: grammar.audio
    };
  }

  if (variant === "sentence_translation") {
    const distractors = chooseGrammarTranslationDistractors(grammarItems, grammar, baseLanguage, 3);
    const options = shuffle([
      { id: grammar.id, label: getGrammarTranslation(grammar, baseLanguage) },
      ...distractors.map((candidate, index) => ({
        id: candidate.id,
        label: candidate.label,
        is_hard_distractor: index === 0
      }))
    ]);
    return {
      id: `sentence_translation:${grammar.id}:${Date.now()}:${Math.random().toString(16).slice(2)}`,
      kind: "grammar",
      activity_type: "select_translation",
      skill: "grammar",
      stat: "precision",
      variant,
      grammar,
      prompt: grammar.target_sentence,
      prompt_hint: baseLanguage === "it" ? "Scegli il significato della frase." : "Choose the sentence meaning.",
      options,
      correct_option_id: grammar.id,
      correct_answer_label: getGrammarTranslation(grammar, baseLanguage),
      answer_explanation: buildGrammarExplanation(pack, grammar, baseLanguage),
      allow_target_audio_before_answer: true,
      target_audio_text: grammar.target_sentence,
      target_audio_lang: pack.language.bcp47,
      audio: grammar.audio
    };
  }

  const hardDistractor = chooseHardSentenceDistractor(grammar);
  const rest = shuffle(grammar.distractors.filter((answer) => answer !== hardDistractor)).slice(0, 2);
  const options = shuffle([
    { id: grammar.target_sentence, label: grammar.target_sentence },
    ...[hardDistractor, ...rest].filter(isDefinedString).map((answer, index) => ({
      id: answer,
      label: answer,
      is_hard_distractor: index === 0
    }))
  ]);

  return {
    id: `sentence_choice:${grammar.id}:${Date.now()}:${Math.random().toString(16).slice(2)}`,
    kind: "grammar",
    activity_type: "sentence_order",
    skill: "grammar",
    stat: "precision",
    variant: "sentence_choice",
    grammar,
    prompt: getLocalizedText(grammar.prompt, baseLanguage, getGrammarTranslation(grammar, baseLanguage)),
    prompt_hint: baseLanguage === "it" ? "Scegli la frase armena giusta." : "Choose the right Armenian sentence.",
    options,
    correct_option_id: grammar.target_sentence,
    correct_answer_label: grammar.target_sentence,
    answer_explanation: buildGrammarExplanation(pack, grammar, baseLanguage),
    allow_target_audio_before_answer: false,
    target_audio_text: grammar.target_sentence,
    target_audio_lang: pack.language.bcp47,
    audio: grammar.audio
  };
}
function shouldUseLetterQuestion(state: LearnerState, selection: QuestionSelectionOptions): boolean {
  if (selection.includeLetters === false) return false;
  if (selection.includeLetters === true) return true;
  const stage = selection.stage ?? 0;
  const letterSeen = Object.values(state.mastery_by_letter).reduce((sum, entry) => sum + entry.seen_count, 0);
  if (stage === 0 && letterSeen < 18) return true;
  return Math.random() < (stage <= 2 ? 0.22 : 0.12);
}

function getItemQuestionVariant(item: LearningItem, focus: TrainingFocus): QuestionVariant {
  if (focus === "comprehension") return "audio_to_base";
  if (focus === "pronunciation") return item.syllables?.length ? "syllable_match" : "transliteration_match";
  if (focus === "grammar") return "target_to_base";
  // Ambiguous emoji prompts are disabled until curated pictures are available.
  return Math.random() < 0.35 ? "base_to_target" : "target_to_base";
}

function buildItemOptions(pack: LanguagePack, item: LearningItem, distractors: LearningItem[], baseLanguage: string, variant: QuestionVariant): AnswerOption[] {
  const all = [item, ...distractors];
  return shuffle(all.map((candidate, index) => ({
    id: candidate.id,
    label: getCorrectItemOptionLabel(candidate, baseLanguage, variant, pack),
    is_hard_distractor: index === 1
  })));
}

function getItemPrompt(item: LearningItem, baseLanguage: string, focus: TrainingFocus, variant: QuestionVariant): string {
  if (variant === "audio_to_base") return "🔊";
  if (variant === "visual_to_target" || variant === "base_to_target") return getItemTranslation(item, baseLanguage);
  if (variant === "transliteration_match" || variant === "syllable_match") return item.target;
  void focus;
  return item.target;
}

function getItemPromptHint(item: LearningItem, baseLanguage: string, focus: TrainingFocus, variant: QuestionVariant): string {
  void item;
  if (focus === "comprehension") return baseLanguage === "it" ? "Ascolta l'armeno e scegli il significato." : "Hear Armenian and choose the meaning.";
  if (focus === "pronunciation") return variant === "syllable_match"
    ? (baseLanguage === "it" ? "Scegli le sillabe/suoni giusti." : "Choose the matching syllables/sounds.")
    : (baseLanguage === "it" ? "Scegli come si legge." : "Choose how it sounds.");
  if (variant === "base_to_target" || variant === "visual_to_target") return baseLanguage === "it" ? "Scegli la parola armena." : "Choose the Armenian word.";
  if (variant === "target_to_visual") return baseLanguage === "it" ? "Scegli l'immagine o significato." : "Choose the picture or meaning.";
  return baseLanguage === "it" ? "Scegli il significato." : "Choose the meaning.";
}

function getCorrectItemOptionLabel(item: LearningItem, baseLanguage: string, variant: QuestionVariant, pack?: LanguagePack): string {
  if (variant === "base_to_target" || variant === "visual_to_target") return item.target;
  if (variant === "target_to_visual") return getItemTranslation(item, baseLanguage);
  if (variant === "transliteration_match") return item.transliteration || item.ipa || item.target;
  if (variant === "syllable_match") return item.syllables?.join(" · ") || item.transliteration || item.target;
  if (variant === "audio_to_base") return getItemTranslation(item, baseLanguage);
  void pack;
  return getItemTranslation(item, baseLanguage);
}

function getMasteryUpdate(question: TrainingQuestion, state: LearnerState, correct: boolean): Pick<LearnerState, "mastery_by_item" | "mastery_by_letter" | "mastery_by_grammar"> {
  const delta = correct ? 0.14 : -0.12;

  if (question.kind === "letter" && question.letter) {
    const previous = state.mastery_by_letter[question.letter.id] ?? createLetterMastery(question.letter.id);
    return {
      mastery_by_item: state.mastery_by_item,
      mastery_by_letter: { ...state.mastery_by_letter, [question.letter.id]: updateLetterMastery(previous, correct, delta) },
      mastery_by_grammar: state.mastery_by_grammar
    };
  }

  if (question.kind === "grammar" && question.grammar) {
    const previous = state.mastery_by_grammar[question.grammar.id] ?? createGrammarMastery(question.grammar.id);
    return {
      mastery_by_item: state.mastery_by_item,
      mastery_by_letter: state.mastery_by_letter,
      mastery_by_grammar: { ...state.mastery_by_grammar, [question.grammar.id]: updateGrammarMastery(previous, correct, delta) }
    };
  }

  if (!question.item) {
    return { mastery_by_item: state.mastery_by_item, mastery_by_letter: state.mastery_by_letter, mastery_by_grammar: state.mastery_by_grammar };
  }

  const previous = state.mastery_by_item[question.item.id] ?? createItemMastery(question.item.id);
  return {
    mastery_by_item: { ...state.mastery_by_item, [question.item.id]: updateItemMastery(previous, correct, delta) },
    mastery_by_letter: state.mastery_by_letter,
    mastery_by_grammar: state.mastery_by_grammar
  };
}

function chooseWeakestItem(pack: LanguagePack, state: LearnerState, selection: QuestionSelectionOptions): LearningItem {
  const source = chooseStagePool(getItemCandidatesForSelection(pack.items, selection), selection);
  if (source.length === 0) {
    throw new Error("No eligible learning item for the requested question selection.");
  }
  const sorted = [...source].sort((a, b) => compareMemoryScore(state.mastery_by_item[a.id], state.mastery_by_item[b.id]));
  const pool = sorted.slice(0, Math.min(10, sorted.length));
  return pool[Math.floor(Math.random() * pool.length)] ?? source[0];
}

function chooseWeakestLetter(letters: LetterItem[], state: LearnerState, selection: QuestionSelectionOptions): LetterItem {
  const source = chooseStagePool(letters, selection);
  const unseen = source.filter((entry) => (state.mastery_by_letter[entry.id]?.seen_count ?? 0) === 0);
  if (unseen.length > 0) return unseen[Math.floor(Math.random() * unseen.length)] ?? unseen[0];
  const sorted = [...source].sort((a, b) => compareMemoryScore(state.mastery_by_letter[a.id], state.mastery_by_letter[b.id]));
  const pool = sorted.slice(0, Math.min(8, sorted.length));
  return pool[Math.floor(Math.random() * pool.length)] ?? source[0] ?? letters[0];
}

function chooseWeakestGrammar(grammarItems: GrammarItem[], state: LearnerState, selection: QuestionSelectionOptions): GrammarItem {
  const source = chooseStagePool(getGrammarCandidatesForSelection(grammarItems, selection), selection);
  if (source.length === 0) throw new Error("No eligible grammar item for the requested question selection.");
  const sorted = [...source].sort((a, b) => compareMemoryScore(state.mastery_by_grammar[a.id], state.mastery_by_grammar[b.id]));
  const pool = sorted.slice(0, Math.min(10, sorted.length));
  return pool[Math.floor(Math.random() * pool.length)] ?? source[0];
}

function getItemCandidatesForSelection(items: LearningItem[], selection: QuestionSelectionOptions): LearningItem[] {
  const strict = filterItemsForSelection(items, selection);
  if (strict.length > 0) return strict;

  // Semantic tags are a preference, not a reason to fall back to an invalid
  // silent question. Relax only the tag filter while retaining complexity and
  // audio requirements.
  if ((selection.tags?.length ?? 0) > 0) {
    return filterItemsForSelection(items, { ...selection, tags: [] });
  }

  return strict;
}

function filterItemsForSelection(items: LearningItem[], selection: QuestionSelectionOptions): LearningItem[] {
  const maxComplexity = selection.maxComplexity ?? Number.POSITIVE_INFINITY;
  const tags = new Set((selection.tags ?? []).filter(Boolean));
  return items.filter((item) => {
    if (!matchesCurriculumSelection(item, selection)) return false;
    if (getComplexity(item) > maxComplexity) return false;
    if (selection.requireHumanAudio && !hasHumanAudio(item.audio)) return false;
    if (selection.requirePlayableAudio && !hasPlayableAudio(item.audio)) return false;
    if (tags.size === 0) return true;
    return item.tags.some((tag) => tags.has(tag));
  });
}

function getLetterCandidatesForSelection(items: LetterItem[], selection: QuestionSelectionOptions): LetterItem[] {
  return items.filter((item) => matchesCurriculumSelection(item, selection));
}

function getGrammarCandidatesForSelection(items: GrammarItem[], selection: QuestionSelectionOptions): GrammarItem[] {
  const strict = filterGrammarForSelection(items, selection);
  if (strict.length > 0) return strict;
  if ((selection.tags?.length ?? 0) > 0) return filterGrammarForSelection(items, { ...selection, tags: [] });
  return strict;
}

function filterGrammarForSelection(items: GrammarItem[], selection: QuestionSelectionOptions): GrammarItem[] {
  const maxComplexity = selection.maxComplexity ?? Number.POSITIVE_INFINITY;
  const tags = new Set((selection.tags ?? []).filter(Boolean));
  return items.filter((item) => {
    if (!matchesCurriculumSelection(item, selection)) return false;
    if (getComplexity(item) > maxComplexity) return false;
    if (tags.size === 0) return true;
    return item.tags.some((tag) => tags.has(tag));
  });
}

function getComplexity(item: LearningItem | GrammarItem): number {
  return item.complexity ?? item.difficulty ?? 1;
}

function getContentStage(item: { tags?: string[]; complexity?: number; difficulty?: number }): number {
  const stageTag = (item.tags ?? []).find((tag) => /^stage:\d+$/.test(tag));
  if (stageTag) return Math.max(0, Number(stageTag.slice("stage:".length)));
  return Math.max(0, Math.floor((item.complexity ?? item.difficulty ?? 1) - 1));
}

function matchesCurriculumSelection(
  item: { tags?: string[]; complexity?: number; difficulty?: number },
  selection: QuestionSelectionOptions
): boolean {
  const tags = item.tags ?? [];
  if (!selection.includeExtension && tags.includes("tier:extension")) return false;
  // A staged curriculum only admits explicitly curated core content. Untagged
  // legacy/imported entries stay dictionary-only until an editor assigns a
  // tier:core tag, preventing accidental Level 0 leakage.
  if (!selection.includeExtension && selection.stage !== undefined && !tags.includes("tier:core")) return false;
  if (selection.stage !== undefined && getContentStage(item) > selection.stage) return false;
  return true;
}

function chooseStagePool<T extends { tags?: string[]; complexity?: number; difficulty?: number }>(
  values: T[],
  selection: QuestionSelectionOptions
): T[] {
  const stage = selection.stage;
  if (values.length <= 1 || stage === undefined) return values;
  const current = values.filter((value) => getContentStage(value) === stage);
  const review = values.filter((value) => getContentStage(value) < stage);
  if (current.length === 0) return review.length > 0 ? review : values;
  if (review.length === 0) return current;
  return Math.random() < (selection.reviewChance ?? 0.3) ? review : current;
}

function hasHumanAudio(audio: AudioReference[] | undefined): boolean {
  return Boolean(audio?.some((entry) => entry.source_type === "human" && entry.review_status !== "draft" && Boolean(entry.url)));
}

function hasPlayableAudio(audio: AudioReference[] | undefined): boolean {
  return Boolean(audio?.some((entry) => {
    if (!entry.url?.trim()) return false;
    if (entry.source_type === "automated" || entry.source_type === "browser_tts") return true;
    return entry.review_status !== "draft";
  }));
}

function compareMemoryScore(a?: PracticeMemory, b?: PracticeMemory): number {
  return memoryPriorityScore(a) - memoryPriorityScore(b);
}

function memoryPriorityScore(memory?: PracticeMemory): number {
  if (!memory) return -4 + Math.random();
  const now = Date.now();
  const lastAsked = memory.last_asked_at ? Date.parse(memory.last_asked_at) : 0;
  const nextReview = memory.next_review_at ? Date.parse(memory.next_review_at) : 0;
  const daysSinceAsked = lastAsked ? Math.min(14, (now - lastAsked) / 86_400_000) : 14;
  let score = memory.mastery * 8 + memory.seen_count * 0.12;
  if (memory.last_was_wrong) score -= 6;
  if (nextReview && now >= nextReview) score -= 4;
  if (memory.seen_count === 0) score -= 3;
  score -= daysSinceAsked * 0.18;
  return score + Math.random() * 0.35;
}

function buildItemExplanation(item: LearningItem, baseLanguage: string): AnswerExplanation {
  return {
    target: item.target,
    transliteration: item.transliteration || item.ipa,
    translation: getItemTranslation(item, baseLanguage)
  };
}

function buildLetterExplanation(letter: LetterItem, baseLanguage: string): AnswerExplanation {
  return {
    target: letter.character,
    transliteration: letter.transliteration || letter.sound,
    translation: getLetterLabel(letter, baseLanguage)
  };
}

function buildGrammarExplanation(pack: LanguagePack, grammar: GrammarItem, baseLanguage: string): AnswerExplanation {
  const wordGlosses = buildSentenceGlosses(pack, grammar.target_sentence, baseLanguage);
  const transliteration = buildSentenceTransliteration(pack, grammar.target_sentence);
  return {
    target: grammar.target_sentence,
    transliteration,
    translation: getGrammarTranslation(grammar, baseLanguage),
    word_glosses: wordGlosses.length > 0 ? wordGlosses : undefined
  };
}

function buildSentenceGlosses(pack: LanguagePack, sentence: string, baseLanguage: string): AnswerGloss[] {
  const itemByTarget = new Map<string, LearningItem>();
  for (const item of pack.items) {
    itemByTarget.set(normalizeToken(item.target), item);
    for (const alias of item.aliases ?? []) itemByTarget.set(normalizeToken(alias), item);
  }
  const glosses: AnswerGloss[] = [];
  const seen = new Set<string>();
  for (const token of splitSentenceWords(sentence)) {
    const normalized = normalizeToken(token);
    const item = itemByTarget.get(normalized);
    if (!item || seen.has(normalized)) continue;
    seen.add(normalized);
    glosses.push({ target: stripOuterPunctuation(token), translation: getItemTranslation(item, baseLanguage) });
  }
  return glosses.slice(0, 6);
}

function buildSentenceTransliteration(pack: LanguagePack, sentence: string): string | undefined {
  const itemByTarget = new Map(pack.items.map((item) => [normalizeToken(item.target), item]));
  const transliterated = splitSentenceWords(sentence).map((token) => {
    const item = itemByTarget.get(normalizeToken(token));
    return item?.transliteration || item?.ipa;
  });
  return transliterated.every(Boolean) ? transliterated.join(" ") : undefined;
}

function getTapOrderDecoyCount(grammar: GrammarItem): number {
  const stage = getContentStage(grammar);
  if (stage <= 1) return 1;
  if (stage <= 4) return 2;
  return 3;
}

function chooseTapOrderDecoys(pack: LanguagePack, grammarItems: GrammarItem[], grammar: GrammarItem, answerWords: string[], count: number): string[] {
  const correctTokens = new Set(answerWords.map(normalizeToken));
  const fromExplicitDistractors = grammar.distractors.flatMap(splitSentenceWords);
  const fromRelatedSentences = grammarItems
    .filter((candidate) => candidate.id !== grammar.id && candidate.tags.some((tag) => tag !== "sentence_order" && grammar.tags.includes(tag)))
    .flatMap((candidate) => splitSentenceWords(candidate.target_sentence));
  const fromRelatedVocabulary = pack.items
    .filter((item) => item.tags.some((tag) => grammar.tags.includes(tag)))
    .map((item) => item.target);
  const fromAllVocabulary = pack.items.map((item) => item.target);
  const pool = uniqueStrings([...fromExplicitDistractors, ...shuffle(fromRelatedSentences), ...shuffle(fromRelatedVocabulary), ...shuffle(fromAllVocabulary)])
    .filter((word) => {
      const normalized = normalizeToken(word);
      return normalized && !correctTokens.has(normalized);
    });
  return pool.slice(0, count);
}

function stripOuterPunctuation(value: string): string {
  return value.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

function normalizeToken(value: string): string {
  return stripOuterPunctuation(value).toLocaleLowerCase();
}

function normalizeComparison(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function chooseGrammarVariant(grammar: GrammarItem): QuestionVariant {
  const words = splitSentenceWords(grammar.target_sentence);
  const variants: QuestionVariant[] = ["sentence_choice", "sentence_translation"];
  if (words.length >= 3) variants.push("sentence_tap_order");
  if (grammar.distractors.length < 2) return "sentence_translation";
  return variants[Math.floor(Math.random() * variants.length)] ?? "sentence_choice";
}

function splitSentenceWords(sentence: string): string[] {
  return sentence.trim().split(/\s+/).filter(Boolean);
}

function chooseMissingWordIndex(words: string[]): number {
  if (words.length <= 1) return 0;
  const inner = words.map((_, index) => index).filter((index) => index > 0 && index < words.length - 1);
  const candidates = inner.length > 0 ? inner : words.map((_, index) => index);
  return candidates[Math.floor(Math.random() * candidates.length)] ?? 0;
}

function chooseMissingWordDistractors(pack: LanguagePack, grammar: GrammarItem, missingWord: string, count: number): string[] {
  const sentenceWords = grammar.distractors.flatMap(splitSentenceWords).filter((word) => word !== missingWord);
  const itemWords = pack.items.map((item) => item.target).filter((word) => word !== missingWord);
  const sameTagWords = pack.items.filter((item) => item.tags.some((tag) => grammar.tags.includes(tag))).map((item) => item.target).filter((word) => word !== missingWord);
  const pool = uniqueStrings([...sameTagWords, ...sentenceWords, ...itemWords]);
  return shuffle(pool).slice(0, count);
}

interface TranslationDistractor {
  id: string;
  label: string;
}

function chooseGrammarTranslationDistractors(grammarItems: GrammarItem[], grammar: GrammarItem, baseLanguage: string, count: number): TranslationDistractor[] {
  const correct = getGrammarTranslation(grammar, baseLanguage);
  const curated = grammar.translation_distractors?.[baseLanguage]
    ?? grammar.translation_distractors?.en
    ?? Object.values(grammar.translation_distractors ?? {})[0]
    ?? [];
  const explicit = uniqueStrings(curated)
    .filter((label) => normalizeComparison(label) !== normalizeComparison(correct))
    .map((label, index) => ({ id: `translation-distractor:${grammar.id}:${index}`, label }));

  const sameTag = grammarItems.filter((candidate) => candidate.id !== grammar.id && candidate.tags.some((tag) => grammar.tags.includes(tag)));
  const others = grammarItems.filter((candidate) => candidate.id !== grammar.id && !sameTag.includes(candidate));
  const fallback = uniqueGrammarItems([...shuffle(sameTag), ...shuffle(others)])
    .map((candidate) => ({ id: candidate.id, label: getGrammarTranslation(candidate, baseLanguage) }))
    .filter((candidate) => normalizeComparison(candidate.label) !== normalizeComparison(correct));

  const seen = new Set<string>();
  return [...explicit, ...fallback].filter((candidate) => {
    const key = normalizeComparison(candidate.label);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, count);
}

function chooseHardSentenceDistractor(grammar: GrammarItem): string {
  const reversed = grammar.target_sentence.split(/\s+/).reverse().join(" ");
  if (grammar.distractors.includes(reversed)) return reversed;
  const sameStart = grammar.distractors.find((candidate) => candidate.split(/\s+/)[0] === grammar.target_sentence.split(/\s+/)[0]);
  return sameStart ?? shuffle(grammar.distractors)[0] ?? reversed;
}

function chooseItemDistractors(pack: LanguagePack, item: LearningItem, count: number): LearningItem[] {
  const candidates = pack.items.filter((candidate) => candidate.id !== item.id);
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const explicitHard = shuffle((item.hard_distractor_ids ?? []).map((id) => byId.get(id)).filter(isDefined));
  const sameTag = shuffle(candidates.filter((candidate) => candidate.tags.some((tag) => item.tags.includes(tag))));
  const similar = shuffle([...candidates]).sort((a, b) => similarityScore(item, a) - similarityScore(item, b)).slice(0, Math.min(8, candidates.length));
  const hardPool = uniqueItems([...explicitHard, ...sameTag, ...similar]);
  const hard = hardPool[Math.floor(Math.random() * Math.max(1, hardPool.length))] ?? candidates[0];
  const restPool = candidates.filter((candidate) => candidate.id !== hard?.id);
  const rest = shuffle(restPool).slice(0, Math.max(0, count - 1));
  return uniqueItems([hard, ...rest].filter(isDefined)).slice(0, count);
}

function getLetterAnswerLabel(letter: LetterItem, baseLanguage: string): string {
  const sound = letter.sound?.trim() || letter.transliteration?.trim();
  if (sound) return baseLanguage === "it" ? `suono ${sound}` : `sound ${sound}`;
  // Legacy packs may not have an explicit sound. Strip Armenian-script names
  // from the localized label rather than revealing an example word/glyph.
  const fallback = getLetterLabel(letter, baseLanguage)
    .split(/[·|,]/)
    .map((part) => part.trim())
    .find((part) => /[A-Za-z]/.test(part));
  return fallback || (baseLanguage === "it" ? "suono" : "sound");
}

function chooseLetterDistractors(letters: LetterItem[], letter: LetterItem, count: number, baseLanguage: string): LetterItem[] {
  const correctLabel = getLetterAnswerLabel(letter, baseLanguage);
  const candidates = letters.filter((candidate) => candidate.id !== letter.id && candidate.character !== letter.character && getLetterAnswerLabel(candidate, baseLanguage) !== correctLabel);
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const explicitHard = shuffle((letter.similar_letter_ids ?? []).map((id) => byId.get(id)).filter(isDefined));
  const similar = shuffle([...candidates]).sort((a, b) => levenshtein(letter.sound, a.sound) - levenshtein(letter.sound, b.sound)).slice(0, Math.min(8, candidates.length));
  const hardPool = uniqueLetters([...explicitHard, ...similar]);
  const hard = hardPool[Math.floor(Math.random() * Math.max(1, hardPool.length))] ?? candidates[0];
  const rest = shuffle(candidates.filter((candidate) => candidate.id !== hard?.id)).slice(0, Math.max(0, count - 1));
  return uniqueLetters([hard, ...rest].filter(isDefined)).slice(0, count);
}

function similarityScore(a: LearningItem, b: LearningItem): number {
  const aText = a.transliteration ?? a.target;
  const bText = b.transliteration ?? b.target;
  const tagBonus = a.tags.some((tag) => b.tags.includes(tag)) ? -2 : 0;
  const visualBonus = a.emoji && a.emoji === b.emoji ? -1 : 0;
  return levenshtein(aText, bText) + Math.abs(getComplexity(a) - getComplexity(b)) + tagBonus + visualBonus;
}

function hitLabel(multiplier: number): CombatBreakdown["label_key"] {
  if (multiplier < 0.25) return "blockedHit";
  if (multiplier < 0.45) return "weakHit";
  if (multiplier < 0.72) return "normalHit";
  if (multiplier < 0.9) return "bigHit";
  return "preciseHit";
}

function addStatGains(stats: HeroStats, gains: Partial<HeroStats>, level: number, statCap?: number): HeroStats {
  const cap = statCap ?? getLevelStatCap(level);
  return {
    strength: clamp(stats.strength + (gains.strength ?? 0), 1, cap),
    defense: clamp(stats.defense + (gains.defense ?? 0), 1, cap),
    precision: clamp(stats.precision + (gains.precision ?? 0), 1, cap),
    stamina: clamp(stats.stamina + (gains.stamina ?? 0), 1, cap)
  };
}

function clampStatsToLevel(stats: HeroStats, level: number, pack?: LanguagePack): HeroStats {
  return addStatGains(
    { strength: 1, defense: 1, precision: 1, stamina: 1 },
    { strength: stats.strength - 1, defense: stats.defense - 1, precision: stats.precision - 1, stamina: stats.stamina - 1 },
    level,
    getLevelStatCap(level, pack)
  );
}

function createItemMastery(itemId: string): ItemMastery {
  return { item_id: itemId, ...baseMemory() };
}

function createLetterMastery(letterId: string): LetterMastery {
  return { letter_id: letterId, ...baseMemory() };
}

function createGrammarMastery(grammarId: string): GrammarMastery {
  return { grammar_id: grammarId, ...baseMemory() };
}

function baseMemory(): PracticeMemory {
  return { seen_count: 0, correct_count: 0, wrong_count: 0, mastery: 0, success_streak: 0 };
}

function updateItemMastery(previous: ItemMastery, correct: boolean, delta: number): ItemMastery {
  return { item_id: previous.item_id, ...updateMemory(previous, correct, delta) };
}

function updateLetterMastery(previous: LetterMastery, correct: boolean, delta: number): LetterMastery {
  return { letter_id: previous.letter_id, ...updateMemory(previous, correct, delta) };
}

function updateGrammarMastery(previous: GrammarMastery, correct: boolean, delta: number): GrammarMastery {
  return { grammar_id: previous.grammar_id, ...updateMemory(previous, correct, delta) };
}

function updateMemory(previous: PracticeMemory, correct: boolean, delta: number): PracticeMemory {
  const now = Date.now();
  const successStreak = correct ? previous.success_streak + 1 : 0;
  const box = Math.min(REVIEW_INTERVALS_MS.length - 1, Math.max(0, successStreak));
  const nextDelay = correct ? REVIEW_INTERVALS_MS[box] : REVIEW_INTERVALS_MS[0];
  return {
    seen_count: previous.seen_count + 1,
    correct_count: previous.correct_count + (correct ? 1 : 0),
    wrong_count: previous.wrong_count + (correct ? 0 : 1),
    mastery: clamp(previous.mastery + delta, 0, 1),
    last_result: correct ? "correct" : "incorrect",
    last_asked_at: new Date(now).toISOString(),
    last_was_wrong: !correct,
    success_streak: successStreak,
    next_review_at: new Date(now + nextDelay).toISOString()
  };
}

function mergeItemMastery(fresh: Record<string, ItemMastery>, stored: unknown): Record<string, ItemMastery> {
  if (!isObject(stored)) return fresh;
  const result = { ...fresh };
  for (const id of Object.keys(result)) {
    const value = stored[id];
    if (!isObject(value)) continue;
    result[id] = { item_id: id, ...normalizeMemory(value) };
  }
  return result;
}

function mergeLetterMastery(fresh: Record<string, LetterMastery>, stored: unknown): Record<string, LetterMastery> {
  if (!isObject(stored)) return fresh;
  const result = { ...fresh };
  for (const id of Object.keys(result)) {
    const value = stored[id];
    if (!isObject(value)) continue;
    result[id] = { letter_id: id, ...normalizeMemory(value) };
  }
  return result;
}

function mergeGrammarMastery(fresh: Record<string, GrammarMastery>, stored: unknown): Record<string, GrammarMastery> {
  if (!isObject(stored)) return fresh;
  const result = { ...fresh };
  for (const id of Object.keys(result)) {
    const value = stored[id];
    if (!isObject(value)) continue;
    result[id] = { grammar_id: id, ...normalizeMemory(value) };
  }
  return result;
}

function normalizeMemory(value: Record<string, unknown>): PracticeMemory {
  const seen = Math.max(0, Math.floor(numberOr(value.seen_count, 0)));
  const correct = Math.max(0, Math.floor(numberOr(value.correct_count, 0)));
  const wrong = Math.max(0, Math.floor(numberOr(value.wrong_count, Math.max(0, seen - correct))));
  return {
    seen_count: seen,
    correct_count: correct,
    wrong_count: wrong,
    mastery: clamp(numberOr(value.mastery, 0), 0, 1),
    last_result: toLastResult(value.last_result),
    last_asked_at: stringOr(value.last_asked_at),
    last_was_wrong: typeof value.last_was_wrong === "boolean" ? value.last_was_wrong : value.last_result === "incorrect",
    success_streak: Math.max(0, Math.floor(numberOr(value.success_streak, 0))),
    next_review_at: stringOr(value.next_review_at)
  };
}

function mergeTrainingCounts(stored: unknown): Partial<Record<TrainingFocus, number>> {
  if (!isObject(stored)) return {};
  const vocabulary = Math.max(0, Math.floor(numberOr(stored.vocabulary, 0))) + Math.max(0, Math.floor(numberOr(stored.letters, 0)));
  return {
    vocabulary,
    comprehension: Math.max(0, Math.floor(numberOr(stored.comprehension, numberOr(stored.listening, 0)))),
    grammar: Math.max(0, Math.floor(numberOr(stored.grammar, 0))),
    pronunciation: Math.max(0, Math.floor(numberOr(stored.pronunciation, 0)))
  };
}

function normalizeLevelTrainingCounts(stored: unknown, shiftLegacyLevels = false): Record<string, Partial<Record<TrainingFocus, number>>> {
  if (!isObject(stored)) return {};
  const result: Record<string, Partial<Record<TrainingFocus, number>>> = {};
  for (const [level, counts] of Object.entries(stored)) {
    if (!isObject(counts)) continue;
    const numericLevel = Math.max(0, Math.floor(numberOr(Number(level), 0)) - (shiftLegacyLevels ? 1 : 0));
    const key = String(numericLevel);
    const existing = result[key] ?? {};
    const normalized = mergeTrainingCounts(counts);
    result[key] = Object.fromEntries(TRAINING_FOCUSES.map((focus) => [
      focus,
      Math.max(0, Math.floor(existing[focus] ?? 0)) + Math.max(0, Math.floor(normalized[focus] ?? 0))
    ]));
  }
  return result;
}


function normalizeLevelLabyrinthCounts(stored: unknown, shiftLegacyLevels = false): Record<string, number> {
  if (!isObject(stored)) return {};
  const result: Record<string, number> = {};
  for (const [level, count] of Object.entries(stored)) {
    const numericLevel = Math.max(0, Math.floor(numberOr(Number(level), 0)) - (shiftLegacyLevels ? 1 : 0));
    const key = String(numericLevel);
    result[key] = Math.max(0, Math.floor(result[key] ?? 0)) + Math.max(0, Math.floor(numberOr(count, 0)));
  }
  return result;
}

function emptyTrainingStones(): TrainingStoneInventory {
  return { vocabulary: 0, comprehension: 0, grammar: 0, pronunciation: 0 };
}

function normalizeTrainingStones(stored: unknown): TrainingStoneInventory {
  if (!isObject(stored)) return emptyTrainingStones();
  return {
    vocabulary: clampStoneCount(stored.vocabulary),
    comprehension: clampStoneCount(stored.comprehension),
    grammar: clampStoneCount(stored.grammar),
    pronunciation: clampStoneCount(stored.pronunciation)
  };
}

function clampStoneCount(value: unknown): number {
  return Math.min(TRAINING_STONE_CAP, Math.max(0, Math.floor(numberOr(value, 0))));
}

function normalizeLabyrinthDoorRequirements(stored: unknown): Record<string, LabyrinthDoorRequirement> {
  if (!isObject(stored)) return {};
  const normalized: Record<string, LabyrinthDoorRequirement> = {};
  for (const [configId, value] of Object.entries(stored)) {
    if (!isObject(value)) continue;
    const required = focusArray(value.required_stones);
    const candidate: LabyrinthDoorRequirement = {
      config_id: typeof value.config_id === "string" ? value.config_id : configId,
      required_stones: [...new Set(required)].slice(0, 3),
      created_at: typeof value.created_at === "string" ? value.created_at : new Date().toISOString()
    };
    if (isValidDoorRequirement(candidate, configId)) normalized[configId] = candidate;
  }
  return normalized;
}

function isValidDoorRequirement(requirement: LabyrinthDoorRequirement, configId: string): boolean {
  return requirement.config_id === configId
    && requirement.required_stones.length >= 2
    && requirement.required_stones.length <= 3
    && new Set(requirement.required_stones).size === requirement.required_stones.length
    && requirement.required_stones.every((focus) => TRAINING_FOCUSES.includes(focus));
}

function focusArray(value: unknown): TrainingFocus[] {
  if (!Array.isArray(value)) return [];
  return value.filter((focus): focus is TrainingFocus => typeof focus === "string" && TRAINING_FOCUSES.includes(focus as TrainingFocus));
}

function deterministicShuffle<T>(values: T[], seed: number): T[] {
  const output = [...values];
  let state = seed >>> 0;
  const random = () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [output[index], output[swap]] = [output[swap], output[index]];
  }
  return output;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getTotalTrainingSessions(
  completed: Partial<Record<TrainingFocus, number>>,
  stored?: unknown,
  labyrinthSessions = 0
): number {
  const focusTotal = Object.values(completed).reduce(
    (sum, value) => sum + Math.max(0, Math.floor(value ?? 0)),
    0
  );
  const calculated = focusTotal + Math.max(0, Math.floor(labyrinthSessions));
  return Math.max(calculated, Math.floor(numberOr(stored, calculated)));
}

export function getLevelTrainingSessions(state: {
  level: number;
  completed_training_sessions_by_level?: Record<string, Partial<Record<TrainingFocus, number>>>;
  completed_labyrinth_sessions_by_level?: Record<string, number>;
}): number {
  const levelKey = String(state.level);
  const counts = state.completed_training_sessions_by_level?.[levelKey] ?? {};
  const focusTotal = Object.values(counts).reduce(
    (sum, value) => sum + Math.max(0, Math.floor(value ?? 0)),
    0
  );
  const labyrinthTotal = Math.max(
    0,
    Math.floor(state.completed_labyrinth_sessions_by_level?.[levelKey] ?? 0)
  );
  return focusTotal + labyrinthTotal;
}

function toLastResult(value: unknown): "correct" | "incorrect" | undefined {
  return value === "correct" || value === "incorrect" ? value : undefined;
}

function shuffle<T>(values: T[]): T[] {
  return [...values].map((value) => ({ value, sort: Math.random() })).sort((a, b) => a.sort - b.sort).map(({ value }) => value);
}

function uniqueItems(items: LearningItem[]): LearningItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function uniqueLetters(letters: LetterItem[]): LetterItem[] {
  const seen = new Set<string>();
  return letters.filter((letter) => {
    if (seen.has(letter.id)) return false;
    seen.add(letter.id);
    return true;
  });
}

function uniqueGrammarItems(items: GrammarItem[]): GrammarItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function levenshtein(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, (_, row) => [row]);
  for (let column = 1; column <= b.length; column += 1) matrix[0][column] = column;
  for (let row = 1; row <= a.length; row += 1) {
    for (let column = 1; column <= b.length; column += 1) {
      const cost = a[row - 1] === b[column - 1] ? 0 : 1;
      matrix[row][column] = Math.min(matrix[row - 1][column] + 1, matrix[row][column - 1] + 1, matrix[row - 1][column - 1] + cost);
    }
  }
  return matrix[a.length][b.length];
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringOr(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function isDefinedString(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}
