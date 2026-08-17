export type ReviewStatus = "draft" | "needs_native_speaker_review" | "approved";
export type TranslationReviewStatus = "needs_review" | "reviewed";

export type LearningSubject = "language" | "mental_math" | "foundations" | "other";

export type ActivityType =
  | "select_translation"
  | "listen_and_choose"
  | "image_match"
  | "repeat_after_me"
  | "letter_recognition"
  | "sentence_order"
  | "select_target"
  | "visual_match"
  | "transliteration_match"
  | "syllable_order"
  | "minimal_pair";

export type LocalizedText = Record<string, string>;
export type LocalizedStringList = Record<string, string[]>;

export interface BaseLanguage {
  code: string;
  name_english: string;
  name_native: string;
  is_default?: boolean;
}

export interface LanguageMetadata {
  name_english: string;
  name_native: string;
  bcp47: string;
  variety?: string;
  script?: string;
  direction: "ltr" | "rtl";
  orthography?: string;
}

export interface PackCapabilities {
  human_audio: boolean;
  tts: "none" | "optional" | "available";
  asr: "none" | "experimental" | "available";
  pronunciation_scoring: "none" | "experimental" | "available";
  ipa: "none" | "partial" | "available";
  transliteration: boolean;
  morphology: "none" | "partial" | "available";
}

export type AudioSourceType = "human" | "automated" | "browser_tts";

export interface AudioReference {
  id: string;
  url: string;
  speaker_label?: string;
  source_type?: AudioSourceType;
  engine?: string;
  voice?: string;
  text?: string;
  mime_type?: string;
  generated_at?: string;
  provider?: string;
  license: string;
  review_status: ReviewStatus;
}

export interface LearningItem {
  id: string;
  concept: string;
  target: string;
  translation: string;
  translations?: LocalizedText;
  literal_translations?: LocalizedText;
  translation_review_status?: Record<string, TranslationReviewStatus>;
  emoji?: string;
  transliteration?: string;
  ipa?: string;
  part_of_speech?: string;
  /** Legacy import hint. Runtime sequencing is driven by controlled tags. */
  difficulty?: number;
  /** Legacy import hint. Runtime sequencing is driven by stage/tier tags. */
  complexity?: number;
  tags: string[];
  audio: AudioReference[];
  hard_distractor_ids?: string[];
  phonetic_distractors?: string[];
  syllables?: string[];
  aliases?: string[];
  /** Ordered graphemes used by early-reading activities. */
  graphemes?: string[];
  /** Optional phoneme labels for literacy content. */
  phonemes?: string[];
  /** Child-facing visual; emoji and public asset URLs are both supported. */
  image?: string;
  /** Only approved images may be used as answer-bearing quiz prompts. */
  image_review_status?: ReviewStatus;
  decodability?: "regular" | "high_frequency" | "extension";
  transliterations?: string[];
  meanings?: string[];
  source?: string;
  source_location?: string;
  notes?: string;
  review_status: ReviewStatus;
}

export interface LetterItem {
  id: string;
  character: string;
  names: LocalizedText;
  /** Armenian text spoken when the learner asks for the letter name. */
  spoken_name?: string;
  sound: string;
  transliteration?: string;
  tags?: string[];
  /** Recordings of the letter name. */
  audio?: AudioReference[];
  /** Optional human-reviewed recording of the isolated sound. */
  sound_audio?: AudioReference[];
  similar_letter_ids?: string[];
  example_item_ids?: string[];
  uppercase?: string;
  lowercase?: string;
  example_word?: string;
  /** Draft comparison with sounds familiar to the base-language learner. */
  sound_approximation?: LocalizedText;
  sound_approximation_review_status?: ReviewStatus;
  source?: string;
  source_location?: string;
  review_status: ReviewStatus;
}


export type FoundationsMathDomain =
  | "counting"
  | "number_match"
  | "number_order"
  | "comparison"
  | "addition"
  | "subtraction"
  | "number_bond"
  | "story_problem"
  | "shape"
  | "pattern"
  | "sorting"
  | "measurement";

export type FoundationsReadingDomain =
  | "sentence_picture"
  | "sentence_order"
  | "missing_word"
  | "missing_letter"
  | "mini_story"
  | "initial_sound"
  | "final_sound"
  | "rhyme"
  | "syllable_count";

export interface FoundationsInstruction {
  id: string;
  text: LocalizedText;
  audio?: AudioReference[];
  tags: string[];
  review_status: ReviewStatus;
}

export interface FoundationsReadingProblem {
  id: string;
  domain: FoundationsReadingDomain;
  /** Text shown to the child: a word, sentence, or short story. */
  text: string;
  /** Complete narrated instruction or comprehension question. */
  prompt: LocalizedText;
  answer: string;
  options?: string[];
  /** Child-facing scene or object; emoji and public asset URLs are supported. */
  image?: string;
  /** Ordered word tiles for sentence construction. */
  words?: string[];
  /** Optional full target/story audio; device speech remains the fallback. */
  audio?: AudioReference[];
  /** Optional audio for the complete child-facing instruction or question. */
  prompt_audio?: AudioReference[];
  /** Reusable instruction id from curriculum/instructions.jsonl. */
  instruction_id?: string;
  tags: string[];
  review_status: ReviewStatus;
}

export interface FoundationsMathProblem {
  id: string;
  domain: FoundationsMathDomain;
  prompt: LocalizedText;
  operands?: number[];
  result: number;
  number_range?: { min: number; max: number };
  representation?: "objects" | "dots" | "numeral" | "number_line";
  object?: string;
  /** Operation used by contextual story problems. */
  operation?: "addition" | "subtraction";
  /** Whole value for number-bond activities. */
  whole?: number;
  /** Optional audio for the complete child-facing problem prompt. */
  audio?: AudioReference[];
  /** Text/visual answer for non-numeric awareness activities. */
  answer?: string;
  /** Explicit answer choices for shapes, patterns, sorting and measurement. */
  options?: string[];
  /** Visual sequence shown by a pattern activity. */
  sequence?: string[];
  /** Reusable instruction id when the prompt is generic. */
  instruction_id?: string;
  tags: string[];
  review_status: ReviewStatus;
}

export interface GrammarItem {
  id: string;
  prompt: LocalizedText;
  target_sentence: string;
  translation: string;
  translations?: LocalizedText;
  literal_translations?: LocalizedText;
  translation_review_status?: Record<string, TranslationReviewStatus>;
  /** Curated answer choices in each base language, used before automatic fallbacks. */
  translation_distractors?: LocalizedStringList;
  distractors: string[];
  /** Legacy import hint. Runtime sequencing is driven by controlled tags. */
  difficulty?: number;
  /** Legacy import hint. Runtime sequencing is driven by stage/tier tags. */
  complexity?: number;
  tags: string[];
  audio: AudioReference[];
  source?: string;
  source_location?: string;
  notes?: string;
  review_status: ReviewStatus;
}

export interface Lesson {
  id: string;
  title: string;
  titles?: LocalizedText;
  item_ids: string[];
  letter_ids?: string[];
  grammar_ids?: string[];
  activity_types: ActivityType[];
  unlock_after?: string[];
}

export interface StoryMilestone {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  task_label: LocalizedText;
  kind: "train" | "fight" | "level" | "coins" | "shop";
  focus?: "vocabulary" | "comprehension" | "pronunciation" | "grammar";
  target_stat?: string;
  target_value?: number;
  target_enemy_id?: string;
  reward_coins?: number;
}

export interface StoryLessonExample {
  target: string;
  transliteration?: string;
  translation: LocalizedText;
  note?: LocalizedText;
}

