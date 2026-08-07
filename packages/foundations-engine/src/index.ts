import type {
  ActivityType,
  AudioReference,
  FoundationsMathProblem,
  FoundationsReadingProblem,
  GrammarItem,
  LanguagePack,
  LearningItem,
  LetterItem
} from "@hero-lang/content-schema";
import { getLocalizedText } from "@hero-lang/content-schema";
import type {
  AnswerOption,
  HeroStatKey,
  LearnerState,
  QuestionSelectionOptions,
  QuestionVariant,
  TrainingFocus,
  TrainingQuestion
} from "@hero-lang/learning-engine";

export {
  answerQuestion,
  buyShopItem,
  consumeLabyrinthDoorStones,
  createInitialLearnerState,
  ensureLabyrinthDoorRequirement,
  getAverageMastery,
  getLabyrinthDoorRequirement,
  getLevelConfig,
  getLevelStatCap,
  getMaxComplexityForLevel,
  getMaxEnergy,
  getMissingLabyrinthStones,
  getStatValue,
  markEnemyDefeated,
  markLabyrinthCompleted,
  markTrainingSessionCompleted,
  normalizeLearnerState,
  TRAINING_STONE_CAP
} from "@hero-lang/learning-engine";

export type {
  AnswerExplanation,
  AnswerGloss,
  AnswerOption,
  AnswerResult,
  CombatBreakdown,
  HeroStatKey,
  HeroStats,
  LabyrinthDoorRequirement,
  LearnerState,
  PracticeMemory,
  QuestionSelectionOptions,
  ShopItem,
  TrainingFocus,
  TrainingQuestion,
  TrainingStoneInventory
} from "@hero-lang/learning-engine";

const FOCUS_STAT: Record<TrainingFocus, HeroStatKey> = {
  vocabulary: "strength",
  comprehension: "defense",
  grammar: "precision",
  pronunciation: "stamina"
};

const NUMBER_WORDS = ["nul", "en", "to", "tre", "fire", "fem", "seks", "syv", "otte", "ni", "ti", "elleve", "tolv", "tretten", "fjorten", "femten", "seksten", "sytten", "atten", "nitten", "tyve"] as const;
interface ReadingCurriculum {
  items: LearningItem[];
  readingProblems: FoundationsReadingProblem[];
  readingProblemChance: number;
}
function getReadingCurriculum(pack: LanguagePack, selection: QuestionSelectionOptions): ReadingCurriculum {
  const items = filterItems(pack.items, selection);
  const readingProblems = filterReadingProblems(pack.reading_problems ?? [], selection);
  const stage = selection.stage;
  if (stage === undefined || stage >= 3) {
    return {
      items,
      readingProblems,
      readingProblemChance: stage !== undefined && stage >= 10 ? 0.72 : stage !== undefined && stage >= 5 ? 0.58 : 0
    };
  }
  const initialSoundProblems = readingProblems.filter((problem) => problem.domain === "initial_sound");
  if (stage === 0) {
    return { items: [], readingProblems: initialSoundProblems, readingProblemChance: 1 };
  }
  const twoLetterItems = items.filter((item) => (item.graphemes?.length || [...item.target].length) <= 2);
  return {
    items: twoLetterItems,
    readingProblems: initialSoundProblems,
    readingProblemChance: stage === 1 ? 0.7 : 0.45
  };
}
export function hasEligibleQuestion(
  pack: LanguagePack,
  focus: TrainingFocus,
  selection: QuestionSelectionOptions = {}
): boolean {
  if (focus === "vocabulary") return filterLetters(pack.letters ?? [], selection).length >= 2;
  if (focus === "comprehension") {
    const curriculum = getReadingCurriculum(pack, selection);
    return curriculum.items.length >= 1 || curriculum.readingProblems.length >= 1;
  }
  const domains = focus === "grammar"
    ? new Set(["counting", "number_match", "number_order", "comparison", "shape", "pattern", "sorting", "measurement"])
    : new Set(["addition", "subtraction", "number_bond", "story_problem"]);
  return filterMathProblems(pack.math_problems ?? [], selection).some((problem) => domains.has(problem.domain));
}

