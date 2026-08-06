import { useEffect, useMemo, useRef, useState } from "react";
import type { AudioReference, LanguagePack, PackLabyrinthConfig, PackLevel } from "@hero-lang/content-schema";
import { buildLanguagePackFromSources, getDefaultBaseLanguage, getLocalizedText, validateLanguagePack } from "@hero-lang/content-schema";
import {
  answerQuestion,
  buyShopItem,
  consumeLabyrinthDoorStones,
  ensureLabyrinthDoorRequirement,
  getLabyrinthDoorRequirement,
  getMissingLabyrinthStones,
  getLevelConfig,
  getLevelStatCap,
  getNextQuestion,
  hasEligibleQuestion,
  markEnemyDefeated,
  markLabyrinthCompleted,
  markTrainingSessionCompleted,
  normalizeLearnerState,
  type AnswerResult,
  type HeroStatKey,
  type LearnerState,
  type TrainingFocus,
  type TrainingQuestion
} from "@hero-lang/foundations-engine";
import { installAudioUnlock, isAudioEnabled, playLearningAudio, playSound, resetLearningAudioState, setAudioEnabled, setLearningAudioMode, unlockAudio } from "../../web/src/audio";
import { AdminPanel } from "../../web/src/components/AdminPanel";
import { EnergyBars } from "../../web/src/components/EnergyBars";
import { HeroStatsPanel } from "../../web/src/components/HeroStatsPanel";
import { LabyrinthPanel } from "../../web/src/components/LabyrinthPanel";
import { PhaserWorld, type WorldEncounter } from "../../web/src/components/PhaserWorld";
import { QuestionCard } from "../../web/src/components/QuestionCard";
import { OfflineStatus } from "../../web/src/components/OfflineStatus";
import { InstallAppButton } from "../../web/src/components/InstallAppButton";
import { SettingsPanel } from "../../web/src/components/SettingsPanel";
import { ShopPanel } from "../../web/src/components/ShopPanel";
import { StoryPanel } from "../../web/src/components/StoryPanel";
import { DeviceViewport } from "../../web/src/components/layout/DeviceViewport";
import { SessionLayout } from "../../web/src/components/game/SessionLayout";
import { HomeDashboard } from "../../web/src/components/game/HomeDashboard";
import { loadLocalPack, mergeContributionIntoPack, resetLocalPack, saveLocalPack, type ContentContribution } from "../../web/src/contentMerge";
import {
  getEnemyForLevel,
  getEffectiveEnemyEnergy,
  getFightDamageDetails,
  getFightGate,
  getFightHeroEnergy,
  getFightMistakeDetails,
  getFightQuestionTarget,
  getFightMaxQuestions,
  getFightParTimeSeconds,
  getSpeedBonusMultiplier,
  getMaxMistakesForTrainingCompletion,
  getQuestionsPerTraining,
  getTrainingOptions,
  getVisibleShopItems,
  MIN_FIGHT_QUESTIONS,
  type EnemyConfig,
  type HeroActionEvent,
  type HeroActionName
} from "../../web/src/gameConfig";
import { setActivePackCopy, t } from "../../web/src/i18n";
import {
  loadAppSettings,
  loadChildProfiles,
  loadActiveProfileId,
  clearLabyrinthSession,
  loadLabyrinthSession,
  loadLearnerState,
  resetLearnerState,
  saveActiveProfileId,
  saveAppSettings,
  saveChildProfiles,
  saveLabyrinthSession,
  saveLearnerState,
  type AppSettings,
  type ChildProfile
} from "./storage";
import packYaml from "../../../content-packs/da-foundations/pack.yaml?raw";
import interfaceYaml from "../../../content-packs/da-foundations/interface.yaml?raw";
import tagsYaml from "../../../content-packs/da-foundations/tags.yaml?raw";
import tasksYaml from "../../../content-packs/da-foundations/tasks.yaml?raw";
import levelsYaml from "../../../content-packs/da-foundations/levels.yaml?raw";
import enemiesYaml from "../../../content-packs/da-foundations/enemies.yaml?raw";
import {
  appendLabyrinthLog,
  completeCurrentLabyrinthEncounter,
  createLabyrinthSession,
  getCurrentLabyrinthEncounter,
  getCurrentLabyrinthFocus,
  getTrapHeartLoss,
  moveLabyrinthSession,
  sanitizeLabyrinthSession,
  type LabyrinthSession
} from "../../web/src/labyrinth";
import storyYaml from "../../../content-packs/da-foundations/story.yaml?raw";
import labyrinthsYaml from "../../../content-packs/da-foundations/labyrinths.yaml?raw";
import wordsJsonl from "../../../content-packs/da-foundations/dictionary/words.jsonl?raw";
import lettersJsonl from "../../../content-packs/da-foundations/dictionary/letters.jsonl?raw";
import sentencesJsonl from "../../../content-packs/da-foundations/dictionary/sentences.jsonl?raw";
import mathProblemsJsonl from "../../../content-packs/da-foundations/curriculum/math-problems.jsonl?raw";
import readingProblemsJsonl from "../../../content-packs/da-foundations/curriculum/reading-problems.jsonl?raw";
import instructionsJsonl from "../../../content-packs/da-foundations/curriculum/instructions.jsonl?raw";
import { ParentProgressPanel } from "../../web/src/components/ParentProgressPanel";
import { useOfflineState } from "../../web/src/offline";
import "../../web/src/App.css";

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

interface FeedbackState {
  correct: boolean;
  timedOut?: boolean;
  correctAnswer: string;
  selectedOptionId?: string;
  correctOptionId?: string;
  statCapReached?: boolean;
  damage?: number;
  energyLoss?: number;
  absorbedDamage?: number;
  combatLabelKey?: string;
  speedBonusPercent?: number;
}

interface NoticeState {
  titleKey: string;
  bodyKey: string;
}

interface TrainingSession {
  focus: TrainingFocus;
  index: number;
  correctCount: number;
  mistakeCount: number;
  maxMistakes: number;
  locked: boolean;
  practiceState: LearnerState;
  question: TrainingQuestion;
  feedback: FeedbackState | null;
}

interface FightSession {
  enemy: EnemyConfig;
  index: number;
  correctCount: number;
  mistakeCount: number;
  locked: boolean;
  heroEnergy: number;
  heroMaxEnergy: number;
  enemyEnergy: number;
  enemyMaxEnergy: number;
  questionsRequired: number;
  maxQuestions: number;
  timerSeconds: number;
  questionStartedAt: number;
  audioStartedAt?: number;
  question: TrainingQuestion;
  feedback: FeedbackState | null;
}

interface LabyrinthResultState {
  success: boolean;
  bonusCoins: number;
  bonusItemNameKey?: string;
}

type PendingEncounter =
  | { type: "training"; focus: TrainingFocus; key: number }
  | { type: "fight"; enemy: EnemyConfig; key: number }
  | { type: "labyrinth"; key: number };