export interface StoryDialogueLine {
  speaker?: LocalizedText;
  target: string;
  transliteration?: string;
  translation: LocalizedText;
}
export interface StoryLesson {
  title: LocalizedText;
  objectives?: LocalizedText[];
  explanation: LocalizedText;
  examples?: StoryLessonExample[];
  dialogue?: StoryDialogueLine[];
  study_notes?: LocalizedText[];
  common_mistakes?: LocalizedText[];
}

export interface StoryChapter {
  id: string;
  title: LocalizedText;
  summary?: LocalizedText;
  fiction?: LocalizedText;
  story_beats?: LocalizedText[];
  lesson?: StoryLesson;
  mission?: LocalizedText;
  cliffhanger?: LocalizedText;
  /** Legacy free-form chapter text. */
  body?: LocalizedText;
  minimum_level?: number;
}

export interface StoryArc {
  title: LocalizedText;
  opening: LocalizedText;
  milestones: StoryMilestone[];
  chapters?: StoryChapter[];
}

export type PackTrainingFocus = "vocabulary" | "comprehension" | "pronunciation" | "grammar";
export type PackHeroStatKey = "strength" | "defense" | "precision" | "stamina";

export interface ControlledTag {
  id: string;
  label: string;
  description?: string;
}

export interface PackTrainingCompletionConfig {
  max_mistakes?: number;
}

export interface PackTaskConfig {
  questions_per_training?: number;
  timer_seconds?: number;
  training_completion?: PackTrainingCompletionConfig;
  max_mistakes_for_training_completion?: number;
}

export interface PackTrainingOption {
  focus: PackTrainingFocus;
  stat: PackHeroStatKey;
  title_key: string;
  short_key: string;
  body_key: string;
  encounter: "training_dummy" | "shield_drill" | "rune_gate" | "echo_crystal" | "stone_lift" | "target_throw" | "puzzle_gate" | "letter_gate";
  encounter_label_key: string;
  icon: string;
  stone_id?: string;
  stone_label_key?: string;
  stone_color?: string;
  stone_icon?: string;
}

export interface PackLevelRequirements {
  completed_training_sessions: number;
  answered_fight_questions: number;
  min_coins?: number;
  min_stats: Partial<Record<PackHeroStatKey, number>>;
}

export interface PackFightRules {
  min_questions: number;
  at_min_questions: number;
  /** Par time for the optional speed bonus. It never invalidates an answer. */
  timer_seconds: number;
  max_questions?: number;
  max_mistakes_to_win?: number;
  sigmoid_k?: number;
}

export type PackCefrBand = "pre_a1" | "a1" | "a2";

/** Pack-owned rules for gameplay levels that extend beyond authored lessons. */
export interface PackProgressionConfig {
  stat_cap_start: number;
  stat_cap_per_level: number;
  unauthored_level_mode?: "review";
}

/** Explicit procedural monster used when no enemy is authored for a level. */
export interface PackEnemyFallbackConfig {
  enemy_id: string;
  energy_growth_per_level: number;
  reward_growth_per_level: number;
  scale_growth_per_level?: number;
  max_scale?: number;
}

export interface PackLevel {
  /** CEFR-informed curriculum band; completion is not a formal CEFR certification. */
  cefr?: PackCefrBand;
  /** An authored review level may deliberately introduce no new core content. */
  review_only?: boolean;
  number: number;
  title: string;
  stat_cap: number;
  /** Deprecated compatibility field. Content is introduced with stage:* tags. */
  max_complexity?: number;
  content_tags?: string[];
  theme?: LocalizedText;
  learning_goal?: LocalizedText;
  grammar_title?: LocalizedText;
  grammar_note?: LocalizedText;
  grammar_examples?: Array<{
    target: string;
    translation: LocalizedText;
    transliteration?: string;
  }>;
  /** Story chapter containing this level's fiction, lesson and mission. */
  chapter_id?: string;
  unlock_requires: PackLevelRequirements;
  fight: PackFightRules;
}

export interface PackEnemy {
  id: string;
  level: number;
  name_key: string;
  max_energy: number;
  reward_coins: number;
  preferred_focus: PackTrainingFocus;
  /** Pack-defined visual key. Existing keys map to rows in the shared monster sheet. */
  sprite: string;
  /** Optional explicit row in the shared monster sheet, allowing new levels to reuse or add visuals without code changes. */
  sprite_row?: number;
  visual_variant?: string;
  scale?: number;
  /** CSS/Phaser hexadecimal tint, for example 0x9b6cff or #9b6cff. */
  tint?: string | number;
  semantic_tags: string[];
  skill_weaknesses?: PackHeroStatKey[];
}


export type LabyrinthRevealMode = "current_and_adjacent";

export interface PackLabyrinthMapConfig {
  width: number;
  height: number;
  theme: string;
  reveal_mode: LabyrinthRevealMode;
}

export interface PackLabyrinthQuestionConfig {
  minimum: number;
  target: number;
  maximum: number;
  minimum_per_focus: number;
  monster_encounters?: number;
}

export interface PackLabyrinthEventConfig {
  trap_encounters?: number;
  cache_cells?: number;
  healing_cells?: number;
  reveal_cells?: number;
  trap_heart_loss?: number;
  cache_coins_min?: number;
  cache_coins_max?: number;
  reveal_radius?: number;
}

export interface PackLabyrinthBonusReward {
  none_weight: number;
  coins_weight: number;
  item_weight: number;
  coins_min: number;
  coins_max: number;
}

export interface PackLabyrinthRewardConfig {
  attribute_points_each: number;
  session_credit: number;
  bonus: PackLabyrinthBonusReward;
}

export interface PackLabyrinthConfig {
  id: string;
  enabled: boolean;
  minimum_level: number;
  map: PackLabyrinthMapConfig;
  questions: PackLabyrinthQuestionConfig;
  events?: PackLabyrinthEventConfig;
  hearts: number;
  semantic_tags: string[];
  rewards: PackLabyrinthRewardConfig;
}

export interface PackFileMap {
  interface?: string;
  tags?: string;
  tasks?: string;
  levels?: string;
  enemies?: string;
  story?: string;
  labyrinths?: string;
  words?: string;
  letters?: string;
  sentences?: string;
  math_problems?: string;
  reading_problems?: string;
  instructions?: string;
}

export interface LanguagePack {
  pack_id: string;
  version: string;
  subject: LearningSubject;
  title: string;
  titles?: LocalizedText;
  description: string;
  descriptions?: LocalizedText;
  language: LanguageMetadata;
  source_language: string;
  base_language?: BaseLanguage;
  base_languages?: BaseLanguage[];
  target_language: string;
  age_band: string;
  capabilities: PackCapabilities;
  lessons: Lesson[];
  items: LearningItem[];
  letters?: LetterItem[];
  grammar_items?: GrammarItem[];
  math_problems?: FoundationsMathProblem[];
  reading_problems?: FoundationsReadingProblem[];
  foundations_instructions?: FoundationsInstruction[];
  story?: StoryArc;
  ui_text?: Record<string, string>;
  controlled_tags?: ControlledTag[];
  task_config?: PackTaskConfig;
  training_options?: PackTrainingOption[];
  progression?: PackProgressionConfig;
  levels?: PackLevel[];
  enemy_fallback?: PackEnemyFallbackConfig;
  enemies?: PackEnemy[];
  labyrinths?: PackLabyrinthConfig[];
  files?: PackFileMap;
  review_status: ReviewStatus;
  license: string;
}

