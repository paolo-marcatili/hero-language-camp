import { useEffect, useMemo, useState } from "react";
import type { LanguagePack, StoryChapter, StoryMilestone } from "@hero-lang/content-schema";
import { getLocalizedText } from "@hero-lang/content-schema";
import { getLevelConfig, type HeroStatKey, type LearnerState } from "@hero-lang/learning-engine";
import { t } from "../i18n";
import { StudyBook } from "./StudyBook";
import { getStoryChapterProgress, getStoryChapterUnlockLevel } from "../gameConfig";

interface StoryPanelProps {
  pack: LanguagePack;
  state: LearnerState;
  language: string;
  /** Optional adult-help language shown only inside the chapter reader. */
  alternateLanguage?: string;
  alternateLanguageLabel?: string;
}

export function StoryPanel({ pack, state, language, alternateLanguage, alternateLanguageLabel }: StoryPanelProps) {
  const [readerOpen, setReaderOpen] = useState(false);
  const [readerLanguage, setReaderLanguage] = useState(language);
  const story = pack.story;
  const chapterProgress = useMemo(() => getStoryChapterProgress(pack, state.level), [pack, state.level]);
  const availableChapters = chapterProgress.unlockedChapters;
  const currentLevel = getLevelConfig(pack, state.level);
  const currentChapter = chapterProgress.currentChapter;
  const [expandedChapterId, setExpandedChapterId] = useState<string | undefined>(currentChapter?.id);
  useEffect(() => {
    setExpandedChapterId(currentChapter?.id);
  }, [state.level, currentChapter?.id]);

  useEffect(() => {
    if (readerOpen) setReaderLanguage(language);
  }, [readerOpen, language]);

  useEffect(() => {
    if (!readerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setReaderOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [readerOpen]);

  if (!story || !currentChapter) return null;
  const nextMilestone = story.milestones.find((milestone) => !isMilestoneComplete(milestone, state));
  const completedCount = story.milestones.filter((milestone) => isMilestoneComplete(milestone, state)).length;
  const maxLevel = Math.max(0, ...(pack.levels ?? []).map((level) => level.number));
  const storyProgress = story.milestones.length > 0
    ? completedCount / Math.max(1, story.milestones.length)
    : Math.min(1, (state.level + 1) / Math.max(1, maxLevel + 1));

  return (
    <>
      <section className="next-task-panel chapter-summary-card" aria-label={t(language, "currentChapter")}>
        <div className="story-progress-track" aria-label={t(language, "storyProgress")}>
          <div className="story-progress-fill" style={{ width: `${storyProgress * 100}%` }} />
        </div>
        <div className="chapter-summary-copy">
          <span>{t(language, "currentChapter")}</span>
          <strong>{getLocalizedText(currentChapter.title, language, currentChapter.id)}</strong>
          <p>{getLocalizedText(currentChapter.summary, language, getLocalizedText(currentChapter.mission, language, ""))}</p>
          <div className="task-pill">
            {nextMilestone
              ? getLocalizedText(nextMilestone.task_label, language, "")
              : getLocalizedText(currentChapter.mission, language, currentLevel?.title ?? "")}
          </div>
        </div>
        <StudyBook pack={pack} state={state} language={language} />
        <button
          type="button"
          className="chapter-open-button"
          onClick={() => setReaderOpen(true)}
          aria-label={t(language, "openChapterReader")}
          title={t(language, "openChapterReader")}
        >
          <span aria-hidden="true">＋</span>
          <small>{t(language, "readChapter")}</small>
        </button>
      </section>

      {readerOpen ? (
        <div className="story-reader-overlay" role="dialog" aria-modal="true" aria-label={t(language, "chapterReaderTitle")}>
          <div className="story-reader-window">
            <header className="story-reader-header">
              <div>
                <span>{readerLabel(readerLanguage, language, "chapterReaderTitle")}</span>
                <h2>{getLocalizedText(story.title, readerLanguage, readerLabel(readerLanguage, language, "story"))}</h2>
              </div>
              <div className="story-reader-header-actions">
                {alternateLanguage ? (
                  <button
                    type="button"
                    className="story-language-toggle"
                    onClick={() => setReaderLanguage((current) => current === language ? alternateLanguage : language)}
                    aria-label={readerLanguage === language ? (alternateLanguageLabel ?? alternateLanguage.toUpperCase()) : language.toUpperCase()}
                  >
                    {readerLanguage === language ? (alternateLanguageLabel ?? alternateLanguage.toUpperCase()) : language.toUpperCase()}
                  </button>
                ) : null}
                <button type="button" className="story-reader-close" onClick={() => setReaderOpen(false)} aria-label={t(language, "close")}>×</button>
              </div>
            </header>
            <div className="story-reader-intro">{getLocalizedText(story.opening, readerLanguage, "")}</div>
            <div className="story-chapter-list">
              {[...availableChapters].reverse().map((chapter) => {
                const expanded = expandedChapterId === chapter.id;
                const isCurrent = chapter.id === currentChapter.id;
                return (
                  <article key={chapter.id} className={`story-chapter${expanded ? " expanded" : ""}${isCurrent ? " current" : ""}`}>
                    <button
                      type="button"
                      className="story-chapter-toggle"
                      aria-expanded={expanded}
                      onClick={() => setExpandedChapterId(expanded ? undefined : chapter.id)}
                    >
                      <span>{isCurrent
                        ? readerLabel(readerLanguage, language, "currentChapter")
                        : readerLabel(readerLanguage, language, "previousChapter")}</span>
                      <strong>{getLocalizedText(chapter.title, readerLanguage, chapter.id)}</strong>
                      <em aria-hidden="true">{expanded ? "−" : "+"}</em>
                    </button>
                    {expanded ? <ChapterContent chapter={chapter} language={readerLanguage} appLanguage={language} targetLanguage={pack.language.bcp47} pack={pack} /> : null}
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function getLetterStageForChapter(letter: { tags?: string[] }): number {
  const tag = letter.tags?.find((value) => /^stage:\d+$/.test(value));
  return tag ? Number(tag.split(":")[1]) : 0;
}

function ChapterContent({ chapter, language, appLanguage, targetLanguage, pack }: { chapter: StoryChapter; language: string; appLanguage: string; targetLanguage: string; pack: LanguagePack }) {
  const lesson = chapter.lesson;
  const chapterLetters = (pack.letters ?? []).filter((letter) => getLetterStageForChapter(letter) === getStoryChapterUnlockLevel(pack, chapter));
  return (
    <div className="story-chapter-content">
      {chapter.fiction ? (
        <section className="story-fiction-section">
          <div className="story-section-kicker">✦ {readerLabel(language, appLanguage, "chapterStory")}</div>
          {paragraphs(getLocalizedText(chapter.fiction, language, "")).map((paragraph, index) => <p key={`fiction:${index}`}>{paragraph}</p>)}
          {chapter.story_beats?.map((beat, index) => <p key={`story-beat:${index}`}>{getLocalizedText(beat, language, "")}</p>)}
        </section>
      ) : null}
      {lesson ? (
        <section className="story-lesson-section">
          <div className="story-section-kicker">📖 {readerLabel(language, appLanguage, "chapterLesson")}</div>
          <h3>{getLocalizedText(lesson.title, language, "")}</h3>
          {lesson.objectives?.length ? (
            <ul className="story-objective-list">
              {lesson.objectives.map((objective, index) => <li key={`objective:${index}`}>{getLocalizedText(objective, language, "")}</li>)}
            </ul>
          ) : null}
          {paragraphs(getLocalizedText(lesson.explanation, language, "")).map((paragraph, index) => <p key={`lesson:${index}`}>{paragraph}</p>)}
          {lesson.dialogue?.length ? (
            <div className="story-dialogue-list">
              <div className="story-section-kicker">💬 {readerLabel(language, appLanguage, "dialogue")}</div>
              {lesson.dialogue.map((line, index) => (
                <div className="story-dialogue-line" key={`${line.target}:${index}`}>
                  <span>{getLocalizedText(line.speaker, language, readerLabel(language, appLanguage, "speaker"))}</span>
                  <div>
                    <strong lang={targetLanguage}>{line.target}</strong>
                    {line.transliteration ? <em>{line.transliteration}</em> : null}
                    <p>{getLocalizedText(line.translation, language, "")}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {lesson.study_notes?.length ? (
            <div className="story-study-notes">
              <strong>{readerLabel(language, appLanguage, "studyNotes")}</strong>
              <ul>{lesson.study_notes.map((note, index) => <li key={`study-note:${index}`}>{getLocalizedText(note, language, "")}</li>)}</ul>
            </div>
          ) : null}
          {chapterLetters.length ? (
            <div className="story-chapter-letters">
              <strong>{readerLabel(language, appLanguage, "chapterLetters")}</strong>
              <div className="story-letter-strip">
                {chapterLetters.map((letter) => (
                  <span className="story-letter-chip" key={letter.id} lang={targetLanguage} title={getLocalizedText(letter.names, language, letter.character)}>
                    <strong>{letter.uppercase || letter.character}</strong>
                    <small>{letter.lowercase || letter.character}</small>
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {lesson.examples?.length ? (
            <div className="story-example-list">
              {lesson.examples.map((example) => (
                <div key={example.target} className="story-example-card">
                  <strong lang={targetLanguage}>{example.target}</strong>
                  {example.transliteration ? <span>{example.transliteration}</span> : null}
                  <p>{getLocalizedText(example.translation, language, "")}</p>
                  {example.note ? <small>{getLocalizedText(example.note, language, "")}</small> : null}
                </div>
              ))}
            </div>
          ) : null}
          {lesson.common_mistakes?.length ? (
            <div className="story-mistakes-card">
              <strong>{readerLabel(language, appLanguage, "watchOut")}</strong>
              <ul>{lesson.common_mistakes.map((mistake, index) => <li key={`mistake:${index}`}>{getLocalizedText(mistake, language, "")}</li>)}</ul>
            </div>
          ) : null}
        </section>
      ) : chapter.body ? (
        <section>{paragraphs(getLocalizedText(chapter.body, language, "")).map((paragraph, index) => <p key={`body:${index}`}>{paragraph}</p>)}</section>
      ) : null}
      {chapter.mission ? (
        <section className="story-mission-card">
          <div className="story-section-kicker">⚑ {readerLabel(language, appLanguage, "chapterMission")}</div>
          <p>{getLocalizedText(chapter.mission, language, "")}</p>
        </section>
      ) : null}
      {chapter.cliffhanger ? (
        <section className="story-cliffhanger-card">
          <div className="story-section-kicker">✧ {readerLabel(language, appLanguage, "nextClue")}</div>
          <p>{getLocalizedText(chapter.cliffhanger, language, "")}</p>
        </section>
      ) : null}
    </div>
  );
}

const READER_LABELS: Record<string, Record<string, string>> = {
  it: {
    chapterReaderTitle: "Libro dei capitoli",
    story: "Storia",
    currentChapter: "Capitolo attuale",
    previousChapter: "Capitolo precedente",
    chapterStory: "Storia",
    chapterLesson: "Lezione",
    chapterMission: "Missione",
    watchOut: "Attenzione",
    dialogue: "Dialogo",
    speaker: "Voce",
    studyNotes: "Per studiare meglio",
    chapterLetters: "Lettere introdotte in questo capitolo",
    nextClue: "La prossima traccia"
  },
  en: {
    chapterReaderTitle: "Chapter book",
    story: "Story",
    currentChapter: "Current chapter",
    previousChapter: "Previous chapter",
    chapterStory: "Story",
    chapterLesson: "Lesson",
    chapterMission: "Mission",
    watchOut: "Watch out",
    dialogue: "Dialogue",
    speaker: "Speaker",
    studyNotes: "Study notes",
    chapterLetters: "Letters introduced in this chapter",
    nextClue: "The next clue"
  }
};

function readerLabel(displayLanguage: string, appLanguage: string, key: string): string {
  return READER_LABELS[displayLanguage]?.[key] ?? t(appLanguage, key);
}

function paragraphs(value: string): string[] {
  return value.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
}

export function isMilestoneComplete(milestone: StoryMilestone, state: LearnerState): boolean {
  if (milestone.kind === "fight" && milestone.target_enemy_id) return state.defeated_enemies.includes(milestone.target_enemy_id);
  if (milestone.kind === "level" && typeof milestone.target_value === "number") return state.level >= milestone.target_value;
  if (milestone.kind === "coins" && typeof milestone.target_value === "number") return state.coins >= milestone.target_value;
  if (milestone.kind === "shop") return state.inventory.length > 0;
  if (milestone.kind === "train" && milestone.target_stat && typeof milestone.target_value === "number") {
    const statName = milestone.target_stat as HeroStatKey;
    return (state.hero_stats[statName] ?? 0) >= milestone.target_value;
  }
  return false;
}