export default function App() {
  const [pack, setPack] = useState<LanguagePack>(() => loadLocalPack(starterPack));
  const validation = useMemo(() => validateLanguagePack(pack), [pack]);
  const [profiles, setProfilesState] = useState<ChildProfile[]>(() => loadChildProfiles());
  const [activeProfileId, setActiveProfileIdState] = useState(() => loadActiveProfileId(loadChildProfiles()));
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0];
  const [settings, setSettingsState] = useState<AppSettings>(() => loadAppSettings(pack));
  const offlineState = useOfflineState();
  const [learnerState, setLearnerState] = useState<LearnerState>(() => loadLearnerState(pack, activeProfile ?? profiles[0]));
  const [trainingMenuOpen, setTrainingMenuOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [profileSwitcherOpen, setProfileSwitcherOpen] = useState(false);
  const [pendingEncounter, setPendingEncounter] = useState<PendingEncounter | null>(null);
  const [audioOn, setAudioOn] = useState(() => isAudioEnabled());
  const [trainingSession, setTrainingSession] = useState<TrainingSession | null>(null);
  const [fightSession, setFightSession] = useState<FightSession | null>(null);
  const [labyrinthSession, setLabyrinthSession] = useState<LabyrinthSession | null>(null);
  const [labyrinthOpen, setLabyrinthOpen] = useState(false);
  const [labyrinthResult, setLabyrinthResult] = useState<LabyrinthResultState | null>(null);
  const [fightGate, setFightGate] = useState<ReturnType<typeof getFightGate> | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [actionEvent, setActionEvent] = useState<HeroActionEvent | null>(null);
  const actionSerial = useRef(0);
  const labyrinthMoveLockUntil = useRef(0);
  const trainingSessionRef = useRef<TrainingSession | null>(null);

  const labyrinthConfig = useMemo(
    () => getLabyrinthForLevel(pack, learnerState.level),
    [pack, learnerState.level]
  );
  const activeLabyrinthConfig = useMemo(() => {
    if (!labyrinthSession) return labyrinthConfig;
    return (pack.labyrinths ?? []).find((config) => config.id === labyrinthSession.configId) ?? labyrinthConfig;
  }, [pack.labyrinths, labyrinthConfig, labyrinthSession?.configId]);
  const labyrinthActive = labyrinthOpen && Boolean(labyrinthSession && activeLabyrinthConfig);
  const sessionActive = Boolean(trainingSession || fightSession || labyrinthActive);
  const pathBusy = sessionActive || Boolean(pendingEncounter);
  const overlaysBusy = pathBusy || adminOpen || settingsOpen || progressOpen || profileSwitcherOpen || Boolean(fightGate) || Boolean(labyrinthResult);
  const currentQuestion = trainingSession?.question ?? fightSession?.question ?? (labyrinthActive ? labyrinthSession?.currentQuestion : null) ?? null;
  const baseLanguage = getDefaultBaseLanguage(pack);
  const trainingOptions = useMemo(() => getTrainingOptions(pack), [pack]);
  const labyrinthDoorRequirement = labyrinthConfig ? getLabyrinthDoorRequirement(learnerState, labyrinthConfig.id) : undefined;
  const labyrinthMissingStones = labyrinthConfig ? getMissingLabyrinthStones(learnerState, labyrinthConfig.id) : [];
  const questionsPerTraining = getQuestionsPerTraining(pack);
  const maxMistakesForTraining = getMaxMistakesForTrainingCompletion(pack);
  const currentEnemy = getEnemyForLevel(pack, learnerState.level);
  const currentLevelConfig = getLevelConfig(pack, learnerState.level);
  const encounter: WorldEncounter | null = pendingEncounter
    ? pendingEncounter.type === "fight"
      ? { type: "fight", enemy: pendingEncounter.enemy }
      : pendingEncounter.type === "training"
        ? { type: "training", focus: pendingEncounter.focus }
        : { type: "labyrinth" }
    : fightSession
      ? { type: "fight", enemy: fightSession.enemy }
      : trainingSession
        ? { type: "training", focus: trainingSession.focus }
        : labyrinthActive
          ? { type: "labyrinth" }
          : null;
  const encounterMode = pendingEncounter ? "approaching" : sessionActive ? "active" : null;

  useEffect(() => installAudioUnlock(), []);

  useEffect(() => {
    trainingSessionRef.current = trainingSession;
  }, [trainingSession]);

  useEffect(() => {
    setLearningAudioMode(settings.audioMode);
    saveAppSettings(settings);
  }, [settings]);

  useEffect(() => {
    setActivePackCopy(pack.ui_text);
  }, [pack]);

  useEffect(() => {
    if (!activeProfile) return;
    saveLearnerState(pack, activeProfile.id, learnerState);
  }, [pack, activeProfile?.id, learnerState]);

  useEffect(() => {
    if (!labyrinthConfig || labyrinthSession?.configId === labyrinthConfig.id) return;
    setLearnerState((previous) => ensureLabyrinthDoorRequirement(previous, labyrinthConfig.id));
  }, [labyrinthConfig?.id, labyrinthSession?.configId]);

  useEffect(() => {
    saveChildProfiles(profiles);
    if (!profiles.some((profile) => profile.id === activeProfileId) && profiles[0]) {
      setActiveProfileId(profiles[0].id);
    }
  }, [profiles]);

  useEffect(() => {
    if (!activeProfile) return;
    setLearnerState((previous) => previous.hero_name === activeProfile.name ? previous : { ...previous, hero_name: activeProfile.name });
  }, [activeProfile?.name]);

  useEffect(() => {
    if (!activeProfile) return;
    setLearnerState((previous) => normalizeLearnerState(pack, previous, activeProfile.name));
  }, [pack.pack_id, pack.version]);

  useEffect(() => {
    if (!activeProfile) return;
    const savedLearner = loadLearnerState(pack, activeProfile);
    const stored = loadLabyrinthSession(pack, activeProfile.id);
    const config = getStoredLabyrinthConfig(pack, stored, savedLearner.level);
    const restored = config && stored
      ? restoreLabyrinthSession(pack, activeProfile.name, savedLearner, config, stored)
      : null;
    if (stored && !restored) clearLabyrinthSession(pack, activeProfile.id);
    setLabyrinthSession(restored);
    setLabyrinthOpen(false);
    setLabyrinthResult(null);
  }, [activeProfileId, pack.pack_id, pack.version]);

  useEffect(() => {
    resetLearningAudioState();
    if (!currentQuestion || !audioOn) return;
    // The shared QuestionCard owns narrated Danish tasks. Narration starts
    // automatically, but it never blocks the child from answering.
    if (currentQuestion.auto_narrate) return () => resetLearningAudioState();
    if (currentQuestion.activity_type === "listen_and_choose" || currentQuestion.activity_type === "repeat_after_me") {
      const handle = window.setTimeout(() => {
        void playLearningAudio(currentQuestion.audio, currentQuestion.target_audio_text, currentQuestion.target_audio_lang ?? pack.language.bcp47).then((played) => {
          if (played) {
            // Listening questions begin their optional speed bonus only after
            // the first playback has finished. Replays never reset the timer.
            setFightSession((previous) => previous?.question.id === currentQuestion.id && !previous.audioStartedAt
              ? { ...previous, audioStartedAt: Date.now(), questionStartedAt: Date.now() }
              : previous);
          } else if (settings.debug) {
            console.warn("Learning audio was unavailable for question", currentQuestion.id);
          }
        });
      }, 140);
      return () => {
        window.clearTimeout(handle);
        resetLearningAudioState();
      };
    }
    return () => resetLearningAudioState();
  }, [currentQuestion?.id, audioOn, settings.audioMode]);

  function triggerAction(name: HeroActionName) {
    actionSerial.current += 1;
    setActionEvent({ name, serial: actionSerial.current });
  }

  function persistLabyrinthSession(next: LabyrinthSession | null) {
    setLabyrinthSession(next);
    if (!activeProfile) return;
    if (next) saveLabyrinthSession(pack, activeProfile.id, next);
    else clearLabyrinthSession(pack, activeProfile.id);
  }

  function setProfiles(profilesNext: ChildProfile[]) {
    setProfilesState(profilesNext);
    saveChildProfiles(profilesNext);
  }

  function setActiveProfileId(profileId: string) {
    resetLearningAudioState();
    const latestProfiles = loadChildProfiles();
    const profile = profiles.find((candidate) => candidate.id === profileId) ?? latestProfiles.find((candidate) => candidate.id === profileId);
    if (profile && !profiles.some((candidate) => candidate.id === profile.id)) {
      setProfilesState([...profiles, profile]);
    }
    setActiveProfileIdState(profileId);
    saveActiveProfileId(profileId);
    if (profile) {
      const nextLearner = loadLearnerState(pack, profile);
      setLearnerState(nextLearner);
      const stored = loadLabyrinthSession(pack, profile.id);
      const config = getStoredLabyrinthConfig(pack, stored, nextLearner.level);
      const restored = config && stored
        ? restoreLabyrinthSession(pack, profile.name, nextLearner, config, stored)
        : null;
      if (stored && !restored) clearLabyrinthSession(pack, profile.id);
      setLabyrinthSession(restored);
    }
    setTrainingMenuOpen(false);
    setShopOpen(false);
    setAdminOpen(false);
    setSettingsOpen(false);
    setProgressOpen(false);
    setProfileSwitcherOpen(false);
    setTrainingSession(null);
    setFightSession(null);
    setLabyrinthOpen(false);
    setLabyrinthResult(null);
    setPendingEncounter(null);
    setFightGate(null);
    triggerAction("jump");
  }

  function setSettings(settingsNext: AppSettings) {
    setSettingsState(settingsNext);
    saveAppSettings(settingsNext);
  }

  async function toggleAudio() {
    resetLearningAudioState();
    const next = !audioOn;
    await setAudioEnabled(next);
    setAudioOn(next);
    if (next) playSound("start");
  }

  function playSubmittedAnswerAudio(question: TrainingQuestion): Promise<boolean> {
    resetLearningAudioState();
    if (!audioOn || !isAudioEnabled()) return Promise.resolve(false);
    const fallbackText = question.target_audio_text
      ?? question.answer_explanation?.target
      ?? question.options.find((option) => option.id === question.correct_option_id)?.label;
    return playLearningAudio(
      question.audio,
      fallbackText,
      question.target_audio_lang ?? pack.language.bcp47
    );
  }

  function runAfterAnswerAudio(
    playback: Promise<boolean>,
    minimumFeedbackMs: number,
    callback: () => void
  ): void {
    const startedAt = Date.now();
    void playback.finally(() => {
      const remaining = Math.max(0, minimumFeedbackMs - (Date.now() - startedAt));
      window.setTimeout(callback, remaining);
    });
  }

  function startTraining(focus: TrainingFocus) {
    if (pathBusy) return;
    const selection = getTrainingSelection(pack, learnerState.level, settings.audioMode, focus);
    if (!hasEligibleQuestion(pack, focus, selection)) {
      setNotice({ titleKey: "audioUnavailableTitle", bodyKey: "audioUnavailableBody" });
      setTrainingMenuOpen(false);
      triggerAction("stumble");
      playSound("wrong");
      return;
    }
    resetLearningAudioState();
    void unlockAudio();
    setNotice(null);
    setShopOpen(false);
    setAdminOpen(false);
    setSettingsOpen(false);
    setTrainingMenuOpen(false);
    setFightSession(null);
    const pending: PendingEncounter = { type: "training", focus, key: Date.now() };
    setPendingEncounter(pending);
    triggerAction("run");
    playSound("start");

    window.setTimeout(() => {
      setTrainingSession({
        focus,
        index: 0,
        correctCount: 0,
        mistakeCount: 0,
        maxMistakes: maxMistakesForTraining,
        locked: false,
        practiceState: learnerState,
        question: getNextQuestion(pack, learnerState, baseLanguage, focus, selection),
        feedback: null
      });
      setPendingEncounter((previous) => (previous?.key === pending.key ? null : previous));
      triggerAction(getTrainingAction(focus));
    }, 1050);
  }

  function handleTrainingAnswer(selectedOptionId: string) {
    if (!trainingSession || trainingSession.locked) return;

    const result = answerQuestion(trainingSession.question, selectedOptionId, trainingSession.practiceState, {
      mode: "training",
      statCap: settings.debugBypass ? Number.POSITIVE_INFINITY : getLevelStatCap(learnerState.level, pack)
    });
    playAnswerAudio(result, false);
    const answerPlayback = result.correct ? Promise.resolve(false) : playSubmittedAnswerAudio(trainingSession.question);
    triggerAction(result.correct ? getTrainingAction(trainingSession.focus) : randomFailAction());

    const answeredSession: TrainingSession = {
      ...trainingSession,
      locked: true,
      correctCount: trainingSession.correctCount + (result.correct ? 1 : 0),
      mistakeCount: trainingSession.mistakeCount + (result.correct ? 0 : 1),
      practiceState: result.updated_state,
      feedback: toFeedback(result, selectedOptionId, trainingSession.question.correct_option_id)
    };
    trainingSessionRef.current = answeredSession;
    setTrainingSession(answeredSession);

    // Correct answers keep the quick automatic rhythm. After a mistake the
    // rich explanation remains on screen until the learner explicitly continues.
    if (result.correct) {
      runAfterAnswerAudio(answerPlayback, 2300, () => advanceTrainingAfterFeedback(answeredSession.question.id));
    }
  }

  function advanceTrainingAfterFeedback(expectedQuestionId: string) {
    const session = trainingSessionRef.current;
    if (!session || !session.locked || !session.feedback || session.question.id !== expectedQuestionId) return;

    const nextIndex = session.index + 1;
    if (nextIndex >= questionsPerTraining) {
      const awardAttributePoint = settings.debugBypass || session.mistakeCount < session.maxMistakes;
      triggerAction(awardAttributePoint ? "victory" : "stumble");
      playSound(awardAttributePoint ? "coin" : "wrong");
      // Finishing the full ten-question session always earns its training stone.
      // The attribute point still reflects performance.
      setLearnerState(markTrainingSessionCompleted(session.practiceState, session.focus, pack, awardAttributePoint));
      trainingSessionRef.current = null;
      setTrainingSession(null);
      return;
    }

    const nextSession: TrainingSession = {
      ...session,
      index: nextIndex,
      locked: false,
      feedback: null,
      question: getNextQuestion(
        pack,
        session.practiceState,
        baseLanguage,
        session.focus,
        getTrainingSelection(pack, session.practiceState.level, settings.audioMode, session.focus)
      )
    };
    trainingSessionRef.current = nextSession;
    setTrainingSession(nextSession);
  }

  function startLabyrinth() {
    if (pathBusy) return;
    const config = activeLabyrinthConfig ?? labyrinthConfig;
    if (!config) {
      setNotice({ titleKey: "labyrinthShort", bodyKey: "labyrinthNotAvailable" });
      return;
    }

    const resuming = labyrinthSession?.configId === config.id;
    let stateForRun = learnerState;
    if (!resuming) {
      const withRequirement = ensureLabyrinthDoorRequirement(learnerState, config.id);
      const missing = getMissingLabyrinthStones(withRequirement, config.id);
      if (missing.length > 0) {
        if (withRequirement !== learnerState) setLearnerState(withRequirement);
        setNotice({ titleKey: "labyrinthDoorLockedTitle", bodyKey: "labyrinthDoorLockedBody" });
        setTrainingMenuOpen(true);
        triggerAction("stumble");
        playSound("wrong");
        return;
      }
      const consumed = consumeLabyrinthDoorStones(withRequirement, config.id);
      if (!consumed.ok) {
        setLearnerState(withRequirement);
        setNotice({ titleKey: "labyrinthDoorLockedTitle", bodyKey: "labyrinthDoorLockedBody" });
        return;
      }
      stateForRun = consumed.state;
      setLearnerState(stateForRun);
    }

    resetLearningAudioState();
    void unlockAudio();
    setNotice(null);
    setLabyrinthResult(null);
    setTrainingMenuOpen(false);
    setShopOpen(false);
    setAdminOpen(false);
    setSettingsOpen(false);
    setProgressOpen(false);
    setProfileSwitcherOpen(false);
    setTrainingSession(null);
    setFightSession(null);
    setPendingEncounter(null);

    let next = resuming && labyrinthSession
      ? rebaseLabyrinthSession(labyrinthSession, stateForRun)
      : createLabyrinthSession(config, stateForRun);
    next = ensureLabyrinthQuestion(next, config);
    persistLabyrinthSession(next);
    setLabyrinthOpen(true);
    playSound("start");
  }

  function ensureLabyrinthQuestion(
    session: LabyrinthSession,
    config: PackLabyrinthConfig
  ): LabyrinthSession {
    if (session.status !== "question") return session;
    if (session.currentQuestion && questionAudioIsEligible(session.currentQuestion, settings.audioMode)) return session;
    const focus = getCurrentLabyrinthFocus(session);
    if (!focus) return session;
    return {
      ...session,
      currentQuestion: getLabyrinthQuestionWithFallback(
        pack,
        session.practiceState,
        baseLanguage,
        config,
        settings.audioMode,
        focus
      ),
      locked: false,
      feedback: null
    };
  }

  function handleLabyrinthMove(cellId: string) {
    if (!labyrinthSession || !activeLabyrinthConfig || labyrinthSession.locked) return;

    // Prevent very fast taps/key presses from applying two moves against the
    // same pre-render session snapshot. This keeps touch and keyboard input
    // deterministic without making normal navigation feel sluggish.
    const now = Date.now();
    if (now < labyrinthMoveLockUntil.current) return;

    const result = moveLabyrinthSession(labyrinthSession, cellId, activeLabyrinthConfig);
    if (result.event === "invalid") return;
    labyrinthMoveLockUntil.current = now + 160;

    let next = result.session;
    if (result.event === "encounter") {
      next = ensureLabyrinthQuestion(next, activeLabyrinthConfig);
      playSound("start");
    } else if (result.event === "treasure_locked") {
      playSound("wrong");
    } else if (result.event === "cache") {
      playSound("coin");
    } else if (result.event === "healing") {
      playSound("correct");
    } else if (result.event === "reveal") {
      playSound("levelUp");
    } else if (result.event === "moved") {
      playSound("step");
    }
    persistLabyrinthSession(next);
  }

  function handleLabyrinthAnswer(selectedOptionId: string) {
    if (!labyrinthSession || !activeLabyrinthConfig || !labyrinthSession.currentQuestion || labyrinthSession.locked) return;

    const question = labyrinthSession.currentQuestion;
    const focus = getCurrentLabyrinthFocus(labyrinthSession);
    const result = answerQuestion(question, selectedOptionId, labyrinthSession.practiceState, {
      mode: "training",
      statCap: settings.debugBypass ? Number.POSITIVE_INFINITY : getLevelStatCap(learnerState.level, pack)
    });
    const activeEncounter = getCurrentLabyrinthEncounter(labyrinthSession);
    const heartLoss = result.correct
      ? 0
      : activeEncounter?.kind === "trap"
        ? getTrapHeartLoss(activeLabyrinthConfig)
        : 1;
    const nextHearts = Math.max(0, labyrinthSession.hearts - heartLoss);
    let answered: LabyrinthSession = {
      ...labyrinthSession,
      hearts: nextHearts,
      questionsAnswered: labyrinthSession.questionsAnswered + 1,
      correctCount: labyrinthSession.correctCount + (result.correct ? 1 : 0),
      mistakeCount: labyrinthSession.mistakeCount + (result.correct ? 0 : 1),
      practiceState: result.updated_state,
      locked: true,
      feedback: {
        correct: result.correct,
        correctAnswer: result.message.replace(/^Correct: |^Answer: /, "").replace(/\.$/, ""),
        selectedOptionId,
        correctOptionId: question.correct_option_id
      }
    };
    answered = appendLabyrinthLog(answered, result.correct ? "labyrinthLogCorrect" : "labyrinthLogWrong", result.correct ? {} : { hearts: heartLoss }, result.correct ? "success" : "danger");

    playAnswerAudio(result, false);
    const answerPlayback = result.correct ? Promise.resolve(false) : playSubmittedAnswerAudio(question);
    triggerAction(result.correct && focus ? getTrainingAction(focus) : randomFailAction());
    // Keep the short feedback state in memory only. The last stable question
    // remains in local storage, so closing the app during this pause cannot
    // leave the saved run permanently locked.
    setLabyrinthSession(answered);

    runAfterAnswerAudio(answerPlayback, 2300, () => {
      if (nextHearts <= 0 && !settings.debugBypass) {
        const failedState = commitLabyrinthMemoryOnly(learnerState, answered.practiceState);
        if (activeProfile) saveLearnerState(pack, activeProfile.id, failedState);
        setLearnerState(failedState);
        persistLabyrinthSession(null);
        setLabyrinthOpen(false);
        setLabyrinthResult({ success: false, bonusCoins: 0 });
        triggerAction("fall");
        playSound("wrong");
        return;
      }

      const encounter = getCurrentLabyrinthEncounter(answered);
      if (!encounter) {
        persistLabyrinthSession({ ...answered, locked: false, feedback: null });
        return;
      }

      const nextQuestionIndex = answered.currentQuestionIndex + 1;
      if (nextQuestionIndex < encounter.focuses.length) {
        let next: LabyrinthSession = {
          ...answered,
          currentQuestionIndex: nextQuestionIndex,
          currentQuestion: undefined,
          locked: false,
          feedback: null
        };
        next = ensureLabyrinthQuestion(next, activeLabyrinthConfig);
        persistLabyrinthSession(next);
        return;
      }

      const completed = completeCurrentLabyrinthEncounter({
        ...answered,
        locked: false,
        feedback: null
      });

      if (!completed.completedLabyrinth) {
        persistLabyrinthSession(completed.session);
        if (completed.collectedRune) playSound("coin");
        return;
      }

      const mergedPracticeState = mergeLabyrinthPracticeIntoCurrent(learnerState, completed.session);
      const completedState = markLabyrinthCompleted(
        mergedPracticeState,
        pack,
        activeLabyrinthConfig.rewards.attribute_points_each,
        activeLabyrinthConfig.rewards.session_credit
      );
      const stateWithCaches = {
        ...completedState,
        coins: completedState.coins + Math.max(0, completed.session.runCoins)
      };
      // LEARNING_APP_RELEASE_AB_2026_08: pack-aware item bonuses
      const bonus = applyLabyrinthBonus(stateWithCaches, activeLabyrinthConfig, pack);
      if (activeProfile) saveLearnerState(pack, activeProfile.id, bonus.state);
      setLearnerState(bonus.state);
      persistLabyrinthSession(null);
      setLabyrinthOpen(false);
      setLabyrinthResult({
        success: true,
        bonusCoins: bonus.coins + Math.max(0, completed.session.runCoins),
        bonusItemNameKey: bonus.itemNameKey
      });
      playSound("levelUp");
      window.setTimeout(() => triggerAction("victory"), 350);
    });
  }

  function pauseLabyrinth() {
    resetLearningAudioState();
    setLabyrinthOpen(false);
    triggerAction("walk");
  }

  function abandonLabyrinth() {
    resetLearningAudioState();
    if (!labyrinthSession || !activeProfile) return;
    if (!window.confirm(t(baseLanguage, "labyrinthAbandonConfirm"))) return;
    const abandonedState = commitLabyrinthMemoryOnly(learnerState, labyrinthSession.practiceState);
    saveLearnerState(pack, activeProfile.id, abandonedState);
    setLearnerState(abandonedState);
    persistLabyrinthSession(null);
    setLabyrinthOpen(false);
    triggerAction("walk");
  }

  function startFight() {
    if (pathBusy) return;
    resetLearningAudioState();
    void unlockAudio();
    const enemy = getEnemyForLevel(pack, learnerState.level);
    const gate = getFightGate(pack, learnerState, settings.debugBypass);
    if (!gate.ok) {
      setFightGate(gate);
      setTrainingMenuOpen(false);
      setShopOpen(false);
      setAdminOpen(false);
      setSettingsOpen(false);
      setProfileSwitcherOpen(false);
      triggerAction("stumble");
      playSound("wrong");
      return;
    }
    setFightGate(null);
    const pending: PendingEncounter = { type: "fight", enemy, key: Date.now() };
    setShopOpen(false);
    setAdminOpen(false);
    setSettingsOpen(false);
    setTrainingMenuOpen(false);
    setTrainingSession(null);
    setPendingEncounter(pending);
    triggerAction("run");
    playSound("start");

    window.setTimeout(() => {
      const focus = getFightFocus(enemy, 0, pack, learnerState.level, settings.audioMode);
      const enemyMaxEnergy = getEffectiveEnemyEnergy(pack, learnerState.level, enemy);
      const heroMaxEnergy = getFightHeroEnergy(pack, learnerState, enemy);
      const questionTarget = getFightQuestionTarget(pack, learnerState, enemy);
      const maxQuestions = Math.min(getFightMaxQuestions(pack, learnerState.level), Math.max(questionTarget + 5, MIN_FIGHT_QUESTIONS + 5));
      const question = getNextQuestion(pack, learnerState, baseLanguage, focus, getFightSelection(pack, enemy, learnerState.level, settings.audioMode, focus));
      setFightSession({
        enemy,
        index: 0,
        correctCount: 0,
        mistakeCount: 0,
        locked: false,
        heroEnergy: heroMaxEnergy,
        heroMaxEnergy,
        enemyEnergy: enemyMaxEnergy,
        enemyMaxEnergy,
        questionsRequired: questionTarget,
        maxQuestions,
        timerSeconds: getFightParTimeSeconds(question, pack, learnerState.level),
        questionStartedAt: Date.now(),
        audioStartedAt: question.activity_type === "listen_and_choose" ? undefined : Date.now(),
        question,
        feedback: null
      });
      setPendingEncounter((previous) => (previous?.key === pending.key ? null : previous));
      triggerAction("sword");
    }, 1100);
  }

  function handleFightAnswer(selectedOptionId: string) {
    resolveFightAnswer(selectedOptionId);
  }

  function resolveFightAnswer(selectedOptionId: string) {
    if (!fightSession || fightSession.locked) return;

    const timingStart = fightSession.question.activity_type === "listen_and_choose"
      ? (fightSession.audioStartedAt ?? Date.now())
      : fightSession.questionStartedAt;
    const elapsedSeconds = Math.max(0, (Date.now() - timingStart) / 1000);
    const speedMultiplier = getSpeedBonusMultiplier(elapsedSeconds, fightSession.timerSeconds, settings.speedBonusEnabled);
    const speedBonusPercent = Math.max(0, Math.round((speedMultiplier - 1) * 100));
    const result = answerQuestion(fightSession.question, selectedOptionId, learnerState, {
      mode: "fight",
      timedOut: false,
      enemyRequirements: fightSession.enemy.requiredStats,
      enemyLevel: fightSession.enemy.level,
      statCap: settings.debugBypass ? Number.POSITIVE_INFINITY : getLevelStatCap(learnerState.level, pack)
    });
    const damageDetails = result.correct
      ? getFightDamageDetails(fightSession.question.stat, learnerState.hero_stats, fightSession.enemy, getLevelStatCap(learnerState.level, pack), speedMultiplier)
      : null;
    const mistakeDetails = result.correct ? null : getFightMistakeDetails(pack, learnerState, fightSession.enemy, false);
    const calculatedDamage = damageDetails?.damage ?? 0;
    const calculatedEnergyLoss = mistakeDetails?.damage ?? 0;
    const rawEnemyEnergy = fightSession.enemyEnergy - calculatedDamage;
    const nextHeroEnergy = Math.max(0, fightSession.heroEnergy - calculatedEnergyLoss);
    const nextIndex = fightSession.index + 1;
    const nextEnemyEnergy = result.correct && nextIndex < MIN_FIGHT_QUESTIONS ? Math.max(1, rawEnemyEnergy) : Math.max(0, rawEnemyEnergy);
    const nextCorrectCount = fightSession.correctCount + (result.correct ? 1 : 0);
    const nextMistakeCount = fightSession.mistakeCount + (result.correct ? 0 : 1);

    setLearnerState(result.updated_state);
    playAnswerAudio(result, true);
    const answerPlayback = result.correct ? Promise.resolve(false) : playSubmittedAnswerAudio(fightSession.question);
    triggerAction(result.correct ? getCorrectFightAction(fightSession.question.skill) : randomFailAction(true));

    setFightSession({
      ...fightSession,
      locked: true,
      heroEnergy: nextHeroEnergy,
      enemyEnergy: nextEnemyEnergy,
      correctCount: nextCorrectCount,
      mistakeCount: nextMistakeCount,
      feedback: {
        ...toFeedback(result, selectedOptionId, fightSession.question.correct_option_id, calculatedDamage, calculatedEnergyLoss, (damageDetails ?? mistakeDetails)?.absorbed ?? 0, (damageDetails ?? mistakeDetails)?.label_key),
        speedBonusPercent: result.correct ? speedBonusPercent : 0
      }
    });

    runAfterAnswerAudio(answerPlayback, 2100, () => {
      if (nextEnemyEnergy <= 0 && nextIndex >= MIN_FIGHT_QUESTIONS) {
        triggerAction("monster_defeat");
        playSound("defeat");
        window.setTimeout(() => {
          const finalState = markEnemyDefeated(result.updated_state, fightSession.enemy.id, fightSession.enemy.rewardCoins, pack);
          setLearnerState(finalState);
          setFightSession(null);
          triggerAction("victory");
          playSound("levelUp");
        }, 900);
        return;
      }

      if (nextHeroEnergy <= 0 || nextIndex >= fightSession.maxQuestions) {
        setFightSession(null);
        triggerAction(nextHeroEnergy <= 0 ? "fall" : "stumble");
        playSound("wrong");
        return;
      }

      setFightSession((previous) => {
        if (!previous) return previous;
        const focus = getFightFocus(previous.enemy, nextIndex, pack, result.updated_state.level, settings.audioMode);
        const question = getNextQuestion(pack, result.updated_state, baseLanguage, focus, getFightSelection(pack, previous.enemy, result.updated_state.level, settings.audioMode, focus));
        const startedAt = Date.now();
        return {
          ...previous,
          index: nextIndex,
          correctCount: nextCorrectCount,
          mistakeCount: nextMistakeCount,
          locked: false,
          heroEnergy: nextHeroEnergy,
          enemyEnergy: nextEnemyEnergy,
          feedback: null,
          timerSeconds: getFightParTimeSeconds(question, pack, result.updated_state.level),
          questionStartedAt: startedAt,
          audioStartedAt: question.activity_type === "listen_and_choose" ? undefined : startedAt,
          question
        };
      });
    });
  }

  function handleReset() {
    resetLearningAudioState();
    if (!activeProfile) return;
    const fresh = resetLearnerState(pack, activeProfile);
    setLearnerState(fresh);
    setTrainingSession(null);
    setFightSession(null);
    setLabyrinthOpen(false);
    setLabyrinthSession(null);
    setLabyrinthResult(null);
    clearLabyrinthSession(pack, activeProfile.id);
    setTrainingMenuOpen(false);
    setShopOpen(false);
    setAdminOpen(false);
    setSettingsOpen(false);
    setProgressOpen(false);
    setProfileSwitcherOpen(false);
    setPendingEncounter(null);
    setFightGate(null);
    triggerAction("jump");
  }

  function handleMergeContribution(contribution: ContentContribution) {
    const result = mergeContributionIntoPack(pack, contribution);
    saveLocalPack(result.pack);
    setPack(result.pack);
    if (activeProfile) setLearnerState((previous) => normalizeLearnerState(result.pack, previous, activeProfile.name));
    return result.summary;
  }

  function handleExportPack() {
    downloadJson(pack, `${pack.pack_id}-local-pack-${Date.now()}.json`);
  }

  function handleResetLocalPack() {
    resetLocalPack(starterPack);
    setPack(starterPack);
    if (activeProfile) {
      setLearnerState((previous) => normalizeLearnerState(starterPack, previous, activeProfile.name));
      clearLabyrinthSession(pack, activeProfile.id);
    }
    setLabyrinthSession(null);
    setLabyrinthOpen(false);
    setLabyrinthResult(null);
  }

  if (!activeProfile) return null;

  const phaserWorld = (
    <PhaserWorld
      language={baseLanguage}
      state={learnerState}
      appearance={activeProfile.appearance}
      graphicsPack={settings.graphicsPack}
      debug={settings.debug}
      debugBypass={settings.debugBypass}
      statCap={settings.debugBypass ? Number.POSITIVE_INFINITY : getLevelStatCap(learnerState.level, pack)}
      trainingOptions={trainingOptions}
      actionEvent={actionEvent}
      encounter={encounter}
      encounterMode={encounterMode}
      sessionActive={Boolean(trainingSession || fightSession)}
    />
  );

  const activeSessionPanel = trainingSession ? (
    <section className="session-panel-card training-session-panel" aria-label={t(baseLanguage, "training")}>
      <div className="session-heading"><span>{t(baseLanguage, "training")}</span><strong>{t(baseLanguage, trainingOptions.find((option) => option.focus === trainingSession.focus)?.encounterLabelKey ?? "training")}</strong><TrainingHearts language={baseLanguage} remaining={Math.max(0, trainingSession.maxMistakes - trainingSession.mistakeCount)} total={trainingSession.maxMistakes} /></div>
      <QuestionCard
        question={trainingSession.question}
        language={baseLanguage}
        disabled={trainingSession.locked}
        mode="training"
        index={trainingSession.index}
        total={questionsPerTraining}
        feedback={trainingSession.feedback}
        onAnswer={handleTrainingAnswer}
        onContinue={trainingSession.feedback && !trainingSession.feedback.correct
          ? () => advanceTrainingAfterFeedback(trainingSession.question.id)
          : undefined}
      />
      <button type="button" className="ghost-button full-width" onClick={() => setTrainingSession(null)}>{t(baseLanguage, "backHome")}</button>
    </section>
  ) : fightSession ? (
    <section className="session-panel-card fight-session-panel" aria-label={t(baseLanguage, "fightTitle")}>
      <div className="session-heading"><span>{t(baseLanguage, "fightTitle")}</span><strong>{t(baseLanguage, fightSession.enemy.nameKey)}</strong><p>{settings.speedBonusEnabled ? `${t(baseLanguage, "softTimerHint")} · ` : ""}{t(baseLanguage, "mistakes")}: {fightSession.mistakeCount}.</p></div>
      <EnergyBars language={baseLanguage} heroEnergy={fightSession.heroEnergy} heroMaxEnergy={fightSession.heroMaxEnergy} enemyName={t(baseLanguage, fightSession.enemy.nameKey)} enemyEnergy={fightSession.enemyEnergy} enemyMaxEnergy={fightSession.enemyMaxEnergy} />
      {fightSession.feedback ? <CombatFeedback language={baseLanguage} feedback={fightSession.feedback} /> : null}
      <QuestionCard
        question={fightSession.question}
        language={baseLanguage}
        disabled={fightSession.locked}
        mode="fight"
        index={fightSession.index}
        total={fightSession.maxQuestions}
        timerSeconds={settings.speedBonusEnabled ? fightSession.timerSeconds : 0}
        feedback={fightSession.feedback}
        onAnswer={handleFightAnswer}
        audioHasStarted={Boolean(fightSession.audioStartedAt)}
        onAudioStarted={() => setFightSession((previous) => previous ? { ...previous, audioStartedAt: Date.now(), questionStartedAt: Date.now() } : previous)}
        onAudioReplayCompleted={(durationMs) => setFightSession((previous) => previous?.question.id === fightSession.question.id
          ? {
              ...previous,
              questionStartedAt: previous.questionStartedAt + durationMs,
              audioStartedAt: previous.audioStartedAt ? previous.audioStartedAt + durationMs : previous.audioStartedAt
            }
          : previous)}
      />
      <div className="level-gate-note">{t(baseLanguage, "levelGate")} · {formatEnemyRequirements(fightSession.enemy, baseLanguage)}</div>
      {settings.debug ? <div className="level-gate-note debug-note">HP {fightSession.enemyEnergy}/{fightSession.enemyMaxEnergy} · Q {fightSession.index + 1}/{fightSession.maxQuestions} · target {fightSession.questionsRequired}</div> : null}
      <button type="button" className="ghost-button full-width" onClick={() => setFightSession(null)}>{t(baseLanguage, "backHome")}</button>
    </section>
  ) : null;

  const homeActions = (
    <>
      <button
        type="button"
        className={`dashboard-action-button train ${trainingMenuOpen ? "active" : ""}`}
        onClick={() => {
          void unlockAudio();
          setAdminOpen(false);
          setSettingsOpen(false);
          setShopOpen(false);
          setTrainingMenuOpen((open) => !open);
          triggerAction("walk");
        }}
      >
        <span>⚡</span><strong>{t(baseLanguage, "train")}</strong>
      </button>
      <button type="button" className="dashboard-action-button fight" onClick={startFight}>
        <span>👾</span><strong>{t(baseLanguage, "fight")}</strong><small>{t(baseLanguage, currentEnemy.nameKey)}</small>
      </button>
      <button
        type="button"
        className={`dashboard-action-button shop ${shopOpen ? "active" : ""}`}
        onClick={() => {
          void unlockAudio();
          setAdminOpen(false);
          setSettingsOpen(false);
          setTrainingMenuOpen(false);
          setShopOpen((open) => !open);
        }}
      >
        <span>🎒</span><strong>{t(baseLanguage, "shopButton")}</strong>
      </button>
    </>
  );

  const homeDashboard = (
    <HomeDashboard
      mode={trainingMenuOpen ? "training" : shopOpen ? "shop" : "overview"}
      actions={homeActions}
      content={trainingMenuOpen ? (
        <TrainingPopover
          language={baseLanguage}
          state={learnerState}
          options={trainingOptions}
          labyrinthConfig={labyrinthConfig}
          levelConfig={currentLevelConfig}
          hasSavedLabyrinth={Boolean(labyrinthSession)}
          doorRequirement={labyrinthDoorRequirement?.required_stones ?? []}
          missingStones={labyrinthMissingStones}
          onStart={startTraining}
          onStartLabyrinth={startLabyrinth}
          onClose={() => setTrainingMenuOpen(false)}
        />
      ) : shopOpen ? (
        <ShopPanel
          pack={pack}
          state={learnerState}
          language={baseLanguage}
          onStateChange={setLearnerState}
          debugBypass={settings.debugBypass}
          onClose={() => setShopOpen(false)}
          embedded
        />
      ) : (
        <>
          <HeroStatsPanel state={learnerState} language={baseLanguage} statCap={getLevelStatCap(learnerState.level, pack)} />
          <StoryPanel pack={pack} state={learnerState} language={baseLanguage} alternateLanguage="it" alternateLanguageLabel="Italiano" />
        </>
      )}
    />
  );

  return (
    <DeviceViewport
      settings={settings}
      language={baseLanguage}
      onExitSimulation={() => setSettings({ ...settings, viewportPreset: "auto", showDeviceFrame: false })}
      onToggleDeviceFrame={() => setSettings({ ...settings, showDeviceFrame: !settings.showDeviceFrame })}
    >
      <main className="app-shell">
        <section className={`mobile-game ${sessionActive ? "session-open" : ""} ${labyrinthActive ? "labyrinth-active" : ""}`}>
          <header className="top-bar">
            <div className="brand-block">
              <span className="eyebrow">{t(baseLanguage, "landingEyebrow")}</span>
              <strong>{t(baseLanguage, "appTitle")}</strong>
            </div>
            <div className="top-controls">
              <OfflineStatus state={offlineState} language={baseLanguage} />
              <InstallAppButton language={baseLanguage} />
              <button
                type="button"
                className="parent-progress-launcher"
                onClick={() => { setProgressOpen((open) => !open); setSettingsOpen(false); setProfileSwitcherOpen(false); setAdminOpen(false); setShopOpen(false); setTrainingMenuOpen(false); }}
                aria-label={t(baseLanguage, "parentProgress")}
              >
                <span aria-hidden="true">📊</span><span>{t(baseLanguage, "parentProgress")}</span>
              </button>
              <button type="button" className="profile-pill" onClick={() => { setProfileSwitcherOpen((open) => !open); setSettingsOpen(false); setProgressOpen(false); setAdminOpen(false); setShopOpen(false); setTrainingMenuOpen(false); }}>{activeProfile.name}</button>
              <button type="button" className="icon-button" onClick={toggleAudio} aria-label={audioOn ? t(baseLanguage, "soundOn") : t(baseLanguage, "soundOff")}>
                {audioOn ? "🔊" : "🔇"}
              </button>
              <button type="button" className="icon-button" onClick={() => { setSettingsOpen((open) => !open); setProgressOpen(false); setProfileSwitcherOpen(false); setAdminOpen(false); setShopOpen(false); setTrainingMenuOpen(false); }} aria-label={t(baseLanguage, "settings")}>
                ⚙️
              </button>
            </div>
          </header>

          {validation.warnings.length > 0 && settings.debug ? <div className="pack-warning">{t(baseLanguage, "packWarning")}</div> : null}

          {labyrinthActive && labyrinthSession && activeLabyrinthConfig ? (
            <LabyrinthPanel language={baseLanguage} config={activeLabyrinthConfig} session={labyrinthSession} onMove={handleLabyrinthMove} onAnswer={handleLabyrinthAnswer} onPause={pauseLabyrinth} onAbandon={abandonLabyrinth} />
          ) : (
            <SessionLayout
              active={Boolean(trainingSession || fightSession)}
              world={phaserWorld}
              panel={activeSessionPanel ?? homeDashboard}
            />
          )}

          {labyrinthResult && !pathBusy ? (
            <LabyrinthResultPanel
              language={baseLanguage}
              result={labyrinthResult}
              onClose={() => {
                setLabyrinthResult(null);
                triggerAction("walk");
              }}
            />
          ) : null}

          {notice && !pathBusy ? <NoticePanel language={baseLanguage} notice={notice} onClose={() => setNotice(null)} /> : null}

          {profileSwitcherOpen && !pathBusy && !adminOpen && !settingsOpen ? (
            <ProfileSwitcher language={baseLanguage} profiles={profiles} activeProfileId={activeProfileId} onChoose={setActiveProfileId} onClose={() => setProfileSwitcherOpen(false)} />
          ) : null}

          {fightGate && !pathBusy ? (
            <FightGatePanel
              language={baseLanguage}
              enemy={currentEnemy}
              gate={fightGate}
              onTrain={() => { setFightGate(null); setTrainingMenuOpen(true); }}
              onClose={() => setFightGate(null)}
            />
          ) : null}

          {progressOpen && !pathBusy && !adminOpen && !settingsOpen ? (
            <ParentProgressPanel pack={pack} state={learnerState} language={baseLanguage} onClose={() => setProgressOpen(false)} />
          ) : null}

          {settingsOpen && !pathBusy && !adminOpen ? (
            <SettingsPanel
              pack={pack}
              language={baseLanguage}
              profiles={profiles}
              activeProfileId={activeProfileId}
              settings={settings}
              onSettingsChange={setSettings}
              onProfilesChange={setProfiles}
              onActiveProfileChange={setActiveProfileId}
              onResetProgress={handleReset}
              onOpenDictionary={() => { setSettingsOpen(false); setAdminOpen(true); }}
              onClose={() => setSettingsOpen(false)}
            />
          ) : null}

          {adminOpen && !pathBusy ? (
            <AdminPanel pack={pack} language={baseLanguage} onMergeContribution={handleMergeContribution} onExportPack={handleExportPack} onResetLocalPack={handleResetLocalPack} onClose={() => setAdminOpen(false)} />
          ) : null}
        </section>
      </main>
    </DeviceViewport>
  );

}