export interface ModularPackSources {
  packYaml: string;
  interfaceYaml?: string;
  tagsYaml?: string;
  tasksYaml?: string;
  levelsYaml?: string;
  enemiesYaml?: string;
  storyYaml?: string;
  labyrinthsYaml?: string;
  wordsJsonl: string;
  lettersJsonl?: string;
  sentencesJsonl?: string;
  mathProblemsJsonl?: string;
  readingProblemsJsonl?: string;
  instructionsJsonl?: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export function buildLanguagePackFromSources(sources: ModularPackSources): LanguagePack {
  const meta = parseYaml(sources.packYaml) as Record<string, unknown>;
  const interfaceDoc = sources.interfaceYaml ? parseYaml(sources.interfaceYaml) as Record<string, unknown> : {};
  const tagsDoc = sources.tagsYaml ? parseYaml(sources.tagsYaml) as Record<string, unknown> : {};
  const tasksDoc = sources.tasksYaml ? parseYaml(sources.tasksYaml) as Record<string, unknown> : {};
  const levelsDoc = sources.levelsYaml ? parseYaml(sources.levelsYaml) as Record<string, unknown> : {};
  const enemiesDoc = sources.enemiesYaml ? parseYaml(sources.enemiesYaml) as Record<string, unknown> : {};
  const storyDoc = sources.storyYaml ? parseYaml(sources.storyYaml) as Record<string, unknown> : undefined;
  const labyrinthsDoc = sources.labyrinthsYaml ? parseYaml(sources.labyrinthsYaml) as Record<string, unknown> : {};
  const baseLanguage = isObject(meta.base_language) ? meta.base_language as unknown as BaseLanguage : undefined;
  const sourceLanguage = baseLanguage?.code ?? asString(meta.source_language, "it");
  const items = parseJsonl<LearningItem>(sources.wordsJsonl).map((item) => normalizeItem(item, sourceLanguage));
  const letters = parseJsonl<LetterItem>(sources.lettersJsonl ?? "").map((letter) => normalizeLetter(letter, sourceLanguage));
  const grammarItems = parseJsonl<GrammarItem>(sources.sentencesJsonl ?? "").map((grammar) => normalizeGrammar(grammar, sourceLanguage));
  const mathProblems = parseJsonl<FoundationsMathProblem>(sources.mathProblemsJsonl ?? "").map(normalizeMathProblem);
  const readingProblems = parseJsonl<FoundationsReadingProblem>(sources.readingProblemsJsonl ?? "").map(normalizeReadingProblem);
  const foundationsInstructions = parseJsonl<FoundationsInstruction>(sources.instructionsJsonl ?? "").map(normalizeFoundationsInstruction);
  const lessons = createLessonsFromItems(items, letters, grammarItems);

  return {
    pack_id: asString(meta.pack_id, "local-pack"),
    version: asString(meta.version, "0.0.0"),
    subject: asString(meta.subject, "language") as LearningSubject,
    title: asString(meta.title, "Language pack"),
    description: asString(meta.description, ""),
    language: (isObject(meta.language) ? meta.language : {}) as unknown as LanguageMetadata,
    source_language: sourceLanguage,
    base_language: baseLanguage,
    base_languages: baseLanguage ? [baseLanguage] : [{ code: sourceLanguage, name_english: sourceLanguage, name_native: sourceLanguage, is_default: true }],
    target_language: asString(meta.target_language, asString((meta.language as Record<string, unknown> | undefined)?.bcp47, "")),
    age_band: asString(meta.age_band, "children"),
    capabilities: (isObject(meta.capabilities) ? meta.capabilities : {}) as unknown as PackCapabilities,
    lessons,
    items,
    letters,
    grammar_items: grammarItems,
    math_problems: mathProblems,
    reading_problems: readingProblems,
    foundations_instructions: foundationsInstructions,
    story: normalizeStory(storyDoc, sourceLanguage),
    ui_text: isObject(interfaceDoc.text) ? stringRecord(interfaceDoc.text) : {},
    controlled_tags: Array.isArray(tagsDoc.controlled_tags) ? tagsDoc.controlled_tags as ControlledTag[] : [],
    task_config: normalizeTaskConfig(tasksDoc),
    training_options: Array.isArray(tasksDoc.training_options) ? tasksDoc.training_options as PackTrainingOption[] : [],
    progression: isObject(levelsDoc.progression) ? levelsDoc.progression as unknown as PackProgressionConfig : undefined,
    levels: Array.isArray(levelsDoc.levels) ? levelsDoc.levels as PackLevel[] : [],
    enemy_fallback: isObject(enemiesDoc.fallback) ? enemiesDoc.fallback as unknown as PackEnemyFallbackConfig : undefined,
    enemies: Array.isArray(enemiesDoc.enemies) ? enemiesDoc.enemies as PackEnemy[] : [],
    labyrinths: Array.isArray(labyrinthsDoc.labyrinths) ? labyrinthsDoc.labyrinths as PackLabyrinthConfig[] : [],
    files: isObject(meta.files) ? meta.files as PackFileMap : undefined,
    review_status: asString(meta.review_status, "draft") as ReviewStatus,
    license: asString(meta.license, "unknown")
  };
}

function normalizeTaskConfig(tasksDoc: Record<string, unknown>): PackTaskConfig {
  const trainingCompletion = isObject(tasksDoc.training_completion) ? tasksDoc.training_completion : {};
  const maxMistakes = asNumber(trainingCompletion.max_mistakes, asNumber(tasksDoc.max_mistakes_for_training_completion, 3));
  return {
    questions_per_training: asNumber(tasksDoc.questions_per_training, 10),
    timer_seconds: asNumber(tasksDoc.timer_seconds, 10),
    training_completion: { max_mistakes: maxMistakes },
    max_mistakes_for_training_completion: maxMistakes
  };
}

export function parseJsonl<T = unknown>(text: string): T[] {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line, index) => {
    try {
      return JSON.parse(line) as T;
    } catch (error) {
      throw new Error(`Invalid JSONL at line ${index + 1}: ${(error as Error).message}`);
    }
  });
}

export function parseYaml(text: string): unknown {
  const lines = text.replace(/\t/g, "  ").split(/\r?\n/).map((raw) => {
    const stripped = stripComment(raw);
    return stripped.trim().length === 0 ? null : { indent: stripped.match(/^ */)?.[0].length ?? 0, text: stripped.trimEnd() };
  }).filter((line): line is { indent: number; text: string } => Boolean(line));

  if (lines.length === 0) return {};
  const [value] = parseYamlBlock(lines, 0, lines[0].indent);
  return value;
}

function parseYamlBlock(lines: Array<{ indent: number; text: string }>, start: number, indent: number): [unknown, number] {
  const first = lines[start];
  if (!first || first.indent < indent) return [{}, start];
  if (first.text.trimStart().startsWith("- ")) return parseYamlArray(lines, start, indent);
  return parseYamlObject(lines, start, indent);
}

/** Parse nested YAML at the indentation actually used by its first line. */
function parseNestedYamlBlock(
  lines: Array<{ indent: number; text: string }>,
  start: number,
  parentIndent: number
): [unknown, number] {
  const next = lines[start];
  if (!next || next.indent <= parentIndent) return [{}, start];
  return parseYamlBlock(lines, start, next.indent);
}

function parseYamlArray(lines: Array<{ indent: number; text: string }>, start: number, indent: number): [unknown[], number] {
  const result: unknown[] = [];
  let index = start;
  while (index < lines.length) {
    const line = lines[index];
    if (line.indent < indent || line.indent !== indent || !line.text.trimStart().startsWith("- ")) break;
    const rest = line.text.trimStart().slice(2).trim();
    if (!rest) {
      const [child, next] = parseNestedYamlBlock(lines, index + 1, indent);
      result.push(child);
      index = next;
      continue;
    }
    const keyValue = splitKeyValue(rest);
    if (keyValue) {
      const [key, valueText] = keyValue;
      const item: Record<string, unknown> = {};
      if (valueText === "") {
        const [child, next] = parseNestedYamlBlock(lines, index + 1, indent + 2);
        item[key] = child;
        index = next;
      } else {
        item[key] = parseYamlScalar(valueText);
        index += 1;
      }
      while (index < lines.length && lines[index].indent === indent + 2 && !lines[index].text.trimStart().startsWith("- ")) {
        const pair = splitKeyValue(lines[index].text.trim());
        if (!pair) break;
        const [childKey, childValueText] = pair;
        if (childValueText === "") {
          const [childValue, next] = parseNestedYamlBlock(lines, index + 1, indent + 2);
          item[childKey] = childValue;
          index = next;
        } else {
          item[childKey] = parseYamlScalar(childValueText);
          index += 1;
        }
      }
      result.push(item);
      continue;
    }
    result.push(parseYamlScalar(rest));
    index += 1;
  }
  return [result, index];
}

