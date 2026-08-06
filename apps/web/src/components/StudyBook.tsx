import { useEffect, useMemo, useState } from "react";
import { getLocalizedText, type LanguagePack, type LetterItem, type StoryChapter } from "@hero-lang/content-schema";
import type { LearnerState } from "@hero-lang/learning-engine";
import { playLearningAudio, unlockAudio } from "../audio";

type StudyBookProps = {
  pack: LanguagePack;
  state: LearnerState;
  language: string;
};

const COPY = {
  it: {
    open: "Studio",
    kicker: "Riferimento",
    title: "Quaderno di studio armeno",
    subtitle: "Lettere, suoni, grammatica, esempi e difficoltà dei capitoli già incontrati.",
    close: "Chiudi il quaderno di studio",
    current: "Capitolo attuale",
    previous: "Capitolo studiato",
    concepts: "argomenti disponibili",
    letters: "lettere introdotte",
    objectives: "Obiettivi",
    explanation: "Concetto",
    studyNotes: "Per studiare meglio",
    examples: "Esempi",
    watchOut: "Attenzione",
    chapterLetters: "Lettere di questo capitolo",
    letterName: "Nome",
    sound: "Suono",
    approximation: "Confronto indicativo con l'italiano",
    mastered: "Consolidata",
    practising: "In esercizio",
    unseen: "Non ancora esercitata",
    playName: "Ascolta il nome",
    playSound: "Ascolta il suono",
    soundMissing: "Suono isolato non ancora disponibile",
    reviewNote: "Le somiglianze con l'italiano sono indicazioni pratiche e richiedono revisione madrelingua."
  },
  en: {
    open: "Study",
    kicker: "Reference",
    title: "Armenian study book",
    subtitle: "Letters, sounds, grammar, examples, and difficulties from chapters already encountered.",
    close: "Close the study book",
    current: "Current chapter",
    previous: "Studied chapter",
    concepts: "available topics",
    letters: "introduced letters",
    objectives: "Objectives",
    explanation: "Concept",
    studyNotes: "Study notes",
    examples: "Examples",
    watchOut: "Watch out",
    chapterLetters: "Letters in this chapter",
    letterName: "Name",
    sound: "Sound",
    approximation: "Indicative Italian sound comparison",
    mastered: "Mastered",
    practising: "Practising",
    unseen: "Not practised yet",
    playName: "Play name",
    playSound: "Play sound",
    soundMissing: "Isolated sound not available yet",
    reviewNote: "Italian comparisons are practical approximations and still require native-speaker review."
  }
} as const;

function letterStage(letter: LetterItem): number {
  const tag = letter.tags?.find((value) => /^stage:\d+$/.test(value));
  return tag ? Number(tag.slice(6)) : 0;
}

function chapterLevel(chapter: StoryChapter): number {
  return chapter.minimum_level ?? 0;
}

function paragraphs(value: string): string[] {
  return value.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
}

function letterProgress(letter: LetterItem, state: LearnerState): "mastered" | "practising" | "unseen" {
  const memory = state.mastery_by_letter[letter.id];
  if ((memory?.mastery ?? 0) >= 0.75) return "mastered";
  if ((memory?.seen_count ?? 0) > 0) return "practising";
  return "unseen";
}