export function getNextQuestion(
  pack: LanguagePack,
  state: LearnerState,
  baseLanguage = "da",
  focus: TrainingFocus = "vocabulary",
  selection: QuestionSelectionOptions = {}
): TrainingQuestion {
  if (focus === "vocabulary") return getLetterQuestion(pack, state, baseLanguage, selection);
  if (focus === "comprehension") return getReadingQuestion(pack, state, baseLanguage, selection);
  if (focus === "grammar") return getNumberQuestion(pack, state, baseLanguage, selection);
  return getOperationQuestion(pack, state, baseLanguage, selection);
}

function getLetterQuestion(
  pack: LanguagePack,
  state: LearnerState,
  language: string,
  selection: QuestionSelectionOptions
): TrainingQuestion {
  const letters = filterLetters(pack.letters ?? [], selection);
  if (letters.length === 0) throw new Error("No Danish graphemes are available.");
  const letter = chooseCurriculumValue(
    letters,
    selection,
    (entry) => entry.tags ?? [],
    (entry) => state.mastery_by_letter[entry.id]?.mastery ?? 0
  );
  // Sound-led recognition is the main beginner activity. Visual case matching
  // remains useful, but is deliberately less frequent.
  const useInitialSound = Math.random() < 0.75;
  const lowercase = letter.lowercase ?? letter.character;
  const uppercase = letter.uppercase ?? letter.character.toUpperCase();
  const letterName = letter.spoken_name ?? getLocalizedText(letter.names, language, letter.character);
  const example = findLetterExample(pack, letter);

  if (useInitialSound) {
    const exampleWord = example?.target ?? letter.example_word ?? lowercase;
    const instruction = "Lyt til ordet. Hvilket bogstav hører du først?";
    const options = makeLetterOptions(letter, letters, (entry) => entry.lowercase ?? entry.character);
    return {
      id: `foundations:letter-sound:${letter.id}:${Date.now()}`,
      kind: "letter",
      activity_type: "listen_and_choose",
      skill: "vocabulary",
      stat: FOCUS_STAT.vocabulary,
      variant: "letter_sound",
      letter,
      prompt: example?.emoji ?? "👂",
      prompt_hint: "Lyt til ordet, og find det første bogstav.",
      options,
      correct_option_id: optionId(letter.id),
      correct_answer_label: lowercase,
      answer_explanation: {
        target: `${uppercase} ${lowercase}`,
        translation: `Ordet ${exampleWord} begynder med ${lowercase}. Bogstavet hedder ${letterName}.`
      },
      ...narratedQuestion(pack, "instruction_letter_initial", instruction, { requireTarget: true }),
      auto_play_target_audio: true,
      target_audio_text: exampleWord,
      target_audio_lang: "da-DK",
      audio: example?.audio?.length ? example.audio : browserSpeech(exampleWord, `example-${letter.id}`)
    };
  }

  const instruction = "Find det lille bogstav, der passer.";
  const options = makeLetterOptions(letter, letters, (entry) => entry.lowercase ?? entry.character);
  return {
    id: `foundations:letter-case:${letter.id}:${Date.now()}`,
    kind: "letter",
    activity_type: "letter_recognition",
    skill: "vocabulary",
    stat: FOCUS_STAT.vocabulary,
    variant: "target_to_base",
    letter,
    prompt: `${uppercase}  →  ?`,
    prompt_hint: "Find det samme bogstav i den lille form.",
    options,
    correct_option_id: optionId(letter.id),
    correct_answer_label: lowercase,
    answer_explanation: {
      target: `${uppercase} ${lowercase}`,
      translation: `Det store ${uppercase} og det lille ${lowercase} er det samme bogstav.`
    },
    ...narratedQuestion(pack, "instruction_letter_case", instruction),
    allow_target_audio_before_answer: false,
    target_audio_text: letterName,
    target_audio_lang: "da-DK",
    audio: letter.audio?.length ? letter.audio : browserSpeech(letterName, `name-${letter.id}`)
  };
}

