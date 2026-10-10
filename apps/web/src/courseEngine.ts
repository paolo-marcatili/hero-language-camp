import * as language from "@hero-lang/learning-engine";
import * as foundations from "@hero-lang/foundations-engine";

export const getNextQuestion: typeof language.getNextQuestion = (pack, ...args) =>
  (pack.subject === "foundations" ? foundations : language).getNextQuestion(pack, ...args);

export const hasEligibleQuestion: typeof language.hasEligibleQuestion = (pack, ...args) =>
  (pack.subject === "foundations" ? foundations : language).hasEligibleQuestion(pack, ...args);
