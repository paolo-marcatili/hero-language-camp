import { getLocalizedText, type LanguagePack } from "@hero-lang/content-schema";
import type { LearnerState, PracticeMemory } from "@hero-lang/learning-engine";

type Props = {
  pack: LanguagePack;
  state: LearnerState;
  language: string;
  onClose: () => void;
};

type MemoryEntry = {
  id: string;
  label: string;
  memory?: PracticeMemory;
};

type CategoryMetric = {
  id: string;
  icon: string;
  label: string;
  entries: MemoryEntry[];
  total: number;
  attempted: number;
  mastered: number;
  mastery: number;
  correct: number;
  wrong: number;
};

export function ParentProgressPanel({ pack, state, language, onClose }: Props) {
  const copy = progressCopy(language);
  const categories = buildCategories(pack, state, language, copy);
  const allEntries = categories.flatMap((category) => category.entries.map((entry) => ({ ...entry, categoryId: category.id })));
  const totalCorrect = categories.reduce((sum, category) => sum + category.correct, 0);
  const totalWrong = categories.reduce((sum, category) => sum + category.wrong, 0);
  const accuracy = totalCorrect + totalWrong > 0 ? Math.round((totalCorrect / (totalCorrect + totalWrong)) * 100) : 0;
  const overallMastery = Math.round(average(categories.map((category) => category.mastery)) * 100);
  const introduced = categories.reduce((sum, category) => sum + category.total, 0);
  const attempted = categories.reduce((sum, category) => sum + category.attempted, 0);
  const masteredCount = categories.reduce((sum, category) => sum + category.mastered, 0);
  const reviewDue = allEntries.filter((entry) => isReviewDue(entry.memory)).length;
  const commonMistakes = allEntries
    .filter((entry) => (entry.memory?.wrong_count ?? 0) > 0)
    .sort((left, right) => (right.memory?.wrong_count ?? 0) - (left.memory?.wrong_count ?? 0) || (left.memory?.mastery ?? 0) - (right.memory?.mastery ?? 0))
    .slice(0, 8);
  const ranked = categories.filter((category) => category.attempted > 0).sort((left, right) => right.mastery - left.mastery);
  const strength = ranked[0];
  const support = ranked[ranked.length - 1];
  const levelSessions = state.completed_training_sessions_by_level?.[String(state.level)] ?? {};
  const activityRows = pack.subject === "foundations"
    ? [
        { icon: "🔤", label: copy.letters, value: levelSessions.vocabulary ?? 0 },
        { icon: "📖", label: copy.reading, value: levelSessions.comprehension ?? 0 },
        { icon: "🧮", label: copy.math, value: (levelSessions.grammar ?? 0) + (levelSessions.pronunciation ?? 0) }
      ]
    : [
        { icon: "🧩", label: copy.vocabulary, value: levelSessions.vocabulary ?? 0 },
        { icon: "👂", label: copy.comprehension, value: levelSessions.comprehension ?? 0 },
        { icon: "🗣️", label: copy.pronunciation, value: levelSessions.pronunciation ?? 0 },
        { icon: "📘", label: copy.grammar, value: levelSessions.grammar ?? 0 }
      ];

  return (
    <section className="parent-progress-panel parent-dashboard" role="dialog" aria-modal="true" aria-label={copy.title}>
      <header className="parent-progress-header parent-dashboard-header">
        <div><span className="eyebrow">{copy.parentArea}</span><h2>{copy.title}</h2></div>
        <button type="button" className="panel-close-button" onClick={onClose} aria-label={copy.close}>✕</button>
      </header>
      <p className="parent-progress-intro">{copy.intro}</p>
      <div className="parent-kpi-grid">
        <Kpi label={copy.mastery} value={`${overallMastery}%`} detail={`${masteredCount}/${introduced} ${copy.mastered}`} />
        <Kpi label={copy.accuracy} value={`${accuracy}%`} detail={`${totalCorrect + totalWrong} ${copy.answers}`} />
        <Kpi label={copy.introduced} value={String(introduced)} detail={`${attempted} ${copy.attempted}`} />
        <Kpi label={copy.reviewDue} value={String(reviewDue)} detail={copy.reviewDetail} />
      </div>
      <div className="parent-dashboard-two-column">
        <section className="parent-progress-section parent-radar-card">
          <div className="parent-section-heading"><h3>{copy.strengthProfile}</h3><span>{copy.masteryScale}</span></div>
          <RadarChart categories={categories} label={copy.strengthProfile} />
          <div className="radar-legend">
            {categories.map((category) => <span key={category.id}><i className={`radar-dot radar-dot-${category.id}`} />{category.label}: {Math.round(category.mastery * 100)}%</span>)}
          </div>
        </section>
        <section className="parent-progress-section">
          <div className="parent-section-heading"><h3>{copy.learningAreas}</h3><span>{copy.coverageAndMastery}</span></div>
          <div className="parent-area-list">
            {categories.map((category) => (
              <article key={category.id} className="parent-area-row">
                <div><strong>{category.icon} {category.label}</strong><span>{category.attempted}/{category.total} {copy.attempted}</span></div>
                <div className="parent-dual-meter" aria-label={`${category.label} ${Math.round(category.mastery * 100)}%`}>
                  <i className="coverage" style={{ width: `${category.total ? (category.attempted / category.total) * 100 : 0}%` }} />
                  <b style={{ width: `${category.mastery * 100}%` }} />
                </div>
                <strong>{Math.round(category.mastery * 100)}%</strong>
              </article>
            ))}
          </div>
        </section>
      </div>
      <section className="parent-progress-section">
        <div className="parent-section-heading"><h3>{copy.currentChapterActivity}</h3><span>{copy.sessions}</span></div>
        <div className="parent-session-bars">
          {activityRows.map((row) => <SessionBar key={row.label} icon={row.icon} label={row.label} value={row.value} />)}
        </div>
      </section>
      <div className="parent-dashboard-two-column">
        <section className="parent-progress-section">
          <h3>{copy.commonMistakes}</h3>
          {commonMistakes.length ? (
            <ol className="parent-mistake-list">
              {commonMistakes.map((entry) => {
                const attemptsForItem = (entry.memory?.correct_count ?? 0) + (entry.memory?.wrong_count ?? 0);
                const itemAccuracy = attemptsForItem ? Math.round(((entry.memory?.correct_count ?? 0) / attemptsForItem) * 100) : 0;
                return <li key={`${entry.categoryId}:${entry.id}`}><strong>{entry.label}</strong><span>{entry.memory?.wrong_count ?? 0} {copy.errors} · {itemAccuracy}% {copy.accuracy.toLowerCase()}</span></li>;
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

function RadarChart({ categories, label }: { categories: CategoryMetric[]; label: string }) {
  const center = 120;
  const radius = 82;
  const angles = categories.map((_, index) => -Math.PI / 2 + index * (Math.PI * 2 / categories.length));
  const point = (angle: number, scale: number) => `${center + Math.cos(angle) * radius * scale},${center + Math.sin(angle) * radius * scale}`;
  const dataPoints = categories.map((category, index) => point(angles[index], Math.max(0.04, category.mastery))).join(" ");
  return (
    <svg className="parent-radar" viewBox="0 0 240 240" role="img" aria-label={label}>
      {[0.25, 0.5, 0.75, 1].map((scale) => <polygon key={scale} points={angles.map((angle) => point(angle, scale)).join(" ")} className="radar-ring" />)}
      {angles.map((angle, index) => <line key={categories[index].id} x1={center} y1={center} x2={center + Math.cos(angle) * radius} y2={center + Math.sin(angle) * radius} className="radar-axis" />)}
      <polygon points={dataPoints} className="radar-data" />
      {categories.map((category, index) => {
        const x = center + Math.cos(angles[index]) * (radius + 24);
        const y = center + Math.sin(angles[index]) * (radius + 17);
        return <text key={category.id} x={x} y={y} textAnchor="middle" className="radar-label">{category.icon}</text>;
      })}
    </svg>
  );
}

function buildCategories(pack: LanguagePack, state: LearnerState, language: string, copy: ReturnType<typeof progressCopy>): CategoryMetric[] {
  const letters = (pack.letters ?? [])
    .filter((entry) => stageOf(entry.tags ?? []) <= state.level)
    .map((entry) => ({ id: entry.id, label: `${entry.uppercase ?? entry.character} ${entry.lowercase ?? entry.character}`, memory: state.mastery_by_letter[entry.id] }));
  const words = pack.items
    .filter((entry) => stageOf(entry.tags) <= state.level)
    .map((entry) => ({ id: entry.id, label: entry.target, memory: state.mastery_by_item[entry.id] }));

  if (pack.subject === "foundations") {
    const reading = (pack.reading_problems ?? [])
      .filter((entry) => stageOf(entry.tags) <= state.level)
      .map((entry) => ({ id: entry.id, label: entry.text, memory: state.mastery_by_grammar[entry.id] }));
    const math = (pack.math_problems ?? [])
      .filter((entry) => stageOf(entry.tags) <= state.level)
      .map((entry) => ({ id: entry.id, label: getLocalizedText(entry.prompt, language, entry.id), memory: state.mastery_by_grammar[entry.id] }));
    return [
      category("letters", "🔤", copy.letters, letters),
      category("words", "📖", copy.words, words),
      category("reading", "📝", copy.reading, reading),
      category("math", "🧮", copy.math, math)
    ];
  }

  const grammar = (pack.grammar_items ?? [])
    .filter((entry) => stageOf(entry.tags) <= state.level)
    .map((entry) => ({ id: entry.id, label: entry.target_sentence, memory: state.mastery_by_grammar[entry.id] }));
  return [
    category("alphabet", "🔤", copy.alphabet, letters),
    category("vocabulary", "🧩", copy.vocabulary, words),
    category("grammar", "📘", copy.grammar, grammar)
  ];
}

function category(id: string, icon: string, label: string, entries: MemoryEntry[]): CategoryMetric {
  const attemptedEntries = entries.filter((entry) => (entry.memory?.seen_count ?? 0) > 0);
  return {
    id,
    icon,
    label,
    entries,
    total: entries.length,
    attempted: attemptedEntries.length,
    mastered: entries.filter((entry) => mastered(entry.memory)).length,
    mastery: average(attemptedEntries.map((entry) => entry.memory?.mastery ?? 0)),
    correct: entries.reduce((sum, entry) => sum + (entry.memory?.correct_count ?? 0), 0),
    wrong: entries.reduce((sum, entry) => sum + (entry.memory?.wrong_count ?? 0), 0)
  };
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

function progressCopy(language: string) {
  if (language.startsWith("it")) return {
    title: "Progressi del bambino", parentArea: "Area genitori", close: "Chiudi", intro: "Una panoramica leggibile dei progressi, dei punti di forza e di ciò che conviene ripassare insieme.", mastery: "Padronanza", accuracy: "Precisione", introduced: "Contenuti introdotti", reviewDue: "Da ripassare", mastered: "padroneggiati", answers: "risposte", attempted: "esercitati", reviewDetail: "elementi che richiedono attenzione", strengthProfile: "Punti di forza e debolezza", masteryScale: "Padronanza per area", learningAreas: "Aree di apprendimento", coverageAndMastery: "Copertura e padronanza", currentChapterActivity: "Attività nel capitolo attuale", sessions: "sessioni", commonMistakes: "Errori più frequenti", errors: "errori", noMistakes: "Non ci sono ancora errori ricorrenti.", howToHelp: "Come sostenere l'apprendimento", strength: "Punto di forza", focusNext: "Prossimo obiettivo", practiceSuggestion: "brevi esercizi frequenti e un ripasso ad alta voce possono aiutare.", notEnoughData: "Servono ancora alcune sessioni per individuare un andamento.", dataNote: "Le statistiche restano sul dispositivo e descrivono solo le attività svolte nell'app.", letters: "Lettere", words: "Parole", reading: "Lettura", math: "Matematica", alphabet: "Alfabeto", vocabulary: "Vocabolario", grammar: "Grammatica", comprehension: "Comprensione", pronunciation: "Pronuncia" };
  if (language.startsWith("da")) return {
    title: "Barnets fremskridt", parentArea: "Forældreområde", close: "Luk", intro: "Et tydeligt overblik over fremskridt, styrker og det, I med fordel kan øve sammen.", mastery: "Mestring", accuracy: "Præcision", introduced: "Introduceret", reviewDue: "Klar til repetition", mastered: "mestret", answers: "svar", attempted: "øvet", reviewDetail: "emner der kræver opmærksomhed", strengthProfile: "Styrker og udfordringer", masteryScale: "Mestring efter område", learningAreas: "Læringsområder", coverageAndMastery: "Dækning og mestring", currentChapterActivity: "Aktivitet i dette kapitel", sessions: "sessioner", commonMistakes: "Hyppige fejl", errors: "fejl", noMistakes: "Der er endnu ingen tydelige gentagne fejl.", howToHelp: "Sådan kan I hjælpe", strength: "Styrke", focusNext: "Næste fokus", practiceSuggestion: "korte, hyppige øvelser og højtlæsning kan hjælpe.", notEnoughData: "Der skal lidt flere sessioner til for at se et mønster.", dataNote: "Statistikken bliver på enheden og beskriver kun aktiviteter i appen.", letters: "Bogstaver", words: "Ord", reading: "Læsning", math: "Matematik", alphabet: "Alfabet", vocabulary: "Ordforråd", grammar: "Grammatik", comprehension: "Forståelse", pronunciation: "Udtale" };
  return {
    title: "Child progress", parentArea: "Parent area", close: "Close", intro: "A clear overview of progress, strengths, and the areas worth practising together.", mastery: "Mastery", accuracy: "Accuracy", introduced: "Introduced", reviewDue: "Due for review", mastered: "mastered", answers: "answers", attempted: "practised", reviewDetail: "items needing attention", strengthProfile: "Strengths and weaknesses", masteryScale: "Mastery by area", learningAreas: "Learning areas", coverageAndMastery: "Coverage and mastery", currentChapterActivity: "Current chapter activity", sessions: "sessions", commonMistakes: "Common mistakes", errors: "errors", noMistakes: "No repeated mistake pattern is visible yet.", howToHelp: "How to support learning", strength: "Strength", focusNext: "Focus next", practiceSuggestion: "short, frequent practice and reading aloud can help.", notEnoughData: "A few more sessions are needed to identify a pattern.", dataNote: "These statistics remain on this device and describe only work completed in the app.", letters: "Letters", words: "Words", reading: "Reading", math: "Mathematics", alphabet: "Alphabet", vocabulary: "Vocabulary", grammar: "Grammar", comprehension: "Comprehension", pronunciation: "Pronunciation" };
}