function getReadingQuestion(
  pack: LanguagePack,
  state: LearnerState,
  language: string,
  selection: QuestionSelectionOptions
): TrainingQuestion {
  const { items, readingProblems, readingProblemChance } = getReadingCurriculum(pack, selection);
  const stage = selection.stage ?? 0;
  if (readingProblems.length > 0 && (items.length === 0 || Math.random() < readingProblemChance)) {
    const problem = chooseCurriculumValue(
      readingProblems,
      selection,
      (entry) => entry.tags,
      (entry) => state.mastery_by_grammar[entry.id]?.mastery ?? 0
    );
    return readingProblemQuestion(pack, problem, language);
  }

  if (items.length === 0) throw new Error("No Danish reading material is available.");
  const item = chooseCurriculumValue(
    items,
    selection,
    (entry) => entry.tags,
    (entry) => state.mastery_by_item[entry.id]?.mastery ?? 0
  );
  const buildWord = Math.random() < (stage >= 10 ? 0.62 : 0.48) && (item.graphemes?.length ?? 0) >= 2;

  if (buildWord) {
    const correctLetters = item.graphemes ?? [...item.target];
    const knownLetters = filterLetters(pack.letters ?? [], selection).map((letter) => letter.lowercase ?? letter.character);
    const decoys = shuffle(knownLetters.filter((letter) => !correctLetters.includes(letter))).slice(0, correctLetters.length >= 4 ? 2 : 1);
    const chips = shuffle([
      ...correctLetters.map((label, index) => ({ id: `${item.id}-${index}`, label })),
      ...decoys.map((label, index) => ({ id: `${item.id}-decoy-${index}`, label, is_hard_distractor: true }))
    ]);
    return {
      id: `foundations:build-word:${item.id}:${Date.now()}`,
      kind: "item",
      activity_type: "syllable_order",
      skill: "comprehension",
      stat: FOCUS_STAT.comprehension,
      variant: "sentence_tap_order",
      item,
      prompt: item.emoji ?? item.image ?? "🧩",
      prompt_hint: "Byg ordet til billedet.",
      options: chips,
      correct_option_id: correctLetters.join(" "),
      correct_answer_label: item.target,
      expected_answer_length: correctLetters.length,
      answer_explanation: {
        target: item.target,
        translation: getLocalizedText(item.translations, language, item.translation)
      },
      ...narratedQuestion(pack, "instruction_build_word", "Byg ordet, du hører.", { requireTarget: true }),
      auto_play_target_audio: true,
      target_audio_text: item.target,
      target_audio_lang: "da-DK",
      audio: item.audio?.length ? item.audio : browserSpeech(item.target, `word-${item.id}`)
    };
  }

  const distractors = chooseWordDistractors(item, items, 3);
  const generated = [item, ...distractors];
  while (generated.length < 4) generated.push(makePseudoWord(item, generated.length));
  const options = shuffle(generated).map((candidate) => ({ id: optionId(candidate.id), label: candidate.target }));
  return {
    id: `foundations:picture-word:${item.id}:${Date.now()}`,
    kind: "item",
    activity_type: "image_match",
    skill: "comprehension",
    stat: FOCUS_STAT.comprehension,
    variant: "visual_to_target",
    item,
    prompt: item.emoji ?? item.image ?? "🖼️",
    prompt_hint: "Hvilket ord passer til billedet?",
    options,
    correct_option_id: optionId(item.id),
    correct_answer_label: item.target,
    answer_explanation: {
      target: item.target,
      translation: getLocalizedText(item.translations, language, item.translation)
    },
    ...narratedQuestion(pack, "instruction_picture_word", "Se på billedet. Hvilket ord passer?"),
    allow_target_audio_before_answer: false,
    target_audio_text: item.target,
    target_audio_lang: "da-DK",
    audio: item.audio?.length ? item.audio : browserSpeech(item.target, `word-${item.id}`)
  };
}