function parseYamlObject(lines: Array<{ indent: number; text: string }>, start: number, indent: number): [Record<string, unknown>, number] {
  const result: Record<string, unknown> = {};
  let index = start;
  while (index < lines.length) {
    const line = lines[index];
    if (line.indent < indent || line.indent !== indent || line.text.trimStart().startsWith("- ")) break;
    const pair = splitKeyValue(line.text.trim());
    if (!pair) break;
    const [key, valueText] = pair;
    if (valueText === "") {
      const [child, next] = parseNestedYamlBlock(lines, index + 1, indent);
      result[key] = child;
      index = next;
    } else {
      result[key] = parseYamlScalar(valueText);
      index += 1;
    }
  }
  return [result, index];
}

function splitKeyValue(text: string): [string, string] | null {
  const match = text.match(/^([A-Za-z0-9_\-]+):(?:\s*(.*))?$/);
  if (!match) return null;
  return [match[1], match[2] ?? ""];
}

function parseYamlScalar(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed === "") return "";
  if (trimmed === "[]") return [];
  if (trimmed === "{}") return {};
  if (trimmed === "null") return null;
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    try { return JSON.parse(trimmed); } catch { return trimmed.slice(1, -1); }
  }
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try { return JSON.parse(trimmed); } catch {
      const inner = trimmed.slice(1, -1).trim();
      if (!inner) return [];
      return splitYamlFlowValues(inner).map((entry) => parseYamlScalar(entry));
    }
  }
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try { return JSON.parse(trimmed); } catch { return trimmed; }
  }
  return trimmed;
}

