import { useEffect, useMemo, useState } from "react";
import { getLocalizedText, type LanguagePack, type LetterItem, type StoryChapter } from "@hero-lang/content-schema";
import type { LearnerState } from "@hero-lang/learning-engine";
import { playLearningAudio, unlockAudio } from "../audio";

type StudyBookProps = {
  pack: LanguagePack;
  state: LearnerState;
  language: string;
};

type StudyConcept = {
  chapter: StoryChapter;
  letters: LetterItem[];
  searchText: string;
};

const COPY = {
  it: {
    open: "Manuale",
    openDetail: "Grammatica, suoni e riferimenti",
    kicker: "Consultazione",
    title: "Manuale di armeno",
    subtitle: "Una raccolta consultabile delle nozioni già incontrate. La storia resta nel libro dei capitoli.",
    close: "Chiudi il manuale",
    searchLabel: "Cerca una nozione",
    searchPlaceholder: "Cerca grammatica, esempio, lettera…",
    noResults: "Nessuna nozione corrisponde alla ricerca.",
    concepts: "nozioni disponibili",
    letters: "lettere e suoni introdotti",
    concept: "Nozione",
    explanation: "In breve",
    studyNotes: "Come ricordarla",
    examples: "Esempi",
    watchOut: "Da non confondere",
    relatedLetters: "Lettere e suoni collegati",
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
    openDetail: "Grammar, sounds, and lookup",
    kicker: "Reference",
    title: "Armenian reference book",
    subtitle: "A lookup collection of concepts already encountered. The narrative remains in the chapter book.",
    close: "Close the reference book",
    searchLabel: "Search concepts",
    searchPlaceholder: "Search grammar, examples, letters…",
    noResults: "No concept matches this search.",
    concepts: "available concepts",
    letters: "introduced letters and sounds",
    concept: "Concept",
    explanation: "In brief",
    studyNotes: "How to remember it",
    examples: "Examples",
    watchOut: "Do not confuse",
    relatedLetters: "Related letters and sounds",
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

function localizedSearchText(chapter: StoryChapter, letters: LetterItem[], language: "it" | "en"): string {
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
    ]),
    ...letters.flatMap((letter) => [
      letter.character,
      letter.uppercase ?? "",
      letter.lowercase ?? "",
      letter.transliteration ?? "",
      letter.sound ?? "",
      getLocalizedText(letter.names, language, ""),
      getLocalizedText(letter.sound_approximation, language, "")
    ])
  ];
  return chunks.join(" ").toLocaleLowerCase(language);
}

export function StudyBook({ pack, state, language }: StudyBookProps) {
  const displayLanguage: "it" | "en" = language.startsWith("it") ? "it" : "en";
  const copy = COPY[displayLanguage];
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);

  const concepts = useMemo<StudyConcept[]>(() => {
    return (pack.story?.chapters ?? [])
      .filter((chapter) => chapterLevel(chapter) <= state.level && Boolean(chapter.lesson))
      .sort((left, right) => chapterLevel(left) - chapterLevel(right))
      .map((chapter) => {
        const letters = (pack.letters ?? []).filter((letter) => letterStage(letter) === chapterLevel(chapter));
        return {
          chapter,
          letters,
          searchText: localizedSearchText(chapter, letters, displayLanguage)
        };
      });
  }, [displayLanguage, pack.letters, pack.story?.chapters, state.level]);

  const introducedLetters = useMemo(
    () => (pack.letters ?? []).filter((letter) => letterStage(letter) <= state.level),
    [pack.letters, state.level]
  );

  const filteredConcepts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase(displayLanguage);
    if (!normalized) return concepts;
    return concepts.filter((concept) => concept.searchText.includes(normalized));
  }, [concepts, displayLanguage, query]);

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

  if (pack.pack_id !== "hy-eastern-it" || concepts.length === 0) return null;

  return (
    <>
      <button type="button" className="study-book-open-button" onClick={() => setOpen(true)}>
        <span className="study-book-open-icon" aria-hidden="true">📚</span>
        <span className="study-book-open-copy">
          <strong>{copy.open}</strong>
          <small>{copy.openDetail}</small>
        </span>
        <span className="study-book-open-arrow" aria-hidden="true">›</span>
      </button>
      {open ? (
        <div className="study-book-overlay" role="presentation">
          <section className="study-book-window" role="dialog" aria-modal="true" aria-label={copy.title}>
            <header className="study-book-header">
              <div>
                <p className="study-book-kicker">{copy.kicker}</p>
                <h2>{copy.title}</h2>
              </div>
              <button type="button" className="study-book-close" onClick={() => setOpen(false)} aria-label={copy.close}>
                <span aria-hidden="true">×</span>
              </button>
            </header>
            <p className="study-book-intro">{copy.subtitle}</p>
            <div className="study-book-toolbar">
              <label htmlFor="study-book-search">{copy.searchLabel}</label>
              <input
                id="study-book-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={copy.searchPlaceholder}
                autoComplete="off"
              />
              <div className="study-book-summary" aria-label={copy.title}>
                <span><strong>{concepts.length}</strong> {copy.concepts}</span>
                <span><strong>{introducedLetters.length}</strong> {copy.letters}</span>
              </div>
            </div>
            <main className="study-book-scroll">
              {filteredConcepts.length ? (
                <div className="study-topic-list">
                  {filteredConcepts.map(({ chapter, letters }) => {
                    const lesson = chapter.lesson;
                    const conceptTitle = getLocalizedText(lesson?.title, displayLanguage, chapter.id);
                    return (
                      <details className="study-topic-card" key={chapter.id}>
                        <summary className="study-topic-toggle">
                          <span>{copy.concept}</span>
                          <strong>{conceptTitle}</strong>
                          <em aria-hidden="true">＋</em>
                        </summary>
                        <div className="study-topic-content">
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
                              <h3>{copy.relatedLetters}</h3>
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
                      </details>
                    );
                  })}
                </div>
              ) : <p className="study-book-empty">{copy.noResults}</p>}
            </main>
          </section>
        </div>
      ) : null}
    </>
  );
}
