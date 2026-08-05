import { useEffect, useMemo, useState } from "react";
import { getLocalizedText, type LanguagePack, type LetterItem } from "@hero-lang/content-schema";
import type { LearnerState } from "@hero-lang/learning-engine";
import { playLearningAudio, unlockAudio } from "../audio";

type AtlasFilter = "all" | "introduced" | "practice" | "mastered";

type AlphabetAtlasProps = {
  pack: LanguagePack;
  state: LearnerState;
  language: "it" | "en";
};

const labels = {
  it: {
    open: "Alfabeto",
    title: "Atlante dell'alfabeto armeno",
    subtitle: "Consulta tutte le lettere, ascolta il nome e segui i progressi.",
    close: "Chiudi",
    all: "Tutte",
    introduced: "Disponibili",
    practice: "Da praticare",
    mastered: "Consolidate",
    available: "Disponibile",
    future: "Capitolo futuro",
    unseen: "Non ancora esercitata",
    practising: "In esercizio",
    masteredStatus: "Consolidata",
    letterName: "Nome",
    sound: "Suono",
    approximation: "Confronto indicativo con l'italiano",
    draft: "Da verificare con un madrelingua",
    example: "Esempio",
    stage: "Capitolo",
    playName: "Ascolta il nome della lettera",
    playSound: "Ascolta il suono",
    soundMissing: "Registrazione del suono non ancora disponibile",
    introducedCount: "disponibili",
    seenCount: "esercitate",
    masteredCount: "consolidate"
  },
  en: {
    open: "Alphabet",
    title: "Armenian alphabet atlas",
    subtitle: "Browse every letter, hear its name, and follow progress.",
    close: "Close",
    all: "All",
    introduced: "Available",
    practice: "To practise",
    mastered: "Mastered",
    available: "Available",
    future: "Future chapter",
    unseen: "Not practised yet",
    practising: "Practising",
    masteredStatus: "Mastered",
    letterName: "Name",
    sound: "Sound",
    approximation: "Indicative Italian sound comparison",
    draft: "Needs native-speaker review",
    example: "Example",
    stage: "Chapter",
    playName: "Play letter name",
    playSound: "Play sound",
    soundMissing: "Sound recording not available yet",
    introducedCount: "available",
    seenCount: "practised",
    masteredCount: "mastered"
  }
} as const;

function getStage(letter: LetterItem): number {
  const stageTag = letter.tags?.find((tag) => /^stage:\d+$/.test(tag));
  return stageTag ? Number(stageTag.split(":")[1]) : 0;
}

function getStatus(letter: LetterItem, state: LearnerState) {
  const stage = getStage(letter);
  const memory = state.mastery_by_letter[letter.id];

  if (stage > state.level) return "future" as const;
  if ((memory?.mastery ?? 0) >= 0.75) return "mastered" as const;
  if ((memory?.seen_count ?? 0) > 0) return "practice" as const;
  return "introduced" as const;
}