function TrainingPopover({
  language,
  state,
  options,
  labyrinthConfig,
  levelConfig,
  hasSavedLabyrinth,
  doorRequirement,
  missingStones,
  onStart,
  onStartLabyrinth,
  onClose
}: {
  language: string;
  state: LearnerState;
  options: ReturnType<typeof getTrainingOptions>;
  labyrinthConfig: PackLabyrinthConfig | null;
  levelConfig: PackLevel | undefined;
  hasSavedLabyrinth: boolean;
  doorRequirement: TrainingFocus[];
  missingStones: TrainingFocus[];
  onStart: (focus: TrainingFocus) => void;
  onStartLabyrinth: () => void;
  onClose: () => void;
}) {
  return (
    <section className="training-popover embedded-panel" role="dialog" aria-label={t(language, "chooseTraining")}>
      <div className="popover-title">
        <span>{t(language, "chooseTraining")}</span>
        <strong>{t(language, "trainingMenuTitle")}</strong>
      </div>
      {levelConfig ? (
        <div className="training-level-guide">
          <span>{getLocalizedText(levelConfig.theme, language, levelConfig.title)}</span>
          <strong>{getLocalizedText(levelConfig.learning_goal, language, levelConfig.title)}</strong>
        </div>
      ) : null}
      <div className="training-bubble-grid">
        {options.map((option) => (
          <button key={option.focus} type="button" className="training-bubble" onClick={() => onStart(option.focus)}>
            <span className="bubble-icon">{option.icon}</span>
            <strong>{t(language, option.encounterLabelKey)}</strong>
            <small>{t(language, option.stat)}</small>
            <em>{state.hero_stats[option.stat]}</em>
            <span className={`training-stone stone-${option.stoneColor}`} title={t(language, option.stoneLabelKey)}>
              {option.stoneIcon} × {state.training_stones[option.focus] ?? 0}
            </span>
          </button>
        ))}
        {labyrinthConfig ? (
          <button type="button" className={`training-bubble labyrinth-bubble${!hasSavedLabyrinth && missingStones.length > 0 ? " locked" : ""}`} onClick={onStartLabyrinth}>
            <span className="bubble-icon">{hasSavedLabyrinth ? "🗺️" : missingStones.length > 0 ? "🔒" : "🚪"}</span>
            <strong>{t(language, hasSavedLabyrinth ? "labyrinthResume" : "labyrinthShort")}</strong>
            <small>{hasSavedLabyrinth ? t(language, "labyrinthRunInProgress") : t(language, "labyrinthDoorNeeds")}</small>
            <div className="door-stone-row" aria-label={t(language, "labyrinthDoorNeeds")}>
              {doorRequirement.map((focus) => {
                const option = options.find((candidate) => candidate.focus === focus);
                const missing = missingStones.includes(focus);
                return <span key={focus} className={`door-stone${missing ? " missing" : " ready"}`}>{option?.stoneIcon ?? "◆"}</span>;
              })}
            </div>
            <em>+1 × 4</em>
          </button>
        ) : null}
      </div>
      <button type="button" className="ghost-button compact-button" onClick={onClose}>{t(language, "close")}</button>
    </section>
  );
}


