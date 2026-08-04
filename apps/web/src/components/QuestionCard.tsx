import { useEffect, useRef, useState } from "react";
import type { AnswerOption, TrainingQuestion } from "@hero-lang/learning-engine";
import { isLearningAudioPlaying, playLearningAudio, unlockAudio } from "../audio";
import { t } from "../i18n";
import { QuestionTimer } from "./QuestionTimer";
import { FitText } from "./FitText";

interface QuestionCardProps {
  question: TrainingQuestion;
  language: string;
  disabled: boolean;
  mode: "training" | "fight";
  index: number;
  total: number;
  timerSeconds?: number;
  feedback?: {
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
  } | null;
  onAnswer: (selectedOptionId: string) => void;
  onContinue?: () => void;
  onAudioStarted?: () => void;
  onAudioReplayCompleted?: (durationMs: number) => void;
  audioHasStarted?: boolean;
}

export function QuestionCard({
  question,
  language,
  disabled,
  mode,
  index,
  total,
  timerSeconds = 10,
  feedback,
  onAnswer,
  onContinue,
  onAudioStarted,
  onAudioReplayCompleted,
  audioHasStarted = false
}: QuestionCardProps) {
  const showTimer = mode === "fight" && timerSeconds > 0;
  const targetLanguage = question.target_audio_lang?.split("-")[0] ?? (/^[\u0530-\u058F]/.test(question.prompt) ? "hy" : undefined);
  const showInstructionAudioButton = Boolean(question.instruction_audio_text || question.instruction_audio?.length);
  const showTargetAudioButton = question.allow_target_audio_before_answer !== false
    && (question.activity_type === "listen_and_choose" || Boolean(question.audio?.length) || Boolean(question.target_audio_text));
  const useSingleAudioControl = Boolean(question.single_audio_control);
  const showSingleReplayButton = useSingleAudioControl && (showInstructionAudioButton || showTargetAudioButton || Boolean(question.secondary_audio?.length));
  const isTapOrder = question.variant === "sentence_tap_order";
  const [selectedChips, setSelectedChips] = useState<AnswerOption[]>([]);
  const [audioStarted, setAudioStarted] = useState(false);
  const [instructionAudioPlaying, setInstructionAudioPlaying] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [secondaryAudioPlaying, setSecondaryAudioPlaying] = useState(false);
  const [narrationFailed, setNarrationFailed] = useState(false);
  const instructionPlaybackSerial = useRef(0);
  const audioPlaybackSerial = useRef(0);
  const secondaryPlaybackSerial = useRef(0);
  const expectedAnswerLength = question.expected_answer_length ?? question.options.length;
  const tapOrderReady = selectedChips.length === expectedAnswerLength;
  const waitingForNarration = Boolean(question.requires_audio_before_answer) && !audioStarted;
  // Avoid cancelling narration by submitting while learning audio is active.
  // A genuine playback failure still releases these controls when its promise settles.
  const answerDisabled = disabled
    || instructionAudioPlaying
    || audioPlaying
    || secondaryAudioPlaying;

  useEffect(() => {
    instructionPlaybackSerial.current += 1;
    audioPlaybackSerial.current += 1;
    secondaryPlaybackSerial.current += 1;
    setSelectedChips([]);
    setInstructionAudioPlaying(false);
    setAudioPlaying(false);
    setSecondaryAudioPlaying(false);
    setNarrationFailed(false);
    setAudioStarted(!question.requires_audio_before_answer || audioHasStarted);

    if (!question.auto_narrate) return;
    const handle = window.setTimeout(() => {
      void playInstructionAudio(false);
    }, 120);
    return () => window.clearTimeout(handle);
  }, [question.id]);

  useEffect(() => {
    if (audioHasStarted) setAudioStarted(true);
  }, [audioHasStarted]);

  function answerSubmissionBlocked(): boolean {
    return answerDisabled || isLearningAudioPlaying();
  }

  function handleChipTap(option: AnswerOption) {
    if (
      answerSubmissionBlocked()
      || !isTapOrder
      || selectedChips.length >= expectedAnswerLength
      || selectedChips.some((chip) => chip.id === option.id)
    ) return;
    setSelectedChips((previous) => [...previous, option]);
  }

  function removeSelectedChip(optionId: string) {
    if (answerSubmissionBlocked()) return;
    setSelectedChips((previous) => previous.filter((chip) => chip.id !== optionId));
  }

  function submitTapOrder() {
    if (answerSubmissionBlocked() || !tapOrderReady) return;
    onAnswer(selectedChips.map((chip) => chip.label).join(" "));
  }
  function submitAnswer(selectedOptionId: string) {
    if (answerSubmissionBlocked()) return;
    onAnswer(selectedOptionId);
  }
  function continueAfterFeedback(): void {
    if (isLearningAudioPlaying()) return;
    onContinue?.();
  }


  async function playInstructionAudio(isReplay = false) {
    if (instructionAudioPlaying) return;
    void unlockAudio();
    const serial = ++instructionPlaybackSerial.current;
    const wasReadyForAnswer = audioStarted;
    const playbackStartedAt = performance.now();
    setInstructionAudioPlaying(true);
    setNarrationFailed(false);

    let instructionPlayed = true;
    let targetPlayed = true;
    try {
      if (question.instruction_audio_text || question.instruction_audio?.length) {
        instructionPlayed = await playLearningAudio(
          question.instruction_audio,
          question.instruction_audio_text,
          question.instruction_audio_lang ?? question.target_audio_lang ?? "da-DK"
        );
      }
      if (question.auto_play_target_audio || (isReplay && question.replay_target_audio)) {
        targetPlayed = await playLearningAudio(
          question.audio,
          question.target_audio_text,
          question.target_audio_lang ?? "da-DK"
        );
      }
    } finally {
      if (serial !== instructionPlaybackSerial.current) return;
      const played = instructionPlayed && targetPlayed;
      // Never trap a child behind a failed system voice. The retry message stays
      // visible, while the visual task remains usable with adult support.
      setNarrationFailed(!played);
      if (!wasReadyForAnswer) {
        setAudioStarted(true);
        onAudioStarted?.();
      } else if (played) {
        onAudioReplayCompleted?.(Math.max(0, performance.now() - playbackStartedAt));
      }
      setInstructionAudioPlaying(false);
    }
  }

  function playQuestionAudio() {
    if (audioPlaying) return;
    void unlockAudio();
    const serial = ++audioPlaybackSerial.current;
    const wasReadyForAnswer = audioStarted;
    const playbackStartedAt = performance.now();
    setAudioPlaying(true);
    void playLearningAudio(question.audio, question.target_audio_text, question.target_audio_lang ?? "hy-AM")
      .then((played) => {
        if (serial !== audioPlaybackSerial.current) return;
        if (played && !wasReadyForAnswer) {
          setAudioStarted(true);
          setNarrationFailed(false);
          onAudioStarted?.();
        } else if (played && wasReadyForAnswer) {
          onAudioReplayCompleted?.(Math.max(0, performance.now() - playbackStartedAt));
        }
      })
      .finally(() => {
        if (serial === audioPlaybackSerial.current) setAudioPlaying(false);
      });
  }

  function playSecondaryAudio() {
    if (secondaryAudioPlaying || !question.secondary_audio?.length) return;
    void unlockAudio();
    const serial = ++secondaryPlaybackSerial.current;
    setSecondaryAudioPlaying(true);
    void playLearningAudio(question.secondary_audio, question.secondary_audio_text, question.target_audio_lang ?? "hy-AM")
      .finally(() => {
        if (serial === secondaryPlaybackSerial.current) setSecondaryAudioPlaying(false);
      });
  }

  return (
    <section className="question-card" aria-label={mode === "fight" ? t(language, "fightTitle") : t(language, "training")}>
      <div className="question-header">
        <span>
          {t(language, "question")} {index + 1} {t(language, "of")} {total}
        </span>
        <span>{t(language, question.skill)}</span>
      </div>

      {showTimer ? (
        <QuestionTimer
          durationSeconds={timerSeconds}
          active={!disabled && audioStarted && !instructionAudioPlaying && !audioPlaying}
          resetKey={`${question.id}:${audioStarted ? "started" : "waiting"}`}
          label={audioStarted ? t(language, "speedBonus") : t(language, "listenToStartBonus")}
        />
      ) : null}

      {showSingleReplayButton ? (
        <div className="question-audio-actions question-audio-actions-single">
          <button
            type="button"
            className="audio-button instruction-audio-button"
            disabled={instructionAudioPlaying || audioPlaying}
            onClick={() => void playInstructionAudio(true)}
          >
            🔊 {t(language, "listenAgain")}
          </button>
        </div>
      ) : showInstructionAudioButton || showTargetAudioButton || question.secondary_audio?.length ? (
        <div className="question-audio-actions">
          {showInstructionAudioButton ? (
            <button type="button" className="audio-button instruction-audio-button" disabled={instructionAudioPlaying} onClick={() => void playInstructionAudio(true)}>
              🔊 {t(language, "playInstruction")}
            </button>
          ) : null}
          {showTargetAudioButton ? (
            <button type="button" className="audio-button" disabled={audioPlaying} onClick={playQuestionAudio}>
              ◉ {question.kind === "letter"
                ? t(language, "playLetterAudio")
                : question.activity_type === "repeat_after_me"
                  ? t(language, "listenAndRepeat")
                  : question.activity_type === "listen_and_choose"
                    ? t(language, "listen")
                    : t(language, "playTargetAudio")}
            </button>
          ) : null}
          {question.secondary_audio?.length ? (
            <button type="button" className="audio-button secondary-audio-button" disabled={secondaryAudioPlaying} onClick={playSecondaryAudio}>
              ◉ {t(language, question.secondary_audio_label_key ?? "playLetterSound")}
            </button>
          ) : null}
        </div>
      ) : null}
      {waitingForNarration ? <p className="audio-required-hint">🔊 {t(language, "narrationPlaying")}</p> : null}
      {narrationFailed ? <p className="audio-required-hint audio-retry-hint">{t(language, "narrationRetryHint")}</p> : null}

      <div className={question.kind === "letter" ? "prompt letter-prompt" : "prompt"} lang={targetLanguage}>
        <FitText text={question.prompt} lang={targetLanguage} maxRem={question.kind === "letter" ? 5.6 : 3.2} minRem={question.kind === "letter" ? 2.1 : 1.05} />
      </div>
      <p className="prompt-hint">{getPromptHint(question, language)}</p>

      {isTapOrder ? (
        <div className="tap-order-area">
          <div className="tap-order-answer" lang={targetLanguage} aria-live="polite">
            {selectedChips.length > 0 ? (
              <div className="tap-order-selected-list">
                {selectedChips.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    className="tap-order-selected-chip"
                    disabled={answerDisabled}
                    onClick={() => removeSelectedChip(chip.id)}
                    title={t(language, "removeWord")}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            ) : t(language, "tapWordsInOrder")}
          </div>
          <div className="tap-order-count">
            {t(language, "wordsSelected", { selected: selectedChips.length, total: expectedAnswerLength })}
          </div>
          <div className="answer-grid word-chip-grid">
            {question.options.map((option) => {
              const used = selectedChips.some((chip) => chip.id === option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`answer-button word-chip${used ? " chip-used" : ""}`}
                  disabled={answerDisabled || used || selectedChips.length >= expectedAnswerLength}
                  onClick={() => handleChipTap(option)}
                >
                  <FitText text={option.label} lang={targetLanguage} maxRem={1.02} minRem={0.62} />
                </button>
              );
            })}
          </div>
          {!answerDisabled ? (
            <div className="tap-order-actions">
              <button
                type="button"
                className="ghost-button compact-button"
                disabled={selectedChips.length === 0}
                onClick={() => setSelectedChips((previous) => previous.slice(0, -1))}
              >
                {t(language, "undoWord")}
              </button>
              <button
                type="button"
                className="ghost-button compact-button"
                disabled={selectedChips.length === 0}
                onClick={() => setSelectedChips([])}
              >
                {t(language, "resetOrder")}
              </button>
              <button
                type="button"
                className="primary-button compact-button tap-order-check"
                disabled={answerDisabled || !tapOrderReady}
                onClick={submitTapOrder}
              >
                {t(language, "checkAnswer")}
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="answer-grid">
          {question.options.map((option) => {
            const isCorrect = feedback?.correctOptionId === option.id;
            const isSelectedWrong = Boolean(feedback && !feedback.correct && feedback.selectedOptionId === option.id);
            const answerClass = `answer-button${option.is_hard_distractor ? " hard-option" : ""}${isCorrect ? " answer-correct" : ""}${isSelectedWrong ? " answer-wrong" : ""}`;
            return (
              <button
                key={option.id}
                type="button"
                className={answerClass}
                disabled={answerDisabled}
                onClick={() => submitAnswer(option.id)}
              >
                <FitText text={option.label} lang={/^[\u0530-\u058F]/.test(option.label) ? "hy" : undefined} maxRem={1.02} minRem={0.62} />
              </button>
            );
          })}
        </div>
      )}

      {feedback ? (
        <div className={`inline-feedback ${feedback.correct ? "correct" : "incorrect"}`}>
          <strong>{feedback.timedOut ? t(language, "timeout") : feedback.correct ? t(language, "correct") : t(language, "wrong")}</strong>
          {!feedback.correct ? <span>{t(language, "answerIs")}: {feedback.correctAnswer}</span> : <span>{feedback.correctAnswer}</span>}
          {question.answer_explanation ? (
            <div className="answer-explanation">
              <div className="answer-explanation-target" lang={targetLanguage}>{question.answer_explanation.target}</div>
              {question.answer_explanation.transliteration ? (
                <div className="answer-explanation-row">
                  <span>{t(language, "pronunciationLabel")}</span>
                  <strong>{question.answer_explanation.transliteration}</strong>
                </div>
              ) : null}
              {question.answer_explanation.translation ? (
                <div className="answer-explanation-row">
                  <span>{t(language, "meaningLabel")}</span>
                  <strong>{question.answer_explanation.translation}</strong>
                </div>
              ) : null}
              {question.answer_explanation.word_glosses?.length ? (
                <div className="answer-glosses" aria-label={t(language, "wordByWord") }>
                  {question.answer_explanation.word_glosses.map((gloss) => (
                    <span key={`${gloss.target}:${gloss.translation}`} className="answer-gloss">
                      <b lang={targetLanguage}>{gloss.target}</b>
                      <span>{gloss.translation}</span>
                    </span>
                  ))}
                </div>
              ) : null}
              {question.target_audio_text ? (
                <button type="button" className="feedback-audio-button" onClick={playQuestionAudio}>
                  🔊 {t(language, "listenAgain")}
                </button>
              ) : null}
            </div>
          ) : null}
          {feedback.statCapReached ? <span>{t(language, "statCapReached")}</span> : null}
          {!feedback.correct && onContinue ? (
            <button type="button" className="primary-button feedback-continue-button" onClick={continueAfterFeedback}>
              {t(language, "continueButton")}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function getPromptHint(question: TrainingQuestion, language: string): string {
  if (question.prompt_hint) return question.prompt_hint;
  if (question.kind === "letter") return t(language, "letterHint");
  if (question.activity_type === "listen_and_choose") return t(language, "comprehensionHint");
  if (question.activity_type === "transliteration_match" || question.activity_type === "syllable_order") return t(language, "pronunciationHint");
  if (question.activity_type === "sentence_order") return t(language, "grammarHint");
  if (question.item?.transliteration) return `${t(language, "sayItLike")}: ${question.item.transliteration}`;
  return t(language, "chooseMeaning");
}
