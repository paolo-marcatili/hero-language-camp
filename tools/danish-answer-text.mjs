import { createHash } from "node:crypto";

// MUST mirror mathQuestion() in packages/foundations-engine/src/index.ts (answerAudioText, numberWord).
// tools/tests/audio-pipeline.test.mjs compares both for every math problem.
const NUMBER_WORDS = ["nul", "en", "to", "tre", "fire", "fem", "seks", "syv", "otte", "ni", "ti", "elleve", "tolv", "tretten", "fjorten", "femten", "seksten", "sytten", "atten", "nitten", "tyve"];
const AWARENESS_DOMAINS = ["shape", "pattern", "sorting", "measurement", "place_value", "data"];

export function numberWord(value) { return NUMBER_WORDS[value] ?? String(value); }

export function mathAnswerAudioText(problem) {
  const result = Number(problem.result);
  const operands = (problem.operands ?? []).map(Number);
  let text = `Det rigtige svar er ${numberWord(result)}.`;
  if (problem.domain === "counting") {
    text = result === 1 ? "Der er en." : `Der er ${numberWord(result)}.`;
  } else if (problem.domain === "number_match" || problem.domain === "number_order") {
    // default sentence
  } else if (problem.domain === "comparison") {
    text = result > 0 ? "Der er flest til venstre." : result < 0 ? "Der er flest til højre." : "Der er lige mange.";
  } else if (AWARENESS_DOMAINS.includes(problem.domain)) {
    text = "Se det rigtige svar på skærmen.";
  } else if (problem.domain === "multiplication" || problem.domain === "division") {
    // default sentence
  } else if (problem.domain === "number_bond") {
    const known = operands[0] ?? 0;
    const whole = problem.whole ?? known + result;
    text = `${numberWord(known)} og ${numberWord(result)} bliver ${numberWord(whole)}.`;
  } else if (problem.domain === "story_problem") {
    const left = operands[0] ?? 0, right = operands[1] ?? 0;
    const operation = problem.operation ?? (left - right === result ? "subtraction" : "addition");
    text = operation === "addition"
      ? `${numberWord(left)} plus ${numberWord(right)} er ${numberWord(result)}.`
      : `${numberWord(left)} minus ${numberWord(right)} er ${numberWord(result)}.`;
  } else {
    const left = operands[0] ?? 0, right = operands[1] ?? 0;
    text = problem.domain === "addition"
      ? `${numberWord(left)} plus ${numberWord(right)} er ${numberWord(result)}.`
      : `${numberWord(left)} minus ${numberWord(right)} er ${numberWord(result)}.`;
  }
  return text;
}

// One recording per distinct sentence. ASCII-only name: no Unicode-normalisation hazards.
export function answerAudioId(text) {
  return `answer-${createHash("sha1").update(text.normalize("NFC")).digest("hex").slice(0, 12)}`;
}