export function StudyBook({ pack, state, language }: StudyBookProps) {
  const displayLanguage = language.startsWith("it") ? "it" : "en";
  const copy = COPY[displayLanguage];
  const [open, setOpen] = useState(false);
  const [expandedTopicId, setExpandedTopicId] = useState<string | undefined>();
  const [playingId, setPlayingId] = useState<string | null>(null);

  const availableChapters = useMemo(
    () => (pack.story?.chapters ?? [])
      .filter((chapter) => chapterLevel(chapter) <= state.level)
      .sort((left, right) => chapterLevel(right) - chapterLevel(left)),
    [pack.story?.chapters, state.level]
  );
  const currentLevel = pack.levels?.find((level) => level.number === state.level);
  const currentChapter = availableChapters.find((chapter) => chapter.id === currentLevel?.chapter_id)
    ?? availableChapters[0];
  const introducedLetters = useMemo(
    () => (pack.letters ?? []).filter((letter) => letterStage(letter) <= state.level),
    [pack.letters, state.level]
  );

  useEffect(() => {
    if (currentChapter?.id) setExpandedTopicId(currentChapter.id);
  }, [currentChapter?.id]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function playName(letter: LetterItem) {
    if (playingId) return;
    setPlayingId(`${letter.id}:name`);
    try {
      void unlockAudio();
      await playLearningAudio(letter.audio ?? [], letter.spoken_name || letter.character, pack.language.bcp47);
    } finally {
      setPlayingId(null);
    }
  }

  async function playSound(letter: LetterItem) {
    if (playingId || !letter.sound_audio?.length) return;
    setPlayingId(`${letter.id}:sound`);
    try {
      void unlockAudio();
      await playLearningAudio(letter.sound_audio, undefined, pack.language.bcp47);
    } finally {
      setPlayingId(null);
    }
  }

  if (pack.pack_id !== "hy-eastern-it" || availableChapters.length === 0) return null;

  return (
    <>
      <button type="button" className="study-book-open-button" onClick={() => setOpen(true)}>
        <span aria-hidden="true">📚</span>
        <span>{copy.open}</span>
      </button>
      {open ? (
        <div className="study-book-overlay" role="dialog" aria-modal="true" aria-label={copy.title}>
          <header className="study-book-header">
            <div>
              <p className="study-book-kicker">{copy.kicker}</p>
              <h2>{copy.title}</h2>
              <p>{copy.subtitle}</p>
            </div>
            <button type="button" className="study-book-close" onClick={() => setOpen(false)} aria-label={copy.close}>
              <span aria-hidden="true">×</span>
            </button>
          </header>
          <main className="study-book-scroll">
            <section className="study-book-summary" aria-label={copy.title}>
              <div><strong>{availableChapters.length}</strong><span>{copy.concepts}</span></div>
              <div><strong>{introducedLetters.length}</strong><span>{copy.letters}</span></div>
            </section>
            <div className="study-topic-list">
              {availableChapters.map((chapter) => {
                const expanded = expandedTopicId === chapter.id;
                const isCurrent = chapter.id === currentChapter?.id;
                const lesson = chapter.lesson;
                const letters = (pack.letters ?? []).filter((letter) => letterStage(letter) === chapterLevel(chapter));
                return (
                  <article className={`study-topic-card${expanded ? " expanded" : ""}${isCurrent ? " current" : ""}`} key={chapter.id}>
                    <button
                      type="button"
                      className="study-topic-toggle"
                      aria-expanded={expanded}
                      onClick={() => setExpandedTopicId(expanded ? undefined : chapter.id)}
                    >
                      <span>{isCurrent ? copy.current : copy.previous}</span>
                      <strong>{getLocalizedText(chapter.title, displayLanguage, chapter.id)}</strong>
                      <small>{getLocalizedText(lesson?.title, displayLanguage, getLocalizedText(chapter.summary, displayLanguage, ""))}</small>
                      <em aria-hidden="true">{expanded ? "−" : "+"}</em>
                    </button>
                    {expanded ? (
                      <div className="study-topic-content">
                        {lesson?.objectives?.length ? (
                          <section>
                            <h3>{copy.objectives}</h3>
                            <ul>{lesson.objectives.map((objective, index) => <li key={`objective:${index}`}>{getLocalizedText(objective, displayLanguage, "")}</li>)}</ul>
                          </section>
                        ) : null}
                        {lesson?.explanation ? (
                          <section>
                            <h3>{copy.explanation}</h3>
                            {paragraphs(getLocalizedText(lesson.explanation, displayLanguage, "")).map((paragraph, index) => <p key={`explanation:${index}`}>{paragraph}</p>)}
                          </section>
                        ) : null}
                        {lesson?.study_notes?.length ? (
                          <section className="study-note-card">
                            <h3>{copy.studyNotes}</h3>
                            <ul>{lesson.study_notes.map((note, index) => <li key={`note:${index}`}>{getLocalizedText(note, displayLanguage, "")}</li>)}</ul>
                          </section>
                        ) : null}
                        {lesson?.examples?.length ? (
                          <section>
                            <h3>{copy.examples}</h3>
                            <div className="study-example-grid">
                              {lesson.examples.map((example, index) => (
                                <article key={`${example.target}:${index}`}>
                                  <strong lang={pack.language.bcp47}>{example.target}</strong>
                                  {example.transliteration ? <em>{example.transliteration}</em> : null}
                                  <p>{getLocalizedText(example.translation, displayLanguage, "")}</p>
                                  {example.note ? <small>{getLocalizedText(example.note, displayLanguage, "")}</small> : null}
                                </article>
                              ))}
                            </div>
                          </section>
                        ) : null}
                        {lesson?.common_mistakes?.length ? (
                          <section className="study-warning-card">
                            <h3>{copy.watchOut}</h3>
                            <ul>{lesson.common_mistakes.map((mistake, index) => <li key={`mistake:${index}`}>{getLocalizedText(mistake, displayLanguage, "")}</li>)}</ul>
                          </section>
                        ) : null}
                        {letters.length ? (
                          <section>
                            <h3>{copy.chapterLetters}</h3>
                            <div className="study-letter-grid">
                              {letters.map((letter) => {
                                const progress = letterProgress(letter, state);
                                const approximation = getLocalizedText(letter.sound_approximation, displayLanguage, "");
                                return (
                                  <article className={`study-letter-card status-${progress}`} key={letter.id}>
                                    <div className="study-letter-main">
                                      <div className="study-letter-glyph" lang={pack.language.bcp47}>
                                        <strong>{letter.uppercase || letter.character}</strong>
                                        <span>{letter.lowercase || letter.character}</span>
                                      </div>
                                      <div>
                                        <b>{getLocalizedText(letter.names, displayLanguage, letter.spoken_name || letter.character)}</b>
                                        <small>{copy[progress]}</small>
                                      </div>
                                    </div>
                                    <dl>
                                      <div><dt>{copy.sound}</dt><dd><code>{letter.sound}</code>{letter.transliteration ? ` · ${letter.transliteration}` : ""}</dd></div>
                                      {approximation ? <div><dt>{copy.approximation}</dt><dd>{approximation}</dd></div> : null}
                                    </dl>
                                    <div className="study-letter-actions">
                                      <button type="button" onClick={() => void playName(letter)} disabled={Boolean(playingId)}>
                                        {playingId === `${letter.id}:name` ? "…" : "▶"} {copy.playName}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => void playSound(letter)}
                                        disabled={Boolean(playingId) || !letter.sound_audio?.length}
                                        title={!letter.sound_audio?.length ? copy.soundMissing : undefined}
                                      >
                                        {playingId === `${letter.id}:sound` ? "…" : "◉"} {copy.playSound}
                                      </button>
                                    </div>
                                  </article>
                                );
                              })}
                            </div>
                            <p className="study-review-note">{copy.reviewNote}</p>
                          </section>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </main>
        </div>
      ) : null}
    </>
  );
}
