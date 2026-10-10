import { useEffect, useState } from "react";
import type { LanguagePack } from "@hero-lang/content-schema";
import { isCorrectAnswer, type LearnerState, type TrainingFocus, type TrainingQuestion } from "@hero-lang/learning-engine";
import { exportProgress, importProgress, placeLearner } from "../../../../packages/learning-engine/src/placement";
import { getNextQuestion, hasEligibleQuestion } from "../courseEngine";
import { QuestionCard } from "./QuestionCard";

const COPY = {
  en: ["Level and progress", "Parent controls: choose a suitable starting point. Coins, equipment and practice history are kept. Placement does not mark skills as mastered.", "Start here", "Quick check (8 questions)", "Save progress", "Open progress backup", "Next", "Finish", "Restore this backup", "Cancel", "Ready to move on", "Practise a little more, or choose a level with a parent.", "Choose a level", "Starting point saved."],
  it: ["Livello e progressi", "Per i genitori: scegli un punto di partenza adatto. Monete, oggetti e storico restano salvati. Il posizionamento non certifica la padronanza.", "Inizia da qui", "Prova rapida (8 domande)", "Salva progressi", "Apri backup dei progressi", "Avanti", "Fine", "Ripristina questo backup", "Annulla", "Pronto per proseguire", "Esercitati ancora, oppure scegli un livello con un genitore.", "Scegli un livello", "Punto di partenza salvato."],
  da: ["Niveau og fremskridt", "Til forældre: vælg et passende startpunkt. Mønter, udstyr og øvehistorik bevares. Placering betyder ikke, at alle færdigheder er mestret.", "Start her", "Kort prøve (8 opgaver)", "Gem fremskridt", "Åbn sikkerhedskopi", "Næste", "Afslut", "Gendan denne kopi", "Annuller", "Klar til næste trin", "Øv lidt mere, eller vælg et niveau sammen med en voksen.", "Vælg et niveau", "Startpunkt gemt."]
};

type Check = { questions: TrainingQuestion[]; index: number; answers: boolean[]; selected?: string };

export function LevelPlacementPanel({ pack, state, language, onPlace }: {
  pack: LanguagePack; state: LearnerState; language: string; onPlace: (state: LearnerState) => void;
}) {
  const c = COPY[language as keyof typeof COPY] ?? COPY.en;
  const incomplete = language === "da" ? "Der mangler opgaver til denne prøve. Vælg et niveau sammen med en voksen."
    : language === "it" ? "Mancano domande per questa prova. Scegli un livello con un genitore."
    : "This check needs more assessment material. Choose a level with a parent.";
  const levels = pack.levels ?? [];
  const defaultTarget = (level: number) => levels.find((entry) => entry.number > level)?.number ?? levels.at(-1)?.number ?? 0;
  const [target, setTarget] = useState(() => defaultTarget(state.level));
  useEffect(() => { setTarget(defaultTarget(state.level)); }, [state.level]);
  const [check, setCheck] = useState<Check | null>(null);
  const [backup, setBackup] = useState<LearnerState | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => { setCheck(null); setBackup(null); setMessage(""); }, [state.hero_name, pack.pack_id]);

  function startCheck() {
    // Check the destination's prerequisites. Two distinct items per learning area.
    const selection = { stage: Math.max(0, target - 1), reviewChance: 0.35 };
    const questions: TrainingQuestion[] = [];
    const seen = new Set<string>();
    for (const focus of ["vocabulary", "comprehension", "grammar", "pronunciation"] as TrainingFocus[]) {
      if (!hasEligibleQuestion(pack, focus, selection)) { setMessage(incomplete); return; }
      let added = 0;
      for (let attempt = 0; attempt < 100 && added < 2; attempt++) {
        let q: TrainingQuestion;
        try { q = getNextQuestion(pack, state, language, focus, selection); }
        catch { setMessage(incomplete); return; }
        const id = `${focus}:${q.grammar?.id ?? q.item?.id ?? q.letter?.id}`;
        if (seen.has(id)) continue;
        seen.add(id); questions.push(q); added++;
      }
      if (added < 2) { setMessage(incomplete); return; }
    }
    setMessage(""); setCheck({ questions, index: 0, answers: [] });
  }

  function save() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(exportProgress(pack, state), null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = `${pack.pack_id}-progress.json`; a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const done = check && check.index >= check.questions.length;
  const passed = Boolean(done && check.answers.filter(Boolean).length >= 7);
  const question = check && !done ? check.questions[check.index] : undefined;
  const correct = question && check?.selected !== undefined ? isCorrectAnswer(question, check.selected) : undefined;
  function nextQuestion() {
    setCheck(value => value && value.selected !== undefined ? { ...value, index: value.index + 1,
      answers: [...value.answers, isCorrectAnswer(value.questions[value.index], value.selected)], selected: undefined } : value);
  }
  function place() {
    try { onPlace(placeLearner(pack, state, target)); setCheck(null); setMessage(c[13]); }
    catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
  }
  return <div className="settings-section placement-panel">
    <h3>{c[0]}</h3><p>{c[1]}</p>
    <label>{c[12]}<select value={target} disabled={Boolean(check && !done)} onChange={(event) => { setTarget(Number(event.target.value)); setCheck(null); setMessage(""); }}>
      {levels.map((level) => <option key={level.number} value={level.number}>
        {[String(level.number), level.cefr?.toUpperCase(), level.title].filter((part): part is string => Boolean(part)).join(" · ")}
      </option>)}
    </select></label>
    {!check ? <div className="settings-row two-cols"><button type="button" onClick={place}>{c[2]}</button><button type="button" onClick={startCheck}>{c[3]}</button></div> : null}
    {question ? <QuestionCard key={question.id} question={question} language={language} mode="training" index={check!.index} total={8} continueOnCorrect disabled={correct !== undefined}
      feedback={correct === undefined ? null : { correct, correctAnswer: question.correct_answer_label, selectedOptionId: check!.selected, correctOptionId: question.correct_option_id }}
      onAnswer={(selected) => setCheck((value) => value ? { ...value, selected } : value)}
      onContinue={nextQuestion} /> : null}
    {done ? <div role="status"><p>{check.answers.filter(Boolean).length}/8 · {passed ? c[10] : c[11]}</p>{passed ? <button type="button" onClick={place}>{c[2]}</button> : null}</div> : null}
    {check ? <button type="button" onClick={() => setCheck(null)}>{c[9]}</button> : null}
    <div className="settings-row two-cols"><button type="button" onClick={save}>{c[4]}</button><label>{c[5]}<input type="file" accept=".json,application/json" onChange={async (event) => {
      const file = event.target.files?.[0]; if (!file) return;
      try { if (file.size > 5_000_000) throw new Error("Backup is too large."); setBackup(importProgress(pack, JSON.parse(await file.text()))); setMessage(""); }
      catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
      event.target.value = "";
    }} /></label></div>
    {backup ? <div><p>{backup.hero_name} · {backup.level} · {backup.coins} 🪙</p><button type="button" onClick={() => { onPlace(backup); setBackup(null); }}>{c[8]}</button><button type="button" onClick={() => setBackup(null)}>{c[9]}</button></div> : null}
    {message ? <p role="status">{message}</p> : null}
  </div>;
}