function LabyrinthResultPanel({
  language,
  result,
  onClose
}: {
  language: string;
  result: LabyrinthResultState;
  onClose: () => void;
}) {
  const bonusText = result.bonusItemNameKey
    ? t(language, "labyrinthBonusItem", { item: t(language, result.bonusItemNameKey) })
    : result.bonusCoins > 0
      ? t(language, "labyrinthBonusCoins", { coins: result.bonusCoins })
      : t(language, "labyrinthNoBonus");

  return (
    <section className={`bottom-sheet labyrinth-result-panel ${result.success ? "success" : "failure"}`} role="dialog">
      <div className="sheet-handle" />
      <div className="panel-heading compact">
        <span>{result.success ? "🏆" : "💔"}</span>
        <strong>{t(language, result.success ? "labyrinthCompleteTitle" : "labyrinthFailedTitle")}</strong>
        <p>{t(language, result.success ? "labyrinthCompleteBody" : "labyrinthFailedBody")}</p>
      </div>
      {result.success ? <div className="labyrinth-bonus-card">{bonusText}</div> : null}
      <button type="button" className="primary-button full-width" onClick={onClose}>
        {t(language, "labyrinthContinue")}
      </button>
    </section>
  );
}


function NoticePanel({
  language,
  notice,
  onClose
}: {
  language: string;
  notice: NoticeState;
  onClose: () => void;
}) {
  return (
    <section className="bottom-sheet notice-panel" role="dialog" aria-label={t(language, notice.titleKey)}>
      <div className="sheet-handle" />
      <div className="panel-heading compact">
        <span>🔇</span>
        <strong>{t(language, notice.titleKey)}</strong>
        <p>{t(language, notice.bodyKey)}</p>
      </div>
      <button type="button" className="primary-button full-width" onClick={onClose}>{t(language, "close")}</button>
    </section>
  );
}