function readingProblemQuestion(pack: LanguagePack, problem: FoundationsReadingProblem, language: string): TrainingQuestion {
  const grammar = readingProblemToGrammar(problem, language);
  const instruction = getLocalizedText(problem.prompt, language, "Læs og vælg det rigtige svar.");
  const fallbackOptions = problem.options?.length ? problem.options : [problem.answer];
  let prompt = problem.text;
  let promptHint = instruction;
  let options: AnswerOption[] = shuffle([...new Set([problem.answer, ...fallbackOptions])]).map((value) => ({ id: optionId(value), label: value }));
  let activity: ActivityType = "select_target";
  let variant: QuestionVariant = "target_to_base";
  let correctOptionId = optionId(problem.answer);
  let expectedAnswerLength: number | undefined;
  let autoPlayTarget = false;
  let replayTarget = false;
  let requiresTarget = false;
  let targetAudioText = problem.text;
  let instructionId = problem.instruction_id;

  if (problem.domain === "sentence_picture") {
    activity = "image_match";
    variant = "target_to_visual";
    instructionId ??= "instruction_sentence_picture";
    promptHint = "Læs sætningen. Hør den kun som hjælp.";
    replayTarget = true;
  } else if (problem.domain === "sentence_order") {
    activity = "sentence_order";
    variant = "sentence_tap_order";
    const correctWords = problem.words?.length ? problem.words : problem.answer.replace(/[.!?]$/u, "").split(/\s+/);
    const decoyPool = ["og", "ikke", "er", "har", "på", "med"].filter((word) => !correctWords.includes(word));
    options = shuffle([
      ...correctWords.map((label, index) => ({ id: `${problem.id}-${index}`, label })),
      ...shuffle(decoyPool).slice(0, correctWords.length >= 5 ? 2 : 1).map((label, index) => ({ id: `${problem.id}-decoy-${index}`, label, is_hard_distractor: true }))
    ]);
    correctOptionId = correctWords.join(" ");
    expectedAnswerLength = correctWords.length;
    prompt = problem.image ?? "🧩";
    promptHint = "Byg sætningen, du hører.";
    instructionId ??= "instruction_sentence_order";
    autoPlayTarget = true;
    requiresTarget = true;
    targetAudioText = problem.answer;
  } else if (problem.domain === "missing_letter") {
    prompt = `${problem.image ?? "✏️"}   ${problem.text}`;
    promptHint = "Vælg det bogstav, der mangler.";
    instructionId ??= "instruction_missing_letter";
    targetAudioText = problem.text.replace("_", problem.answer);
  } else if (problem.domain === "missing_word") {
    promptHint = "Vælg det ord, der passer i den tomme plads.";
    instructionId ??= "instruction_missing_word";
  } else if (problem.domain === "mini_story") {
    activity = "select_translation";
    variant = "base_to_target";
    promptHint = "Læs historien. Hør den kun som hjælp.";
    instructionId ??= "instruction_read_story";
    autoPlayTarget = false;
    replayTarget = true;
    targetAudioText = problem.text;
  } else if (problem.domain === "initial_sound" || problem.domain === "final_sound") {
    activity = "listen_and_choose";
    variant = "letter_sound";
    prompt = problem.image ?? "👂";
    promptHint = problem.domain === "initial_sound" ? "Find den første lyd." : "Find den sidste lyd.";
    instructionId ??= problem.domain === "initial_sound" ? "instruction_letter_initial" : "instruction_letter_final";
    autoPlayTarget = true;
    requiresTarget = true;
  } else if (problem.domain === "rhyme") {
    activity = "listen_and_choose";
    variant = "audio_to_base";
    prompt = problem.image ?? "🎵";
    promptHint = "Vælg det ord, der rimer.";
    instructionId ??= "instruction_rhyme";
    autoPlayTarget = true;
    requiresTarget = true;
  } else if (problem.domain === "syllable_count") {
    activity = "listen_and_choose";
    variant = "audio_to_base";
    prompt = problem.image ?? "👏";
    promptHint = "Klap ordet, og vælg antallet af stavelser.";
    instructionId ??= "instruction_syllables";
    autoPlayTarget = true;
    requiresTarget = true;
  }

  return {
    id: `foundations:reading:${problem.id}:${Date.now()}`,
    kind: "grammar",
    activity_type: activity,
    skill: "comprehension",
    stat: FOCUS_STAT.comprehension,
    variant,
    grammar,
    prompt,
    prompt_hint: promptHint,
    options,
    correct_option_id: correctOptionId,
    correct_answer_label: problem.answer,
    expected_answer_length: expectedAnswerLength,
    answer_explanation: {
      target: problem.domain === "initial_sound" || problem.domain === "final_sound" || problem.domain === "rhyme" || problem.domain === "syllable_count"
        ? problem.text
        : problem.answer,
      translation: problem.domain === "mini_story" ? instruction : problem.text.replace("___", problem.answer).replace("_", problem.answer)
    },
    ...narratedQuestion(pack, instructionId, instruction, { audio: problem.prompt_audio, requireTarget: requiresTarget }),
    auto_play_target_audio: autoPlayTarget,
    replay_target_audio: replayTarget || autoPlayTarget,
    allow_target_audio_before_answer: replayTarget || autoPlayTarget,
    target_audio_text: targetAudioText,
    target_audio_lang: "da-DK",
    audio: problem.audio?.length ? problem.audio : browserSpeech(targetAudioText, `reading-${problem.id}`)
  };
}

