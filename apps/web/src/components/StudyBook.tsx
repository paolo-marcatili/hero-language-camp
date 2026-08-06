import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { getLocalizedText, type LanguagePack, type LetterItem, type StoryChapter } from "@hero-lang/content-schema";
import type { LearnerState } from "@hero-lang/learning-engine";
import { playLearningAudio, unlockAudio } from "../audio";

type StudyBookProps = {
  pack: LanguagePack;
  state: LearnerState;
  language: string;
};

type ManualConcept = {
  id: string;
  chapter: StoryChapter;
  searchText: string;
};

const COPY = {
  it: {
    open: "Manuale",
    openDetail: "Alfabeto, grammatica e riferimenti",
    kicker: "Consultazione",
    title: "Manuale di armeno",
    subtitle: "Nozioni concise già incontrate nel corso, organizzate come un manuale da consultare.",
    close: "Chiudi il manuale",
    searchLabel: "Cerca una nozione",
    searchPlaceholder: "Cerca pronome, verbo essere, lettera…",
    noResults: "Nessuna nozione corrisponde alla ricerca.",
    available: "nozioni disponibili",
    alphabetTitle: "Alfabeto e suoni",
    alphabetSummary: "Lettere introdotte finora, nome, suono e confronto indicativo con l'italiano.",
    concept: "Nozione",
    explanation: "In breve",
    studyNotes: "Come ricordarla",
    examples: "Esempi",
    watchOut: "Da non confondere",
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
    open: "Reference",
    openDetail: "Alphabet, grammar, and lookup",
    kicker: "Reference",
    title: "Armenian reference manual",
    subtitle: "Concise concepts already encountered in the course, organised as a lookup manual.",
    close: "Close the manual",
    searchLabel: "Search concepts",
    searchPlaceholder: "Search pronouns, to be, letters…",
    noResults: "No concept matches this search.",
    available: "available concepts",
    alphabetTitle: "Alphabet and sounds",
    alphabetSummary: "Letters introduced so far, with names, sounds, and indicative Italian comparisons.",
    concept: "Concept",
    explanation: "In brief",
    studyNotes: "How to remember it",
    examples: "Examples",
    watchOut: "Do not confuse",
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

function conceptSearchText(chapter: StoryChapter, language: "it" | "en"): string {
  const lesson = chapter.lesson;
  const chunks = [
    getLocalizedText(lesson?.title, language, ""),
    getLocalizedText(lesson?.explanation, language, ""),
    ...(lesson?.study_notes ?? []).map((value) => getLocalizedText(value, language, "")),
    ...(lesson?.common_mistakes ?? []).map((value) => getLocalizedText(value, language, "")),
    ...(lesson?.examples ?? []).flatMap((example) => [
      example.target,
      example.transliteration ?? "",
      getLocalizedText(example.translation, language, ""),
      getLocalizedText(example.note, language, "")
    ])
  ];
  return chunks.join(" ").toLocaleLowerCase(language);
}

function letterSearchText(letters: LetterItem[], language: "it" | "en"): string {
  return letters.flatMap((letter) => [
    letter.character,
    letter.uppercase ?? "",
    letter.lowercase ?? "",
    letter.transliteration ?? "",
    letter.sound ?? "",
    getLocalizedText(letter.names, language, ""),
    getLocalizedText(letter.sound_approximation, language, "")
  ]).join(" ").toLocaleLowerCase(language);
}

export function StudyBook({ pack, state, language }: StudyBookProps) {
  const displayLanguage: "it" | "en" = language.startsWith("it") ? "it" : "en";
  const copy = COPY[displayLanguage];
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);

  const concepts = useMemo<ManualConcept[]>(() => {
    return (pack.story?.chapters ?? [])
      .filter((chapter) => chapterLevel(chapter) <= state.level && Boolean(chapter.lesson))
      .sort((left, right) => chapterLevel(left) - chapterLevel(right))
      .map((chapter) => ({
        id: chapter.id,
        chapter,
        searchText: conceptSearchText(chapter, displayLanguage)
      }));
  }, [displayLanguage, pack.story?.chapters, state.level]);

  const introducedLetters = useMemo(
    () => (pack.letters ?? [])
      .filter((letter) => letterStage(letter) <= state.level)
      .sort((left, right) => left.id.localeCompare(right.id)),
    [pack.letters, state.level]
  );

  const normalizedQuery = query.trim().toLocaleLowerCase(displayLanguage);
  const alphabetMatches = !normalizedQuery
    || copy.alphabetTitle.toLocaleLowerCase(displayLanguage).includes(normalizedQuery)
    || letterSearchText(introducedLetters, displayLanguage).includes(normalizedQuery);
  const filteredConcepts = normalizedQuery
    ? concepts.filter((concept) => concept.searchText.includes(normalizedQuery))
    : concepts;
  const resultCount = filteredConcepts.length + (alphabetMatches && introducedLetters.length ? 1 : 0);

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

  if (pack.pack_id !== "hy-eastern-it" || (concepts.length === 0 && introducedLetters.length === 0)) return null;

  const overlay = open ? createPortal(
    <div className="story-reader-overlay study-manual-overlay" role="dialog" aria-modal="true" aria-label={copy.title}>
      <section className="story-reader-window study-manual-window">
        <header className="story-reader-header">
          <div>
            <span>{copy.kicker}</span>
            <h2>{copy.title}</h2>
          </div>
          <button type="button" className="story-reader-close" onClick={() => setOpen(false)} aria-label={copy.close}>×</button>
        </header>
        <div className="study-manual-intro">{copy.subtitle}</div>
        <div className="study-manual-toolbar">
          <label htmlFor="study-manual-search">{copy.searchLabel}</label>
          <input
            id="study-manual-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.searchPlaceholder}
            autoComplete="off"
          />
          <span><strong>{resultCount}</strong> {copy.available}</span>
        </div>
        <main className="story-chapter-list study-manual-scroll">
          {alphabetMatches && introducedLetters.length ? (
            <details className="study-manual-topic">
              <summary>
                <span>Ա Բ Գ</span>
                <div><strong>{copy.alphabetTitle}</strong><small>{copy.alphabetSummary}</small></div>
                <em aria-hidden="true">＋</em>
              </summary>
              <div className="study-manual-topic-content">
                <div className="study-manual-letter-grid">
                  {introducedLetters.map((letter) => {
                    const progress = letterProgress(letter, state);
                    const approximation = getLocalizedText(letter.sound_approximation, displayLanguage, "");
                    return (
                      <article className={`study-manual-letter status-${progress}`} key={letter.id}>
                        <div className="study-manual-letter-main">
                          <div className="study-manual-glyph" lang={pack.language.bcp47}>
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
                        <div className="study-manual-letter-actions">
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
                <p className="study-manual-review-note">{copy.reviewNote}</p>
              </div>
            </details>
          ) : null}

          {filteredConcepts.map(({ id, chapter }) => {
            const lesson = chapter.lesson;
            if (!lesson) return null;
            const title = getLocalizedText(lesson.title, displayLanguage, id);
            const explanation = getLocalizedText(lesson.explanation, displayLanguage, "");
            return (
              <details className="study-manual-topic" key={id}>
                <summary>
                  <span>📘</span>
                  <div><strong>{title}</strong><small>{explanation}</small></div>
                  <em aria-hidden="true">＋</em>
                </summary>
                <div className="study-manual-topic-content">
                  {explanation ? (
                    <section>
                      <h3>{copy.explanation}</h3>
                      {paragraphs(explanation).map((paragraph, index) => <p key={`explanation:${index}`}>{paragraph}</p>)}
                    </section>
                  ) : null}
                  {lesson.study_notes?.length ? (
                    <section>
                      <h3>{copy.studyNotes}</h3>
                      <ul>{lesson.study_notes.map((note, index) => <li key={`note:${index}`}>{getLocalizedText(note, displayLanguage, "")}</li>)}</ul>
                    </section>
                  ) : null}
                  {lesson.examples?.length ? (
                    <section>
                      <h3>{copy.examples}</h3>
                      <div className="study-manual-example-list">
                        {lesson.examples.map((example, index) => (
                          <article key={`example:${index}`}>
                            <strong lang={pack.language.bcp47}>{example.target}</strong>
                            {example.transliteration ? <em>{example.transliteration}</em> : null}
                            <p>{getLocalizedText(example.translation, displayLanguage, "")}</p>
                            {example.note ? <small>{getLocalizedText(example.note, displayLanguage, "")}</small> : null}
                          </article>
                        ))}
                      </div>
                    </section>
                  ) : null}
                  {lesson.common_mistakes?.length ? (
                    <section className="study-manual-warning">
                      <h3>{copy.watchOut}</h3>
                      <ul>{lesson.common_mistakes.map((mistake, index) => <li key={`mistake:${index}`}>{getLocalizedText(mistake, displayLanguage, "")}</li>)}</ul>
                    </section>
                  ) : null}
                </div>
              </details>
            );
          })}

          {resultCount === 0 ? <p className="study-manual-empty">{copy.noResults}</p> : null}
        </main>
      </section>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <section className="next-task-panel study-manual-launcher" aria-label={copy.title}>
        <div className="study-manual-launcher-icon" aria-hidden="true">📚</div>
        <div className="chapter-summary-copy">
          <span>{copy.kicker}</span>
          <strong>{copy.open}</strong>
          <p>{copy.openDetail}</p>
        </div>
        <button
          type="button"
          className="chapter-open-button"
          onClick={() => setOpen(true)}
          aria-label={copy.title}
          title={copy.title}
        >
          <span aria-hidden="true">＋</span>
          <small>{copy.open}</small>
        </button>
      </section>
      {overlay}
    </>
  );
}