function ProfileSwitcher({
  language,
  profiles,
  activeProfileId,
  onChoose,
  onClose
}: {
  language: string;
  profiles: ChildProfile[];
  activeProfileId: string;
  onChoose: (profileId: string) => void;
  onClose: () => void;
}) {
  return (
    <section className="profile-switcher bottom-sheet" role="dialog" aria-label={t(language, "profileSwitcherTitle")}>
      <div className="sheet-handle" />
      <div className="panel-heading compact">
        <span>{t(language, "switchHero")}</span>
        <strong>{t(language, "profileSwitcherTitle")}</strong>
        <p>{t(language, "profileSwitcherBody")}</p>
      </div>
      <div className="profile-list">
        {profiles.map((profile) => (
          <button key={profile.id} type="button" className={profile.id === activeProfileId ? "profile-card active" : "profile-card"} onClick={() => onChoose(profile.id)}>
            <span className="profile-avatar-dot" style={{ background: profile.appearance.outfitColor }} />
            <strong>{profile.name}</strong>
            <small>{profile.id === activeProfileId ? t(language, "activeHero") : t(language, "switchHero")}</small>
          </button>
        ))}
      </div>
      <button type="button" className="ghost-button full-width" onClick={onClose}>{t(language, "close")}</button>
    </section>
  );
}

