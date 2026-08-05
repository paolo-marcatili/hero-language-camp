// LEARNING_APP_RELEASE_AB_2026_08: parent learning dashboard
import type { LanguagePack } from "@hero-lang/content-schema";
import type { LearnerState, PracticeMemory } from "@hero-lang/foundations-engine";

import { t } from "../../../web/src/i18n";

interface Props {
  pack: LanguagePack;
  state: LearnerState;
  language: string;
  onClose: () => void;
}

interface CategoryMetric {
  id: string;
  icon: string;
  label: string;
  total: number;
  attempted: number;
  mastered: number;
  mastery: number;
  correct: number;
  wrong: number;
}

export function ParentProgressPanel({ pack, state, language, onClose }: Props) {
  const copy = parentCopy(language);
  const introducedLetters = (pack.letters ?? []).filter((entry) => stageOf(entry.tags ?? []) <= state.level);
  const introducedWords = pack.items.filter((entry) => stageOf(entry.tags) <= state.level);
  const introducedReading = (pack.reading_problems ?? []).filter((entry) => stageOf(entry.tags) <= state.level);
  const introducedMath = (pack.math_problems ?? []).filter((entry) => stageOf(entry.tags) <= state.level);
  const levelSessions = state.completed_training_sessions_by_level?.[String(state.level)] ?? {};

  const categories: CategoryMetric[] = [
    category("letters", "🔤", t(language, "progressLetters"), introducedLetters.map((entry) => state.mastery_by_letter[entry.id])),
    category("words", "📖", t(language, "progressWords"), introducedWords.map((entry) => state.mastery_by_item[entry.id])),
    category("reading", "📝", t(language, "progressReading"), introducedReading.map((entry) => state.mastery_by_grammar[entry.id])),
    category("math", "🧮", t(language, "progressMath"), introducedMath.map((entry) => state.mastery_by_grammar[entry.id]))
  ];

  const allMemories = categories.flatMap((entry) => memoriesForCategory(entry.id, pack, state));
  const totalCorrect = categories.reduce((sum, entry) => sum + entry.correct, 0);
  const totalWrong = categories.reduce((sum, entry) => sum + entry.wrong, 0);
  const accuracy = totalCorrect + totalWrong > 0 ? Math.round((totalCorrect / (totalCorrect + totalWrong)) * 100) : 0;
  const overallMastery = Math.round(average(categories.map((entry) => entry.mastery)) * 100);
  const introduced = categories.reduce((sum, entry) => sum + entry.total, 0);
  const masteredCount = categories.reduce((sum, entry) => sum + entry.mastered, 0);
  const reviewDue = allMemories.filter((entry) => isReviewDue(entry.memory)).length;
  const commonMistakes = allMemories
    .filter((entry) => (entry.memory?.wrong_count ?? 0) > 0)
    .sort((a, b) => (b.memory?.wrong_count ?? 0) - (a.memory?.wrong_count ?? 0) || (a.memory?.mastery ?? 0) - (b.memory?.mastery ?? 0))
    .slice(0, 8);
  const ranked = [...categories].filter((entry) => entry.attempted > 0).sort((a, b) => b.mastery - a.mastery);
  const strength = ranked[0];
  const support = ranked[ranked.length - 1];

  return (
    <section className="parent-progress-panel parent-dashboard" role="dialog" aria-modal="true" aria-label={t(language, "parentProgress")}>
      <header className="parent-progress-header parent-dashboard-header">
        <div><span className="eyebrow">{t(language, "parentArea")}</span><h2>{t(language, "parentProgress")}</h2></div>
        <button type="button" className="panel-close-button" onClick={onClose} aria-label={t(language, "close")}>✕</button>
      </header>

      <p className="parent-progress-intro">{copy.intro}</p>

      <div className="parent-kpi-grid">
        <Kpi label={copy.mastery} value={`${overallMastery}%`} detail={`${masteredCount}/${introduced} ${copy.mastered}`} />
        <Kpi label={copy.accuracy} value={`${accuracy}%`} detail={`${totalCorrect + totalWrong} ${copy.answers}`} />
        <Kpi label={copy.introduced} value={String(introduced)} detail={`${categories.reduce((sum, entry) => sum + entry.attempted, 0)} ${copy.attempted}`} />
        <Kpi label={copy.reviewDue} value={String(reviewDue)} detail={copy.reviewDetail} />
      </div>

      <div className="parent-dashboard-two-column">
        <section className="parent-progress-section parent-radar-card">
          <div className="parent-section-heading"><h3>{copy.strengthProfile}</h3><span>{copy.masteryScale}</span></div>
          <RadarChart categories={categories} />
          <div className="radar-legend">
            {categories.map((entry) => <span key={entry.id}><i className={`radar-dot radar-dot-${entry.id}`} />{entry.label}: {Math.round(entry.mastery * 100)}%</span>)}
          </div>
        </section>

        <section className="parent-progress-section">
          <div className="parent-section-heading"><h3>{copy.learningAreas}</h3><span>{copy.coverageAndMastery}</span></div>
          <div className="parent-area-list">
            {categories.map((entry) => (
              <article key={entry.id} className="parent-area-row">
                <div><strong>{entry.icon} {entry.label}</strong><span>{entry.attempted}/{entry.total} {copy.attempted}</span></div>
                <div className="parent-dual-meter" aria-label={`${entry.label} ${Math.round(entry.mastery * 100)}%`}>
                  <i className="coverage" style={{ width: `${entry.total ? (entry.attempted / entry.total) * 100 : 0}%` }} />
                  <b style={{ width: `${entry.mastery * 100}%` }} />
                </div>
                <strong>{Math.round(entry.mastery * 100)}%</strong>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="parent-progress-section">
        <div className="parent-section-heading"><h3>{t(language, "currentChapterActivity")}</h3><span>{copy.sessions}</span></div>
        <div className="parent-session-bars">
          <SessionBar icon="🔤" label={t(language, "progressLetters")} value={levelSessions.vocabulary ?? 0} />
          <SessionBar icon="📖" label={copy.readingPractice} value={levelSessions.comprehension ?? 0} />
          <SessionBar icon="🧮" label={copy.mathPractice} value={(levelSessions.grammar ?? 0) + (levelSessions.pronunciation ?? 0)} />
        </div>
      </section>

      <div className="parent-dashboard-two-column">
        <section className="parent-progress-section">
          <h3>{copy.commonMistakes}</h3>
          {commonMistakes.length ? (
            <ol className="parent-mistake-list">
              {commonMistakes.map((entry) => {
                const attempts = (entry.memory?.correct_count ?? 0) + (entry.memory?.wrong_count ?? 0);
                const itemAccuracy = attempts ? Math.round(((entry.memory?.correct_count ?? 0) / attempts) * 100) : 0;
                return <li key={entry.id}><strong>{entry.label}</strong><span>{entry.memory?.wrong_count ?? 0} {copy.errors} · {itemAccuracy}% {copy.accuracy.toLowerCase()}</span></li>;
              })}
            </ol>
          ) : <p className="parent-empty-state">{copy.noMistakes}</p>}
        </section>

        <section className="parent-progress-section parent-support-card">
          <h3>{copy.howToHelp}</h3>
          <div className="parent-insight good"><span>✨</span><div><strong>{copy.strength}</strong><p>{strength ? `${strength.label}: ${Math.round(strength.mastery * 100)}%` : copy.notEnoughData}</p></div></div>
          <div className="parent-insight focus"><span>🎯</span><div><strong>{copy.focusNext}</strong><p>{support ? `${support.label}: ${copy.practiceSuggestion}` : copy.notEnoughData}</p></div></div>
          <p className="parent-data-note">{copy.dataNote}</p>
        </section>
      </div>
    </section>
  );
}

function Kpi({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="parent-kpi"><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function SessionBar({ icon, label, value }: { icon: string; label: string; value: number }) {
  const width = Math.min(100, value * 20);
  return <div className="parent-session-bar"><span>{icon} {label}</span><div><i style={{ width: `${width}%` }} /></div><strong>{value}</strong></div>;
}

function RadarChart({ categories }: { categories: CategoryMetric[] }) {
  const center = 120;
  const radius = 82;
  const angles = categories.map((_, index) => -Math.PI / 2 + index * (Math.PI * 2 / categories.length));
  const point = (angle: number, scale: number) => `${center + Math.cos(angle) * radius * scale},${center + Math.sin(angle) * radius * scale}`;
  const rings = [0.25, 0.5, 0.75, 1];
  const dataPoints = categories.map((entry, index) => point(angles[index], Math.max(0.04, entry.mastery))).join(" ");
  return (
    <svg className="parent-radar" viewBox="0 0 240 240" role="img" aria-label="Learning strengths radar chart">
      {rings.map((scale) => <polygon key={scale} points={angles.map((angle) => point(angle, scale)).join(" ")} className="radar-ring" />)}
      {angles.map((angle, index) => <line key={categories[index].id} x1={center} y1={center} x2={center + Math.cos(angle) * radius} y2={center + Math.sin(angle) * radius} className="radar-axis" />)}
      <polygon points={dataPoints} className="radar-data" />
      {categories.map((entry, index) => {
        const x = center + Math.cos(angles[index]) * (radius + 24);
        const y = center + Math.sin(angles[index]) * (radius + 17);
        return <text key={entry.id} x={x} y={y} textAnchor="middle" className="radar-label">{entry.icon}</text>;
      })}
    </svg>
  );
}

function category(id: string, icon: string, label: string, memories: Array<PracticeMemory | undefined>): CategoryMetric {
  const defined = memories.filter((entry): entry is PracticeMemory => Boolean(entry));
  const attempted = defined.filter((entry) => entry.seen_count > 0);
  return {
    id,
    icon,
    label,
    total: memories.length,
    attempted: attempted.length,
    mastered: defined.filter(mastered).length,
    mastery: average(attempted.map((entry) => entry.mastery)),
    correct: defined.reduce((sum, entry) => sum + entry.correct_count, 0),
    wrong: defined.reduce((sum, entry) => sum + entry.wrong_count, 0)
  };
}

function memoriesForCategory(id: string, pack: LanguagePack, state: LearnerState): Array<{ id: string; label: string; memory?: PracticeMemory }> {
  if (id === "letters") return (pack.letters ?? []).filter((entry) => stageOf(entry.tags ?? []) <= state.level).map((entry) => ({ id: entry.id, label: `${entry.uppercase ?? entry.character} ${entry.lowercase ?? entry.character}`, memory: state.mastery_by_letter[entry.id] }));
  if (id === "words") return pack.items.filter((entry) => stageOf(entry.tags) <= state.level).map((entry) => ({ id: entry.id, label: entry.target, memory: state.mastery_by_item[entry.id] }));
  if (id === "reading") return (pack.reading_problems ?? []).filter((entry) => stageOf(entry.tags) <= state.level).map((entry) => ({ id: entry.id, label: entry.text, memory: state.mastery_by_grammar[entry.id] }));
  return (pack.math_problems ?? []).filter((entry) => stageOf(entry.tags) <= state.level).map((entry) => ({ id: entry.id, label: String((entry as { text?: string }).text ?? entry.id), memory: state.mastery_by_grammar[entry.id] }));
}

function mastered(memory: PracticeMemory | undefined): boolean {
  return (memory?.mastery ?? 0) >= 0.72;
}

function isReviewDue(memory: PracticeMemory | undefined): boolean {
  if (!memory || memory.seen_count === 0) return false;
  if (memory.last_was_wrong || memory.mastery < 0.55) return true;
  return Boolean(memory.next_review_at && new Date(memory.next_review_at).getTime() <= Date.now());
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function stageOf(tags: string[]): number {
  const tag = tags.find((value) => value.startsWith("stage:"));
  return tag ? Number(tag.slice(6)) || 0 : 0;
}

function parentCopy(language: string) {
  if (language.startsWith("it")) return {
    intro: "Una panoramica leggibile dei progressi, delle aree forti e di ciò che conviene ripassare insieme.", mastery: "Padronanza", accuracy: "Precisione", introduced: "Contenuti introdotti", reviewDue: "Da ripassare", mastered: "padroneggiati", answers: "risposte", attempted: "esercitati", reviewDetail: "elementi che richiedono attenzione", strengthProfile: "Punti di forza e debolezza", masteryScale: "Padronanza per area", learningAreas: "Aree di apprendimento", coverageAndMastery: "Copertura e padronanza", sessions: "sessioni in questo capitolo", readingPractice: "Lettura e comprensione", mathPractice: "Matematica", commonMistakes: "Errori più frequenti", errors: "errori", noMistakes: "Non ci sono ancora errori ricorrenti.", howToHelp: "Come sostenere l'apprendimento", strength: "Punto di forza", focusNext: "Prossimo obiettivo", practiceSuggestion: "brevi esercizi frequenti e un ripasso ad alta voce possono aiutare.", notEnoughData: "Servono ancora alcune sessioni per individuare un andamento.", dataNote: "Le statistiche restano sul dispositivo e descrivono solo le attività svolte nell'app." };
  if (language.startsWith("da")) return {
    intro: "Et tydeligt overblik over fremskridt, styrker og det, I med fordel kan øve sammen.", mastery: "Mestring", accuracy: "Præcision", introduced: "Introduceret", reviewDue: "Klar til repetition", mastered: "mestret", answers: "svar", attempted: "øvet", reviewDetail: "emner der kræver opmærksomhed", strengthProfile: "Styrker og udfordringer", masteryScale: "Mestring efter område", learningAreas: "Læringsområder", coverageAndMastery: "Dækning og mestring", sessions: "sessioner i dette kapitel", readingPractice: "Læsning og forståelse", mathPractice: "Matematik", commonMistakes: "Hyppige fejl", errors: "fejl", noMistakes: "Der er endnu ingen tydelige gentagne fejl.", howToHelp: "Sådan kan I hjælpe", strength: "Styrke", focusNext: "Næste fokus", practiceSuggestion: "korte, hyppige øvelser og højtlæsning kan hjælpe.", notEnoughData: "Der skal lidt flere sessioner til for at se et mønster.", dataNote: "Statistikken bliver på enheden og beskriver kun aktiviteter i appen." };
  return {
    intro: "A clear overview of progress, strengths, and the areas worth practising together.", mastery: "Mastery", accuracy: "Accuracy", introduced: "Introduced", reviewDue: "Due for review", mastered: "mastered", answers: "answers", attempted: "practised", reviewDetail: "items needing attention", strengthProfile: "Strengths and weaknesses", masteryScale: "Mastery by area", learningAreas: "Learning areas", coverageAndMastery: "Coverage and mastery", sessions: "sessions in this chapter", readingPractice: "Reading and comprehension", mathPractice: "Mathematics", commonMistakes: "Common mistakes", errors: "errors", noMistakes: "No repeated mistake pattern is visible yet.", howToHelp: "How to support learning", strength: "Strength", focusNext: "Focus next", practiceSuggestion: "short, frequent practice and reading aloud can help.", notEnoughData: "A few more sessions are needed to identify a pattern.", dataNote: "These statistics remain on this device and describe only work completed in the app." };
}