export function AlphabetAtlas({ pack, state, language }: AlphabetAtlasProps) {
  const copy = labels[language];
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<AtlasFilter>("all");
  const [playingId, setPlayingId] = useState<string | null>(null);

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

  const letters = useMemo(
    () => [...(pack.letters ?? [])].sort((left, right) => getStage(left) - getStage(right)),
    [pack.letters]
  );

  const counts = useMemo(() => {
    return letters.reduce(
      (result, letter) => {
        const status = getStatus(letter, state);
        if (status !== "future") result.introduced += 1;
        if ((state.mastery_by_letter[letter.id]?.seen_count ?? 0) > 0) result.seen += 1;
        if (status === "mastered") result.mastered += 1;
        return result;
      },
      { introduced: 0, seen: 0, mastered: 0 }
    );
  }, [letters, state]);

  const visibleLetters = useMemo(() => {
    if (filter === "all") return letters;
    return letters.filter((letter) => {
      const status = getStatus(letter, state);
      if (filter === "introduced") return status !== "future";
      if (filter === "practice") return status === "introduced" || status === "practice";
      return status === "mastered";
    });
  }, [filter, letters, state]);

  async function playLetterName(letter: LetterItem) {
    if (playingId) return;
    setPlayingId(`${letter.id}:name`);
    try {
      unlockAudio();
      await playLearningAudio(letter.audio ?? [], letter.spoken_name || letter.character, pack.language.bcp47);
    } finally {
      setPlayingId(null);
    }
  }

  async function playLetterSound(letter: LetterItem) {
    if (playingId || !letter.sound_audio?.length) return;
    setPlayingId(`${letter.id}:sound`);
    try {
      unlockAudio();
      await playLearningAudio(letter.sound_audio, undefined, pack.language.bcp47);
    } finally {
      setPlayingId(null);
    }
  }

  return (
    <>
      <button type="button" className="alphabet-open-button" onClick={() => setOpen(true)}>
        <span aria-hidden="true">🔤</span>
        <span>{copy.open}</span>
      </button>

      {open ? (
        <div className="alphabet-atlas-overlay" role="dialog" aria-modal="true" aria-label={copy.title}>
          <header className="alphabet-atlas-header">
            <div>
              <p className="alphabet-atlas-kicker">{copy.open}</p>
              <h2>{copy.title}</h2>
              <p>{copy.subtitle}</p>
            </div>
            <button type="button" className="panel-close-button" onClick={() => setOpen(false)}>
              <span aria-hidden="true">×</span>
              <span>{copy.close}</span>
            </button>
          </header>

          <main className="alphabet-atlas-content">
            <section className="alphabet-atlas-summary" aria-label="Alphabet progress">
              <strong>{counts.introduced}</strong><span>{copy.introducedCount}</span>
              <strong>{counts.seen}</strong><span>{copy.seenCount}</span>
              <strong>{counts.mastered}</strong><span>{copy.masteredCount}</span>
            </section>

            <div className="alphabet-atlas-filters" role="group" aria-label="Alphabet filters">
              {(["all", "introduced", "practice", "mastered"] as AtlasFilter[]).map((option) => (
                <button
                  type="button"
                  key={option}
                  className={filter === option ? "is-active" : undefined}
                  onClick={() => setFilter(option)}
                >
                  {copy[option]}
                </button>
              ))}
            </div>

            <section className="alphabet-atlas-grid">
              {visibleLetters.map((letter) => {
                const status = getStatus(letter, state);
                const approximation = getLocalizedText(
                  letter.sound_approximation,
                  language,
                  language === "it" ? "Confronto non disponibile" : "Comparison unavailable"
                );
                const name = getLocalizedText(letter.names, language, letter.spoken_name || letter.character);
                const exampleWord = letter.example_word || letter.example_item_ids?.[0];
                const namePlaying = playingId === `${letter.id}:name`;
                const soundPlaying = playingId === `${letter.id}:sound`;
                const statusLabel =
                  status === "future"
                    ? copy.future
                    : status === "mastered"
                      ? copy.masteredStatus
                      : status === "practice"
                        ? copy.practising
                        : copy.unseen;

                return (
                  <article className={`alphabet-letter-card status-${status}`} key={letter.id}>
                    <div className="alphabet-letter-heading">
                      <div className="alphabet-letter-glyph" lang={pack.language.bcp47}>
                        <strong>{letter.uppercase || letter.character}</strong>
                        <span>{letter.lowercase || letter.character}</span>
                      </div>
                      <div>
                        <span className="alphabet-letter-status">{statusLabel}</span>
                        <small>{copy.stage} {getStage(letter) + 1}</small>
                      </div>
                    </div>

                    <dl className="alphabet-letter-details">
                      <div><dt>{copy.letterName}</dt><dd>{name}</dd></div>
                      <div><dt>{copy.sound}</dt><dd><code>{letter.sound}</code>{letter.transliteration ? ` · ${letter.transliteration}` : ""}</dd></div>
                      <div><dt>{copy.approximation}</dt><dd>{approximation}</dd></div>
                      {exampleWord ? <div><dt>{copy.example}</dt><dd lang={pack.language.bcp47}>{exampleWord}</dd></div> : null}
                    </dl>

                    {letter.sound_approximation_review_status !== "approved" ? (
                      <span className="alphabet-review-badge">{copy.draft}</span>
                    ) : null}

                    <div className="alphabet-letter-actions">
                      <button
                        type="button"
                        onClick={() => void playLetterName(letter)}
                        disabled={Boolean(playingId)}
                      >
                        {namePlaying ? "…" : "▶"} {copy.playName}
                      </button>
                      <button
                        type="button"
                        onClick={() => void playLetterSound(letter)}
                        disabled={Boolean(playingId) || !letter.sound_audio?.length}
                        title={!letter.sound_audio?.length ? copy.soundMissing : undefined}
                      >
                        {soundPlaying ? "…" : "◉"} {copy.playSound}
                      </button>
                    </div>
                    {!letter.sound_audio?.length ? <small className="alphabet-sound-missing">{copy.soundMissing}</small> : null}
                  </article>
                );
              })}
            </section>
          </main>
        </div>
      ) : null}
    </>
  );
}