function FightGatePanel({
  language,
  enemy,
  gate,
  onTrain,
  onClose
}: {
  language: string;
  enemy: EnemyConfig;
  gate: ReturnType<typeof getFightGate>;
  onTrain: () => void;
  onClose: () => void;
}) {
  return (
    <section className="bottom-sheet fight-gate-panel" role="dialog" aria-label={t(language, "fightLockedTitle")}>
      <div className="sheet-handle" />
      <div className="panel-heading compact">
        <span>{t(language, "trainMore")}</span>
        <strong>{t(language, "fightLockedTitle")}</strong>
        <p>{t(language, "fightLockedBody")}</p>
      </div>
      <div className="gate-monster-name">👾 {t(language, enemy.nameKey)}</div>
      <div className="requirement-list">
        {gate.requirements.map((requirement) => {
          const label = requirement.labelKey === "requirementStat"
            ? t(language, requirement.labelKey, { stat: t(language, String(requirement.labelVars?.stat ?? "")), value: requirement.required })
            : t(language, requirement.labelKey);
          return (
            <div key={requirement.id} className={requirement.ok ? "requirement ok" : "requirement missing"}>
              <span>{requirement.ok ? "✓" : "!"}</span>
              <strong>{label}</strong>
              <em>{Math.floor(requirement.current)} / {requirement.required}</em>
            </div>
          );
        })}
      </div>
      <div className="gate-actions">
        <button type="button" className="primary-button" onClick={onTrain}>⚡ {t(language, "train")}</button>
        <button type="button" className="ghost-button" onClick={onClose}>{t(language, "close")}</button>
      </div>
    </section>
  );
}