function splitYamlFlowValues(value: string): string[] {
  const result: string[] = [];
  let current = "";
  let quote = "";
  let depth = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if ((char === '"' || char === "'") && value[index - 1] !== "\\") {
      if (!quote) quote = char;
      else if (quote === char) quote = "";
      current += char;
      continue;
    }
    if (!quote) {
      if (char === "[" || char === "{") depth += 1;
      if (char === "]" || char === "}") depth = Math.max(0, depth - 1);
      if (char === "," && depth === 0) {
        result.push(current.trim());
        current = "";
        continue;
      }
    }
    current += char;
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

function stripComment(raw: string): string {
  let quoted = false;
  let quote = "";
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

export function validateLanguagePack(pack: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isObject(pack)) {
    return { ok: false, errors: ["Pack must be a JSON object."], warnings };
  }

  requireString(pack, "pack_id", errors);
  requireString(pack, "version", errors);
  requireString(pack, "title", errors);
  requireString(pack, "source_language", errors);
  requireString(pack, "target_language", errors);
  requireString(pack, "license", errors);

  if (!Array.isArray(pack.items) || pack.items.length === 0) errors.push("Pack must contain at least one learning item.");
  if (!Array.isArray(pack.lessons) || pack.lessons.length === 0) errors.push("Pack must contain at least one lesson.");

  if (isObject(pack.language)) {
    requireString(pack.language, "name_english", errors, "language");
    requireString(pack.language, "name_native", errors, "language");
    requireString(pack.language, "bcp47", errors, "language");
  } else {
    errors.push("Pack must include language metadata.");
  }

  const baseLanguageCodes = new Set<string>();
  if (Array.isArray(pack.base_languages)) {
    for (const [index, baseLanguage] of pack.base_languages.entries()) {
      if (!isObject(baseLanguage)) { errors.push(`base_languages[${index}] must be an object.`); continue; }
      requireString(baseLanguage, "code", errors, `base_languages[${index}]`);
      if (typeof baseLanguage.code === "string") baseLanguageCodes.add(baseLanguage.code);
    }
  }

  const controlledTags = new Set<string>();
  if (Array.isArray(pack.controlled_tags)) {
    for (const [index, tag] of pack.controlled_tags.entries()) {
      if (!isObject(tag)) { errors.push(`controlled_tags[${index}] must be an object.`); continue; }
      requireString(tag, "id", errors, `controlled_tags[${index}]`);
      if (typeof tag.id === "string") controlledTags.add(tag.id);
    }
  }

  const itemIds = new Set<string>();
  if (Array.isArray(pack.items)) {
    for (const [index, item] of pack.items.entries()) {
      if (!isObject(item)) { errors.push(`items[${index}] must be an object.`); continue; }
      const id = typeof item.id === "string" ? item.id : undefined;
      if (!id) errors.push(`items[${index}].id is required.`);
      else if (itemIds.has(id)) errors.push(`Duplicate learning item id: ${id}`);
      else itemIds.add(id);
      requireString(item, "target", errors, `items[${index}]`);
      requireString(item, "translation", errors, `items[${index}]`);
      if (item.difficulty !== undefined && (typeof item.difficulty !== "number" || item.difficulty < 1)) errors.push(`items[${index}].difficulty must be a positive number when provided.`);
      if (item.complexity !== undefined && (typeof item.complexity !== "number" || item.complexity < 0)) errors.push(`items[${index}].complexity must be a non-negative number when provided.`);
      if (!Array.isArray(item.tags)) errors.push(`items[${index}].tags must be an array.`);
      else for (const tag of item.tags) if (controlledTags.size > 0 && !isControlledOrDynamicTag(String(tag), controlledTags)) warnings.push(`items[${index}] uses tag not in controlled_tags: ${String(tag)}`);
      if (!Array.isArray(item.audio)) errors.push(`items[${index}].audio must be an array, even if empty.`);
      else validateAudioReferences(item.audio, `items[${index}].audio`, errors, warnings);
      if (typeof item.image === "string" && item.image && item.image_review_status !== "approved") warnings.push(`items[${index}].image_review_status must be approved before the image is used in a quiz.`);
      if (isObject(item.translations)) {
        for (const code of baseLanguageCodes) if (typeof item.translations[code] !== "string" || item.translations[code] === "") warnings.push(`items[${index}] is missing translation for base language: ${code}`);
      }
      if (item.review_status !== "approved") warnings.push(`items[${index}] is not approved yet: ${id ?? "unknown id"}`);
    }
  }

  const letterIds = new Set<string>();
  if (Array.isArray(pack.letters)) {
    for (const [index, letter] of pack.letters.entries()) {
      if (!isObject(letter)) { errors.push(`letters[${index}] must be an object.`); continue; }
      const id = typeof letter.id === "string" ? letter.id : undefined;
      if (!id) errors.push(`letters[${index}].id is required.`);
      else if (letterIds.has(id)) errors.push(`Duplicate letter id: ${id}`);
      else letterIds.add(id);
      requireString(letter, "character", errors, `letters[${index}]`);
      requireString(letter, "sound", errors, `letters[${index}]`);
      if (!isObject(letter.names)) errors.push(`letters[${index}].names must be a localized text object.`);
      if (Array.isArray(letter.audio)) validateAudioReferences(letter.audio, `letters[${index}].audio`, errors, warnings);
      if (Array.isArray(letter.sound_audio)) validateAudioReferences(letter.sound_audio, `letters[${index}].sound_audio`, errors, warnings);
      if (letter.review_status !== "approved") warnings.push(`letters[${index}] is not approved yet: ${id ?? "unknown id"}`);
    }
  }

  const grammarIds = new Set<string>();
  if (Array.isArray(pack.grammar_items)) {
    for (const [index, grammar] of pack.grammar_items.entries()) {
      if (!isObject(grammar)) { errors.push(`grammar_items[${index}] must be an object.`); continue; }
      const id = typeof grammar.id === "string" ? grammar.id : undefined;
      if (!id) errors.push(`grammar_items[${index}].id is required.`);
      else if (grammarIds.has(id)) errors.push(`Duplicate grammar item id: ${id}`);
      else grammarIds.add(id);
      requireString(grammar, "target_sentence", errors, `grammar_items[${index}]`);
      requireString(grammar, "translation", errors, `grammar_items[${index}]`);
      if (!isObject(grammar.prompt)) errors.push(`grammar_items[${index}].prompt must be a localized text object.`);
      if (grammar.translation_distractors !== undefined) {
        if (!isObject(grammar.translation_distractors)) {
          errors.push(`grammar_items[${index}].translation_distractors must be an object of language-code arrays.`);
        } else {
          for (const [code, values] of Object.entries(grammar.translation_distractors)) {
            if (!Array.isArray(values) || values.some((value) => typeof value !== "string" || value.trim() === "")) {
              errors.push(`grammar_items[${index}].translation_distractors.${code} must contain non-empty strings.`);
            }
          }
        }
      }
      if (!Array.isArray(grammar.distractors) || grammar.distractors.length === 0) errors.push(`grammar_items[${index}].distractors must contain at least one sentence.`);
      if (grammar.difficulty !== undefined && (typeof grammar.difficulty !== "number" || grammar.difficulty < 1)) errors.push(`grammar_items[${index}].difficulty must be a positive number when provided.`);
      if (grammar.complexity !== undefined && (typeof grammar.complexity !== "number" || grammar.complexity < 0)) errors.push(`grammar_items[${index}].complexity must be a non-negative number when provided.`);
      if (!Array.isArray(grammar.tags)) errors.push(`grammar_items[${index}].tags must be an array.`);
      else for (const tag of grammar.tags) if (controlledTags.size > 0 && !isControlledOrDynamicTag(String(tag), controlledTags)) warnings.push(`grammar_items[${index}] uses tag not in controlled_tags: ${String(tag)}`);
      if (!Array.isArray(grammar.audio)) errors.push(`grammar_items[${index}].audio must be an array, even if empty.`);
      else validateAudioReferences(grammar.audio, `grammar_items[${index}].audio`, errors, warnings);
      if (grammar.review_status !== "approved") warnings.push(`grammar_items[${index}] is not approved yet: ${id ?? "unknown id"}`);
    }
  }

  if (Array.isArray(pack.math_problems)) {
    const mathIds = new Set<string>();
    for (const [index, problem] of pack.math_problems.entries()) {
      const path = `math_problems[${index}]`;
      if (!isObject(problem)) { errors.push(`${path} must be an object.`); continue; }
      requireString(problem, "id", errors, path);
      if (typeof problem.id === "string") {
        if (mathIds.has(problem.id)) errors.push(`Duplicate math problem id: ${problem.id}`);
        mathIds.add(problem.id);
      }
      if (!["counting", "number_match", "number_order", "comparison", "addition", "subtraction", "number_bond", "story_problem", "shape", "pattern", "sorting", "measurement"].includes(String(problem.domain))) errors.push(`${path}.domain is unsupported.`);
      if (!isObject(problem.prompt)) errors.push(`${path}.prompt must be localized text.`);
      if (!Number.isFinite(problem.result)) errors.push(`${path}.result must be a number.`);
      if (problem.options !== undefined && (!Array.isArray(problem.options) || problem.options.some((value) => typeof value !== "string" || value.trim() === ""))) errors.push(`${path}.options must contain non-empty strings.`);
      if (problem.sequence !== undefined && (!Array.isArray(problem.sequence) || problem.sequence.some((value) => typeof value !== "string" || value.trim() === ""))) errors.push(`${path}.sequence must contain non-empty strings.`);
      if (["shape", "pattern", "sorting", "measurement"].includes(String(problem.domain)) && (typeof problem.answer !== "string" || problem.answer.trim() === "")) errors.push(`${path}.answer is required for awareness activities.`);
      if (!Array.isArray(problem.tags)) errors.push(`${path}.tags must be an array.`);
      if (problem.review_status !== "approved") warnings.push(`${path} is not approved yet: ${String(problem.id ?? "unknown id")}`);
    }
  }

  if (Array.isArray(pack.reading_problems)) {
    const readingIds = new Set<string>();
    for (const [index, problem] of pack.reading_problems.entries()) {
      const path = `reading_problems[${index}]`;
      if (!isObject(problem)) { errors.push(`${path} must be an object.`); continue; }
      requireString(problem, "id", errors, path);
      if (typeof problem.id === "string") {
        if (readingIds.has(problem.id)) errors.push(`Duplicate reading problem id: ${problem.id}`);
        readingIds.add(problem.id);
      }
      if (!["sentence_picture", "sentence_order", "missing_word", "missing_letter", "mini_story", "initial_sound", "final_sound", "rhyme", "syllable_count"].includes(String(problem.domain))) errors.push(`${path}.domain is unsupported.`);
      requireString(problem, "text", errors, path);
      requireString(problem, "answer", errors, path);
      if (!isObject(problem.prompt)) errors.push(`${path}.prompt must be localized text.`);
      if (!Array.isArray(problem.tags)) errors.push(`${path}.tags must be an array.`);
      if (problem.options !== undefined && (!Array.isArray(problem.options) || problem.options.some((value) => typeof value !== "string" || value.trim() === ""))) errors.push(`${path}.options must contain non-empty strings.`);
      if (problem.words !== undefined && (!Array.isArray(problem.words) || problem.words.some((value) => typeof value !== "string" || value.trim() === ""))) errors.push(`${path}.words must contain non-empty strings.`);
      if (Array.isArray(problem.prompt_audio)) validateAudioReferences(problem.prompt_audio, `${path}.prompt_audio`, errors, warnings);
      if (problem.review_status !== "approved") warnings.push(`${path} is not approved yet: ${String(problem.id ?? "unknown id")}`);
    }
  }

  if (Array.isArray(pack.foundations_instructions)) {
    const instructionIds = new Set<string>();
    for (const [index, instruction] of pack.foundations_instructions.entries()) {
      const path = `foundations_instructions[${index}]`;
      if (!isObject(instruction)) { errors.push(`${path} must be an object.`); continue; }
      requireString(instruction, "id", errors, path);
      if (typeof instruction.id === "string") {
        if (instructionIds.has(instruction.id)) errors.push(`Duplicate foundations instruction id: ${instruction.id}`);
        instructionIds.add(instruction.id);
      }
      if (!isObject(instruction.text)) errors.push(`${path}.text must be localized text.`);
      if (!Array.isArray(instruction.tags)) errors.push(`${path}.tags must be an array.`);
      if (Array.isArray(instruction.audio)) validateAudioReferences(instruction.audio, `${path}.audio`, errors, warnings);
    }
  }

  if (Array.isArray(pack.lessons)) {
    for (const [index, lesson] of pack.lessons.entries()) {
      if (!isObject(lesson)) { errors.push(`lessons[${index}] must be an object.`); continue; }
      requireString(lesson, "id", errors, `lessons[${index}]`);
      requireString(lesson, "title", errors, `lessons[${index}]`);
      if (!Array.isArray(lesson.item_ids) || lesson.item_ids.length === 0) errors.push(`lessons[${index}].item_ids must contain at least one item id.`);
      else for (const itemId of lesson.item_ids) if (!itemIds.has(String(itemId))) errors.push(`lessons[${index}] references unknown item id: ${String(itemId)}`);
      if (Array.isArray(lesson.letter_ids)) for (const letterId of lesson.letter_ids) if (!letterIds.has(String(letterId))) errors.push(`lessons[${index}] references unknown letter id: ${String(letterId)}`);
      if (Array.isArray(lesson.grammar_ids)) for (const grammarId of lesson.grammar_ids) if (!grammarIds.has(String(grammarId))) errors.push(`lessons[${index}] references unknown grammar item id: ${String(grammarId)}`);
    }
  }

  const story = isObject(pack.story) ? pack.story : undefined;
  const storyChapters = story && Array.isArray(story.chapters) ? story.chapters : [];
  if (story && !Array.isArray(story.chapters)) errors.push("story.chapters must be an array.");
  const chapterIds = new Set<string>();
  for (const [index, chapter] of storyChapters.entries()) {
    const path = `story.chapters[${index}]`;
    if (!isObject(chapter)) { errors.push(`${path} must be an object.`); continue; }
    requireString(chapter, "id", errors, path);
    if (typeof chapter.id === "string") {
      if (chapterIds.has(chapter.id)) errors.push(`${path}.id must be unique: ${chapter.id}.`);
      chapterIds.add(chapter.id);
    }
    if (!isObject(chapter.title)) errors.push(`${path}.title must be localized text.`);
    if (chapter.minimum_level !== undefined && (!Number.isInteger(chapter.minimum_level) || Number(chapter.minimum_level) < 0)) errors.push(`${path}.minimum_level must be a non-negative integer.`);
    if (chapter.lesson !== undefined) {
      if (!isObject(chapter.lesson)) errors.push(`${path}.lesson must be an object.`);
      else {
        if (!isObject(chapter.lesson.title)) errors.push(`${path}.lesson.title must be localized text.`);
        if (!isObject(chapter.lesson.explanation)) errors.push(`${path}.lesson.explanation must be localized text.`);
        if (chapter.lesson.examples !== undefined && !Array.isArray(chapter.lesson.examples)) errors.push(`${path}.lesson.examples must be an array.`);
        if (chapter.lesson.dialogue !== undefined && !Array.isArray(chapter.lesson.dialogue)) errors.push(`${path}.lesson.dialogue must be an array.`);
      }
    }
  }
  const storyLevels = Array.isArray(pack.levels) ? pack.levels : [];
  for (const [index, level] of storyLevels.entries()) {
    if (!isObject(level)) continue;
    if (typeof level.chapter_id === "string" && !chapterIds.has(level.chapter_id)) errors.push(`levels[${index}].chapter_id references unknown chapter: ${level.chapter_id}.`);
  }
  // curriculum-v2 pack contract: authored teaching and procedural gameplay are explicit.
  const authoredLevelNumbers = new Set<number>();
  if (Array.isArray(pack.levels)) {
    for (const level of pack.levels) {
      if (isObject(level) && Number.isInteger(level.number) && Number(level.number) >= 0) authoredLevelNumbers.add(Number(level.number));
    }
  }
  const progressionConfig = pack.progression;
  if (progressionConfig !== undefined) {
    if (!isObject(progressionConfig)) errors.push("progression must be an object.");
    else {
      if (typeof progressionConfig.stat_cap_start !== "number" || progressionConfig.stat_cap_start <= 0) errors.push("progression.stat_cap_start must be a positive number.");
      if (typeof progressionConfig.stat_cap_per_level !== "number" || progressionConfig.stat_cap_per_level <= 0) errors.push("progression.stat_cap_per_level must be a positive number.");
      if (progressionConfig.unauthored_level_mode !== undefined && progressionConfig.unauthored_level_mode !== "review") errors.push("progression.unauthored_level_mode must be review when provided.");
    }
  }
  const enemyFallbackConfig = pack.enemy_fallback;
  if (enemyFallbackConfig !== undefined) {
    if (!isObject(enemyFallbackConfig)) errors.push("enemy_fallback must be an object.");
    else {
      requireString(enemyFallbackConfig, "enemy_id", errors, "enemy_fallback");
      for (const key of ["energy_growth_per_level", "reward_growth_per_level"] as const) {
        if (typeof enemyFallbackConfig[key] !== "number" || Number(enemyFallbackConfig[key]) < 0) errors.push(`enemy_fallback.${key} must be a non-negative number.`);
      }
      if (enemyFallbackConfig.scale_growth_per_level !== undefined && (typeof enemyFallbackConfig.scale_growth_per_level !== "number" || enemyFallbackConfig.scale_growth_per_level < 0)) errors.push("enemy_fallback.scale_growth_per_level must be a non-negative number.");
      if (enemyFallbackConfig.max_scale !== undefined && (typeof enemyFallbackConfig.max_scale !== "number" || enemyFallbackConfig.max_scale <= 0)) errors.push("enemy_fallback.max_scale must be a positive number.");
      const fallbackEnemyId = typeof enemyFallbackConfig.enemy_id === "string" ? enemyFallbackConfig.enemy_id : undefined;
      if (fallbackEnemyId && (!Array.isArray(pack.enemies) || !pack.enemies.some((enemy) => isObject(enemy) && enemy.id === fallbackEnemyId))) errors.push(`enemy_fallback.enemy_id references unknown enemy: ${fallbackEnemyId}.`);
    }
  }
  if (pack.subject === "language" && authoredLevelNumbers.size > 0) {
    const coreCountByStage = new Map<number, number>();
    const curriculumCollections: Array<[string, unknown]> = [
      ["items", pack.items],
      ["letters", pack.letters],
      ["grammar_items", pack.grammar_items]
    ];
    for (const [collectionName, collection] of curriculumCollections) {
      if (!Array.isArray(collection)) continue;
      for (const [index, row] of collection.entries()) {
        if (!isObject(row)) continue;
        const tags = Array.isArray(row.tags) ? row.tags.map(String) : [];
        if (!tags.includes("tier:core")) continue;
        const stageTag = tags.find((tag) => /^stage:\d+$/.test(tag));
        if (!stageTag) {
          errors.push(`${collectionName}[${index}] is tier:core but has no explicit stage:N tag.`);
          continue;
        }
        const stage = Number(stageTag.slice(6));
        if (!authoredLevelNumbers.has(stage)) errors.push(`${collectionName}[${index}] references unauthored curriculum stage ${stage}.`);
        coreCountByStage.set(stage, (coreCountByStage.get(stage) ?? 0) + 1);
      }
    }
    if (Array.isArray(pack.levels)) {
      for (const [index, level] of pack.levels.entries()) {
        if (!isObject(level) || typeof level.number !== "number") continue;
        if (level.review_only !== true && (coreCountByStage.get(level.number) ?? 0) === 0) errors.push(`levels[${index}] introduces no tier:core content; set review_only: true or add staged content.`);
      }
    }
  }

  if (Array.isArray(pack.levels)) {
    for (const [index, level] of pack.levels.entries()) {
      if (!isObject(level)) { errors.push(`levels[${index}] must be an object.`); continue; }
      if (typeof level.number !== "number") errors.push(`levels[${index}].number must be a number.`);
      if (typeof level.stat_cap !== "number") errors.push(`levels[${index}].stat_cap must be a number.`);
      if (level.cefr !== undefined && !["pre_a1", "a1", "a2"].includes(String(level.cefr))) errors.push(`levels[${index}].cefr must be pre_a1, a1 or a2.`);
      if (level.review_only !== undefined && typeof level.review_only !== "boolean") errors.push(`levels[${index}].review_only must be boolean.`);
      if (!isObject(level.unlock_requires)) errors.push(`levels[${index}].unlock_requires must be an object.`);
      if (!isObject(level.fight)) errors.push(`levels[${index}].fight must be an object.`);
    }
  }

  if (Array.isArray(pack.enemies)) {
    for (const [index, enemy] of pack.enemies.entries()) {
      if (!isObject(enemy)) { errors.push(`enemies[${index}] must be an object.`); continue; }
      requireString(enemy, "id", errors, `enemies[${index}]`);
      requireString(enemy, "name_key", errors, `enemies[${index}]`);
      requireString(enemy, "sprite", errors, `enemies[${index}]`);
      if (enemy.sprite_row !== undefined && (!Number.isInteger(enemy.sprite_row) || Number(enemy.sprite_row) < 0)) errors.push(`enemies[${index}].sprite_row must be a non-negative integer.`);
      if (enemy.scale !== undefined && (typeof enemy.scale !== "number" || enemy.scale <= 0)) errors.push(`enemies[${index}].scale must be a positive number.`);
      if (!Array.isArray(enemy.semantic_tags) || !enemy.semantic_tags.every((tag) => typeof tag === "string")) {
        errors.push(`enemies[${index}].semantic_tags must be a string array.`);
      }
      const validStats = new Set(["strength", "defense", "precision", "stamina"]);
      if (enemy.skill_weaknesses !== undefined && (
        !Array.isArray(enemy.skill_weaknesses)
        || !enemy.skill_weaknesses.every((stat) => typeof stat === "string" && validStats.has(stat))
      )) {
        errors.push(`enemies[${index}].skill_weaknesses must be an array of valid hero stats.`);
      }
    }
  }

  if (Array.isArray(pack.labyrinths)) {
    const labyrinthIds = new Set<string>();
    for (const [index, labyrinth] of pack.labyrinths.entries()) {
      const path = `labyrinths[${index}]`;
      if (!isObject(labyrinth)) { errors.push(`${path} must be an object.`); continue; }
      requireString(labyrinth, "id", errors, path);
      if (typeof labyrinth.id === "string") {
        if (labyrinthIds.has(labyrinth.id)) errors.push(`${path}.id must be unique: ${labyrinth.id}.`);
        labyrinthIds.add(labyrinth.id);
      }
      if (typeof labyrinth.enabled !== "boolean") errors.push(`${path}.enabled must be a boolean.`);
      if (!Number.isInteger(labyrinth.minimum_level) || Number(labyrinth.minimum_level) < 0) errors.push(`${path}.minimum_level must be a non-negative integer.`);
      if (!isObject(labyrinth.map)) errors.push(`${path}.map must be an object.`);
      else {
        if (!Number.isInteger(labyrinth.map.width) || Number(labyrinth.map.width) < 5) errors.push(`${path}.map.width must be an integer of at least 5.`);
        if (!Number.isInteger(labyrinth.map.height) || Number(labyrinth.map.height) < 5) errors.push(`${path}.map.height must be an integer of at least 5.`);
        requireString(labyrinth.map, "theme", errors, `${path}.map`);
        if (labyrinth.map.reveal_mode !== "current_and_adjacent") errors.push(`${path}.map.reveal_mode is unsupported.`);
      }
      if (!isObject(labyrinth.questions)) errors.push(`${path}.questions must be an object.`);
      else {
        const minimum = Number(labyrinth.questions.minimum ?? 0);
        const target = Number(labyrinth.questions.target ?? 0);
        const maximum = Number(labyrinth.questions.maximum ?? 0);
        const perFocus = Number(labyrinth.questions.minimum_per_focus ?? 0);
        if (!Number.isInteger(minimum) || !Number.isInteger(target) || !Number.isInteger(maximum) || minimum < 1 || target < minimum || maximum < target) {
          errors.push(`${path}.questions must use integers satisfying 1 <= minimum <= target <= maximum.`);
        }
        if (!Number.isInteger(perFocus) || perFocus < 1) errors.push(`${path}.questions.minimum_per_focus must be a positive integer.`);
        if (target < perFocus * 4) errors.push(`${path}.questions.target must cover all four focuses.`);
        if (labyrinth.questions.monster_encounters !== undefined && (!Number.isInteger(labyrinth.questions.monster_encounters) || Number(labyrinth.questions.monster_encounters) < 1)) {
          errors.push(`${path}.questions.monster_encounters must be a positive integer when provided.`);
        }
      }
      if (labyrinth.events !== undefined) {
        if (!isObject(labyrinth.events)) errors.push(`${path}.events must be an object when provided.`);
        else {
          for (const key of ["trap_encounters", "cache_cells", "healing_cells", "reveal_cells"] as const) {
            const value = labyrinth.events[key];
            if (value !== undefined && (!Number.isInteger(value) || Number(value) < 0)) {
              errors.push(`${path}.events.${key} must be a non-negative integer when provided.`);
            }
          }
          for (const key of ["trap_heart_loss", "reveal_radius"] as const) {
            const value = labyrinth.events[key];
            if (value !== undefined && (!Number.isInteger(value) || Number(value) < 1)) {
              errors.push(`${path}.events.${key} must be a positive integer when provided.`);
            }
          }
          const cacheMin = labyrinth.events.cache_coins_min;
          const cacheMax = labyrinth.events.cache_coins_max;
          if (cacheMin !== undefined && (!Number.isInteger(cacheMin) || Number(cacheMin) < 0)) errors.push(`${path}.events.cache_coins_min must be a non-negative integer when provided.`);
          if (cacheMax !== undefined && (!Number.isInteger(cacheMax) || Number(cacheMax) < 0)) errors.push(`${path}.events.cache_coins_max must be a non-negative integer when provided.`);
          if (cacheMin !== undefined && cacheMax !== undefined && Number(cacheMax) < Number(cacheMin)) errors.push(`${path}.events.cache_coins_max must be >= cache_coins_min.`);
        }
      }
      if (!Number.isInteger(labyrinth.hearts) || Number(labyrinth.hearts) < 1) errors.push(`${path}.hearts must be a positive integer.`);
      if (!Array.isArray(labyrinth.semantic_tags) || !labyrinth.semantic_tags.every((tag) => typeof tag === "string")) errors.push(`${path}.semantic_tags must be a string array.`);
      if (!isObject(labyrinth.rewards)) errors.push(`${path}.rewards must be an object.`);
      else {
        if (!Number.isInteger(labyrinth.rewards.attribute_points_each) || Number(labyrinth.rewards.attribute_points_each) < 0) errors.push(`${path}.rewards.attribute_points_each must be a non-negative integer.`);
        if (!Number.isInteger(labyrinth.rewards.session_credit) || Number(labyrinth.rewards.session_credit) < 0) errors.push(`${path}.rewards.session_credit must be a non-negative integer.`);
        if (!isObject(labyrinth.rewards.bonus)) errors.push(`${path}.rewards.bonus must be an object.`);
        else {
          for (const key of ["none_weight", "coins_weight", "item_weight", "coins_min", "coins_max"] as const) {
            const value = labyrinth.rewards.bonus[key];
            if (typeof value !== "number" || !Number.isFinite(value) || value < 0) errors.push(`${path}.rewards.bonus.${key} must be a non-negative number.`);
          }
          if (Number(labyrinth.rewards.bonus.coins_max) < Number(labyrinth.rewards.bonus.coins_min)) errors.push(`${path}.rewards.bonus.coins_max must be >= coins_min.`);
        }
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function getPackSummary(pack: LanguagePack): string {
  return `${pack.title}: ${pack.items.length} items, ${pack.lessons.length} lessons, ${pack.language.name_english}`;
}

function isControlledOrDynamicTag(tag: string, controlledTags: Set<string>): boolean {
  return controlledTags.has(tag) || /^stage:\d+$/.test(tag);
}

function validateAudioReferences(audio: unknown[], path: string, errors: string[], warnings: string[]): void {
  const seenIds = new Set<string>();
  for (const [index, entry] of audio.entries()) {
    if (!isObject(entry)) { errors.push(`${path}[${index}] must be an object.`); continue; }
    requireString(entry, "id", errors, `${path}[${index}]`);
    requireString(entry, "url", errors, `${path}[${index}]`);
    requireString(entry, "license", errors, `${path}[${index}]`);
    if (typeof entry.id === "string") { if (seenIds.has(entry.id)) warnings.push(`${path}[${index}] duplicates audio id within one item: ${entry.id}`); seenIds.add(entry.id); }
    if (entry.source_type && !["human", "automated", "browser_tts"].includes(String(entry.source_type))) errors.push(`${path}[${index}].source_type must be human, automated, or browser_tts.`);
    if (entry.review_status !== "approved" && entry.source_type === "human") warnings.push(`${path}[${index}] human audio is not approved yet: ${entry.id ?? "unknown id"}`);
  }
}

export function getDefaultBaseLanguage(pack: LanguagePack): string {
  return pack.base_language?.code ?? pack.base_languages?.find((language) => language.is_default)?.code ?? pack.source_language ?? "it";
}

export function getLocalizedText(text: LocalizedText | undefined, languageCode: string, fallback = ""): string {
  if (!text) return fallback;
  return text[languageCode] ?? text.en ?? Object.values(text)[0] ?? fallback;
}

export function getItemTranslation(item: LearningItem, languageCode: string): string {
  return getLocalizedText(item.translations, languageCode, item.translation);
}

export function getLetterLabel(letter: LetterItem, languageCode: string): string {
  const name = getLocalizedText(letter.names, languageCode, letter.transliteration ?? letter.sound);
  return `${name} (${letter.sound})`;
}

export function getGrammarTranslation(grammar: GrammarItem, languageCode: string): string {
  return getLocalizedText(grammar.translations, languageCode, grammar.translation);
}

function normalizeItem(item: LearningItem, sourceLanguage: string): LearningItem {
  return {
    ...item,
    translations: { ...(item.translations ?? {}), [sourceLanguage]: item.translation },
    difficulty: item.difficulty === undefined ? undefined : Number(item.difficulty),
    complexity: item.complexity === undefined ? undefined : Number(item.complexity),
    tags: Array.isArray(item.tags) ? item.tags : [],
    audio: Array.isArray(item.audio) ? item.audio : [],
    review_status: item.review_status ?? "draft"
  };
}

function normalizeLetter(letter: LetterItem, sourceLanguage: string): LetterItem {
  return {
    ...letter,
    names: { ...(letter.names ?? {}), [sourceLanguage]: getLocalizedText(letter.names, sourceLanguage, letter.sound) },
    tags: Array.isArray(letter.tags) ? letter.tags : [],
    audio: Array.isArray(letter.audio) ? letter.audio : [],
    similar_letter_ids: Array.isArray(letter.similar_letter_ids) ? letter.similar_letter_ids : [],
    review_status: letter.review_status ?? "draft"
  };
}

function normalizeGrammar(grammar: GrammarItem, sourceLanguage: string): GrammarItem {
  return {
    ...grammar,
    translations: { ...(grammar.translations ?? {}), [sourceLanguage]: grammar.translation },
    prompt: { ...(grammar.prompt ?? {}), [sourceLanguage]: getLocalizedText(grammar.prompt, sourceLanguage, grammar.translation) },
    translation_distractors: normalizeLocalizedStringList(grammar.translation_distractors),
    distractors: Array.isArray(grammar.distractors) ? grammar.distractors : [],
    difficulty: grammar.difficulty === undefined ? undefined : Number(grammar.difficulty),
    complexity: grammar.complexity === undefined ? undefined : Number(grammar.complexity),
    tags: Array.isArray(grammar.tags) ? grammar.tags : [],
    audio: Array.isArray(grammar.audio) ? grammar.audio : [],
    review_status: grammar.review_status ?? "draft"
  };
}

function normalizeMathProblem(problem: FoundationsMathProblem): FoundationsMathProblem {
  return {
    ...problem,
    operands: Array.isArray(problem.operands) ? problem.operands.map(Number) : undefined,
    result: Number(problem.result),
    options: Array.isArray(problem.options) ? problem.options.map(String) : undefined,
    sequence: Array.isArray(problem.sequence) ? problem.sequence.map(String) : undefined,
    audio: Array.isArray(problem.audio) ? problem.audio : [],
    tags: Array.isArray(problem.tags) ? problem.tags : [],
    review_status: problem.review_status ?? "draft"
  };
}

function normalizeReadingProblem(problem: FoundationsReadingProblem): FoundationsReadingProblem {
  return {
    ...problem,
    options: Array.isArray(problem.options) ? problem.options.map(String) : undefined,
    words: Array.isArray(problem.words) ? problem.words.map(String) : undefined,
    audio: Array.isArray(problem.audio) ? problem.audio : [],
    prompt_audio: Array.isArray(problem.prompt_audio) ? problem.prompt_audio : [],
    tags: Array.isArray(problem.tags) ? problem.tags : [],
    review_status: problem.review_status ?? "draft"
  };
}

function normalizeFoundationsInstruction(instruction: FoundationsInstruction): FoundationsInstruction {
  return {
    ...instruction,
    text: isObject(instruction.text) ? instruction.text : { da: String(instruction.text ?? "") },
    audio: Array.isArray(instruction.audio) ? instruction.audio : [],
    tags: Array.isArray(instruction.tags) ? instruction.tags : [],
    review_status: instruction.review_status ?? "draft"
  };
}

function normalizeLocalizedStringList(value: LocalizedStringList | undefined): LocalizedStringList | undefined {
  if (!value || !isObject(value)) return undefined;
  const normalized = Object.fromEntries(
    Object.entries(value)
      .map(([code, entries]) => [code, Array.isArray(entries) ? [...new Set(entries.map((entry) => String(entry).trim()).filter(Boolean))] : []] as const)
      .filter(([, entries]) => entries.length > 0)
  );
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function createLessonsFromItems(items: LearningItem[], letters: LetterItem[], grammarItems: GrammarItem[]): Lesson[] {
  const groups = new Map<string, string[]>();
  for (const item of items) {
    const tag = item.tags[0] ?? "starter";
    groups.set(tag, [...(groups.get(tag) ?? []), item.id]);
  }
  const lessons: Lesson[] = [...groups.entries()].map(([tag, ids], index) => ({
    id: `lesson_${String(index + 1).padStart(2, "0")}_${tag}`,
    title: tag.replaceAll("_", " "),
    item_ids: ids,
    letter_ids: index === 0 ? letters.map((letter) => letter.id) : [],
    grammar_ids: grammarItems.filter((grammar) => grammar.tags.includes(tag)).map((grammar) => grammar.id),
    activity_types: ["select_translation", "listen_and_choose", "repeat_after_me", "letter_recognition", "sentence_order"]
  }));
  return lessons.length > 0 ? lessons : [{ id: "lesson_01_starter", title: "Starter", item_ids: items.map((item) => item.id), letter_ids: letters.map((letter) => letter.id), grammar_ids: grammarItems.map((grammar) => grammar.id), activity_types: ["select_translation"] }];
}

function normalizeStory(value: unknown, sourceLanguage: string): StoryArc | undefined {
  if (!isObject(value) || !Array.isArray(value.milestones)) return undefined;
  return value as unknown as StoryArc;
}

function stringRecord(value: unknown): Record<string, string> {
  if (!isObject(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, v]) => typeof v === "string")) as Record<string, string>;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(obj: Record<string, unknown>, field: string, errors: string[], prefix?: string): void {
  if (typeof obj[field] !== "string" || obj[field] === "") errors.push(`${prefix ? `${prefix}.` : ""}${field} must be a non-empty string.`);
}