// LEARNING_APP_RELEASE_AB_2026_08: answer-safe Danish audio
function readingProblemToGrammar(problem: FoundationsReadingProblem, language: string): GrammarItem {
  return {
    id: problem.id,
    prompt: problem.prompt,
    target_sentence: problem.answer,
    translation: getLocalizedText(problem.prompt, language, problem.text),
    translations: problem.prompt,
    distractors: (problem.options ?? []).filter((value) => value !== problem.answer),
    tags: problem.tags,
    audio: problem.audio ?? [],
    review_status: problem.review_status
  };
}

function getNumberQuestion(
  pack: LanguagePack,
  state: LearnerState,
  language: string,
  selection: QuestionSelectionOptions
): TrainingQuestion {
  const candidates = filterMathProblems(pack.math_problems ?? [], selection)
    .filter((problem) => ["counting", "number_match", "number_order", "comparison", "shape", "pattern", "sorting", "measurement"].includes(problem.domain));
  if (candidates.length === 0) throw new Error("No counting problems are available.");
  const problem = chooseCurriculumValue(
    candidates,
    selection,
    (entry) => entry.tags,
    (entry) => state.mastery_by_grammar[entry.id]?.mastery ?? 0
  );
  return mathQuestion(pack, problem, "grammar", language);
}

function getOperationQuestion(
  pack: LanguagePack,
  state: LearnerState,
  language: string,
  selection: QuestionSelectionOptions
): TrainingQuestion {
  const candidates = filterMathProblems(pack.math_problems ?? [], selection)
    .filter((problem) => ["addition", "subtraction", "number_bond", "story_problem"].includes(problem.domain));
  if (candidates.length === 0) throw new Error("No arithmetic problems are available.");
  const problem = chooseCurriculumValue(
    candidates,
    selection,
    (entry) => entry.tags,
    (entry) => state.mastery_by_grammar[entry.id]?.mastery ?? 0
  );
  return mathQuestion(pack, problem, "pronunciation", language);
}