function TrainingHearts({ language, remaining, total }: { language: string; remaining: number; total: number }) {
  const safeTotal = Math.max(1, total);
  const hearts = Array.from({ length: safeTotal }, (_, index) => index < remaining);
  return (
    <div className="training-hearts" aria-label={`${t(language, "mistakes")}: ${safeTotal - remaining}/${safeTotal}`}>
      <span>{t(language, "trainHint")}</span>
      <div className="heart-row">
        {hearts.map((full, index) => (
          <span key={index} className={full ? "heart full" : "heart empty"}>{full ? "❤️" : "♡"}</span>
        ))}
      </div>
    </div>
  );
}

function CombatFeedback({ language, feedback }: { language: string; feedback: FeedbackState }) {
  const hasDamage = (feedback.damage ?? 0) > 0;
  const hasLoss = (feedback.energyLoss ?? 0) > 0;
  const absorbed = Math.max(0, Math.floor(feedback.absorbedDamage ?? 0));
  const labelKey = feedback.combatLabelKey ?? (feedback.correct ? "normalHit" : "monsterHit");
  return (
    <div className={`combat-feedback ${feedback.correct ? "hero-damage" : "monster-damage"}`}>
      <strong>{t(language, labelKey)}</strong>
      {hasDamage ? <span className="damage-number">💥 -{Math.floor(feedback.damage ?? 0)}</span> : null}
      {hasLoss ? <span className="damage-number">😵 -{Math.floor(feedback.energyLoss ?? 0)}</span> : null}
      {feedback.correct && (feedback.speedBonusPercent ?? 0) > 0 ? <em>{t(language, "speedBonusEarned", { value: feedback.speedBonusPercent ?? 0 })}</em> : null}
      {absorbed > 0 ? <em>{t(language, "damageAbsorbed", { value: absorbed })}</em> : null}
    </div>
  );
}

function commitPracticeMemoryOnly(committed: LearnerState, practice: LearnerState): LearnerState {
  return {
    ...committed,
    streak: 0,
    mastery_by_item: practice.mastery_by_item,
    mastery_by_letter: practice.mastery_by_letter,
    mastery_by_grammar: practice.mastery_by_grammar,
    path_distance: Math.max(committed.path_distance, practice.path_distance)
  };
}