function mathQuestion(pack: LanguagePack, problem: FoundationsMathProblem, focus: TrainingFocus, language: string): TrainingQuestion {
  const grammar = mathProblemToGrammar(problem, language);
  const result = problem.result;
  const object = problem.object ?? "●";
  const rangeMin = problem.number_range?.min ?? 0;
  const rangeMax = problem.number_range?.max ?? 10;
  const instruction = getLocalizedText(problem.prompt, language, "Hvad er det rigtige svar?");
  const numberOptions = numericOptions(result, rangeMin, rangeMax);
  let prompt = instruction;
  let promptHint = "Vælg det rigtige tal.";
  let options: AnswerOption[] = numberOptions.map((value) => ({ id: optionId(String(value)), label: String(value) }));
  let activity: ActivityType = "visual_match";
  let variant: QuestionVariant = "target_to_base";
  let correctOptionId = optionId(String(result));
  let correctAnswerLabel = String(result);
  let explanationTarget = String(result);
  let answerAudioText = `Det rigtige svar er ${numberWord(result)}.`;

  if (problem.domain === "counting") {
    prompt = makeObjects(object, result);
    promptHint = "Tæl tingene. Hvor mange er der?";
    answerAudioText = result === 1 ? "Der er en." : `Der er ${numberWord(result)}.`;
  } else if (problem.domain === "number_match") {
    prompt = String(result);
    promptHint = "Hvilken gruppe har så mange?";
    options = shuffle(numberOptions).map((value) => ({ id: optionId(String(value)), label: makeObjects(object, value) }));
  } else if (problem.domain === "number_order") {
    const operands = problem.operands ?? [Math.max(0, result - 1), result + 1];
    prompt = `${operands[0]}  •  ?  •  ${operands[1]}`;
    promptHint = "Hvilket tal mangler i rækken?";
  } else if (problem.domain === "comparison") {
    const [left = 0, right = 0] = problem.operands ?? [];
    prompt = `${makeObjects(object, left)}   │   ${makeObjects(object, right)}`;
    promptHint = "Hvilken side har flest, eller er der lige mange?";
    options = shuffle([
      { id: optionId("left"), label: "⬅️ Flere" },
      { id: optionId("equal"), label: "⚖️ Lige mange" },
      { id: optionId("right"), label: "Flere ➡️" }
    ]);
    const answer = result > 0 ? "left" : result < 0 ? "right" : "equal";
    correctOptionId = optionId(answer);
    correctAnswerLabel = answer === "left" ? "Flest til venstre" : answer === "right" ? "Flest til højre" : "Lige mange";
    explanationTarget = `${left} ${comparisonSymbol(result)} ${right}`;
    answerAudioText = answer === "left" ? "Der er flest til venstre." : answer === "right" ? "Der er flest til højre." : "Der er lige mange.";
  } else if (["shape", "pattern", "sorting", "measurement"].includes(problem.domain)) {
    const answer = problem.answer ?? String(problem.result);
    const choices = problem.options?.length ? problem.options : [answer];
    prompt = problem.domain === "pattern"
      ? (problem.sequence?.join("  ") ?? "🔴  🔵  🔴  🔵  ?")
      : problem.object ?? (problem.sequence?.join("  ") ?? "👀");
    promptHint = instruction;
    options = shuffle([...new Set([answer, ...choices])]).map((value) => ({ id: optionId(value), label: value }));
    correctOptionId = optionId(answer);
    correctAnswerLabel = answer;
    explanationTarget = answer;
    answerAudioText = "Se det rigtige svar på skærmen.";
    activity = "visual_match";
    variant = "target_to_visual";
  } else if (problem.domain === "number_bond") {
    const [known = 0] = problem.operands ?? [];
    const whole = problem.whole ?? known + result;
    prompt = `${known}  +  ?  =  ${whole}`;
    promptHint = "Find den manglende talven.";
    explanationTarget = `${known} + ${result} = ${whole}`;
    answerAudioText = `${numberWord(known)} og ${numberWord(result)} bliver ${numberWord(whole)}.`;
  } else if (problem.domain === "story_problem") {
    const [left = 0, right = 0] = problem.operands ?? [];
    const operation = problem.operation ?? (left - right === result ? "subtraction" : "addition");
    const sign = operation === "addition" ? "+" : "−";
    prompt = `${instruction}\n${makeObjects(object, left)} ${sign} ${makeObjects(object, right)}`;
    promptHint = "Find de vigtige tal, og vælg svaret.";
    activity = "visual_match";
    variant = "target_to_visual";
    explanationTarget = `${left} ${sign} ${right} = ${result}`;
    answerAudioText = operation === "addition"
      ? `${numberWord(left)} plus ${numberWord(right)} er ${numberWord(result)}.`
      : `${numberWord(left)} minus ${numberWord(right)} er ${numberWord(result)}.`;
  } else {
    const [left = 0, right = 0] = problem.operands ?? [];
    const sign = problem.domain === "addition" ? "+" : "−";
    prompt = `${makeObjects(object, left)}  ${sign}  ${makeObjects(object, right)}`;
    promptHint = problem.domain === "addition"
      ? "Læg grupperne sammen. Hvor mange er der i alt?"
      : "Tag den anden gruppe væk. Hvor mange er der tilbage?";
    activity = "visual_match";
    variant = "target_to_visual";
    explanationTarget = `${left} ${sign} ${right} = ${result}`;
    answerAudioText = problem.domain === "addition"
      ? `${numberWord(left)} plus ${numberWord(right)} er ${numberWord(result)}.`
      : `${numberWord(left)} minus ${numberWord(right)} er ${numberWord(result)}.`;
  }

  return {
    id: `foundations:math:${problem.id}:${Date.now()}`,
    kind: "grammar",
    activity_type: activity,
    skill: focus,
    stat: FOCUS_STAT[focus],
    variant,
    grammar,
    prompt,
    prompt_hint: promptHint,
    options,
    correct_option_id: correctOptionId,
    correct_answer_label: correctAnswerLabel,
    answer_explanation: {
      target: explanationTarget,
      translation: instruction
    },
    ...narratedQuestion(pack, problem.instruction_id, instruction, { audio: problem.audio }),
    allow_target_audio_before_answer: false,
    target_audio_text: answerAudioText,
    target_audio_lang: "da-DK",
    audio: browserSpeech(answerAudioText, `math-answer-${problem.id}`)
  };
}

function mathProblemToGrammar(problem: FoundationsMathProblem, language: string): GrammarItem {
  const [left, right] = problem.operands ?? [];
  const awarenessAnswer = problem.answer ?? String(problem.result);
  const equation = problem.domain === "addition"
    ? `${left} + ${right} = ${problem.result}`
    : problem.domain === "subtraction"
      ? `${left} − ${right} = ${problem.result}`
      : problem.domain === "number_bond"
        ? `${left} + ${problem.result} = ${problem.whole ?? Number(left) + problem.result}`
        : problem.domain === "story_problem"
          ? `${left} ${problem.operation === "subtraction" ? "−" : "+"} ${right} = ${problem.result}`
          : problem.domain === "comparison"
            ? `${left} ${comparisonSymbol(problem.result)} ${right}`
            : ["shape", "pattern", "sorting", "measurement"].includes(problem.domain)
              ? awarenessAnswer
              : String(problem.result);
  const distractors = ["shape", "pattern", "sorting", "measurement"].includes(problem.domain)
    ? (problem.options ?? []).filter((value) => value !== awarenessAnswer)
    : numericOptions(problem.result, problem.number_range?.min ?? 0, problem.number_range?.max ?? 10)
      .filter((value) => value !== problem.result)
      .map(String);
  return {
    id: problem.id,
    prompt: problem.prompt,
    target_sentence: equation,
    translation: getLocalizedText(problem.prompt, language, equation),
    translations: problem.prompt,
    distractors,
    tags: problem.tags,
    audio: problem.audio ?? [],
    review_status: problem.review_status
  };
}

function narratedQuestion(
  pack: LanguagePack,
  instructionId: string | undefined,
  fallbackText: string,
  options: { audio?: AudioReference[]; requireTarget?: boolean } = {}
): Pick<TrainingQuestion,
  "instruction_audio_text" | "instruction_audio_lang" | "instruction_audio" | "auto_narrate" | "single_audio_control" | "requires_audio_before_answer"
> {
  const stored = instructionId
    ? pack.foundations_instructions?.find((instruction) => instruction.id === instructionId)
    : undefined;
  const instructionText = stored ? getLocalizedText(stored.text, "da", fallbackText) : fallbackText;
  const audio = options.audio?.length
    ? options.audio
    : stored?.audio?.length
      ? stored.audio
      : browserSpeech(instructionText, `instruction-${instructionId ?? hashText(instructionText)}`);
  return {
    instruction_audio_text: instructionText,
    instruction_audio_lang: "da-DK",
    instruction_audio: audio,
    auto_narrate: true,
    single_audio_control: true,
    requires_audio_before_answer: Boolean(options.requireTarget)
  };
}

function findLetterExample(pack: LanguagePack, letter: LetterItem): LearningItem | undefined {
  const explicitIds = letter.example_item_ids ?? [];
  const explicit = explicitIds.map((id) => pack.items.find((item) => item.id === id)).find(Boolean);
  if (explicit) return explicit;
  const lowercase = letter.lowercase ?? letter.character;
  return pack.items.find((item) => item.graphemes?.[0] === lowercase);
}

function filterLetters(letters: LetterItem[], selection: QuestionSelectionOptions): LetterItem[] {
  return letters.filter((letter) => matchesStage(letter.tags ?? [], selection.stage));
}

function filterItems(items: LearningItem[], selection: QuestionSelectionOptions): LearningItem[] {
  return items.filter((item) => matchesStage(item.tags, selection.stage) && (selection.includeExtension || !item.tags.includes("tier:extension")));
}

function filterMathProblems(problems: FoundationsMathProblem[], selection: QuestionSelectionOptions): FoundationsMathProblem[] {
  return problems.filter((problem) => matchesStage(problem.tags, selection.stage));
}

function filterReadingProblems(problems: FoundationsReadingProblem[], selection: QuestionSelectionOptions): FoundationsReadingProblem[] {
  return problems.filter((problem) => matchesStage(problem.tags, selection.stage));
}