function downloadJson(value: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function formatEnemyRequirements(enemy: EnemyConfig, language: string): string {
  const order: HeroStatKey[] = ["strength", "defense", "precision", "stamina"];
  const requirements = order.filter((stat) => enemy.requiredStats[stat]).map((stat) => `${t(language, stat)} ${enemy.requiredStats[stat]}`);
  return requirements.length > 0 ? `${t(language, "monsterNeeds")} ${requirements.join(" · ")}` : t(language, "fightMistakeHint");
}

function getFightFocus(enemy: EnemyConfig, index: number, pack: LanguagePack, level: number, audioMode: AppSettings["audioMode"]): TrainingFocus {
  const cycle: TrainingFocus[] = [enemy.preferredFocus, "comprehension", "grammar", "pronunciation", "vocabulary"];
  const preferred = cycle[index % cycle.length] ?? enemy.preferredFocus;
  const fallbackOrder = uniqueFocuses([preferred, enemy.preferredFocus, "vocabulary", "grammar", "pronunciation", "comprehension"]);
  return fallbackOrder.find((focus) => hasEligibleQuestion(pack, focus, getFightSelection(pack, enemy, level, audioMode, focus))) ?? "vocabulary";
}

function getStoredLabyrinthConfig(
  pack: LanguagePack,
  stored: unknown,
  level: number
): PackLabyrinthConfig | null {
  if (stored && typeof stored === "object" && "configId" in stored) {
    const configId = (stored as { configId?: unknown }).configId;
    if (typeof configId === "string") {
      const storedConfig = (pack.labyrinths ?? []).find(
        (config) => config.id === configId && config.enabled
      );
      if (storedConfig) return storedConfig;
    }
  }
  return getLabyrinthForLevel(pack, level);
}

/**
 * On failure or explicit abandonment, retain only spaced-review memory.
 * XP, path progress, coins, statistics, and session credit remain unchanged.
 */
function commitLabyrinthMemoryOnly(
  committed: LearnerState,
  practice: LearnerState
): LearnerState {
  return {
    ...committed,
    streak: 0,
    mastery_by_item: mergePracticeMemoryMaps(
      committed.mastery_by_item,
      practice.mastery_by_item
    ),
    mastery_by_letter: mergePracticeMemoryMaps(
      committed.mastery_by_letter,
      practice.mastery_by_letter
    ),
    mastery_by_grammar: mergePracticeMemoryMaps(
      committed.mastery_by_grammar,
      practice.mastery_by_grammar
    )
  };
}

/**
 * Rebase a paused run onto the latest committed profile. This preserves the
 * labyrinth's uncommitted answer XP/path deltas while avoiding the loss of
 * progress made elsewhere after the run was paused.
 */
function rebaseLabyrinthSession(
  session: LabyrinthSession,
  current: LearnerState
): LabyrinthSession {
  const xpDelta = Math.max(0, session.practiceState.xp - session.baseXp);
  const pathDelta = Math.max(
    0,
    session.practiceState.path_distance - session.basePathDistance
  );
  return {
    ...session,
    baseXp: current.xp,
    basePathDistance: current.path_distance,
    practiceState: {
      ...current,
      xp: current.xp + xpDelta,
      path_distance: current.path_distance + pathDelta,
      streak: session.practiceState.streak,
      mastery_by_item: mergePracticeMemoryMaps(
        current.mastery_by_item,
        session.practiceState.mastery_by_item
      ),
      mastery_by_letter: mergePracticeMemoryMaps(
        current.mastery_by_letter,
        session.practiceState.mastery_by_letter
      ),
      mastery_by_grammar: mergePracticeMemoryMaps(
        current.mastery_by_grammar,
        session.practiceState.mastery_by_grammar
      )
    }
  };
}

/**
 * Apply question XP/path deltas and updated review memory without replacing
 * progress that may have changed while a saved labyrinth was paused.
 */
function mergeLabyrinthPracticeIntoCurrent(
  current: LearnerState,
  session: LabyrinthSession
): LearnerState {
  const xpDelta = Math.max(0, session.practiceState.xp - session.baseXp);
  const pathDelta = Math.max(
    0,
    session.practiceState.path_distance - session.basePathDistance
  );
  return {
    ...current,
    xp: current.xp + xpDelta,
    path_distance: current.path_distance + pathDelta,
    streak: session.practiceState.streak,
    mastery_by_item: mergePracticeMemoryMaps(
      current.mastery_by_item,
      session.practiceState.mastery_by_item
    ),
    mastery_by_letter: mergePracticeMemoryMaps(
      current.mastery_by_letter,
      session.practiceState.mastery_by_letter
    ),
    mastery_by_grammar: mergePracticeMemoryMaps(
      current.mastery_by_grammar,
      session.practiceState.mastery_by_grammar
    )
  };
}

function mergePracticeMemoryMaps<T extends { last_asked_at?: string }>(
  current: Record<string, T>,
  practice: Record<string, T>
): Record<string, T> {
  const merged = { ...current };
  for (const [id, candidate] of Object.entries(practice)) {
    const existing = merged[id];
    if (!existing || practiceTimestamp(candidate) >= practiceTimestamp(existing)) {
      merged[id] = candidate;
    }
  }
  return merged;
}

function practiceTimestamp(value: { last_asked_at?: string }): number {
  if (!value.last_asked_at) return 0;
  const parsed = Date.parse(value.last_asked_at);
  return Number.isFinite(parsed) ? parsed : 0;
}

function restoreLabyrinthSession(
  pack: LanguagePack,
  heroName: string,
  learnerState: LearnerState,
  config: PackLabyrinthConfig,
  stored: unknown
): LabyrinthSession | null {
  const restored = sanitizeLabyrinthSession(stored, learnerState, config);
  if (!restored) return null;
  return {
    ...restored,
    practiceState: normalizeLearnerState(pack, restored.practiceState, heroName)
  };
}

function getLabyrinthForLevel(pack: LanguagePack, level: number): PackLabyrinthConfig | null {
  const available = (pack.labyrinths ?? [])
    .filter((config) => config.enabled && config.minimum_level <= level)
    .sort((a, b) => b.minimum_level - a.minimum_level);
  return available[0] ?? null;
}

function getLabyrinthSelection(
  pack: LanguagePack,
  config: PackLabyrinthConfig,
  level: number,
  audioMode: AppSettings["audioMode"],
  focus: TrainingFocus
) {
  return {
    stage: level,
    tags: config.semantic_tags,
    requireHumanAudio: requiresHumanAudioForFocus(focus, audioMode),
    requirePlayableAudio: requiresPlayableAudioForFocus(focus, audioMode),
    reviewChance: getCurriculumReviewChance(level)
  };
}

function getLabyrinthQuestionWithFallback(
  pack: LanguagePack,
  state: LearnerState,
  baseLanguage: string,
  config: PackLabyrinthConfig,
  audioMode: AppSettings["audioMode"],
  requestedFocus: TrainingFocus
): TrainingQuestion {
  const order = uniqueFocuses([requestedFocus, "vocabulary", "grammar", "pronunciation", "comprehension"]);
  for (const focus of order) {
    const selection = getLabyrinthSelection(pack, config, state.level, audioMode, focus);
    if (hasEligibleQuestion(pack, focus, selection)) {
      return getNextQuestion(pack, state, baseLanguage, focus, selection);
    }
  }
  throw new Error("The language pack has no eligible labyrinth questions.");
}

function applyLabyrinthBonus(
  initialState: LearnerState,
  config: PackLabyrinthConfig,
  pack: LanguagePack
): { state: LearnerState; coins: number; itemNameKey?: string } {
  const bonus = config.rewards.bonus;
  const noneWeight = Math.max(0, bonus.none_weight);
  const coinsWeight = Math.max(0, bonus.coins_weight);
  const itemWeight = Math.max(0, bonus.item_weight);
  const totalWeight = noneWeight + coinsWeight + itemWeight;
  if (totalWeight <= 0) return { state: initialState, coins: 0 };

  const roll = Math.random() * totalWeight;
  if (roll < noneWeight) return { state: initialState, coins: 0 };

  const coinReward = () => {
    const minimum = Math.max(0, Math.floor(bonus.coins_min));
    const maximum = Math.max(minimum, Math.floor(bonus.coins_max));
    const coins = minimum + Math.floor(Math.random() * (maximum - minimum + 1));
    return { state: { ...initialState, coins: initialState.coins + coins }, coins };
  };

  if (roll < noneWeight + coinsWeight) return coinReward();

  const eligibleItems = getVisibleShopItems(initialState.level)
    .filter((item) => !initialState.inventory.includes(item.id));
  const item = eligibleItems[Math.floor(Math.random() * eligibleItems.length)];
  if (!item) return coinReward();

  const purchase = buyShopItem(
    { ...initialState, coins: initialState.coins + item.price },
    item,
    pack
  );
  if (!purchase.ok) return coinReward();

  return {
    state: { ...purchase.state, coins: initialState.coins },
    coins: 0,
    itemNameKey: item.nameKey
  };
}

function getTrainingSelection(pack: LanguagePack, level: number, audioMode?: AppSettings["audioMode"], focus?: TrainingFocus) {
  return {
    stage: level,
    requireHumanAudio: focus ? requiresHumanAudioForFocus(focus, audioMode) : false,
    requirePlayableAudio: focus ? requiresPlayableAudioForFocus(focus, audioMode) : false,
    reviewChance: getCurriculumReviewChance(level)
  };
}

function getFightSelection(pack: LanguagePack, enemy: EnemyConfig, level: number, audioMode?: AppSettings["audioMode"], focus?: TrainingFocus) {
  return {
    stage: level,
    tags: enemy.tags,
    requireHumanAudio: focus ? requiresHumanAudioForFocus(focus, audioMode) : false,
    requirePlayableAudio: focus ? requiresPlayableAudioForFocus(focus, audioMode) : false,
    reviewChance: getCurriculumReviewChance(level)
  };
}

function getCurriculumReviewChance(level: number): number {
  // Later chapters intentionally introduce fewer new items and increasingly
  // combine earlier material. This keeps their workload substantial without
  // imposing a calendar gate or forcing a child to wait between sessions.
  if (level >= 7) return 0.55;
  if (level >= 5) return 0.4;
  return 0.3;
}

function requiresHumanAudioForFocus(focus: TrainingFocus, audioMode: AppSettings["audioMode"] | undefined): boolean {
  return audioMode === "human_only" && focus === "comprehension";
}

function requiresPlayableAudioForFocus(focus: TrainingFocus, audioMode: AppSettings["audioMode"] | undefined): boolean {
  return audioMode === "human_and_automatic" && focus === "comprehension";
}

function uniqueFocuses(values: TrainingFocus[]): TrainingFocus[] {
  return values.filter((focus, index) => values.indexOf(focus) === index);
}

function questionAudioIsEligible(question: TrainingQuestion, audioMode: AppSettings["audioMode"]): boolean {
  if (question.activity_type !== "listen_and_choose" && question.activity_type !== "repeat_after_me") return true;
  const audio = question.audio ?? [];
  if (audioMode === "human_only") {
    return audio.some((entry) => entry.source_type === "human" && entry.review_status !== "draft" && Boolean(entry.url?.trim()));
  }
  return audio.some((entry) => {
    if (!entry.url?.trim()) return false;
    if (entry.source_type === "automated" || entry.source_type === "browser_tts") return true;
    return entry.review_status !== "draft";
  });
}

function getTrainingAction(focus: TrainingFocus): HeroActionName {
  if (focus === "vocabulary") return "training_dummy";
  if (focus === "comprehension") return "shield_block";
  if (focus === "grammar") return "rune_focus";
  return "echo_crystal";
}

function toFeedback(result: AnswerResult, selectedOptionId?: string, correctOptionId?: string, damage?: number, energyLoss?: number, absorbedDamage?: number, combatLabelKey?: string): FeedbackState {
  return {
    correct: result.correct,
    timedOut: result.timed_out,
    correctAnswer: result.message.replace(/^Correct: |^Answer: /, "").replace(/\.$/, ""),
    selectedOptionId,
    correctOptionId,
    statCapReached: result.stat_cap_reached,
    damage,
    energyLoss,
    absorbedDamage,
    combatLabelKey: combatLabelKey ?? result.combat_label_key
  };
}

function playAnswerAudio(result: AnswerResult, fight: boolean) {
  if (result.correct) {
    playSound(fight ? "hit" : "correct");
  } else {
    playSound(fight ? "enemyHit" : "wrong");
  }
  if (result.coins_delta > 0) playSound("coin");
}

function getCorrectFightAction(skill: TrainingFocus): HeroActionName {
  if (skill === "comprehension") {
    playSound("parry");
    return "parry";
  }
  if (skill === "grammar") {
    playSound("throw");
    return "dagger_throw";
  }
  if (skill === "pronunciation") {
    playSound("magic");
    return "strategy_spell";
  }
  return randomHeroAttackAction();
}

function randomHeroAttackAction(): HeroActionName {
  const actions: HeroActionName[] = ["hero_hit", "super_punch", "fart_attack"];
  const action = actions[Math.floor(Math.random() * actions.length)] ?? "hero_hit";
  if (action === "super_punch") playSound("super");
  if (action === "fart_attack") playSound("fart");
  return action;
}

function randomFailAction(inFight = false): HeroActionName {
  const actions: HeroActionName[] = inFight ? ["enemy_hit", "self_punch", "fall"] : ["stumble", "self_punch", "fall"];
  const action = actions[Math.floor(Math.random() * actions.length)] ?? "stumble";
  if (action === "self_punch") playSound("wrong");
  return action;
}