function matchesStage(tags: string[], stage: number | undefined): boolean {
  if (stage === undefined) return true;
  const itemStage = getStage(tags);
  return itemStage <= stage;
}

function getStage(tags: string[]): number {
  const tag = tags.find((candidate) => candidate.startsWith("stage:"));
  if (!tag) return 0;
  const value = Number(tag.slice("stage:".length));
  return Number.isFinite(value) ? value : 0;
}

function chooseCurriculumValue<T>(
  values: T[],
  selection: QuestionSelectionOptions,
  tags: (value: T) => string[],
  mastery: (value: T) => number
): T {
  if (values.length === 0) throw new Error("Cannot choose from an empty curriculum pool.");
  const stage = selection.stage;
  if (stage === undefined) return chooseByMastery(values, mastery);
  const current = values.filter((value) => getStage(tags(value)) === stage);
  const review = values.filter((value) => getStage(tags(value)) < stage);
  const useReview = review.length > 0 && (current.length === 0 || Math.random() < (selection.reviewChance ?? 0.3));
  return chooseByMastery(useReview ? review : current.length > 0 ? current : values, mastery);
}

function makeLetterOptions(letter: LetterItem, letters: LetterItem[], label: (entry: LetterItem) => string): AnswerOption[] {
  const choices = [letter, ...shuffle(letters.filter((candidate) => candidate.id !== letter.id)).slice(0, 3)];
  return shuffle(choices).map((entry) => ({ id: optionId(entry.id), label: label(entry) }));
}

function chooseWordDistractors(item: LearningItem, items: LearningItem[], count: number): LearningItem[] {
  const sameLength = items.filter((candidate) => candidate.id !== item.id && candidate.target.length === item.target.length);
  const others = items.filter((candidate) => candidate.id !== item.id && !sameLength.some((same) => same.id === candidate.id));
  return shuffle([...shuffle(sameLength), ...shuffle(others)]).slice(0, count);
}

function numericOptions(correct: number, min: number, max: number): number[] {
  const values = new Set<number>([correct]);
  const safeMin = Math.min(min, correct);
  const safeMax = Math.max(max, correct);
  const candidates = shuffle(Array.from({ length: Math.max(1, safeMax - safeMin + 1) }, (_, index) => safeMin + index).filter((value) => value !== correct));
  for (const value of candidates) {
    values.add(value);
    if (values.size >= 4) break;
  }
  let extra = safeMax + 1;
  while (values.size < 4) values.add(extra++);
  return shuffle([...values]);
}

function makeObjects(object: string, count: number): string {
  if (count <= 0) return "∅";
  return Array.from({ length: count }, () => object).join(" ");
}

function browserSpeech(text: string, id: string): AudioReference[] {
  return [{
    id: `browser-${id}`,
    url: "browser-tts:da-DK",
    text,
    source_type: "browser_tts",
    provider: "system",
    license: "device voice",
    review_status: "draft"
  }];
}

function makePseudoWord(item: LearningItem, index: number): LearningItem {
  const letters = [...item.target];
  const rotated = letters.length > 1
    ? [...letters.slice(index % letters.length), ...letters.slice(0, index % letters.length)].join("")
    : `${item.target}${index}`;
  return { ...item, id: `${item.id}-pseudo-${index}`, target: rotated === item.target ? [...letters].reverse().join("") : rotated };
}

function chooseByMastery<T>(values: T[], mastery: (value: T) => number): T {
  const ranked = [...values].sort((left, right) => mastery(left) - mastery(right));
  const pool = ranked.slice(0, Math.max(1, Math.ceil(ranked.length / 2)));
  return pool[Math.floor(Math.random() * pool.length)] ?? ranked[0];
}

function numberWord(value: number): string {
  return NUMBER_WORDS[value] ?? String(value);
}

function comparisonSymbol(value: number): string {
  return value > 0 ? ">" : value < 0 ? "<" : "=";
}

function optionId(value: string): string {
  return `answer:${value}`;
}

function hashText(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  return Math.abs(hash).toString(36);
}

function shuffle<T>(values: T[]): T[] {
  const next = [...values];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [next[index], next[swap]] = [next[swap], next[index]];
  }
  return next;
}
